/* =========================================================
   Rocha Costa — cliente da API do backend (server/app.py)
   ========================================================= */

const RC_TOKEN_KEY = 'rc_admin_token';

function getAdminToken() {
  return sessionStorage.getItem(RC_TOKEN_KEY);
}
function setAdminToken(token) {
  sessionStorage.setItem(RC_TOKEN_KEY, token);
}
function limparAdminToken() {
  sessionStorage.removeItem(RC_TOKEN_KEY);
}

async function apiLogin(senha) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senha }),
  });
  if (!res.ok) throw new Error('senha-invalida');
  const { token } = await res.json();
  setAdminToken(token);
  return token;
}

// GET público, sem autenticação
async function apiGet(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Falha ao buscar ${path} (${res.status})`);
  return res.json();
}

// POST/PUT/DELETE autenticados — inclui o token e trata sessão expirada
async function apiAuth(path, method, corpo) {
  const token = getAdminToken();
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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
  const token = getAdminToken();
  const formData = new FormData();
  formData.append('arquivo', arquivo);
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
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
