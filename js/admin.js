/* =========================================================
   Rocha Costa — Painel administrativo (backend real)
   =========================================================
   Login e CRUD de imóveis/depoimentos passam pela API em
   server/app.py. As edições feitas aqui agora valem para
   todo mundo que visita o site — não ficam só no navegador
   de quem está editando.
   ========================================================= */

function mostrarErroLogin(mensagem) {
  const erro = document.getElementById('admin-login-erro');
  erro.textContent = mensagem;
  erro.style.display = 'block';
}

function entrarNoPainel(usuario) {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-app').style.display = 'grid';
  const campoUsuario = document.getElementById('acesso-usuario');
  if (campoUsuario && usuario) campoUsuario.value = usuario;
  iniciarPainelAdmin();
}

// ---- Avisos rápidos no canto da tela (no lugar das caixas de alerta do navegador) ----
function avisar(mensagem, tipo = 'ok') {
  let pilha = document.getElementById('admin-avisos');
  if (!pilha) {
    pilha = document.createElement('div');
    pilha.id = 'admin-avisos';
    pilha.className = 'admin-avisos';
    pilha.setAttribute('aria-live', 'polite');
    document.body.appendChild(pilha);
  }
  const aviso = document.createElement('div');
  aviso.className = `admin-aviso admin-aviso--${tipo}`;
  aviso.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
  aviso.textContent = mensagem;
  pilha.appendChild(aviso);
  setTimeout(() => {
    aviso.classList.add('saindo');
    setTimeout(() => aviso.remove(), 400);
  }, tipo === 'erro' ? 7000 : 3500);
}

// Desliga o botão "Salvar" enquanto a requisição não volta (evita salvar duas vezes)
async function comBotaoOcupado(form, tarefa) {
  const botao = form.querySelector('button[type="submit"]');
  if (botao?.disabled) return;
  const texto = botao?.textContent;
  if (botao) {
    botao.disabled = true;
    botao.textContent = 'Salvando...';
  }
  try {
    await tarefa();
  } finally {
    if (botao) {
      botao.disabled = false;
      botao.textContent = texto;
    }
  }
}

// ---- Verificação por imagem (CAPTCHA) do login ----
let _captchaVale = '';

async function carregarCaptcha() {
  const img = document.getElementById('admin-captcha-img');
  const campo = document.getElementById('admin-captcha');
  campo.value = '';
  try {
    const dados = await apiCaptcha();
    _captchaVale = dados.vale;
    img.src = dados.imagem;
  } catch (err) {
    _captchaVale = '';
    img.removeAttribute('src');
    mostrarErroLogin(err.message);
  }
}

// Botões "Mostrar/Ocultar" dos campos de senha
function ligarBotoesVerSenha() {
  document.querySelectorAll('[data-ver-senha]').forEach((botao) => {
    botao.addEventListener('click', () => {
      const campo = document.getElementById(botao.getAttribute('data-ver-senha'));
      const mostrar = campo.type === 'password';
      campo.type = mostrar ? 'text' : 'password';
      botao.textContent = mostrar ? 'Ocultar' : 'Mostrar';
      botao.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
    });
  });
}

// Medidor simples de força da senha (só orientação; quem decide é o servidor)
function forcaDaSenha(senha) {
  let pontos = 0;
  if (senha.length >= 10) pontos += 1;
  if (senha.length >= 14) pontos += 1;
  if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos += 1;
  if (/\d/.test(senha) && /[^\d]/.test(senha)) pontos += 1;
  if (/[^A-Za-z0-9]/.test(senha)) pontos += 1;
  return senha.length < 10 ? Math.min(pontos, 1) : pontos;
}

function ligarMedidorDeSenha() {
  const campo = document.getElementById('admin-nova-senha');
  const barra = document.querySelector('#admin-forca span');
  const texto = document.getElementById('admin-forca-texto');
  if (!campo || !barra) return;
  const niveis = ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Forte', 'Muito forte'];
  const cores = ['#c62828', '#c62828', '#e08a00', '#c9a400', '#2e9d57', '#1b7f43'];
  campo.addEventListener('input', () => {
    const n = campo.value ? forcaDaSenha(campo.value) : 0;
    barra.style.width = campo.value ? `${Math.max(10, n * 20)}%` : '0';
    barra.style.background = cores[n];
    texto.textContent = campo.value ? `Força da senha: ${niveis[n]}` : 'Mínimo de 10 caracteres, com letras e números.';
  });
}

// Primeiro acesso: o painel ainda não tem usuário e senha. No computador do
// site aparece o formulário para criar; em qualquer outro aparelho, só um aviso.
function mostrarCriacaoDeAcesso(sessao) {
  const loginForm = document.getElementById('admin-login-form');
  const setupForm = document.getElementById('admin-setup-form');
  const nota = document.getElementById('admin-login-nota');
  loginForm.style.display = 'none';
  if (!sessao.pode_configurar) {
    nota.textContent = 'O painel ainda não tem acesso criado. Abra esta página no computador onde o site está instalado para criar o usuário e a senha.';
    return;
  }
  nota.textContent = 'Primeiro acesso: escolha o usuário e a senha que vão proteger o painel.';
  setupForm.style.display = 'block';
  ligarMedidorDeSenha();
  setupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const erro = document.getElementById('admin-setup-erro');
    const usuario = document.getElementById('admin-novo-usuario').value.trim();
    const senha = document.getElementById('admin-nova-senha').value;
    const mostrar = (msg) => { erro.textContent = msg; erro.style.display = 'block'; };
    erro.style.display = 'none';
    if (senha !== document.getElementById('admin-nova-senha2').value) return mostrar('As duas senhas não são iguais.');
    const botao = setupForm.querySelector('button[type="submit"]');
    botao.disabled = true;
    try {
      await apiCriarAcesso(usuario, senha);
      setupForm.reset();
      entrarNoPainel(usuario.toLowerCase());
    } catch (err) {
      mostrar(err.message);
    } finally {
      botao.disabled = false;
    }
  });
}

