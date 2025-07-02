require('dotenv').config();
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
const PORT = process.env.PORT || 5030;

// Usar variáveis de ambiente para segurança
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://asoxpubkhrqoumcdizcp.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzb3hwdWJraHJxb3VtY2RpemNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4OTI3ODQsImV4cCI6MjA2NjQ2ODc4NH0.-RUTRABZMLa4HBWpu_20rILzbMxdZj3Kn6Jkmh5b7Zw'
);
const bucket = 'anuncios';

function verificarToken(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token ausente' });

  supabase.auth.getUser(token)
    .then(({ data, error }) => {
      if (error || !data?.user) {
        return res.status(401).json({ error: 'Token inválido' });
      }
      req.usuarioSupabase = data.user;
      next();
    })
    .catch(err => {
      console.error('Erro ao validar token:', err);
      res.status(500).json({ error: 'Erro interno na verificação do token' });
    });
}


const credentials = {
  key: fs.readFileSync('/etc/letsencrypt/live/atentus.com.br/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/atentus.com.br/fullchain.pem')
};

// Middlewares (sem duplicatas)
app.use(cors({ origin: 'https://atentus.com.br', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
const upload = multer({ storage: multer.memoryStorage() });

let clients = {}; // clientes WhatsApp por userId
let qrCodes = {}; // qrcodes por userId
let estadosConexao = {}; // status conectado por userId
let cronJobs = {}; // armazenar referências dos cron jobs

function criarClient(userId) {
  // Limpar cliente anterior se existir
  if (clients[userId]) {
    try {
      clients[userId].destroy();
    } catch (err) {
      console.error('Erro ao destruir cliente anterior:', err);
    }
  }

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: userId }),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
  });

  client.on('qr', async qr => {
    try {
      qrCodes[userId] = await qrcode.toDataURL(qr);
      estadosConexao[userId] = false;
    } catch (err) {
      console.error('Erro ao gerar QR code:', err);
    }
  });

  client.on('ready', () => {
    console.log(`Cliente WhatsApp conectado para usuário: ${userId}`);
    estadosConexao[userId] = true;
    agendarEnvios(userId);
  });

  client.on('disconnected', () => {
    console.log(`Cliente WhatsApp desconectado para usuário: ${userId}`);
    estadosConexao[userId] = false;
  });

  client.on('auth_failure', () => {
    console.log(`Falha na autenticação para usuário: ${userId}`);
    estadosConexao[userId] = false;
  });

  client.initialize();
  clients[userId] = client;
}

function obterDiaSemana() {
  const agora = new Date();
  const dias = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  return dias[agora.getDay()];
}

async function verificarArquivoExiste(bucket, filePath) {
  try {
    const { data, error } = await supabase.storage.from(bucket).download(filePath);
    return !error && data;
  } catch {
    return false;
  }
}

function agendarEnvios(userId) {
  // Cancelar job anterior se existir
  if (cronJobs[userId]) {
    cronJobs[userId].stop();
    delete cronJobs[userId];
  }

  cronJobs[userId] = cron.schedule('0 * * * *', async () => {
    try {
      const client = clients[userId];
      if (!client || !estadosConexao[userId]) return;

      const agora = new Date();
      const hora = agora.getHours();
      const nomeDia = obterDiaSemana();

      // Buscar horários configurados
      const horariosRes = await supabase
        .from('horarios')
        .select('hora')
        .eq('user_id', userId);
      
      const horarios = horariosRes.data?.map(h => h.hora) || [];
      if (!horarios.includes(hora)) return;

      // Buscar mensagem do dia
      const msgRes = await supabase
        .from('mensagens')
        .select('texto')
        .eq('user_id', userId)
        .eq('dia_semana', nomeDia);
      
      const texto = msgRes.data?.[0]?.texto;
      if (!texto) return;

      // Buscar imagem
      const exts = ['jpg', 'png', 'jpeg'];
      let urlImagem = '';
      
      for (const ext of exts) {
        const filePath = `${userId}/${nomeDia}.${ext}`;
        const existe = await verificarArquivoExiste(bucket, filePath);
        
        if (existe) {
          const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
          urlImagem = data?.publicUrl;
          break;
        }
      }
      
      if (!urlImagem) return;

      // Buscar grupos selecionados
      const gruposRes = await supabase
        .from('grupos_check')
        .select('id')
        .eq('user_id', userId);
      
      const grupos = gruposRes.data?.map(g => g.id) || [];
      if (grupos.length === 0) return;

      // Enviar para os grupos
      const media = await MessageMedia.fromUrl(urlImagem);
      
      for (const grupoId of grupos) {
        try {
          await client.sendMessage(grupoId, media, { caption: texto });
          console.log(`Mensagem enviada para grupo ${grupoId} do usuário ${userId}`);
          await new Promise(r => setTimeout(r, 2000)); // Delay entre envios
        } catch (err) {
          console.error(`Erro ao enviar para grupo ${grupoId}:`, err);
        }
      }
    } catch (err) {
      console.error(`Erro no agendamento para usuário ${userId}:`, err);
    }
  });
}

