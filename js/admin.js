/* =========================================================
   Rocha Costa — Painel administrativo (backend real)
   =========================================================
   Login e CRUD de imóveis/depoimentos passam pela API em
   server/app.py. As edições feitas aqui agora valem para
   todo mundo que visita o site — não ficam só no navegador
   de quem está editando.
   ========================================================= */

function adminEstaLogado() {
  return !!getAdminToken();
}

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
        <button class="btn btn-sm btn-outline-navy" data-editar-imovel="${im.id}">Editar</button>
        <button class="btn btn-sm btn-primary" data-excluir-imovel="${im.id}">Excluir</button>
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('[data-excluir-imovel]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir este imóvel? Essa ação não pode ser desfeita.')) return;
      const id = btn.getAttribute('data-excluir-imovel');
      try {
        await apiAuth(`/api/imoveis/${id}`, 'DELETE');
        renderAdminImoveis();
      } catch (err) {
        if (err.sessaoExpirada) return tratarSessaoExpirada();
        alert(err.message);
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
        alert('Não foi possível carregar este imóvel. Ele pode ter sido excluído.');
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
      val('imovel-imagem', item.imagem);
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
      atualizarPreviewImovel();
      document.getElementById('form-imovel').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

function atualizarPreviewImovel() {
  const url = document.getElementById('imovel-imagem')?.value.trim();
  const img = document.getElementById('imovel-imagem-preview');
  if (!img) return;
  img.hidden = !url;
  if (url) img.src = url;
}

function limparFormImovel() {
  const form = document.getElementById('form-imovel');
  form.reset();
  document.getElementById('imovel-id').value = '';
  document.getElementById('imovel-upload-status').textContent = '';
  document.getElementById('imovel-lat').value = '';
  document.getElementById('imovel-lng').value = '';
  document.getElementById('imovel-mapa-status').textContent = 'Em branco, o mapa do imóvel mostra a posição da obra escolhida acima ou, se não houver obra, o bairro.';
  atualizarPreviewImovel();
}

function iniciarFormImovel() {
  const form = document.getElementById('form-imovel');
  if (!form) return;

  document.getElementById('imovel-imagem').addEventListener('input', atualizarPreviewImovel);

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
  document.getElementById('imovel-imagem-arquivo').addEventListener('change', async (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    const status = document.getElementById('imovel-upload-status');
    status.textContent = 'Enviando foto...';
    try {
      const { url } = await apiUploadImagem(arquivo);
      document.getElementById('imovel-imagem').value = url;
      atualizarPreviewImovel();
      status.textContent = 'Foto enviada. Clique em "Salvar" para gravar o imóvel.';
    } catch (err) {
      if (err.sessaoExpirada) return tratarSessaoExpirada();
      status.textContent = `Erro: ${err.message}`;
    }
    e.target.value = '';
  });

  let salvando = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (salvando) return; // clique duplo não cria o imóvel duas vezes
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
      imagem: document.getElementById('imovel-imagem').value.trim(),
      descricao: document.getElementById('imovel-descricao').value.trim(),
      empreendimento_id: document.getElementById('imovel-empreendimento').value || null,
      destaque: document.getElementById('imovel-destaque').checked,
      localizacao: document.getElementById('imovel-lat').value
        ? { lat: Number(document.getElementById('imovel-lat').value), lng: Number(document.getElementById('imovel-lng').value) }
        : null,
    };
    salvando = true;
    try {
      if (idCampo) {
        await apiAuth(`/api/imoveis/${idCampo}`, 'PUT', dados);
      } else {
        await apiAuth('/api/imoveis', 'POST', dados);
      }
      limparFormImovel();
      renderAdminImoveis();
      renderAdminDashboard();
    } catch (err) {
      if (err.sessaoExpirada) return tratarSessaoExpirada();
      alert(err.message);
    } finally {
      salvando = false;
    }
  });

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
      document.getElementById('form-depoimento-titulo').textContent = 'Editar depoimento';
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
        renderAdminDepoimentos();
      } catch (err) {
        if (err.sessaoExpirada) return tratarSessaoExpirada();
        alert(err.message);
      }
    });
  });
}

function limparFormDepoimento() {
  document.getElementById('form-depoimento').reset();
  document.getElementById('dep-id').value = '';
  document.getElementById('form-depoimento-titulo').textContent = 'Adicionar depoimento';
  document.getElementById('dep-salvar').textContent = 'Adicionar';
}

