let usuarioLogado = false;
let sessionToken = '';
let userId = '';
let loginUsuario = '';

const API_BASE_URL = 'https://atentus.com.br:5030';
const STORAGE_KEYS = {
  USER_LOGGED: 'usuarioLogado',
  SESSION_TOKEN: 'sessionToken',
  USER_ID: 'userId',
  LOGIN_USER: 'loginUsuario'
};

/*const supabase = window.supabase.createClient(
  'https://asoxpubkhrqoumcdizcp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzb3hwdWJraHJxb3VtY2RpemNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4OTI3ODQsImV4cCI6MjA2NjQ2ODc4NH0.-RUTRABZMLa4HBWpu_20rILzbMxdZj3Kn6Jkmh5b7Zw'
);*/


function getCurrentPage() {
  // Se não estiver logado, força página de login
  if (!verificarAutenticacao()) {
    return 'login';
  }
  
  // Se estiver logado, verifica a página ativa ou URL
  const urlParams = new URLSearchParams(window.location.search);
  const pageFromUrl = urlParams.get('page');
  
  return pageFromUrl || 'anuncios'; // Página padrão para usuários logados
}

// Verificar se há dados salvos no sessionStorage ao carregar
/*document.addEventListener('DOMContentLoaded', () => {
  const usuarioSalvo = sessionStorage.getItem('usuarioLogado');
  const tokenSalvo = sessionStorage.getItem('sessionToken');
  const userIdSalvo = sessionStorage.getItem('userId');
  const loginSalvo = sessionStorage.getItem('loginUsuario');
  
  if (usuarioSalvo === 'true' && tokenSalvo && userIdSalvo) {
    usuarioLogado = true;
    sessionToken = tokenSalvo;
    userId = userIdSalvo;
    loginUsuario = loginSalvo;
  }
  
  inicializarApp();
});
*/
// Função de login - ajustada para as rotas do servidor
async function realizarLogin(email, password) {
  try {
    const response = await fetch('https://atentus.com.br:5030/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        senha: password
      })
    });

    const data = await response.json();

    if (!data.sucesso) {
      return { sucesso: false, mensagem: data.mensagem || 'Erro no login' };
    }

    // Salvar dados da sessão
    sessionStorage.setItem('usuarioLogado', 'true');
    sessionStorage.setItem('sessionToken', data.token);
    sessionStorage.setItem('loginUsuario', email);
    sessionStorage.setItem('userId', data.userId);

    usuarioLogado = true;
    sessionToken = data.token;
    userId = data.userId;
    loginUsuario = email;

    await iniciarClienteWhatsApp();
    atualizarInterfaceLogin();
    return { sucesso: true, mensagem: 'Login realizado com sucesso' };
  } catch (err) {
    console.error('Erro no login:', err);
    return { sucesso: false, mensagem: 'Erro ao conectar com o servidor' };
  }
}

// Função de cadastro ajustada
async function realizarCadastroUsuario(email, password) {
  try {
    const response = await fetch('https://atentus.com.br:5030/cadastrar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,  // Padronizar para 'email' como no login
        senha: password
      })
    });

    const data = await response.json();

    if (!data.sucesso) {
      return { sucesso: false, mensagem: data.mensagem || 'Erro no cadastro' };
    }

    // Salvar userId se retornado pelo servidor
    if (data.userId) {
      sessionStorage.setItem('userId', data.userId);
      userId = data.userId;
    }

    return {
      sucesso: true,
      mensagem: data.mensagem || 'Cadastro realizado com sucesso!',
      userId: data.userId
    };
  } catch (err) {
    console.error('Erro no cadastro:', err);
    return { sucesso: false, mensagem: 'Erro ao cadastrar usuário' };
  }
}

// Função para o botão de login
async function handleLogin() {
  const email = document.getElementById('login').value;
  const password = document.getElementById('senha').value;
  
  if (!email || !password) {
    alert('Por favor, preencha todos os campos');
    return;
  }
  
  const resultado = await realizarLogin(email, password);
  
  if (resultado.sucesso) {
    alert(resultado.mensagem);
    // Redirecionar ou atualizar interface conforme necessário
  } else {
    alert(resultado.mensagem);
  }
}

// Função para o botão de cadastro
async function handleCadastro() {
  const email = document.getElementById('loginCadastro').value;
  const password = document.getElementById('senhaCadastro').value;
  
  if (!email || !password) {
    alert('Por favor, preencha todos os campos');
    return;
  }
  
  const resultado = await realizarCadastroUsuario(email, password);
  
  if (resultado.sucesso) {
    alert(resultado.mensagem);
    // Opcionalmente fazer login automático após cadastro
    // await realizarLogin(email, password);
  } else {
    alert(resultado.mensagem);
  }
}



// Função para iniciar cliente WhatsApp
async function iniciarClienteWhatsApp() {
  if (!userId) return;
  
  try {
    await fetch('https://atentus.com.br:5030/iniciar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId })
    });
  } catch (err) {
    console.error('Erro ao iniciar cliente WhatsApp:', err);
  }
}

// Função para atualizar interface após login
function atualizarInterfaceLogin() {
  const menu = document.getElementById('menu_bar');
  if (menu) menu.style.display = 'block';
  carregarPagina('anuncios');
}

// Função para exibir status
function exibirStatus(elementId, mensagem) {
  const elemento = document.getElementById(elementId);
  if (elemento) {
    elemento.textContent = mensagem;
    elemento.style.display = 'block';
  }
}