async function iniciarLoginAdmin() {
  const loginForm = document.getElementById('admin-login-form');
  if (!loginForm) return;
  ligarBotoesVerSenha();

  // O cookie de sessão não é legível aqui: quem diz se ainda vale é o servidor.
  try {
    const sessao = await apiSessao();
    if (sessao.logado) entrarNoPainel(sessao.usuario);
    else if (!sessao.configurado) mostrarCriacaoDeAcesso(sessao);
    else carregarCaptcha();
  } catch (err) {
    mostrarErroLogin('Não foi possível falar com o servidor. Recarregue a página.');
  }

  document.getElementById('admin-captcha-trocar').addEventListener('click', carregarCaptcha);

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const usuario = document.getElementById('admin-usuario').value.trim();
    const senha = document.getElementById('admin-senha').value;
    const captcha = document.getElementById('admin-captcha').value.trim();
    const botao = loginForm.querySelector('button[type="submit"]');
    document.getElementById('admin-login-erro').style.display = 'none';
    botao.disabled = true;
    try {
      await apiLogin(usuario, senha, _captchaVale, captcha);
      loginForm.reset();
      entrarNoPainel(usuario.toLowerCase());
    } catch (err) {
      // Cada imagem vale uma tentativa só: sempre vem uma nova depois de um erro.
      document.getElementById('admin-senha').value = '';
      await carregarCaptcha();
      mostrarErroLogin(err.message || 'Usuário ou senha incorretos.');
    } finally {
      botao.disabled = false;
    }
  });

  document.getElementById('admin-logout')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await apiAuth('/api/auth/logout', 'POST'); // a sessão deixa de valer no servidor e o cookie é apagado
    } catch (err) {
      // sem conexão ou sessão já vencida: segue saindo do mesmo jeito
    }
    limparAdminToken();
    location.reload();
  });
}

// ---- Configurações > Acesso ao painel (trocar usuário e senha) ----
function iniciarFormAcesso() {
  const form = document.getElementById('form-acesso');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = document.getElementById('acesso-status');
    const nova = document.getElementById('acesso-nova-senha').value;
    status.style.color = 'var(--red)';
    if (nova !== document.getElementById('acesso-nova-senha2').value) {
      status.textContent = 'As duas senhas novas não são iguais.';
      return;
    }
    try {
      const resposta = await apiAuth('/api/auth/credenciais', 'POST', {
        usuario: document.getElementById('acesso-usuario').value.trim(),
        senha_atual: document.getElementById('acesso-senha-atual').value,
        nova_senha: nova,
      });
      form.reset();
      document.getElementById('acesso-usuario').value = resposta.usuario;
      status.style.color = '';
      status.textContent = 'Acesso atualizado. Os outros aparelhos foram desconectados.';
    } catch (err) {
      if (err.sessaoExpirada) return tratarSessaoExpirada();
      status.textContent = err.message;
    }
  });
}

