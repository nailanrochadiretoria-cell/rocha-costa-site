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

function iniciarLoginAdmin() {
  const loginForm = document.getElementById('admin-login-form');
  const loginScreen = document.getElementById('login-screen');
  const app = document.getElementById('admin-app');
  if (!loginForm) return;

  if (adminEstaLogado()) {
    loginScreen.style.display = 'none';
    app.style.display = 'grid';
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const senha = document.getElementById('admin-senha').value;
    document.getElementById('admin-login-erro').style.display = 'none';
    try {
      await apiLogin(senha);
      loginScreen.style.display = 'none';
      app.style.display = 'grid';
      iniciarPainelAdmin();
    } catch (err) {
      mostrarErroLogin('Senha incorreta. Tente novamente.');
    }
  });

  document.getElementById('admin-logout')?.addEventListener('click', () => {
    limparAdminToken();
    location.reload();
  });
}

// Se a sessão expirar no meio do uso, volta pra tela de login com um aviso.
function tratarSessaoExpirada() {
  document.getElementById('admin-app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  mostrarErroLogin('Sua sessão expirou. Faça login novamente.');
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

  tbody.innerHTML = lista.map((im) => `
    <tr>
      <td>${im.id}</td>
      <td>${im.titulo}</td>
      <td>${im.bairro}</td>
      <td>${im.status}</td>
      <td>${formatarBRL(im.preco)}</td>
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
      const item = await apiGet(`/api/imoveis/${id}`);
      if (!item) return;
      document.getElementById('imovel-id').value = item.id;
      document.getElementById('imovel-titulo').value = item.titulo;
      document.getElementById('imovel-bairro').value = item.bairro;
      document.getElementById('imovel-status').value = item.status;
      document.getElementById('imovel-preco').value = item.preco;
      document.getElementById('imovel-empreendimento').value = item.empreendimento_id || '';
      document.getElementById('imovel-destaque').checked = !!item.destaque;
      document.getElementById('form-imovel').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

function iniciarFormImovel() {
  const form = document.getElementById('form-imovel');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const idCampo = document.getElementById('imovel-id').value;
    const dados = {
      titulo: document.getElementById('imovel-titulo').value,
      bairro: document.getElementById('imovel-bairro').value,
      status: document.getElementById('imovel-status').value,
      preco: Number(document.getElementById('imovel-preco').value),
      empreendimento_id: document.getElementById('imovel-empreendimento').value || null,
      destaque: document.getElementById('imovel-destaque').checked,
    };
    try {
      if (idCampo) {
        await apiAuth(`/api/imoveis/${idCampo}`, 'PUT', dados);
      } else {
        await apiAuth('/api/imoveis', 'POST', dados);
      }
      form.reset();
      document.getElementById('imovel-id').value = '';
      renderAdminImoveis();
    } catch (err) {
      if (err.sessaoExpirada) return tratarSessaoExpirada();
      alert(err.message);
    }
  });

  document.getElementById('imovel-cancelar')?.addEventListener('click', () => {
    form.reset();
    document.getElementById('imovel-id').value = '';
  });
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

  tbody.innerHTML = lista.map((d) => `
    <tr>
      <td>${d.nome}</td>
      <td>${d.empreendimento}</td>
      <td style="color:#F2A900;letter-spacing:1px;">${'★'.repeat(d.estrelas)}${'☆'.repeat(5 - d.estrelas)}</td>
      <td><button class="btn btn-sm btn-primary" data-excluir-depoimento="${d.id}">Excluir</button></td>
    </tr>`).join('');

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

function iniciarFormDepoimento() {
  const form = document.getElementById('form-depoimento');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = {
      nome: document.getElementById('dep-nome').value,
      empreendimento: document.getElementById('dep-empreendimento').value,
      texto: document.getElementById('dep-texto').value,
      estrelas: Number(document.getElementById('dep-estrelas').value),
    };
    try {
      await apiAuth('/api/depoimentos', 'POST', dados);
      form.reset();
      renderAdminDepoimentos();
    } catch (err) {
      if (err.sessaoExpirada) return tratarSessaoExpirada();
      alert(err.message);
    }
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

  tbody.innerHTML = lista.map((emp) => `
    <tr>
      <td>${emp.imagens && emp.imagens[0] ? `<img class="admin-hero-thumb" src="${emp.imagens[0]}" alt="">` : '—'}</td>
      <td>${emp.nome}</td>
      <td>${emp.status || '—'}</td>
      <td>${emp.ano || '—'}</td>
      <td>${emp.total_unidades || '—'}</td>
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
      const item = await apiGet(`/api/empreendimentos/${id}`);
      if (!item) return;
      preencherFormEmpreendimento(item);
      document.getElementById('form-empreendimento').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

function renderGaleriaEmpreendimento() {
  const wrap = document.getElementById('emp-imagens-lista');
  wrap.innerHTML = _empGaleriaAtual.map((url, i) => `
    <div class="admin-galeria-item${i === 0 ? ' capa' : ''}" draggable="true" data-idx="${i}">
      <img src="${url}" alt="">
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
}

function iniciarFormEmpreendimento() {
  const form = document.getElementById('form-empreendimento');
  if (!form) return;

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
    + lista.map((emp) => `<option value="${emp.id}">${emp.nome}</option>`).join('');
  select.value = valorAtual;
}

// ---- Seção: Hero (slides da home) ----
const HERO_DESTINOS = {
  imoveis: 'Empreendimentos', portfolio: 'Portfólio', simulador: 'Simulador',
  depoimentos: 'Depoimentos', contato: 'Contato', whatsapp: 'WhatsApp', url: 'URL personalizada',
};

async function renderAdminHero() {
  const tbody = document.getElementById('admin-hero-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';

  let lista;
  try {
    lista = await apiGet('/api/hero-slides');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="5">Não foi possível carregar os slides.</td></tr>';
    return;
  }

  tbody.innerHTML = lista.map((s) => `
    <tr>
      <td>${s.imagem ? `<img class="admin-hero-thumb" src="${s.imagem}" alt="">` : '—'}</td>
      <td>${s.titulo}</td>
      <td>${HERO_DESTINOS[s.cta_tipo] || s.cta_tipo}${s.cta_tipo === 'url' ? ` (${s.cta_valor})` : ''}</td>
      <td>${s.area_clicavel ? 'Sim' : 'Não'}</td>
      <td>
        <button class="btn btn-sm btn-outline-navy" data-editar-hero="${s.id}">Editar</button>
        <button class="btn btn-sm btn-primary" data-excluir-hero="${s.id}">Excluir</button>
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('[data-excluir-hero]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Excluir este slide do hero?')) return;
      const id = btn.getAttribute('data-excluir-hero');
      try {
        await apiAuth(`/api/hero-slides/${id}`, 'DELETE');
        renderAdminHero();
        renderAdminDashboard();
      } catch (err) {
        if (err.sessaoExpirada) return tratarSessaoExpirada();
        alert(err.message);
      }
    });
  });
  tbody.querySelectorAll('[data-editar-hero]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-editar-hero');
      const item = await apiGet(`/api/hero-slides/${id}`);
      if (!item) return;
      preencherFormHero(item);
      document.getElementById('form-hero').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