function iniciarFormDepoimento() {
  const form = document.getElementById('form-depoimento');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
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
    } catch (err) {
      if (err.sessaoExpirada) return tratarSessaoExpirada();
      alert(err.message);
    }
  });
  document.getElementById('dep-cancelar')?.addEventListener('click', limparFormDepoimento);
}

// ---- Seção: Blog ----
function limparFormBlog() {
  document.getElementById('form-blog').reset();
  document.getElementById('blog-id').value = '';
  document.getElementById('blog-upload-status').textContent = '';
  document.getElementById('form-blog-titulo-secao').textContent = 'Novo artigo';
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
      document.getElementById('form-blog-titulo-secao').textContent = 'Editar artigo';
      document.getElementById('form-blog').scrollIntoView({ behavior: 'smooth' });
    });
  });
  tbody.querySelectorAll('[data-excluir-post]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir este artigo?')) return;
      try {
        await apiAuth(`/api/blog/${btn.getAttribute('data-excluir-post')}`, 'DELETE');
        renderAdminBlog();
        renderAdminDashboard();
      } catch (err) {
        if (err.sessaoExpirada) return tratarSessaoExpirada();
        alert(err.message);
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
      status.textContent = 'Imagem enviada. Clique em "Salvar artigo".';
    } catch (err) {
      if (err.sessaoExpirada) return tratarSessaoExpirada();
      status.textContent = `Erro: ${err.message}`;
    }
    e.target.value = '';
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
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
    } catch (err) {
      if (err.sessaoExpirada) return tratarSessaoExpirada();
      alert(err.message);
    }
  });
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
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
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
      status.textContent = 'Configurações salvas! Já valem para todo o site.';
      carregarConfigAdmin();
    } catch (err) {
      if (err.sessaoExpirada) return tratarSessaoExpirada();
      status.textContent = `Erro: ${err.message}`;
    }
  });
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
    } catch (err) {
      if (err.sessaoExpirada) return tratarSessaoExpirada();
      alert(err.message);
    }
  });
  // Só carrega o iframe quando a aba é aberta (evita pesar o painel à toa)
  document.querySelector('[data-admin-secao="secao-paginas"]')?.addEventListener('click', () => {
    if (!iframe.src) carregar();
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
        <button class="btn btn-sm btn-outline-navy" data-editar-emp="${emp.id}">Editar</button>
        <button class="btn btn-sm btn-primary" data-excluir-emp="${emp.id}">Excluir</button>
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('[data-excluir-emp]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir este empreendimento? Os imóveis vinculados a ele não serão excluídos, só perderão o vínculo.')) return;
      const id = btn.getAttribute('data-excluir-emp');
      try {
        await apiAuth(`/api/empreendimentos/${id}`, 'DELETE');
        renderAdminEmpreendimentos();
        renderAdminDashboard();
        popularSelectEmpreendimentos();
      } catch (err) {
        if (err.sessaoExpirada) return tratarSessaoExpirada();
        alert(err.message);
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
        alert('Não foi possível carregar este empreendimento. Ele pode ter sido excluído.');
        renderAdminEmpreendimentos();
        return;
      }
      preencherFormEmpreendimento(item);
      document.getElementById('form-empreendimento').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

function renderGaleriaEmpreendimento() {
  const wrap = document.getElementById('emp-imagens-lista');
  wrap.innerHTML = _empGaleriaAtual.map((url, i) => `
    <div class="admin-galeria-item${i === 0 ? ' capa' : ''}" draggable="true" data-idx="${i}">
      <img src="${urlSegura(url)}" alt="">
      ${i === 0 ? '<span class="admin-galeria-capa-label">CAPA</span>' : ''}
      <button type="button" class="admin-galeria-remover" data-remover-foto="${i}" aria-label="Remover foto">&times;</button>
    </div>`).join('');

  wrap.querySelectorAll('[data-remover-foto]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-remover-foto'));
      _empGaleriaAtual.splice(idx, 1);
      renderGaleriaEmpreendimento();
    });
  });

  // Reordenar por arraste (a primeira posição vira a capa)
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
      const [movido] = _empGaleriaAtual.splice(origemArraste, 1);
      _empGaleriaAtual.splice(destino, 0, movido);
      origemArraste = null;
      renderGaleriaEmpreendimento();
    });
  });
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
  document.getElementById('form-empreendimento-titulo-secao').textContent = 'Editar empreendimento';
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
  document.getElementById('form-empreendimento-titulo-secao').textContent = 'Adicionar empreendimento';
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
  // A prévia só carrega quando a aba de empreendimentos é aberta
  document.querySelector('[data-admin-secao="secao-empreendimentos"]')?.addEventListener('click', atualizarPreviaMapaEmpreendimento);

  document.getElementById('emp-imagens-arquivo').addEventListener('change', async (e) => {
    const arquivos = [...e.target.files];
    if (!arquivos.length) return;
    const status = document.getElementById('emp-upload-status');
    status.textContent = `Enviando ${arquivos.length} foto(s)...`;
    try {
      for (const arquivo of arquivos) {
        const { url } = await apiUploadImagem(arquivo);
        _empGaleriaAtual.push(url);
      }
      renderGaleriaEmpreendimento();
      status.textContent = 'Fotos enviadas com sucesso.';
    } catch (err) {
      if (err.sessaoExpirada) return tratarSessaoExpirada();
      status.textContent = `Erro: ${err.message}`;
    }
    e.target.value = '';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
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
    } catch (err) {
      if (err.sessaoExpirada) return tratarSessaoExpirada();
      alert(err.message);
    }
  });

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