// Se a sessão expirar no meio do uso, volta pra tela de login com um aviso.
function tratarSessaoExpirada() {
  document.getElementById('admin-app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  carregarCaptcha().then(() => mostrarErroLogin('Sua sessão expirou. Faça login novamente.'));
}

// ---- Seção: Imóveis ----
let _imovelGaleriaAtual = []; // fotos do imóvel em edição, na ordem (a primeira é a capa)

async function renderAdminImoveis() {
  const tbody = document.getElementById('admin-imoveis-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';

  let lista;
  try {
    lista = await apiGet('/api/imoveis');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="6">Não foi possível carregar os imóveis.</td></tr>';
    return;
  }

  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="6">Nenhum imóvel cadastrado ainda.</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map((im) => `
    <tr>
      <td>${escHTML(im.id)}</td>
      <td>${escHTML(im.titulo)}</td>
      <td>${escHTML(im.bairro)}</td>
      <td>${escHTML(im.status)}</td>
      <td>${formatarPrecoImovel(im.preco)}</td>
      <td>
        <button class="btn btn-sm btn-outline-navy" data-editar-imovel="${escHTML(im.id)}">Editar</button>
        <button class="btn btn-sm btn-primary" data-excluir-imovel="${escHTML(im.id)}">Excluir</button>
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('[data-excluir-imovel]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir este imóvel? Essa ação não pode ser desfeita.')) return;
      const id = btn.getAttribute('data-excluir-imovel');
      try {
        await apiAuth(`/api/imoveis/${id}`, 'DELETE');
        if (document.getElementById('imovel-id').value === id) limparFormImovel();
        renderAdminImoveis();
        renderAdminDashboard();
        avisar('Imóvel excluído.');
      } catch (err) {
        if (err.sessaoExpirada) return tratarSessaoExpirada();
        avisar(err.message, 'erro');
      }
    });
  });
  tbody.querySelectorAll('[data-editar-imovel]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-editar-imovel');
      let item;
      try {
        item = await apiGet(`/api/imoveis/${id}`);
      } catch (err) {
        avisar('Não foi possível carregar este imóvel. Ele pode ter sido excluído.', 'erro');
        renderAdminImoveis();
        return;
      }
      const val = (campo, v) => { document.getElementById(campo).value = v == null ? '' : v; };
      val('imovel-id', item.id);
      val('imovel-titulo', item.titulo);
      val('imovel-bairro', item.bairro);
      val('imovel-status', item.status || 'Pronto para morar');
      val('imovel-preco', item.preco);
      val('imovel-tipo', item.tipo || 'Casa');
      val('imovel-cidade', item.cidade || 'Petrolina');
      val('imovel-area', item.area);
      val('imovel-quartos', item.quartos);
      val('imovel-banheiros', item.banheiros);
      val('imovel-vagas', item.vagas);
      val('imovel-imagem', '');
      _imovelGaleriaAtual = [...(item.imagens && item.imagens.length ? item.imagens : (item.imagem ? [item.imagem] : []))];
      renderGaleria('imovel-imagens-lista', _imovelGaleriaAtual);
      val('imovel-descricao', item.descricao);
      val('imovel-empreendimento', item.empreendimento_id || '');
      document.getElementById('imovel-destaque').checked = !!item.destaque;
      const loc = item.localizacao;
      val('imovel-lat', loc ? loc.lat : '');
      val('imovel-lng', loc ? loc.lng : '');
      val('imovel-mapa-link', loc ? `${loc.lat}, ${loc.lng}` : '');
      document.getElementById('imovel-mapa-status').textContent = loc
        ? 'Este imóvel tem posição própria no mapa. Apague o campo para voltar a usar a da obra/bairro.'
        : 'Em branco, o mapa do imóvel mostra a posição da obra escolhida acima ou, se não houver obra, o bairro.';
      document.getElementById('imovel-upload-status').textContent = '';
      modoEdicao('imovel', `Editar imóvel: ${item.titulo || ''}`);
      document.getElementById('form-imovel').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

function limparFormImovel() {
  const form = document.getElementById('form-imovel');
  form.reset();
  document.getElementById('imovel-id').value = '';
  document.getElementById('imovel-upload-status').textContent = '';
  document.getElementById('imovel-lat').value = '';
  document.getElementById('imovel-lng').value = '';
  document.getElementById('imovel-mapa-status').textContent = 'Em branco, o mapa do imóvel mostra a posição da obra escolhida acima ou, se não houver obra, o bairro.';
  _imovelGaleriaAtual = [];
  renderGaleria('imovel-imagens-lista', _imovelGaleriaAtual);
  modoEdicao('imovel', null);
}

// Título do formulário + texto do botão "Limpar" mudam quando um item está sendo editado
const _TITULOS_NOVO = {
  imovel: ['form-imovel-titulo-secao', 'Adicionar imóvel', 'imovel-cancelar'],
  emp: ['form-empreendimento-titulo-secao', 'Adicionar empreendimento', 'emp-cancelar'],
  dep: ['form-depoimento-titulo', 'Adicionar depoimento', 'dep-cancelar'],
  blog: ['form-blog-titulo-secao', 'Novo artigo', 'blog-cancelar'],
};
function modoEdicao(qual, titulo) {
  const [idTitulo, tituloNovo, idCancelar] = _TITULOS_NOVO[qual];
  const el = document.getElementById(idTitulo);
  if (el) el.textContent = titulo || tituloNovo;
  const cancelar = document.getElementById(idCancelar);
  if (cancelar) cancelar.textContent = titulo ? 'Cancelar edição' : 'Limpar formulário';
  el?.closest('.form-card')?.classList.toggle('form-card--editando', !!titulo);
}

function iniciarFormImovel() {
  const form = document.getElementById('form-imovel');
  if (!form) return;

  // Foto por endereço (URL): botão "Adicionar" ou Enter
  const campoUrl = document.getElementById('imovel-imagem');
  const adicionarUrl = () => {
    const url = campoUrl.value.trim();
    if (!url) return;
    if (!/^(https?:\/\/|\/)/i.test(url)) {
      avisar('Cole um endereço que comece com https://', 'erro');
      return;
    }
    _imovelGaleriaAtual.push(url);
    campoUrl.value = '';
    renderGaleria('imovel-imagens-lista', _imovelGaleriaAtual);
  };
  document.getElementById('imovel-imagem-adicionar').addEventListener('click', adicionarUrl);
  campoUrl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      adicionarUrl();
    }
  });

  // Localização própria do imóvel: colar link do Google Maps
  document.getElementById('imovel-mapa-link').addEventListener('input', (e) => {
    const texto = e.target.value.trim();
    const status = document.getElementById('imovel-mapa-status');
    const c = texto ? _coordenadasDoTexto(texto) : null;
    document.getElementById('imovel-lat').value = c ? c.lat : '';
    document.getElementById('imovel-lng').value = c ? c.lng : '';
    if (!texto) status.textContent = 'Em branco, o mapa do imóvel mostra a posição da obra escolhida acima ou, se não houver obra, o bairro.';
    else if (c) status.textContent = `Localização reconhecida: ${c.lat}, ${c.lng}. Salve o imóvel para gravar.`;
    else if (/goo\.gl|maps\.app/.test(texto)) status.textContent = 'Link encurtado não traz a posição. Abra-o no navegador e copie o endereço completo da barra.';
    else status.textContent = 'Não encontrei a posição nesse texto. Cole o endereço completo do Google Maps ou digite "latitude, longitude".';
  });
  document.getElementById('imovel-imagem-arquivo').addEventListener('change', (e) => {
    enviarFotosParaGaleria(e.target, _imovelGaleriaAtual, 'imovel-imagens-lista', 'imovel-upload-status');
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    comBotaoOcupado(form, () => salvarImovel());
  });

  async function salvarImovel() {
    const idCampo = document.getElementById('imovel-id').value;
    const num = (id) => Number(document.getElementById(id).value) || 0;
    const dados = {
      titulo: document.getElementById('imovel-titulo').value.trim(),
      bairro: document.getElementById('imovel-bairro').value.trim(),
      status: document.getElementById('imovel-status').value,
      preco: num('imovel-preco'),
      tipo: document.getElementById('imovel-tipo').value,
      cidade: document.getElementById('imovel-cidade').value.trim() || 'Petrolina',
      area: num('imovel-area'),
      quartos: num('imovel-quartos'),
      banheiros: num('imovel-banheiros'),
      vagas: num('imovel-vagas'),
      imagens: [..._imovelGaleriaAtual],
      descricao: document.getElementById('imovel-descricao').value.trim(),
      empreendimento_id: document.getElementById('imovel-empreendimento').value || null,
      destaque: document.getElementById('imovel-destaque').checked,
      localizacao: document.getElementById('imovel-lat').value
        ? { lat: Number(document.getElementById('imovel-lat').value), lng: Number(document.getElementById('imovel-lng').value) }
        : null,
    };
    try {
      if (idCampo) {
        await apiAuth(`/api/imoveis/${idCampo}`, 'PUT', dados);
      } else {
        await apiAuth('/api/imoveis', 'POST', dados);
      }
      limparFormImovel();
      renderAdminImoveis();
      renderAdminDashboard();
      avisar(idCampo ? 'Imóvel atualizado!' : 'Imóvel cadastrado!');
    } catch (err) {
      if (err.sessaoExpirada) return tratarSessaoExpirada();
      avisar(err.message, 'erro');
    }
  }

  document.getElementById('imovel-cancelar')?.addEventListener('click', limparFormImovel);
}

// ---- Seção: Depoimentos ----
async function renderAdminDepoimentos() {
  const tbody = document.getElementById('admin-depoimentos-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';

  let lista;
  try {
    lista = await apiGet('/api/depoimentos');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="4">Não foi possível carregar os depoimentos.</td></tr>';
    return;
  }

  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="4">Nenhum depoimento cadastrado ainda.</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map((d) => {
    const estrelas = Math.max(0, Math.min(5, Number(d.estrelas) || 5));
    return `
    <tr>
      <td>${escHTML(d.nome)}</td>
      <td>${escHTML(d.empreendimento) || '—'}</td>
      <td style="color:#F2A900;letter-spacing:1px;">${'★'.repeat(estrelas)}${'☆'.repeat(5 - estrelas)}</td>
      <td>
        <button class="btn btn-sm btn-outline-navy" data-editar-depoimento="${escHTML(d.id)}">Editar</button>
        <button class="btn btn-sm btn-primary" data-excluir-depoimento="${escHTML(d.id)}">Excluir</button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-editar-depoimento]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const d = lista.find((x) => String(x.id) === btn.getAttribute('data-editar-depoimento'));
      if (!d) return;
      document.getElementById('dep-id').value = d.id;
      document.getElementById('dep-nome').value = d.nome || '';
      document.getElementById('dep-empreendimento').value = d.empreendimento || '';
      document.getElementById('dep-texto').value = d.texto || '';
      document.getElementById('dep-estrelas').value = String(d.estrelas || 5);
      modoEdicao('dep', `Editar depoimento de ${d.nome || ''}`);
      document.getElementById('dep-salvar').textContent = 'Salvar alterações';
      document.getElementById('form-depoimento').scrollIntoView({ behavior: 'smooth' });
    });
  });

  tbody.querySelectorAll('[data-excluir-depoimento]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir este depoimento?')) return;
      const id = btn.getAttribute('data-excluir-depoimento');
      try {
        await apiAuth(`/api/depoimentos/${id}`, 'DELETE');
        if (document.getElementById('dep-id').value === id) limparFormDepoimento();
        renderAdminDepoimentos();
        renderAdminDashboard();
        avisar('Depoimento excluído.');
      } catch (err) {
        if (err.sessaoExpirada) return tratarSessaoExpirada();
        avisar(err.message, 'erro');
      }
    });
  });
}