function preencherFormHero(item) {
  document.getElementById('hero-id').value = item.id;
  document.getElementById('hero-eyebrow').value = item.eyebrow || '';
  document.getElementById('hero-titulo').value = item.titulo || '';
  document.getElementById('hero-texto').value = item.texto || '';
  document.getElementById('hero-cta-texto').value = item.cta_texto || '';
  document.getElementById('hero-cta-tipo').value = item.cta_tipo || 'imoveis';
  document.getElementById('hero-cta-valor').value = item.cta_valor || '';
  document.getElementById('hero-imagem-url').value = item.imagem || '';
  document.getElementById('hero-imagem-mobile-url').value = item.imagem_mobile || '';
  document.getElementById('form-hero-titulo-secao').textContent = 'Editar slide';
  atualizarVisibilidadeCtaValor();
  atualizarPreviewImagemHero(item.imagem || '');

  const area = item.area_clicavel;
  document.getElementById('hero-area-ativa').checked = !!area;
  document.getElementById('hero-area-x').value = area ? area.x : 10;
  document.getElementById('hero-area-y').value = area ? area.y : 10;
  document.getElementById('hero-area-largura').value = area ? area.largura : 30;
  document.getElementById('hero-area-altura').value = area ? area.altura : 15;
  atualizarVisibilidadeAreaEditor();
  desenharCaixaArea();
}