// ROTAS =========================================================================================

app.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    
    if (!email || !senha) {
      return res.status(400).json({ sucesso: false, mensagem: 'Email e senha são obrigatórios' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ 
      email, 
      password: senha 
    });
    
    if (error || !data.session) {
      return res.status(401).json({ sucesso: false, mensagem: 'Credenciais inválidas' });
    }
    
    res.json({ 
      sucesso: true, 
      userId: data.user.id, 
      token: data.session.access_token 
    });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor' });
  }
});


app.get('/verificar-token', verificarToken, (req, res) => {
  res.json({ valido: true });
});


app.post('/cadastrar', async (req, res) => {
  try {
    // Mudança: aceitar 'email' em vez de 'login' para corresponder ao app.js
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ 
        sucesso: false, 
        mensagem: 'Email e senha são obrigatórios' 
      });
    }

    const { data, error } = await supabase.auth.signUp({
      email: email,  // Usar email diretamente
      password: senha
    });

    if (error) {
      return res.json({ 
        sucesso: false, 
        mensagem: error.message 
      });
    }

    // Retornar userId se disponível (como esperado pelo app.js)
    return res.json({ 
      sucesso: true, 
      mensagem: 'Cadastro realizado com sucesso',
      userId: data.user?.id || null  // Incluir userId se disponível
    });

  } catch (err) {
    console.error('Erro no cadastro:', err);
    res.status(500).json({ 
      sucesso: false, 
      mensagem: 'Erro interno do servidor' 
    });
  }
});

app.post('/iniciar', verificarToken, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ erro: 'userId é obrigatório' });
    }

    if (!clients[userId]) {
      criarClient(userId);
    }
    
    res.json({ iniciado: true });
  } catch (err) {
    console.error('Erro ao iniciar cliente:', err);
    res.status(500).json({ erro: 'Erro ao iniciar cliente' });
  }
});

app.get('/status/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ erro: 'userId é obrigatório' });
    }

    res.json({ 
      conectado: !!estadosConexao[userId], 
      qr: estadosConexao[userId] ? null : qrCodes[userId] 
    });
  } catch (err) {
    console.error('Erro ao verificar status:', err);
    res.status(500).json({ erro: 'Erro ao verificar status' });
  }
});

app.post('/restart', verificarToken, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'userId é obrigatório' });
    }

    // Parar cron job
    if (cronJobs[userId]) {
      cronJobs[userId].stop();
      delete cronJobs[userId];
    }

    // Destruir cliente atual
    if (clients[userId]) {
      await clients[userId].destroy();
      delete clients[userId];
      delete qrCodes[userId];
      delete estadosConexao[userId];
    }
    
    // Criar novo cliente
    criarClient(userId);
    
    res.json({ message: 'Bot reiniciado com sucesso' });
  } catch (err) {
    console.error('Erro ao reiniciar bot:', err);
    res.status(500).json({ message: 'Erro ao reiniciar bot' });
  }
});

app.post('/logout', verificarToken, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'userId é obrigatório' });
    }

    if (clients[userId]) {
      await clients[userId].logout();
      estadosConexao[userId] = false;
    }
    
    res.json({ message: 'Desconectado com sucesso' });
  } catch (err) {
    console.error('Erro ao desconectar:', err);
    res.status(500).json({ message: 'Erro ao desconectar' });
  }
});

app.get('/grupos', verificarToken, async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId é obrigatório' });
    }

    const client = clients[userId];
    
    if (!client || !estadosConexao[userId]) {
      return res.status(400).json({ error: 'WhatsApp não conectado' });
    }
    
    const chats = await client.getChats();
    const grupos = chats
      .filter(chat => chat.isGroup)
      .map(grupo => ({
        id: `${grupo.id._serialized} - ${grupo.name}`,
        nome: grupo.name
      }));
      
    res.json(grupos);
  } catch (err) {
    console.error('Erro ao buscar grupos:', err);
    res.status(500).json({ error: 'Erro ao buscar grupos' });
  }
});