function limparFormDepoimento() {
  document.getElementById('form-depoimento').reset();
  document.getElementById('dep-id').value = '';
  modoEdicao('dep', null);
  document.getElementById('dep-salvar').textContent = 'Adicionar';
}

function iniciarFormDepoimento() {
  const form = document.getElementById('form-depoimento');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    comBotaoOcupado(form, salvarDepoimento);
  });
  async function salvarDepoimento() {
    const id = document.getElementById('dep-id').value;
    const dados = {
      nome: document.getElementById('dep-nome').value,
      empreendimento: document.getElementById('dep-empreendimento').value,
      texto: document.getElementById('dep-texto').value,
      estrelas: Number(document.getElementById('dep-estrelas').value),
    };
    try {
      if (id) {
        await apiAuth(`/api/depoimentos/${id}`, 'PUT', dados);
      } else {
        await apiAuth('/api/depoimentos', 'POST', dados);
      }
      limparFormDepoimento();
      renderAdminDepoimentos();
      renderAdminDashboard();
      avisar(id ? 'Depoimento atualizado!' : 'Depoimento adicionado!');
    } catch (err) {
      if (err.sessaoExpirada) return tratarSessaoExpirada();
      avisar(err.message, 'erro');
    }
  }
  document.getElementById('dep-cancelar')?.addEventListener('click', limparFormDepoimento);
}

// ---- Seção: Blog ----
function limparFormBlog() {
  document.getElementById('form-blog').reset();
  document.getElementById('blog-id').value = '';
  document.getElementById('blog-upload-status').textContent = '';
  atualizarPreviewBlog();
  modoEdicao('blog', null);
}

function atualizarPreviewBlog() {
  const url = document.getElementById('blog-imagem')?.value.trim();
  const img = document.getElementById('blog-imagem-preview');
  if (!img) return;
  img.hidden = !url;
  if (url) img.src = url;
}