// Função para fazer logout
async function fazerLogout() {
  try {
    // Chamar endpoint de logout no servidor
    await fetch('https://atentus.com.br:5030/logout', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({ userId })
    });
  } catch (err) {
    console.error('Erro no logout:', err);
  } finally {
    // Limpar dados locais
    sessionStorage.clear();
    usuarioLogado = false;
    sessionToken = '';
    userId = '';
    loginUsuario = '';
    
    // Atualizar interface
    const menu = document.getElementById('menu_bar');
    if (menu) menu.style.display = 'none';
    carregarPagina('login');
  }
}

function carregarPagina(pagina) {
  fetch(`pages/${pagina}.html`)
    .then(response => {
      if (!response.ok) throw new Error('Página não encontrada');
      return response.text();
    })
    .then(html => {
      document.querySelector('main').innerHTML = html;

      // Executa scripts inline da página
      const scripts = document.querySelector('main').querySelectorAll('script');
      scripts.forEach(oldScript => {
        const newScript = document.createElement('script');
        if (oldScript.src) {
          newScript.src = oldScript.src;
        } else {
          newScript.textContent = oldScript.textContent;
        }
        document.body.appendChild(newScript);
      });

      // Inicializar elementos da página após carregar
      setTimeout(() => {
        inicializarElementosPagina();
        configurarBotoesLoginCadastro();
      }, 100);
    })
    .catch(err => {
      console.error(err);
      document.querySelector('main').innerHTML = `<p>Erro ao carregar ${pagina}</p>`;
    });
}

function inicializarElementosPagina() {
  // EMOJI PICKER
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
      if (picker.style.display === 'none' || !picker.style.display) {
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

  // UPLOAD DE ARQUIVO
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

  // SALVAR MENSAGEM
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

  // STATUS DO WHATSAPP E QR CODE
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
      if (!userId) return;
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
        const res = await fetch('https://atentus.com.br:5030/restart', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        });
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
        const res = await fetch('https://atentus.com.br:5030/logout', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        });
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

  // GERENCIAMENTO DE HORÁRIOS
  const selects = [
    'chooseHours1', 'chooseHours2', 'chooseHours3',
    'chooseHours4', 'chooseHours5', 'chooseHours6'
  ];
  const statusEl = document.getElementById('statushorarios');
  const listaEl = document.getElementById('horarios_escolhidos');
  const btnConfirmar = document.getElementById('confirmar_horas');

  if (btnConfirmar && listaEl && statusEl) {
    const textoOriginalBotao = btnConfirmar.innerText;

    async function carregarHorarios() {
      if (!userId) return;
      try {
        const res = await fetch(`https://atentus.com.br:5030/horarios?userId=${encodeURIComponent(userId)}`);
        const data = await res.json();
        const lista = data.horarios || [];
        listaEl.innerText = lista.map(h => `${h}:00`).join(' | ');
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

  // GRUPOS
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
          let nomeParte = grupo.nome || '';

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

  // ANÚNCIOS PREVIEW
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

  // COPIAR ANÚNCIO
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

  // APAGAR ANÚNCIO
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

  // APAGAR TODOS ANÚNCIOS
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
}

// Função para verificar autenticação
function verificarAutenticacao() {
  return sessionStorage.getItem('usuarioLogado') === 'true';
}

// Função para inicializar a aplicação
function inicializarApp() {
  const menu = document.getElementById('menu_bar');
  
  if (verificarAutenticacao()) {
    carregarPagina(getCurrentPage());
    if (menu) menu.style.display = 'block';
  } else {
    carregarPagina('login');
    if (menu) menu.style.display = 'none';
  }

  // Configura todos os listeners de navegação
  document.addEventListener('click', (e) => {
    // Links normais
    const link = e.target.closest('[data-page]');
    if (link) {
      e.preventDefault();
      carregarPagina(link.getAttribute('data-page'));
    }
    
    // Botão de cadastro
    const btnCadastro = document.getElementById('linkCadastro');
if (btnCadastro) {
  btnCadastro.addEventListener('click', (e) => {
    e.preventDefault();
    carregarPagina('cadastro');
  });
}
    
    // Botão de login
    const btnLogin = document.getElementById('linkLogin');
if (btnLogin) {
  btnLogin.addEventListener('click', (e) => {
    e.preventDefault();
    carregarPagina('login');
  });
}
  });
}

function configurarBotoesLoginCadastro() {
  setTimeout(() => {
    const btnLogin = document.getElementById('btnEntrar');
    const btnCadastro = document.getElementById('btnCadastrar');
    
    if (btnLogin) {
      btnLogin.removeEventListener('click', handleLogin);
      btnLogin.addEventListener('click', handleLogin);
      console.log('Event listener do login configurado');
    }
    
    if (btnCadastro) {
      btnCadastro.removeEventListener('click', handleCadastro);
      btnCadastro.addEventListener('click', handleCadastro);
      console.log('Event listener do cadastro configurado');
    }
  }, 100);
}


// Corrigindo o erro de sintaxe no final
// Mantenha apenas um DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  inicializarApp();
  configurarNavegacao();
  configurarBotoesLoginCadastro();
});

function configurarNavegacao() {
  document.addEventListener('click', (e) => {
    // Links com data-page
    const link = e.target.closest('[data-page]');
    if (link) {
      e.preventDefault();
      carregarPagina(link.getAttribute('data-page'));
      return;
    }
    
    
  });
}

// ...continuação de código atualizado
// Adicionado as seções:
// - Copiar anúncio
// - Apagar anúncio
// - Apagar todos os anúncios
// - Inicializar app
// - Configurar botões
// - Navegação