app.post('/grupos', verificarToken, async (req, res) => {
  try {
    const { userId, gruposSelecionados } = req.body;
    
    if (!userId || !gruposSelecionados) {
      return res.status(400).json({ message: 'userId e gruposSelecionados são obrigatórios' });
    }

    // Remover grupos existentes do usuário
    await supabase.from('grupos_check').delete().eq('user_id', userId);
    
    // Inserir novos grupos
    if (gruposSelecionados.length > 0) {
      const inserts = gruposSelecionados.map(grupo => ({
        user_id: userId,
        id: grupo.id.split(' - ')[0] // Pegar apenas o ID sem o nome
      }));
      
      await supabase.from('grupos_check').insert(inserts);
    }
    
    res.json({ message: 'Grupos salvos com sucesso' });
  } catch (err) {
    console.error('Erro ao salvar grupos:', err);
    res.status(500).json({ message: 'Erro ao salvar grupos' });
  }
});

app.get('/horarios', verificarToken, async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId é obrigatório' });
    }
    
    const { data, error } = await supabase
      .from('horarios')
      .select('hora')
      .eq('user_id', userId);
      
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    res.json({ horarios: data.map(h => h.hora) });
  } catch (err) {
    console.error('Erro ao buscar horários:', err);
    res.status(500).json({ error: 'Erro ao buscar horários' });
  }
});

app.post('/horarios', verificarToken, async (req, res) => {
  try {
    const { userId, horarios } = req.body;
    
    if (!userId || !horarios) {
      return res.status(400).json({ message: 'userId e horarios são obrigatórios' });
    }

    await supabase.from('horarios').delete().eq('user_id', userId);
    
    if (horarios.length > 0) {
      const inserts = horarios.map(h => ({ user_id: userId, hora: h }));
      await supabase.from('horarios').insert(inserts);
    }
    
    res.json({ 
      message: 'Horários atualizados com sucesso',
      horarios: horarios
    });
  } catch (err) {
    console.error('Erro ao salvar horários:', err);
    res.status(500).json({ message: 'Erro ao salvar horários' });
  }
});

app.get('/anuncio/:dia', async (req, res) => {
  try {
    const { dia } = req.params;
    const { userId } = req.query;
    
    if (!userId || !dia) {
      return res.status(400).json({ error: 'userId e dia são obrigatórios' });
    }

    // Buscar texto
    const { data: msgData } = await supabase
      .from('mensagens')
      .select('texto')
      .eq('user_id', userId)
      .eq('dia_semana', dia);
    
    const texto = msgData?.[0]?.texto || '';

    // Buscar imagem
    const exts = ['jpg', 'png', 'jpeg'];
    let imagemBase64 = '';
    
    for (const ext of exts) {
      const filePath = `${userId}/${dia}.${ext}`;
      const existe = await verificarArquivoExiste(bucket, filePath);
      
      if (existe) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
        imagemBase64 = data?.publicUrl;
        break;
      }
    }
    
    res.json({ texto, imagemBase64 });
  } catch (err) {
    console.error('Erro ao buscar anúncio:', err);
    res.status(500).json({ error: 'Erro ao buscar anúncio' });
  }
});

app.post('/copiar-anuncio', verificarToken, async (req, res) => {
  try {
    const { userId, diaOrigem, diasDestino } = req.body;
    
    if (!userId || !diaOrigem || !diasDestino) {
      return res.status(400).send('Parâmetros obrigatórios: userId, diaOrigem, diasDestino');
    }

    // Copiar texto
    const { data: msgOrigem } = await supabase
      .from('mensagens')
      .select('texto')
      .eq('user_id', userId)
      .eq('dia_semana', diaOrigem);
    
    const texto = msgOrigem?.[0]?.texto;
    
    if (texto) {
      for (const diaDestino of diasDestino) {
        await supabase
          .from('mensagens')
          .upsert({ 
            user_id: userId, 
            dia_semana: diaDestino, 
            texto 
          });
      }
    }

    // Copiar imagem
    const exts = ['jpg', 'png', 'jpeg'];
    
    for (const ext of exts) {
      const pathOrigem = `${userId}/${diaOrigem}.${ext}`;
      const existe = await verificarArquivoExiste(bucket, pathOrigem);
      
      if (existe) {
        const { data: fileData } = await supabase.storage
          .from(bucket)
          .download(pathOrigem);
        
        if (fileData) {
          for (const diaDestino of diasDestino) {
            const pathDestino = `${userId}/${diaDestino}.${ext}`;
            await supabase.storage
              .from(bucket)
              .upload(pathDestino, fileData, { upsert: true });
          }
        }
        break;
      }
    }
    
    res.send('Anúncio copiado com sucesso');
  } catch (err) {
    console.error('Erro ao copiar anúncio:', err);
    res.status(500).send('Erro ao copiar anúncio');
  }
});

