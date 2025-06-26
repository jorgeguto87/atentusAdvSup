// server.js reescrito para Supabase + multiusuário com armazenamento separado

const https = require('https');
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const cron = require('node-cron');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = 5030;

const supabase = createClient('https://asoxpubkhrqoumcdizcp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzb3hwdWJraHJxb3VtY2RpemNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4OTI3ODQsImV4cCI6MjA2NjQ2ODc4NH0.-RUTRABZMLa4HBWpu_20rILzbMxdZj3Kn6Jkmh5b7Zw');
const bucket = 'anuncios';

const credentials = {
  key: fs.readFileSync('/etc/letsencrypt/live/atentus.com.br/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/atentus.com.br/fullchain.pem')
};

app.use(cors({ origin: 'https://atentus.com.br', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const upload = multer({ storage: multer.memoryStorage() });

let clients = {}; // clientes WhatsApp por userId
let qrCodes = {}; // qrcodes por userId
let estadosConexao = {}; // status conectado por userId

function criarClient(userId) {
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: userId }),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
  });

  client.on('qr', async qr => {
    qrCodes[userId] = await qrcode.toDataURL(qr);
    estadosConexao[userId] = false;
  });

  client.on('ready', () => {
    estadosConexao[userId] = true;
    agendarEnvios(userId);
  });

  client.on('disconnected', () => {
    estadosConexao[userId] = false;
  });

  client.initialize();
  clients[userId] = client;
}

function agendarEnvios(userId) {
  cron.schedule('0 * * * *', async () => {
    const client = clients[userId];
    if (!client || !estadosConexao[userId]) return;

    const agora = new Date();
    const hora = agora.getHours();
    const dia = ((hora >= 0 && hora <= 1) ? (agora.getDay() + 6) % 7 : agora.getDay());
    if (dia === 0) return;

    const dias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    const nomeDia = dias[dia];

    const horariosRes = await supabase.from('horarios').select('hora').eq('user_id', userId);
    const horarios = horariosRes.data?.map(h => (h.hora + 3) % 24) || [];
    if (!horarios.includes(hora)) return;

    const msgRes = await supabase.from('mensagens').select('texto').eq('user_id', userId).eq('dia_semana', nomeDia);
    const texto = msgRes.data?.[0]?.texto;
    if (!texto) return;

    const exts = ['jpg', 'png'];
    let urlImagem = '';
    for (const ext of exts) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(`${userId}/${nomeDia}.${ext}`);
      if (data?.publicUrl) {
        urlImagem = data.publicUrl;
        break;
      }
    }
    if (!urlImagem) return;

    const gruposRes = await supabase.from('grupos_check').select('id').eq('user_id', userId);
    const grupos = gruposRes.data?.map(g => g.id) || [];

    const media = await MessageMedia.fromUrl(urlImagem);
    for (const grupoId of grupos) {
      await client.sendMessage(grupoId, media, { caption: texto });
      await new Promise(r => setTimeout(r, 2000));
    }
  });
}

// ROTAS =========================================================================================

app.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error || !data.session) return res.status(401).json({ sucesso: false, mensagem: 'Login inválido' });
  res.json({ sucesso: true, userId: data.user.id, token: data.session.access_token });
});

app.post('/iniciar', async (req, res) => {
  const { userId } = req.body;
  if (!clients[userId]) criarClient(userId);
  res.json({ iniciado: true });
});

app.get('/status/:userId', (req, res) => {
  const { userId } = req.params;
  res.json({ conectado: !!estadosConexao[userId], qr: estadosConexao[userId] ? null : qrCodes[userId] });
});

app.post('/upload', upload.single('arquivo'), async (req, res) => {
  const { diaSemana, userId } = req.body;
  const ext = path.extname(req.file.originalname);
  const nomeFinal = `${userId}/${diaSemana}${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(nomeFinal, req.file.buffer, {
    contentType: req.file.mimetype,
    upsert: true
  });

  if (error) return res.status(500).json({ message: 'Erro no upload' });
  res.json({ message: 'Arquivo salvo com sucesso' });
});

app.post('/mensagem', async (req, res) => {
  const { userId, diaSemana, texto } = req.body;
  const { data } = await supabase.from('mensagens').select('*').eq('user_id', userId).eq('dia_semana', diaSemana);

  if (data.length) {
    await supabase.from('mensagens').update({ texto }).eq('user_id', userId).eq('dia_semana', diaSemana);
  } else {
    await supabase.from('mensagens').insert({ user_id: userId, dia_semana: diaSemana, texto });
  }

  res.json({ message: 'Mensagem salva com sucesso' });
});

app.post('/horarios', async (req, res) => {
  const { userId, horarios } = req.body;
  await supabase.from('horarios').delete().eq('user_id', userId);
  const inserts = horarios.map(h => ({ user_id: userId, hora: h }));
  await supabase.from('horarios').insert(inserts);
  res.json({ message: 'Horários atualizados' });
});

const httpsServer = https.createServer(credentials, app);
httpsServer.listen(PORT, () => console.log(`Servidor rodando em https://atentus.com.br:${PORT}`));