function atualizarVisibilidadeCtaValor() {
  const tipo = document.getElementById('hero-cta-tipo').value;
  document.getElementById('hero-cta-valor-wrap').style.display = tipo === 'url' ? 'flex' : 'none';
}
function atualizarVisibilidadeAreaEditor() {
  const ativo = document.getElementById('hero-area-ativa').checked;
  document.getElementById('hero-area-editor-wrap').style.display = ativo ? 'block' : 'none';
}
function atualizarPreviewImagemHero(url) {
  const img = document.getElementById('hero-area-preview-img');
  img.src = url || '';
  img.style.display = url ? 'block' : 'none';
}
function desenharCaixaArea() {
  const box = document.getElementById('hero-area-box');
  const ativo = document.getElementById('hero-area-ativa').checked;
  if (!ativo) { box.style.display = 'none'; return; }
  const x = Number(document.getElementById('hero-area-x').value) || 0;
  const y = Number(document.getElementById('hero-area-y').value) || 0;
  const w = Number(document.getElementById('hero-area-largura').value) || 1;
  const h = Number(document.getElementById('hero-area-altura').value) || 1;
  box.style.display = 'block';
  box.style.left = `${x}%`;
  box.style.top = `${y}%`;
  box.style.width = `${w}%`;
  box.style.height = `${h}%`;
}

function iniciarFormHero() {
  const form = document.getElementById('form-hero');
  if (!form) return;

  document.getElementById('hero-cta-tipo').addEventListener('change', atualizarVisibilidadeCtaValor);
  document.getElementById('hero-area-ativa').addEventListener('change', () => {
    atualizarVisibilidadeAreaEditor();
    desenharCaixaArea();
  });
  ['hero-area-x', 'hero-area-y', 'hero-area-largura', 'hero-area-altura'].forEach((id) => {
    document.getElementById(id).addEventListener('input', desenharCaixaArea);
  });
  document.getElementById('hero-imagem-url').addEventListener('input', (e) => {
    atualizarPreviewImagemHero(e.target.value);
  });

  document.getElementById('hero-imagem-arquivo').addEventListener('change', async (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    const status = document.getElementById('hero-upload-status');
    status.textContent = 'Enviando imagem...';
    try {
      const { url } = await apiUploadImagem(arquivo);
      document.getElementById('hero-imagem-url').value = url;
      atualizarPreviewImagemHero(url);
      status.textContent = 'Imagem enviada com sucesso.';
    } catch (err) {
      if (err.sessaoExpirada) return tratarSessaoExpirada();
      status.textContent = `Erro: ${err.message}`;
    }
  });

  document.getElementById('hero-imagem-mobile-arquivo').addEventListener('change', async (e) => {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    const status = document.getElementById('hero-upload-mobile-status');
    status.textContent = 'Enviando imagem...';
    try {
      const { url } = await apiUploadImagem(arquivo);
      document.getElementById('hero-imagem-mobile-url').value = url;
      status.textContent = 'Imagem enviada com sucesso.';
    } catch (err) {
      if (err.sessaoExpirada) return tratarSessaoExpirada();
      status.textContent = `Erro: ${err.message}`;
    }
  });

  // Arrastar sobre a prévia da imagem para desenhar a área clicável manualmente
  const editor = document.getElementById('hero-area-editor');
  let arrastando = false;
  let inicioX = 0, inicioY = 0;

  function posRelativa(evento) {
    const rect = editor.getBoundingClientRect();
    const clientX = evento.touches ? evento.touches[0].clientX : evento.clientX;
    const clientY = evento.touches ? evento.touches[0].clientY : evento.clientY;
    const x = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1) * 100;
    const y = Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1) * 100;
    return { x, y };
  }

  function iniciarArraste(evento) {
    if (!document.getElementById('hero-area-ativa').checked) return;
    arrastando = true;
    const p = posRelativa(evento);
    inicioX = p.x; inicioY = p.y;
  }
  function moverArraste(evento) {
    if (!arrastando) return;
    const p = posRelativa(evento);
    const x = Math.min(inicioX, p.x);
    const y = Math.min(inicioY, p.y);
    const w = Math.max(Math.abs(p.x - inicioX), 1);
    const h = Math.max(Math.abs(p.y - inicioY), 1);
    document.getElementById('hero-area-x').value = x.toFixed(1);
    document.getElementById('hero-area-y').value = y.toFixed(1);
    document.getElementById('hero-area-largura').value = w.toFixed(1);
    document.getElementById('hero-area-altura').value = h.toFixed(1);
    desenharCaixaArea();
  }
  function finalizarArraste() { arrastando = false; }

  editor.addEventListener('mousedown', iniciarArraste);
  window.addEventListener('mousemove', moverArraste);
  window.addEventListener('mouseup', finalizarArraste);
  editor.addEventListener('touchstart', iniciarArraste, { passive: true });
  window.addEventListener('touchmove', moverArraste, { passive: true });
  window.addEventListener('touchend', finalizarArraste);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const idCampo = document.getElementById('hero-id').value;
    const areaAtiva = document.getElementById('hero-area-ativa').checked;
    const dados = {
      eyebrow: document.getElementById('hero-eyebrow').value,
      titulo: document.getElementById('hero-titulo').value,
      texto: document.getElementById('hero-texto').value,
      cta_texto: document.getElementById('hero-cta-texto').value,
      cta_tipo: document.getElementById('hero-cta-tipo').value,
      cta_valor: document.getElementById('hero-cta-valor').value,
      imagem: document.getElementById('hero-imagem-url').value,
      imagem_mobile: document.getElementById('hero-imagem-mobile-url').value,
      area_clicavel: areaAtiva ? {
        x: Number(document.getElementById('hero-area-x').value),
        y: Number(document.getElementById('hero-area-y').value),
        largura: Number(document.getElementById('hero-area-largura').value),
        altura: Number(document.getElementById('hero-area-altura').value),
      } : null,
    };
    try {
      if (idCampo) {
        await apiAuth(`/api/hero-slides/${idCampo}`, 'PUT', dados);
      } else {
        await apiAuth('/api/hero-slides', 'POST', dados);
      }
      limparFormHero();
      renderAdminHero();
      renderAdminDashboard();
    } catch (err) {
      if (err.sessaoExpirada) return tratarSessaoExpirada();
      alert(err.message);
    }
  });

  document.getElementById('hero-cancelar')?.addEventListener('click', limparFormHero);
}