async function renderAdminBlog() {
  const tbody = document.getElementById('admin-blog-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';
  let lista;
  try {
    lista = await apiGet('/api/blog');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="4">Não foi possível carregar os artigos.</td></tr>';
    return;
  }
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="4">Nenhum artigo ainda.</td></tr>';
    return;
  }
  tbody.innerHTML = lista.map((p) => `
    <tr>
      <td>${p.imagem ? `<img class="admin-hero-thumb" src="${urlSegura(p.imagem)}" alt="">` : '—'}</td>
      <td>${escHTML(p.titulo)}</td>
      <td>${p.data ? formatarDataPost(p.data) : '—'}</td>
      <td>
        <button class="btn btn-sm btn-outline-navy" data-editar-post="${escHTML(p.id)}">Editar</button>
        <button class="btn btn-sm btn-primary" data-excluir-post="${escHTML(p.id)}">Excluir</button>
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('[data-editar-post]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = lista.find((x) => String(x.id) === btn.getAttribute('data-editar-post'));
      if (!p) return;
      document.getElementById('blog-id').value = p.id;
      document.getElementById('blog-titulo').value = p.titulo || '';
      document.getElementById('blog-categoria').value = p.categoria || '';
      document.getElementById('blog-data').value = p.data || '';
      document.getElementById('blog-resumo').value = p.resumo || '';
      document.getElementById('blog-corpo').value = p.corpo || '';
      document.getElementById('blog-imagem').value = p.imagem || '';
      document.getElementById('blog-upload-status').textContent = '';
      atualizarPreviewBlog();
      modoEdicao('blog', `Editar artigo: ${p.titulo || ''}`);
      document.getElementById('form-blog').scrollIntoView({ behavior: 'smooth' });
    });
  });
  tbody.querySelectorAll('[data-excluir-post]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir este artigo?')) return;
      const id = btn.getAttribute('data-excluir-post');
      try {
        await apiAuth(`/api/blog/${id}`, 'DELETE');
        if (document.getElementById('blog-id').value === id) limparFormBlog();
        renderAdminBlog();
        renderAdminDashboard();
        avisar('Artigo excluído.');
      } catch (err) {
        if (err.sessaoExpirada) return tratarSessaoExpirada();
        avisar(err.message, 'erro');
      }
    });
  });
}

function iniciarFormBlog() {
  const form = document.getElementById('form-blog');
  if (!form) return;
  document.getElementById('blog-imagem-arquivo').addEventListener('change', async (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    const status = document.getElementById('blog-upload-status');
    status.textContent = 'Enviando imagem...';
    try {
      const { url } = await apiUploadImagem(arquivo);
      document.getElementById('blog-imagem').value = url;
      atualizarPreviewBlog();
      status.textContent = 'Imagem enviada. Clique em "Salvar artigo".';
    } catch (err) {
      if (err.sessaoExpirada) return tratarSessaoExpirada();
      status.textContent = `Erro: ${err.message}`;
    }
    e.target.value = '';
  });
  document.getElementById('blog-imagem').addEventListener('input', atualizarPreviewBlog);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    comBotaoOcupado(form, salvarArtigo);
  });
  async function salvarArtigo() {
    const id = document.getElementById('blog-id').value;
    const dados = {
      titulo: document.getElementById('blog-titulo').value,
      categoria: document.getElementById('blog-categoria').value,
      data: document.getElementById('blog-data').value,
      resumo: document.getElementById('blog-resumo').value,
      corpo: document.getElementById('blog-corpo').value,
      imagem: document.getElementById('blog-imagem').value.trim(),
    };
    try {
      if (id) await apiAuth(`/api/blog/${id}`, 'PUT', dados);
      else await apiAuth('/api/blog', 'POST', dados);
      limparFormBlog();
      renderAdminBlog();
      renderAdminDashboard();
      avisar(id ? 'Artigo atualizado!' : 'Artigo publicado!');
    } catch (err) {
      if (err.sessaoExpirada) return tratarSessaoExpirada();
      avisar(err.message, 'erro');
    }
  }
  document.getElementById('blog-cancelar').addEventListener('click', limparFormBlog);
}

// ---- Seção: Configurações ----
const CORES_ORIGINAIS = { principal: '#001F3E', destaque: '#E3052D' };

function _formatarTelefone(numero) {
  const d = String(numero || '').replace(/\D/g, '').replace(/^55/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

async function carregarConfigAdmin() {
  let cfg;
  try {
    cfg = await apiGet('/api/configuracoes');
  } catch (e) {
    return;
  }
  document.getElementById('cfg-whatsapp').value = _formatarTelefone(cfg.whatsapp_numero);
  document.getElementById('cfg-whatsapp-msg').value = cfg.whatsapp_mensagem || '';
  document.getElementById('cfg-instagram').value = cfg.instagram_url || '';
  document.getElementById('cfg-facebook').value = cfg.facebook_url || '';
  document.getElementById('cfg-cor-principal').value = cfg.cor_principal || CORES_ORIGINAIS.principal;
  document.getElementById('cfg-cor-destaque').value = cfg.cor_destaque || CORES_ORIGINAIS.destaque;
}

function iniciarFormConfig() {
  const form = document.getElementById('form-config');
  if (!form) return;
  const status = document.getElementById('cfg-status');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    comBotaoOcupado(form, salvarConfig);
  });
  async function salvarConfig() {
    let numero = document.getElementById('cfg-whatsapp').value.replace(/\D/g, '');
    if (numero.length === 10 || numero.length === 11) numero = `55${numero}`; // DDD + número → com código do Brasil
    if (numero.length < 12) {
      status.textContent = 'Confira o número do WhatsApp: informe DDD + número.';
      return;
    }
    try {
      await apiAuth('/api/configuracoes', 'PUT', {
        whatsapp_numero: numero,
        whatsapp_mensagem: document.getElementById('cfg-whatsapp-msg').value,
        instagram_url: document.getElementById('cfg-instagram').value.trim(),
        facebook_url: document.getElementById('cfg-facebook').value.trim(),
        cor_principal: document.getElementById('cfg-cor-principal').value,
        cor_destaque: document.getElementById('cfg-cor-destaque').value,
      });
      status.textContent = '';
      avisar('Configurações salvas! Já valem para todo o site.');
      carregarConfigAdmin();
    } catch (err) {
      if (err.sessaoExpirada) return tratarSessaoExpirada();
      status.textContent = `Erro: ${err.message}`;
    }
  }
  document.getElementById('cfg-cores-padrao').addEventListener('click', () => {
    document.getElementById('cfg-cor-principal').value = CORES_ORIGINAIS.principal;
    document.getElementById('cfg-cor-destaque').value = CORES_ORIGINAIS.destaque;
    status.textContent = 'Cores originais selecionadas. Clique em "Salvar configurações" para aplicar.';
  });
}

// ---- Seção: Editar páginas (editor visual num iframe) ----
async function _urlDaPaginaEditor() {
  const select = document.getElementById('editor-pagina');
  const opcao = select.selectedOptions[0];
  let url = `/${select.value}?editar=1`;
  const fonte = opcao.getAttribute('data-precisa-id');
  if (fonte) {
    // Páginas de detalhe precisam de um item de exemplo para abrir
    const lista = await apiGet(`/api/${fonte}`).catch(() => []);
    if (lista.length) url += `&id=${encodeURIComponent(lista[0].id)}`;
  }
  return url;
}

function iniciarEditorPaginas() {
  const select = document.getElementById('editor-pagina');
  const iframe = document.getElementById('editor-iframe');
  if (!select || !iframe) return;
  let pendentes = 0;

  async function carregar() {
    iframe.src = await _urlDaPaginaEditor();
  }
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data) return;
    if (e.data.tipo === 'cms-pendentes') pendentes = e.data.total;
  });
  select.addEventListener('focus', () => { select.dataset.anterior = select.value; });
  select.addEventListener('change', () => {
    if (pendentes && !confirm('Há alterações não salvas nesta página. Trocar de página e perdê-las?')) {
      select.value = select.dataset.anterior || select.value;
      return;
    }
    pendentes = 0;
    carregar();
  });
  document.getElementById('editor-tela-cheia').addEventListener('click', async () => {
    window.open(await _urlDaPaginaEditor(), '_blank');
  });
  document.getElementById('editor-restaurar').addEventListener('click', async () => {
    const nome = select.selectedOptions[0].textContent;
    if (!confirm(`Voltar TODOS os textos, imagens e links da página "${nome}" ao original? (O cabeçalho e o rodapé não são afetados.)`)) return;
    try {
      await apiAuth(`/api/conteudo/${select.value.replace('.html', '')}`, 'DELETE');
      pendentes = 0;
      carregar();
      avisar('Textos originais restaurados.');
    } catch (err) {
      if (err.sessaoExpirada) return tratarSessaoExpirada();
      avisar(err.message, 'erro');
    }
  });
  // Só carrega o iframe quando a aba é aberta (evita pesar o painel à toa)
  document.addEventListener('admin:abriu-paginas', () => {
    if (!iframe.getAttribute('src')) carregar();
  });
}

// ---- Seção: Empreendimentos (com galeria de fotos) ----
let _empGaleriaAtual = []; // URLs das fotos do empreendimento em edição, na ordem de exibição

async function renderAdminEmpreendimentos() {
  const tbody = document.getElementById('admin-empreendimentos-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';

  let lista;
  try {
    lista = await apiGet('/api/empreendimentos');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="6">Não foi possível carregar os empreendimentos.</td></tr>';
    return;
  }

  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="6">Nenhum empreendimento cadastrado ainda.</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map((emp) => `
    <tr>
      <td>${emp.imagens && emp.imagens[0] ? `<img class="admin-hero-thumb" src="${urlSegura(emp.imagens[0])}" alt="">` : '—'}</td>
      <td>${escHTML(emp.nome)}</td>
      <td>${escHTML(emp.status) || '—'}</td>
      <td>${escHTML(emp.ano) || '—'}</td>
      <td>${escHTML(emp.total_unidades) || '—'}</td>
      <td>
        <button class="btn btn-sm btn-outline-navy" data-editar-emp="${escHTML(emp.id)}">Editar</button>
        <button class="btn btn-sm btn-primary" data-excluir-emp="${escHTML(emp.id)}">Excluir</button>
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('[data-excluir-emp]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir este empreendimento? Os imóveis vinculados a ele não serão excluídos, só perderão o vínculo.')) return;
      const id = btn.getAttribute('data-excluir-emp');
      try {
        await apiAuth(`/api/empreendimentos/${id}`, 'DELETE');
        if (document.getElementById('emp-id').value === id) limparFormEmpreendimento();
        renderAdminEmpreendimentos();
        renderAdminDashboard();
        popularSelectEmpreendimentos();
        avisar('Empreendimento excluído.');
      } catch (err) {
        if (err.sessaoExpirada) return tratarSessaoExpirada();
        avisar(err.message, 'erro');
      }
    });
  });
  tbody.querySelectorAll('[data-editar-emp]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-editar-emp');
      let item;
      try {
        item = await apiGet(`/api/empreendimentos/${id}`);
      } catch (err) {
        avisar('Não foi possível carregar este empreendimento. Ele pode ter sido excluído.', 'erro');
        renderAdminEmpreendimentos();
        return;
      }
      preencherFormEmpreendimento(item);
      document.getElementById('form-empreendimento').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

