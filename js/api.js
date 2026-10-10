/* =========================================================
   Rocha Costa — cliente da API do backend (server/app.py)
   ========================================================= */

const RC_TOKEN_KEY = 'rc_admin_logado';

// Escapa texto antes de jogar em innerHTML (conteúdo vindo da API/URL).
// Serve tanto para texto quanto para valores de atributo entre aspas.
function escHTML(valor) {
  return String(valor == null ? '' : valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Card de depoimento (home e página de depoimentos usam o mesmo)
function cardDepoimentoHTML(d) {
  const estrelas = Math.max(0, Math.min(5, Math.round(Number(d.estrelas) || 5)));
  const nome = String(d.nome || 'Cliente');
  return `
    <div class="card testimonial-card">
      <div class="stars" aria-label="${estrelas} de 5 estrelas">${'★'.repeat(estrelas)}${'☆'.repeat(5 - estrelas)}</div>
      <p>“${escHTML(d.texto)}”</p>
      <div class="testimonial-author">
        <div class="avatar">${escHTML(nome.trim().charAt(0).toUpperCase() || 'C')}</div>
        <div><strong>${escHTML(nome)}</strong>${d.empreendimento ? `<div class="meta">${escHTML(d.empreendimento)}</div>` : ''}</div>
      </div>
    </div>`;
}

// URL de imagem/link segura para atributos src/href: só caminhos do próprio
// site ou http(s). Qualquer outra coisa (ex.: "javascript:") vira o fallback.
function urlSegura(valor, fallback = '') {
  const url = String(valor || '').trim();
  if (/^https?:\/\//i.test(url) || (url.startsWith('/') && !url.startsWith('//')) || /^[\w-]+\.html/.test(url)) {
    return escHTML(url);
  }
  return escHTML(fallback);
}

// A sessão do admin fica num cookie HttpOnly, que o navegador envia sozinho e
// o JavaScript não consegue ler. Aqui guardamos só uma marca "está logado"
// (sem valor secreto) para a tela saber o que mostrar.
// sessionStorage pode lançar erro (modo privado/bloqueado) — nunca deixa isso quebrar a página.
function getAdminToken() {
  try { return sessionStorage.getItem(RC_TOKEN_KEY); } catch (e) { return null; }
}
function setAdminToken(token) {
  try { sessionStorage.setItem(RC_TOKEN_KEY, token); } catch (e) { /* sem persistência */ }
}
function limparAdminToken() {
  try { sessionStorage.removeItem(RC_TOKEN_KEY); } catch (e) { /* nada a limpar */ }
}

async function apiLogin(usuario, senha, captchaVale, captcha) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, senha, captcha_vale: captchaVale, captcha }),
  });
  if (!res.ok) {
    const dados = await res.json().catch(() => ({}));
    throw new Error(dados.erro || 'Não foi possível entrar.');
  }
  setAdminToken('1');
}

// Imagem de verificação ("não sou um robô") do login: { vale, imagem }
async function apiCaptcha() {
  const res = await fetch('/api/auth/captcha', { cache: 'no-store' });
  if (!res.ok) {
    const dados = await res.json().catch(() => ({}));
    throw new Error(dados.erro || 'Não foi possível carregar a imagem de verificação.');
  }
  return res.json();
}

// Pergunta ao servidor se o cookie de sessão ainda vale e se o painel já tem senha.
async function apiSessao() {
  const res = await fetch('/api/auth/sessao', { cache: 'no-store' });
  if (!res.ok) throw new Error('Não foi possível falar com o servidor.');
  const dados = await res.json();
  if (dados.logado) setAdminToken('1'); else limparAdminToken();
  return dados;
}

// Primeiro acesso: cria o usuário e a senha do painel (só no computador do site).
async function apiCriarAcesso(usuario, senha) {
  const res = await fetch('/api/auth/configurar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, senha }),
  });
  if (!res.ok) {
    const dados = await res.json().catch(() => ({}));
    throw new Error(dados.erro || 'Não foi possível criar o acesso.');
  }
  setAdminToken('1');
}

// GET público, sem autenticação
async function apiGet(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Falha ao buscar ${path} (${res.status})`);
  return res.json();
}

// POST público, sem autenticação (ex: formulário de contato, leads)
async function apiPost(path, corpo) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  if (!res.ok) {
    const dados = await res.json().catch(() => ({}));
    throw new Error(dados.erro || `Erro ao enviar (${res.status})`);
  }
  return res.json();
}

// POST/PUT/DELETE autenticados — o cookie de sessão vai junto sozinho; trata sessão expirada
async function apiAuth(path, method, corpo) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
  if (res.status === 401) {
    limparAdminToken();
    const erro = new Error('sessao-expirada');
    erro.sessaoExpirada = true;
    throw erro;
  }
  if (!res.ok) {
    const dados = await res.json().catch(() => ({}));
    throw new Error(dados.erro || `Erro ao chamar ${path} (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

// Upload de arquivo (multipart) autenticado — usado para trocar imagens no admin
async function apiUploadImagem(arquivo) {
  const formData = new FormData();
  formData.append('arquivo', arquivo);
  const res = await fetch('/api/upload', {
    method: 'POST',
    credentials: 'same-origin',
    body: formData,
  });
  if (res.status === 401) {
    limparAdminToken();
    const erro = new Error('sessao-expirada');
    erro.sessaoExpirada = true;
    throw erro;
  }
  if (!res.ok) {
    const dados = await res.json().catch(() => ({}));
    throw new Error(dados.erro || 'Erro ao enviar imagem.');
  }
  return res.json(); // { url }
}
// "2026-06-18" é lido pelo navegador como meia-noite em UTC — no Brasil
// (UTC-3) isso ainda é dia 17, e a data aparecia um dia antes. Monta a data
// no fuso local para evitar isso.
function formatarDataPost(iso) {
  const [ano, mes, dia] = String(iso).split('-').map(Number);
  if (!ano || !mes || !dia) return '';
  return new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}