function limparFormHero() {
  const form = document.getElementById('form-hero');
  form.reset();
  document.getElementById('hero-id').value = '';
  document.getElementById('form-hero-titulo-secao').textContent = 'Adicionar slide';
  document.getElementById('hero-upload-status').textContent = '';
  document.getElementById('hero-upload-mobile-status').textContent = '';
  atualizarVisibilidadeCtaValor();
  atualizarVisibilidadeAreaEditor();
  atualizarPreviewImagemHero('');
  desenharCaixaArea();
}

// ---- Dashboard ----
async function renderAdminDashboard() {
  const el = document.getElementById('dash-imoveis-total');
  const el2 = document.getElementById('dash-depoimentos-total');
  const el3 = document.getElementById('dash-hero-total');
  const el4 = document.getElementById('dash-empreendimentos-total');
  if (!el || !el2) return;
  const [imoveis, depoimentos, heroSlides, empreendimentos] = await Promise.all([
    apiGet('/api/imoveis').catch(() => []),
    apiGet('/api/depoimentos').catch(() => []),
    apiGet('/api/hero-slides').catch(() => []),
    apiGet('/api/empreendimentos').catch(() => []),
  ]);
  el.textContent = imoveis.length;
  el2.textContent = depoimentos.length;
  if (el3) el3.textContent = heroSlides.length;
  if (el4) el4.textContent = empreendimentos.length;
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
        document.querySelectorAll('.admin-section').forEach((s) => { s.style.display = 'none'; s.classList.remove('admin-section--enter'); });
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
  popularSelectEmpreendimentos();

  if (_painelAdminIniciado) return;
  _painelAdminIniciado = true;

  iniciarNavegacaoAdmin();
  iniciarFormHero();
  iniciarFormEmpreendimento();
  iniciarFormImovel();
  iniciarFormDepoimento();
}

document.addEventListener('DOMContentLoaded', () => {
  iniciarLoginAdmin();
  if (adminEstaLogado()) iniciarPainelAdmin();
});