// ---- Seção: Banners do topo (slides da home) ----
// Cada banner = imagem para computador + imagem para celular + destino do clique.
const HERO_DESTINOS = {
  imoveis: 'Catálogo de imóveis', portfolio: 'Portfólio de obras', simulador: 'Simulador',
  depoimentos: 'Depoimentos', contato: 'Contato', blog: 'Blog', sobre: 'Sobre nós', whatsapp: 'WhatsApp',
  imovel: 'Um imóvel específico', empreendimento: 'Um empreendimento específico', url: 'Endereço personalizado', nenhum: 'Nenhum (sem link)',
};

async function _nomeDestinoHero(s) {
  const base = HERO_DESTINOS[s.cta_tipo] || s.cta_tipo || '—';
  if (s.cta_tipo === 'url') return `${base}: ${s.cta_valor || '—'}`;
  if (s.cta_tipo === 'imovel' || s.cta_tipo === 'empreendimento') {
    const lista = await apiGet(`/api/${s.cta_tipo === 'imovel' ? 'imoveis' : 'empreendimentos'}`).catch(() => []);
    const item = lista.find((x) => String(x.id) === String(s.cta_valor));
    return `${base}: ${item ? (item.titulo || item.nome) : 'não encontrado'}`;
  }
  return base;
}