// Galeria de fotos do formulário (a primeira é a capa). Reordena com as setas
// (funciona no celular) ou arrastando com o mouse; o × remove a foto.
function renderGaleria(idLista, lista) {
  const wrap = document.getElementById(idLista);
  if (!wrap) return;
  const desenhar = () => renderGaleria(idLista, lista);
  wrap.innerHTML = lista.map((url, i) => `
    <div class="admin-galeria-item${i === 0 ? ' capa' : ''}" draggable="true" data-idx="${i}">
      <img src="${urlSegura(url)}" alt="">
      ${i === 0 ? '<span class="admin-galeria-capa-label">CAPA</span>' : ''}
      <button type="button" class="admin-galeria-remover" data-remover-foto="${i}" aria-label="Remover foto">&times;</button>
      <span class="admin-galeria-setas">
        <button type="button" data-mover-foto="${i}" data-passo="-1" aria-label="Mover para a esquerda"${i === 0 ? ' disabled' : ''}>◀</button>
        <button type="button" data-mover-foto="${i}" data-passo="1" aria-label="Mover para a direita"${i === lista.length - 1 ? ' disabled' : ''}>▶</button>
      </span>
    </div>`).join('');

  wrap.querySelectorAll('[data-remover-foto]').forEach((btn) => {
    btn.addEventListener('click', () => {
      lista.splice(Number(btn.getAttribute('data-remover-foto')), 1);
      desenhar();
    });
  });
  wrap.querySelectorAll('[data-mover-foto]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const de = Number(btn.getAttribute('data-mover-foto'));
      const para = de + Number(btn.getAttribute('data-passo'));
      if (para < 0 || para >= lista.length) return;
      [lista[de], lista[para]] = [lista[para], lista[de]];
      desenhar();
    });
  });

  let origemArraste = null;
  wrap.querySelectorAll('.admin-galeria-item').forEach((item) => {
    item.addEventListener('dragstart', () => {
      origemArraste = Number(item.getAttribute('data-idx'));
      item.classList.add('dragging');
    });
    item.addEventListener('dragend', () => item.classList.remove('dragging'));
    item.addEventListener('dragover', (e) => e.preventDefault());
    item.addEventListener('drop', () => {
      const destino = Number(item.getAttribute('data-idx'));
      if (origemArraste === null || origemArraste === destino) return;
      const [movido] = lista.splice(origemArraste, 1);
      lista.splice(destino, 0, movido);
      origemArraste = null;
      desenhar();
    });
  });
}

// Envia várias fotos e coloca na galeria (usado por imóveis e empreendimentos)
async function enviarFotosParaGaleria(input, lista, idLista, idStatus) {
  const arquivos = [...input.files];
  input.value = '';
  if (!arquivos.length) return;
  const status = document.getElementById(idStatus);
  let enviadas = 0;
  for (const arquivo of arquivos) {
    status.textContent = `Enviando foto ${enviadas + 1} de ${arquivos.length}...`;
    try {
      const { url } = await apiUploadImagem(arquivo);
      lista.push(url);
      enviadas += 1;
      renderGaleria(idLista, lista);
    } catch (err) {
      if (err.sessaoExpirada) return tratarSessaoExpirada();
      status.textContent = `Erro na foto "${arquivo.name}": ${err.message}`;
      return;
    }
  }
  status.textContent = `${enviadas} foto(s) enviada(s). Clique em "Salvar" para gravar.`;
}

function renderGaleriaEmpreendimento() {
  renderGaleria('emp-imagens-lista', _empGaleriaAtual);
}

