async function realizarLogin(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return { sucesso: false, mensagem: 'Credenciais inválidas' };
    }

    sessionStorage.setItem('usuarioLogado', 'true');
    sessionStorage.setItem('sessionToken', data.session.access_token);
    sessionStorage.setItem('loginUsuario', email);
    sessionStorage.setItem('userId', data.user.id);

    usuarioLogado = true;
    sessionToken = data.session.access_token;

    atualizarInterfaceLogin();
    return { sucesso: true, mensagem: 'Login realizado com sucesso' };
  } catch (err) {
    console.error(err);
    return { sucesso: false, mensagem: 'Erro ao conectar com o Supabase' };
  }
}

async function realizarCadastroUsuario(email, password) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) {
      return { sucesso: false, mensagem: error.message };
    }

    return {
      sucesso: true,
      mensagem: 'Cadastro realizado! Verifique seu e-mail.'
    };
  } catch (err) {
    console.error(err);
    return { sucesso: false, mensagem: 'Erro ao cadastrar usuário' };
  }
}

function inicializarElementosPagina() {
  const button = document.getElementById('emoji-button');
  const picker = document.getElementById('emoji-picker');
  const textarea = document.getElementById('input_text');

  const emojis = [
    '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇',
    '🙂','🙃','😉','😍','🥰','😘','😗','😙','😚','😎',
    '🤩','🥳','😏','😋','😜','🤪','😝','🤑','🤗','👍',
    '👎','👌','✌️','🤞','🤟','🤘','🤙','👋','👏','🙏','👇',
    '👆','👂','👃','👄','👶','👦','👧','👨','👩','👪',
    '👫','👬','👭','👮','👯','👰','👱','👲','👳','👴',
    '👵','👶','👷','👸','👹','👺','👻','👼','👽','👾',
    '👿','💀','💂','💃','💄','💅','💆','💇','💈','💉',
    '💊','💋','💌','💍','💎','💏','💐','💑','💒','💓',
    '💔','💕','💖','💗','💘','💙','💚','💛','💜','💝',
    '💞','💟','💠','💡','💢','💣','💤','💥','💦','💧',
    '💨','💩','💪','💫','💬','💭','💮','💯','💰','💱',
    '💲','💳','💴','💵','💶','💷','💸','💹','💺','💻',
    '💼','💽','💾','💿','📀','📁','📂','📃','📄','📅',
    '📆','📇','📈','📉','📊','📋','📌','📍','📎','📏',
    '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔',
    '🔥','✨','⚡','💥','⭐','🎉','🎊','🎈','🥳','🎂',
    '🍾','🥂','🍻','🍹','🍕','🍔','🍟','🌮','🍩','🍪',
    '💼','📈','📉','📊','💰','💵','💳','🧾','📜','📝',
    '📅','⏰','📢','📞','📱','✔️','❌','⚠️','🚫','✅',
    '❗','❓','💡','🔔','🎯','🚀'
  ];

  if (button && picker && textarea) {
    function criarPicker() {
      picker.innerHTML = '';
      emojis.forEach(emoji => {
        const span = document.createElement('span');
        span.textContent = emoji;
        span.addEventListener('click', () => {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const text = textarea.value;
          textarea.value = text.slice(0, start) + emoji + text.slice(end);
          textarea.focus();
          textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
          picker.style.display = 'none';
        });
        picker.appendChild(span);
      });
    }

    button.addEventListener('click', () => {
      if (picker.style.display === 'none') {
        criarPicker();
        const rect = button.getBoundingClientRect();
        picker.style.position = 'absolute';
        picker.style.top = (rect.bottom + window.scrollY) + 'px';
        picker.style.left = (rect.left + window.scrollX) + 'px';
        picker.style.display = 'flex';
      } else {
        picker.style.display = 'none';
      }
    });

    document.addEventListener('click', (e) => {
      if (!picker.contains(e.target) && e.target !== button) {
        picker.style.display = 'none';
      }
    });
  }

  const uploadButton = document.getElementById('upload-button');
if (uploadButton) {
  uploadButton.addEventListener('click', async () => {
    const fileInput = document.getElementById('file-input');
    const file = fileInput?.files[0];
    const diaSemana = document.getElementById('diaSemana')?.value;

    if (!file) {
      exibirStatus('status_documents', 'Nenhum arquivo selecionado');
      return;
    }
    if (!userId) {
      exibirStatus('status_documents', 'Usuário não autenticado');
      return;
    }

    const formData = new FormData();
    formData.append('arquivo', file);
    formData.append('diaSemana', diaSemana);
    formData.append('userId', userId);

    try {
      const res = await fetch('https://atentus.com.br:5030/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      exibirStatus('status_documents', data.message || 'Upload realizado');
    } catch (error) {
      exibirStatus('status_documents', 'Erro no upload');
      console.error(error);
    }
  });
}

// --- SALVAR MENSAGEM ---
const campoMensagem = document.getElementById('input_text');
const uploadText = document.getElementById('upload_text');
const previewText = document.getElementById('previewText');

if (campoMensagem && uploadText && previewText) {
  uploadText.addEventListener('click', async () => {
    if (!userId) {
      exibirStatus('status_text', 'Usuário não autenticado');
      return;
    }
    const diaSemana = document.getElementById('diaSemana')?.value || '';
    const texto = campoMensagem.value || '';

    const dados = { userId, diaSemana, texto };

    try {
      const res = await fetch('https://atentus.com.br:5030/mensagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      });
      const data = await res.json();
      exibirStatus('status_text', data.message || 'Mensagem salva');
    } catch (error) {
      exibirStatus('status_text', 'Erro ao salvar mensagem');
      console.error(error);
    }
  });

  campoMensagem.addEventListener('input', () => {
    const textoComQuebras = campoMensagem.value.replace(/\n/g, '<br>');
    previewText.innerHTML = textoComQuebras;
  });
}

// --- STATUS DO WHATSAPP E QR CODE ---
if (document.getElementById('qrcode')) {
  const qrcodeImg = document.getElementById('qrcode');
  const title = document.getElementById('title');
  const subtitle = document.getElementById('subtitle');
  const loading = document.getElementById('loading');
  const statusText = document.getElementById('status');

  let intervalId = null;
  let isRestarting = false;
  let isLoggingOut = false;

  async function checkStatus() {
    if (!userId) return; // só tenta se userId disponível
    try {
      const res = await fetch(`https://atentus.com.br:5030/status/${userId}`);
      const data = await res.json();

      if (data.conectado) {
        qrcodeImg.style.display = 'none';
        loading.style.display = 'none';
        title.textContent = '✅ Conectado com Sucesso!';
        subtitle.textContent = 'Você já pode fechar esta página.';

        if (isRestarting || isLoggingOut) {
          statusText.textContent = '✅ Conectado com sucesso!';
        } else {
          statusText.textContent = '';
        }

        isRestarting = false;
        isLoggingOut = false;
        restartCheckStatusInterval();
      } else {
        if (data.qr) {
          qrcodeImg.src = data.qr;
          qrcodeImg.style.display = 'block';
        }
        loading.style.display = 'block';

        if (!isRestarting && !isLoggingOut) {
          statusText.textContent = 'Aguardando conexão com o WhatsApp...';
        }
      }
    } catch (err) {
      console.error('Erro ao verificar status:', err);
    }
  }

  function startCheckStatusInterval() {
    if (!intervalId) {
      intervalId = setInterval(checkStatus, 3000);
    }
  }

  function stopCheckStatusInterval() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function restartCheckStatusInterval() {
    stopCheckStatusInterval();
    startCheckStatusInterval();
  }

  async function restartBot() {
    stopCheckStatusInterval();
    isRestarting = true;
    statusText.textContent = '♻️ Reiniciando, aguarde por favor...';
    loading.style.display = 'block';

    try {
      const res = await fetch('https://atentus.com.br:5030/restart', { method: 'POST' });
      const data = await res.json();
      statusText.textContent = data.message || 'Reiniciado com sucesso!';
      title.textContent = '✅ Reiniciado com sucesso!';
      setTimeout(() => startCheckStatusInterval(), 3000);
    } catch (error) {
      statusText.textContent = 'Erro ao reiniciar...';
      loading.style.display = 'none';
      console.error(error);
      isRestarting = false;
      startCheckStatusInterval();
    }
  }

  async function logoutBot() {
    stopCheckStatusInterval();
    isLoggingOut = true;
    statusText.textContent = '🚪 Desconectando, aguarde...';
    loading.style.display = 'block';

    try {
      const res = await fetch('https://atentus.com.br:5030/logout', { method: 'POST' });
      const data = await res.json();
      statusText.textContent = data.message || 'Desconectado!';
      title.textContent = '❎ Desconectado!';
      setTimeout(() => startCheckStatusInterval(), 3000);
    } catch (error) {
      statusText.textContent = 'Erro ao desconectar...';
      loading.style.display = 'none';
      console.error(error);
      isLoggingOut = false;
      startCheckStatusInterval();
    }
  }

  // Botões
  const btnReconnect = document.getElementById('reconnect');
  const btnLogout = document.getElementById('logout');
  if (btnReconnect) btnReconnect.addEventListener('click', restartBot);
  if (btnLogout) btnLogout.addEventListener('click', logoutBot);

  // Inicialização
  checkStatus();
  startCheckStatusInterval();
}

// --- GERENCIAMENTO DE HORÁRIOS ---
const selects = [
  'chooseHours1', 'chooseHours2', 'chooseHours3',
  'chooseHours4', 'chooseHours5', 'chooseHours6'
];
const statusEl = document.getElementById('statushorarios');
const listaEl = document.getElementById('horarios_escolhidos');
const btnConfirmar = document.getElementById('confirmar_horas');

if (btnConfirmar && listaEl && statusEl) {
  const textoOriginalBotao = btnConfirmar.innerText;

  // CARREGAR HORÁRIOS - backend não tem GET /horarios?userId, então aqui fica vazio ou adaptar backend
  async function carregarHorarios() {
    if (!userId) return;
    try {
      // Supondo que você crie rota GET /horarios?userId=...
      const res = await fetch(`https://atentus.com.br:5030/horarios?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      const lista = data.horarios || [];
      // Ajusta para hora original com fuso
      const horariosOriginais = lista.map(h => (h - 3 + 24) % 24);
      listaEl.innerText = horariosOriginais.map(h => `${h}:00`).join(' | ');
    } catch {
      listaEl.innerText = 'Erro ao carregar horários';
    }
  }

  btnConfirmar.addEventListener('click', async () => {
    if (!userId) {
      statusEl.innerText = 'Usuário não autenticado';
      return;
    }

    const valores = selects.map(id => {
      const el = document.getElementById(id);
      return el ? el.value : null;
    }).filter(v => v !== 'null' && v !== null);

    const unicos = [...new Set(valores.map(Number))].sort((a,b) => a-b);

    if (unicos.length === 0) {
      statusEl.innerText = '⚠️ Selecione pelo menos um horário';
      return;
    }

    btnConfirmar.disabled = true;
    btnConfirmar.innerText = 'Salvando...';

    try {
      const res = await fetch('https://atentus.com.br:5030/horarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, horarios: unicos }),
      });
      const data = await res.json();
      statusEl.innerText = data.message || '✅ Horários salvos com sucesso!';
      if(data.horarios) {
        listaEl.innerText = data.horarios.map(h => `${h}:00`).join(' | ');
      }
    } catch {
      statusEl.innerText = '❌ Erro ao salvar os horários';
    } finally {
      btnConfirmar.disabled = false;
      btnConfirmar.innerText = textoOriginalBotao;
    }
  });

  carregarHorarios();
}

// --- GRUPOS ---
const tabelaEsquerda = document.getElementById('tabela_grupos_esquerda');
const tabelaDireita = document.getElementById('tabela_grupos_direita');
const btnConfirmarGrupos = document.getElementById('confirmar_grupos');

if (btnConfirmarGrupos && tabelaEsquerda && tabelaDireita) {
  tabelaEsquerda.innerHTML = '';
  tabelaDireita.innerHTML = '';

  async function carregarGrupos() {
    if (!userId) return;
    try {
      const res = await fetch(`https://atentus.com.br:5030/grupos?userId=${encodeURIComponent(userId)}`);
      const grupos = await res.json();

      grupos.forEach(grupo => {
        const tr = document.createElement('tr');

        let idParte = grupo.id;
        let nomeParte = '';

        if (grupo.id.includes(' - ')) {
          [idParte, nomeParte] = grupo.id.split(' - ');
        }

        const tdId = document.createElement('td');
        tdId.textContent = idParte;

        const tdNome = document.createElement('td');
        tdNome.textContent = nomeParte;

        const tdCheck = document.createElement('td');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.addEventListener('change', atualizarGruposSelecionados);

        tdCheck.appendChild(checkbox);

        tr.appendChild(tdId);
        tr.appendChild(tdNome);
        tr.appendChild(tdCheck);

        tabelaEsquerda.appendChild(tr);
      });
    } catch (error) {
      console.error('Erro ao carregar grupos:', error);
    }
  }

  function atualizarGruposSelecionados() {
    tabelaDireita.innerHTML = '';

    const linhas = tabelaEsquerda.querySelectorAll('tr');
    linhas.forEach(tr => {
      const checkbox = tr.querySelector('input[type="checkbox"]');
      if (checkbox && checkbox.checked) {
        const trNovo = document.createElement('tr');

        const tdId = document.createElement('td');
        tdId.textContent = tr.children[0].textContent;

        const tdNome = document.createElement('td');
        tdNome.textContent = tr.children[1].textContent;

        trNovo.appendChild(tdId);
        trNovo.appendChild(tdNome);

        tabelaDireita.appendChild(trNovo);
      }
    });
  }

  btnConfirmarGrupos.addEventListener('click', async () => {
    if (!userId) return;

    const status = document.getElementById('status_grupos');
    const linhasSelecionadas = tabelaDireita.querySelectorAll('tr');
    const gruposSelecionados = Array.from(linhasSelecionadas).map(tr => ({
      id: tr.children[0].textContent,
      nome: tr.children[1].textContent
    }));

    try {
      const res = await fetch('https://atentus.com.br:5030/grupos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, gruposSelecionados })
      });
      const data = await res.json();
      status.textContent = data.message || 'Grupos salvos com sucesso';
    } catch (err) {
      status.textContent = 'Erro ao salvar os grupos';
      console.error(err);
    }
  });

  carregarGrupos();
}

// --- ANÚNCIOS PREVIEW ---
const selectDia = document.getElementById('diaSemana_chk');
const imagem = document.getElementById('previewImagem_chk');
const texto = document.getElementById('previewText_chk');

if (selectDia && imagem && texto) {
  async function carregarPreview(dia) {
    try {
      const res = await fetch(`https://atentus.com.br:5030/anuncio/${encodeURIComponent(dia)}?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      imagem.src = data.imagemBase64 || 'default_preview.jpg';
      texto.innerHTML = (data.texto || '').replace(/\n/g, '<br>');
    } catch (err) {
      console.error('Erro ao carregar anúncio:', err);
      imagem.src = 'default_preview.jpg';
      texto.textContent = '';
    }
  }

  carregarPreview(selectDia.value);

  selectDia.addEventListener('change', () => {
    carregarPreview(selectDia.value);
  });
}

// --- COPIAR ANÚNCIO ---
const btnConfirmarCheckbox = document.getElementById('confirmar_checkbox');
if (btnConfirmarCheckbox) {
  btnConfirmarCheckbox.addEventListener('click', async () => {
    if (!userId) return;
    const selectDia = document.getElementById('diaSemana_chk');
    const diaOrigem = selectDia.value;
    const statuschk = document.getElementById('status_checkbox');

    const checkboxes = document.querySelectorAll('.main__checkbox');
    const diasDestino = [];

    checkboxes.forEach(checkbox => {
      if (checkbox.checked) {
        const dia = checkbox.id.replace('checkbox_', '');
        if (dia !== diaOrigem) diasDestino.push(dia);
      }
    });

    if (diasDestino.length === 0) {
      statuschk.textContent = 'Selecione pelo menos um dia diferente para copiar o anúncio.';
      return;
    }

    try {
      const res = await fetch('https://atentus.com.br:5030/copiar-anuncio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, diaOrigem, diasDestino })
      });
      if (!res.ok) throw new Error('Erro ao copiar anúncio');
      const msg = await res.text();
      statuschk.textContent = msg;
      checkboxes.forEach(c => c.checked = false);
    } catch (err) {
      console.error(err);
      statuschk.textContent = 'Erro ao copiar anúncio.';
    }
  });
}

// --- APAGAR ANÚNCIO ---
const btnApagarAnuncio = document.getElementById('btn-apagar-anuncio');
if (btnApagarAnuncio) {
  btnApagarAnuncio.addEventListener('click', async () => {
    if (!userId) return;
    const diaSelecionado = document.getElementById('diaSemana_chk').value;
    const statuschk = document.getElementById('status_checkbox');

    if (!diaSelecionado) {
      statuschk.textContent = 'Por favor, selecione um dia.';
      return;
    }

    try {
      const resposta = await fetch('https://atentus.com.br:5030/apagar-anuncio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, dia: diaSelecionado })
      });
      const textoResposta = await resposta.text();
      statuschk.textContent = textoResposta;
    } catch (error) {
      console.error('Erro ao apagar anúncio:', error);
      statuschk.textContent = 'Erro ao tentar apagar o anúncio.';
    }
  });
}

// --- APAGAR TODOS ANÚNCIOS ---
const btnApagarTodos = document.getElementById('btn-apagar-todos');
if (btnApagarTodos) {
  btnApagarTodos.addEventListener('click', async () => {
    if (!userId) return;
    const statuschk = document.getElementById('status_checkbox');

    try {
      const res = await fetch('https://atentus.com.br:5030/apagar-todos-anuncios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const msg = await res.text();
      statuschk.textContent = msg;
    } catch (err) {
      console.error(err);
      statuschk.textContent = 'Erro ao apagar todos os anúncios.';
    }
  });
}

// --- Função para inicializar app após login ---
function inicializarApp() {
  // Aqui pode colocar chamadas que precisam userId para já carregar dados
  // Por exemplo, carregar grupos, horários, anúncios, etc.

  // Exemplo: carregarHorarios();
  // Exemplo: carregarGrupos();

  // Se quiser, pode disparar eventos para atualizar UI, etc
}

// --- Função para trocar de página (se usar SPA simples) ---
function carregarPagina(nomePagina) {
  const paginas = document.querySelectorAll('.pagina');
  paginas.forEach(p => p.style.display = 'none');
  const paginaAtiva = document.getElementById(nomePagina);
  if (paginaAtiva) paginaAtiva.style.display = 'block';
}

// Se você quiser, pode disparar inicializarApp() no carregamento se já estiver logado
}