async function renderAdminHero() {
  const tbody = document.getElementById('admin-hero-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';

  let lista;
  try {
    lista = await apiGet('/api/hero-slides');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="4">Não foi possível carregar os banners.</td></tr>';
    return;
  }
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="4">Nenhum banner cadastrado — a página inicial mostra um texto padrão no lugar.</td></tr>';
    return;
  }

  const destinos = await Promise.all(lista.map(_nomeDestinoHero));
  tbody.innerHTML = lista.map((s, i) => `
    <tr>
      <td>${s.imagem ? `<img class="admin-hero-thumb" src="${urlSegura(s.imagem)}" alt="">` : '<span class="form-note">sem imagem</span>'}</td>
      <td>${s.imagem_mobile ? `<img class="admin-hero-thumb admin-hero-thumb--celular" src="${urlSegura(s.imagem_mobile)}" alt="">` : '<span class="form-note">usa a do computador</span>'}</td>
      <td>${escHTML(destinos[i])}</td>
      <td>
        <button class="btn btn-sm btn-outline-navy" data-editar-hero="${escHTML(s.id)}">Editar</button>
        <button class="btn btn-sm btn-primary" data-excluir-hero="${escHTML(s.id)}">Excluir</button>
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('[data-excluir-hero]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir este banner?')) return;
      try {
        await apiAuth(`/api/hero-slides/${btn.getAttribute('data-excluir-hero')}`, 'DELETE');
        renderAdminHero();
        renderAdminDashboard();
      } catch (err) {
        if (err.sessaoExpirada) return tratarSessaoExpirada();
        alert(err.message);
      }
    });
  });
  tbody.querySelectorAll('[data-editar-hero]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = lista.find((x) => String(x.id) === btn.getAttribute('data-editar-hero'));
      if (!item) return;
      preencherFormHero(item);
      document.getElementById('form-hero').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

function _previewHero(tipo, url) {
  const img = document.getElementById(`hero-preview-${tipo}`);
  if (!img) return;
  img.hidden = !url;
  if (url) img.src = url;
}

// Mostra o campo certo embaixo do "Ao clicar, levar para"
async function atualizarDestinoHero(valorAtual) {
  const tipo = document.getElementById('hero-cta-tipo').value;
  const wrapUrl = document.getElementById('hero-cta-valor-wrap');
  const wrapItem = document.getElementById('hero-cta-item-wrap');
  wrapUrl.hidden = tipo !== 'url';
  wrapItem.hidden = !(tipo === 'imovel' || tipo === 'empreendimento');
  if (!wrapItem.hidden) {
    const select = document.getElementById('hero-cta-item');
    document.getElementById('hero-cta-item-label').textContent = tipo === 'imovel' ? 'Qual imóvel?' : 'Qual empreendimento?';
    const lista = await apiGet(`/api/${tipo === 'imovel' ? 'imoveis' : 'empreendimentos'}`).catch(() => []);
    select.innerHTML = lista.map((x) => `<option value="${escHTML(x.id)}">${escHTML(x.titulo || x.nome)}${x.bairro ? ` — ${escHTML(x.bairro)}` : ''}</option>`).join('')
      || '<option value="">Nenhum cadastrado ainda</option>';
    if (valorAtual) select.value = String(valorAtual);
  }
}

function preencherFormHero(item) {
  document.getElementById('hero-id').value = item.id;
  document.getElementById('hero-titulo').value = item.titulo || '';
  document.getElementById('hero-imagem-url').value = item.imagem || '';
  document.getElementById('hero-imagem-mobile-url').value = item.imagem_mobile || '';
  const tipo = HERO_DESTINOS[item.cta_tipo] ? item.cta_tipo : 'imoveis';
  document.getElementById('hero-cta-tipo').value = tipo;
  document.getElementById('hero-cta-valor').value = tipo === 'url' ? (item.cta_valor || '') : '';
  document.getElementById('form-hero-titulo-secao').textContent = 'Editar banner';
  _previewHero('pc', item.imagem);
  _previewHero('celular', item.imagem_mobile);
  atualizarDestinoHero(item.cta_valor);
}

function limparFormHero() {
  document.getElementById('form-hero').reset();
  document.getElementById('hero-id').value = '';
  document.getElementById('form-hero-titulo-secao').textContent = 'Adicionar banner';
  document.getElementById('hero-upload-status').textContent = '';
  document.getElementById('hero-upload-mobile-status').textContent = '';
  _previewHero('pc', '');
  _previewHero('celular', '');
  atualizarDestinoHero();
}

function iniciarFormHero() {
  const form = document.getElementById('form-hero');
  if (!form) return;

  document.getElementById('hero-cta-tipo').addEventListener('change', () => atualizarDestinoHero());

  // Upload das duas imagens (computador e celular)
  [['hero-imagem-arquivo', 'hero-imagem-url', 'hero-upload-status', 'pc'],
    ['hero-imagem-mobile-arquivo', 'hero-imagem-mobile-url', 'hero-upload-mobile-status', 'celular']]
    .forEach(([idArquivo, idUrl, idStatus, tipo]) => {
      document.getElementById(idUrl).addEventListener('input', (e) => _previewHero(tipo, e.target.value.trim()));
      document.getElementById(idArquivo).addEventListener('change', async (e) => {
        const arquivo = e.target.files[0];
        if (!arquivo) return;
        const status = document.getElementById(idStatus);
        status.textContent = 'Enviando imagem...';
        try {
          const { url } = await apiUploadImagem(arquivo);
          document.getElementById(idUrl).value = url;
          _previewHero(tipo, url);
          status.textContent = 'Imagem enviada. Clique em "Salvar banner".';
        } catch (err) {
          if (err.sessaoExpirada) return tratarSessaoExpirada();
          status.textContent = `Erro: ${err.message}`;
        }
        e.target.value = '';
      });
    });

  let salvando = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (salvando) return;
    const idCampo = document.getElementById('hero-id').value;
    const imagem = document.getElementById('hero-imagem-url').value.trim();
    if (!imagem) {
      alert('Envie a imagem para computador (é obrigatória).');
      return;
    }
    const tipo = document.getElementById('hero-cta-tipo').value;
    let valor = '';
    if (tipo === 'url') valor = document.getElementById('hero-cta-valor').value.trim();
    if (tipo === 'imovel' || tipo === 'empreendimento') valor = document.getElementById('hero-cta-item').value;
    if ((tipo === 'url' || tipo === 'imovel' || tipo === 'empreendimento') && !valor) {
      alert('Escolha para onde o banner deve levar.');
      return;
    }
    const dados = {
      titulo: document.getElementById('hero-titulo').value.trim(),
      imagem,
      imagem_mobile: document.getElementById('hero-imagem-mobile-url').value.trim(),
      cta_tipo: tipo,
      cta_valor: valor,
      area_clicavel: null,
    };
    salvando = true;
    try {
      if (idCampo) await apiAuth(`/api/hero-slides/${idCampo}`, 'PUT', dados);
      else await apiAuth('/api/hero-slides', 'POST', dados);
      limparFormHero();
      renderAdminHero();
      renderAdminDashboard();
    } catch (err) {
      if (err.sessaoExpirada) return tratarSessaoExpirada();
      alert(err.message);
    } finally {
      salvando = false;
    }
  });

  document.getElementById('hero-cancelar')?.addEventListener('click', limparFormHero);
}

// ---- Dashboard ----
async function renderAdminDashboard() {
  const el = document.getElementById('dash-imoveis-total');
  const el2 = document.getElementById('dash-depoimentos-total');
  const el3 = document.getElementById('dash-hero-total');
  const el4 = document.getElementById('dash-empreendimentos-total');
  const el5 = document.getElementById('dash-leads-total');
  if (!el || !el2) return;
  const [imoveis, depoimentos, heroSlides, empreendimentos, leads] = await Promise.all([
    apiGet('/api/imoveis').catch(() => []),
    apiGet('/api/depoimentos').catch(() => []),
    apiGet('/api/hero-slides').catch(() => []),
    apiGet('/api/empreendimentos').catch(() => []),
    apiAuth('/api/leads', 'GET').catch(() => []),
  ]);
  el.textContent = imoveis.length;
  el2.textContent = depoimentos.length;
  if (el3) el3.textContent = heroSlides.length;
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
        <button class="btn btn-sm btn-primary" data-excluir-lead="${l.id}">Excluir</button>
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
      } catch (err) {
        if (err.sessaoExpirada) return tratarSessaoExpirada();
        alert(err.message);
      }
    });
  });
}

// ---- Navegação entre seções do painel (com transição) ----
function iniciarNavegacaoAdmin() {
  document.querySelectorAll('[data-admin-secao]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const alvo = link.getAttribute('data-admin-secao');
      const atual = document.querySelector('.admin-section[style*="display: block"], .admin-section:not([style*="display: none"])');
      const proxima = document.getElementById(alvo);
      if (proxima === atual) return;

      document.querySelectorAll('[data-admin-secao]').forEach((l) => l.classList.remove('active'));
      link.classList.add('active');

      const trocar = () => {
        // Remove também a classe de saída: antes ela ficava na seção e, ao
        // voltar para ela depois, a seção abria invisível (opacity 0).
        document.querySelectorAll('.admin-section').forEach((s) => {
          s.style.display = 'none';
          s.classList.remove('admin-section--enter', 'admin-section--leave');
        });
        proxima.style.display = 'block';
        // força reflow para a animação reiniciar mesmo se a mesma classe já foi usada antes
        void proxima.offsetWidth;
        proxima.classList.add('admin-section--enter');
      };

      if (atual) {
        atual.classList.add('admin-section--leave');
        setTimeout(trocar, 150);
      } else {
        trocar();
      }
    });
  });
}

// Evita registrar os listeners dos formulários mais de uma vez — pode ser
// chamada tanto pelo login automático (token já salvo) quanto pelo submit
// manual do login; sem essa trava, um POST de formulário dispararia em
// duplicidade (dois listeners = duas requisições para o mesmo clique).
let _painelAdminIniciado = false;

function iniciarPainelAdmin() {
  renderAdminDashboard();
  renderAdminHero();
  renderAdminEmpreendimentos();
  renderAdminImoveis();
  renderAdminDepoimentos();
  renderAdminLeads();
  renderAdminBlog();
  carregarConfigAdmin();
  popularSelectEmpreendimentos();

  if (_painelAdminIniciado) return;
  _painelAdminIniciado = true;

  iniciarNavegacaoAdmin();
  iniciarFormHero();
  iniciarFormEmpreendimento();
  iniciarFormImovel();
  iniciarFormDepoimento();
  iniciarFormBlog();
  iniciarFormConfig();
  iniciarFormAcesso();
  iniciarEditorPaginas();
}

document.addEventListener('DOMContentLoaded', () => {
  iniciarLoginAdmin();
});