// Extrai latitude/longitude de um link do Google Maps (ou de "lat, lng" digitado)
function _coordenadasDoTexto(texto) {
  const t = String(texto || '').trim();
  const padroes = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,          // ...!3d-9.38!4d-40.50 (posição exata do marcador)
    /[?&](?:q|query|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,              // .../@-9.38,-40.50,17z
    /^(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)$/, // -9.38, -40.50
  ];
  for (const re of padroes) {
    const m = t.match(re);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}

function atualizarPreviaMapaEmpreendimento() {
  const iframe = document.getElementById('emp-mapa-previa');
  if (!iframe) return;
  const lat = Number(document.getElementById('emp-lat').value);
  const lng = Number(document.getElementById('emp-lng').value);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
  const url = `https://www.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
  if (iframe.dataset.url !== url) {
    iframe.dataset.url = url;
    iframe.src = url;
  }
}

function preencherFormEmpreendimento(item) {
  document.getElementById('emp-id').value = item.id;
  document.getElementById('emp-nome').value = item.nome || '';
  document.getElementById('emp-status').value = item.status || 'Em construção';
  document.getElementById('emp-descricao').value = item.descricao || '';
  document.getElementById('emp-diferenciais').value = (item.diferenciais || []).join('\n');
  document.getElementById('emp-ano').value = item.ano || '';
  document.getElementById('emp-total-unidades').value = item.total_unidades || '';
  document.getElementById('emp-lat').value = item.localizacao ? item.localizacao.lat : -9.3891;
  document.getElementById('emp-lng').value = item.localizacao ? item.localizacao.lng : -40.5030;
  modoEdicao('emp', `Editar empreendimento: ${item.nome || ''}`);
  document.getElementById('emp-upload-status').textContent = '';
  _empGaleriaAtual = [...(item.imagens || [])];
  renderGaleriaEmpreendimento();
  document.getElementById('emp-mapa-link').value = '';
  atualizarPreviaMapaEmpreendimento();
}

function limparFormEmpreendimento() {
  const form = document.getElementById('form-empreendimento');
  form.reset();
  document.getElementById('emp-id').value = '';
  document.getElementById('emp-lat').value = -9.3891;
  document.getElementById('emp-lng').value = -40.5030;
  modoEdicao('emp', null);
  document.getElementById('emp-upload-status').textContent = '';
  _empGaleriaAtual = [];
  renderGaleriaEmpreendimento();
  atualizarPreviaMapaEmpreendimento();
}

function iniciarFormEmpreendimento() {
  const form = document.getElementById('form-empreendimento');
  if (!form) return;

  // Localização: colar link do Google Maps preenche latitude/longitude
  const campoLink = document.getElementById('emp-mapa-link');
  const statusMapa = document.getElementById('emp-mapa-status');
  let timerMapa;
  campoLink.addEventListener('input', () => {
    const texto = campoLink.value.trim();
    if (!texto) return;
    const c = _coordenadasDoTexto(texto);
    if (c) {
      document.getElementById('emp-lat').value = c.lat;
      document.getElementById('emp-lng').value = c.lng;
      statusMapa.textContent = `Localização reconhecida: ${c.lat}, ${c.lng}. Confira no mapa abaixo e salve.`;
      atualizarPreviaMapaEmpreendimento();
    } else if (/goo\.gl|maps\.app/.test(texto)) {
      statusMapa.textContent = 'Esse é um link encurtado e não traz a posição. Abra-o no navegador e copie o endereço completo da barra (o que tem "@-9.38...,-40.50...").';
    } else {
      statusMapa.textContent = 'Não encontrei a posição nesse texto. Cole o endereço completo do Google Maps ou digite "latitude, longitude".';
    }
  });
  ['emp-lat', 'emp-lng'].forEach((id) => document.getElementById(id).addEventListener('input', () => {
    clearTimeout(timerMapa);
    timerMapa = setTimeout(atualizarPreviaMapaEmpreendimento, 600);
  }));

  document.getElementById('emp-imagens-arquivo').addEventListener('change', (e) => {
    enviarFotosParaGaleria(e.target, _empGaleriaAtual, 'emp-imagens-lista', 'emp-upload-status');
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    comBotaoOcupado(form, salvarEmpreendimento);
  });
  async function salvarEmpreendimento() {
    const idCampo = document.getElementById('emp-id').value;
    const diferenciais = document.getElementById('emp-diferenciais').value
      .split('\n').map((s) => s.trim()).filter(Boolean);
    const dados = {
      nome: document.getElementById('emp-nome').value,
      status: document.getElementById('emp-status').value,
      descricao: document.getElementById('emp-descricao').value,
      diferenciais,
      ano: document.getElementById('emp-ano').value ? Number(document.getElementById('emp-ano').value) : null,
      total_unidades: document.getElementById('emp-total-unidades').value ? Number(document.getElementById('emp-total-unidades').value) : null,
      localizacao: {
        lat: Number(document.getElementById('emp-lat').value),
        lng: Number(document.getElementById('emp-lng').value),
      },
      imagens: _empGaleriaAtual,
    };
    try {
      if (idCampo) {
        await apiAuth(`/api/empreendimentos/${idCampo}`, 'PUT', dados);
      } else {
        await apiAuth('/api/empreendimentos', 'POST', dados);
      }
      limparFormEmpreendimento();
      renderAdminEmpreendimentos();
      renderAdminDashboard();
      popularSelectEmpreendimentos();
      avisar(idCampo ? 'Empreendimento atualizado!' : 'Empreendimento cadastrado!');
    } catch (err) {
      if (err.sessaoExpirada) return tratarSessaoExpirada();
      avisar(err.message, 'erro');
    }
  }

  document.getElementById('emp-cancelar')?.addEventListener('click', limparFormEmpreendimento);
}

// Preenche o seletor de empreendimento no formulário de imóvel
async function popularSelectEmpreendimentos() {
  const select = document.getElementById('imovel-empreendimento');
  if (!select) return;
  const valorAtual = select.value;
  let lista;
  try {
    lista = await apiGet('/api/empreendimentos');
  } catch (e) {
    return;
  }
  select.innerHTML = '<option value="">Nenhum (imóvel avulso)</option>'
    + lista.map((emp) => `<option value="${escHTML(emp.id)}">${escHTML(emp.nome)}</option>`).join('');
  select.value = valorAtual;
}

// ---- Dashboard ----
async function renderAdminDashboard() {
  const el = document.getElementById('dash-imoveis-total');
  const el2 = document.getElementById('dash-depoimentos-total');
  const el4 = document.getElementById('dash-empreendimentos-total');
  const el5 = document.getElementById('dash-leads-total');
  if (!el || !el2) return;
  const [imoveis, depoimentos, empreendimentos, leads] = await Promise.all([
    apiGet('/api/imoveis').catch(() => []),
    apiGet('/api/depoimentos').catch(() => []),
    apiGet('/api/empreendimentos').catch(() => []),
    apiAuth('/api/leads', 'GET').catch(() => []),
  ]);
  el.textContent = imoveis.length;
  el2.textContent = depoimentos.length;
  if (el4) el4.textContent = empreendimentos.length;
  if (el5) el5.textContent = leads.length;
  const el6 = document.getElementById('dash-blog-total');
  if (el6) el6.textContent = (await apiGet('/api/blog').catch(() => [])).length;
}

// ---- Seção: Leads (formulário de contato) ----
// Os leads vêm de visitantes anônimos (sem login) — escapamos antes de jogar
// em innerHTML pra um texto malicioso no formulário não rodar no navegador
// do admin logado (o que roubaria o token da sessão).
function _escaparHTML(texto) {
  const div = document.createElement('div');
  div.textContent = texto == null ? '' : String(texto);
  return div.innerHTML;
}

// Constrói o link do WhatsApp para o ADMIN falar com o lead (número do lead,
// não o número da empresa — por isso não reaproveita linkWhatsApp/data-wa).
function _linkWhatsAppParaLead(telefone, nome) {
  let digitos = (telefone || '').replace(/\D/g, '');
  if (digitos.length <= 11) digitos = `55${digitos}`; // assume DDD+número sem o 55
  const texto = `Olá${nome ? `, ${nome}` : ''}! Aqui é da Rocha Costa, vi que você entrou em contato pelo site.`;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`;
}

function _formatarDataLead(iso) {
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch (e) {
    return iso || '—';
  }
}

async function renderAdminLeads() {
  const tbody = document.getElementById('admin-leads-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>';

  let lista;
  try {
    lista = await apiAuth('/api/leads', 'GET');
  } catch (err) {
    if (err.sessaoExpirada) return tratarSessaoExpirada();
    tbody.innerHTML = '<tr><td colspan="6">Não foi possível carregar os leads.</td></tr>';
    return;
  }

  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="6">Nenhum lead recebido ainda.</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map((l) => `
    <tr>
      <td>${_formatarDataLead(l.criado_em)}</td>
      <td>${_escaparHTML(l.nome)}</td>
      <td>${_escaparHTML([l.telefone, l.email].filter(Boolean).join(' · ')) || '—'}</td>
      <td style="max-width:260px;white-space:normal;">${_escaparHTML(l.mensagem) || '—'}</td>
      <td>${_escaparHTML(l.origem)}</td>
      <td>
        ${l.telefone ? `<a class="btn btn-sm btn-outline-navy" href="${_linkWhatsAppParaLead(l.telefone, l.nome)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
        <button class="btn btn-sm btn-primary" data-excluir-lead="${_escaparHTML(l.id)}">Excluir</button>
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('[data-excluir-lead]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir este lead?')) return;
      const id = btn.getAttribute('data-excluir-lead');
      try {
        await apiAuth(`/api/leads/${id}`, 'DELETE');
        renderAdminLeads();
        renderAdminDashboard();
        avisar('Lead excluído.');
      } catch (err) {
        if (err.sessaoExpirada) return tratarSessaoExpirada();
        avisar(err.message, 'erro');
      }
    });
  });
}