app.post('/apagar-anuncio', verificarToken, async (req, res) => {
  try {
    const { userId, dia } = req.body;
    
    if (!userId || !dia) {
      return res.status(400).send('userId e dia são obrigatórios');
    }

    // Apagar texto
    await supabase
      .from('mensagens')
      .delete()
      .eq('user_id', userId)
      .eq('dia_semana', dia);
    
    // Apagar imagem
    const exts = ['jpg', 'png', 'jpeg'];
    
    for (const ext of exts) {
      const filePath = `${userId}/${dia}.${ext}`;
      await supabase.storage.from(bucket).remove([filePath]);
    }
    
    res.send('Anúncio apagado com sucesso');
  } catch (err) {
    console.error('Erro ao apagar anúncio:', err);
    res.status(500).send('Erro ao apagar anúncio');
  }
});

app.post('/apagar-todos-anuncios', verificarToken, async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).send('userId é obrigatório');
    }

    // Apagar todas as mensagens
    await supabase
      .from('mensagens')
      .delete()
      .eq('user_id', userId);
    
    // Apagar todas as imagens
    const dias = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
    const exts = ['jpg', 'png', 'jpeg'];
    
    const filesToRemove = [];
    for (const dia of dias) {
      for (const ext of exts) {
        filesToRemove.push(`${userId}/${dia}.${ext}`);
      }
    }
    
    await supabase.storage.from(bucket).remove(filesToRemove);
    
    res.send('Todos os anúncios foram apagados');
  } catch (err) {
    console.error('Erro ao apagar todos os anúncios:', err);
    res.status(500).send('Erro ao apagar todos os anúncios');
  }
});

app.post('/upload', verificarToken, upload.single('arquivo'), async (req, res) => {
  try {
    const { diaSemana, userId } = req.body;
    
    if (!diaSemana || !userId) {
      return res.status(400).json({ message: 'diaSemana e userId são obrigatórios' });
    }
    
    if (!req.file) {
      return res.status(400).json({ message: 'Nenhum arquivo enviado' });
    }

    const ext = path.extname(req.file.originalname);
    const nomeFinal = `${userId}/${diaSemana}${ext}`;

    const { error } = await supabase.storage.from(bucket).upload(nomeFinal, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: true
    });

    if (error) {
      console.error('Erro no upload:', error);
      return res.status(500).json({ message: 'Erro no upload' });
    }
    
    res.json({ message: 'Arquivo salvo com sucesso' });
  } catch (err) {
    console.error('Erro no upload:', err);
    res.status(500).json({ message: 'Erro no upload' });
  }
});

app.post('/mensagem', verificarToken, async (req, res) => {
  try {
    const { userId, diaSemana, texto } = req.body;
    
    if (!userId || !diaSemana) {
      return res.status(400).json({ message: 'userId e diaSemana são obrigatórios' });
    }

    const { data } = await supabase
      .from('mensagens')
      .select('*')
      .eq('user_id', userId)
      .eq('dia_semana', diaSemana);

    if (data.length) {
      await supabase
        .from('mensagens')
        .update({ texto })
        .eq('user_id', userId)
        .eq('dia_semana', diaSemana);
    } else {
      await supabase
        .from('mensagens')
        .insert({ user_id: userId, dia_semana: diaSemana, texto });
    }

    res.json({ message: 'Mensagem salva com sucesso' });
  } catch (err) {
    console.error('Erro ao salvar mensagem:', err);
    res.status(500).json({ message: 'Erro ao salvar mensagem' });
  }
});

const httpsServer = https.createServer(credentials, app);
httpsServer.listen(PORT, () => {
  console.log(`Servidor rodando em https://atentus.com.br:${PORT}`);
});