// ---- Navegação entre seções do painel (com transição) ----
// A seção aberta fica guardada numa variável (e no endereço, #secao-...), em vez
// de ser descoberta pelo estilo da página: antes, alguns itens do menu não abriam.
let _secaoAtual = 'secao-dashboard';

function abrirSecaoAdmin(alvo, animar = true) {
  const proxima = document.getElementById(alvo);
  if (!proxima || !proxima.classList.contains('admin-section') || alvo === _secaoAtual) return;
  const atual = document.getElementById(_secaoAtual);
  _secaoAtual = alvo;
  document.querySelectorAll('[data-admin-secao]').forEach((l) => l.classList.toggle('active', l.getAttribute('data-admin-secao') === alvo));
  history.replaceState(null, '', `#${alvo}`);
  // A prévia do mapa e o editor de páginas só carregam quando a aba é aberta
  if (alvo === 'secao-empreendimentos') atualizarPreviaMapaEmpreendimento();
  if (alvo === 'secao-paginas') document.dispatchEvent(new CustomEvent('admin:abriu-paginas'));

  const trocar = () => {
    document.querySelectorAll('.admin-section').forEach((s) => {
      s.style.display = 'none';
      s.classList.remove('admin-section--enter', 'admin-section--leave');
    });
    proxima.style.display = 'block';
    void proxima.offsetWidth; // força reflow para a animação reiniciar
    proxima.classList.add('admin-section--enter');
    document.querySelector('.admin-main')?.scrollTo?.(0, 0);
    window.scrollTo(0, 0);
  };
  if (atual && animar) {
    atual.classList.add('admin-section--leave');
    setTimeout(trocar, 150);
  } else {
    trocar();
  }
}

function iniciarNavegacaoAdmin() {
  document.querySelectorAll('[data-admin-secao], [data-ir-secao]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      abrirSecaoAdmin(link.getAttribute('data-admin-secao') || link.getAttribute('data-ir-secao'));
    });
  });
  // Recarregou a página? Volta para a mesma aba
  const doEndereco = location.hash.slice(1);
  if (doEndereco && doEndereco !== _secaoAtual) abrirSecaoAdmin(doEndereco, false);
}

// Evita registrar os listeners dos formulários mais de uma vez — pode ser
// chamada tanto pelo login automático (token já salvo) quanto pelo submit
// manual do login; sem essa trava, um POST de formulário dispararia em
// duplicidade (dois listeners = duas requisições para o mesmo clique).
let _painelAdminIniciado = false;

function iniciarPainelAdmin() {
  renderAdminDashboard();
  renderAdminEmpreendimentos();
  renderAdminImoveis();
  renderAdminDepoimentos();
  renderAdminLeads();
  renderAdminBlog();
  carregarConfigAdmin();
  popularSelectEmpreendimentos();

  if (_painelAdminIniciado) return;
  _painelAdminIniciado = true;

  iniciarFormEmpreendimento();
  iniciarFormImovel();
  iniciarFormDepoimento();
  iniciarFormBlog();
  iniciarFormConfig();
  iniciarFormAcesso();
  iniciarEditorPaginas();
  iniciarNavegacaoAdmin(); // por último: pode abrir direto a aba que estava no endereço
}

document.addEventListener('DOMContentLoaded', () => {
  iniciarLoginAdmin();
});
