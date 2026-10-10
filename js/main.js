/* =========================================================
   Rocha Costa — JS compartilhado (todas as páginas)
   ========================================================= */

// ---- Configuração central de contato ----
// Troque aqui quando tiver os dados reais/definitivos.
// Número e mensagem do WhatsApp vêm do admin (Configurações), injetados pelo
// servidor em window.RC_CONFIG; os valores abaixo são só o padrão de segurança.
const _RC_CFG = window.RC_CONFIG || {};
const ROCHA_COSTA = {
  whatsappNumber: _RC_CFG.whatsapp_numero || '5587999143998', // 55 + DDD + número, sem "+"
  whatsappMensagem: _RC_CFG.whatsapp_mensagem || 'Quero mais informações sobre o imóvel escolhido.',
};

// ---- Saudação dinâmica por horário ----
function saudacaoPorHorario() {
  const hora = new Date().getHours();
  if (hora >= 5 && hora < 12) return 'Bom dia';
  if (hora >= 12 && hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

// ---- Monta o link do WhatsApp com saudação dinâmica ----
// itemLabel (opcional): nome do imóvel/empreendimento para personalizar a mensagem
function linkWhatsApp(itemLabel) {
  const saudacao = saudacaoPorHorario();
  const base = itemLabel
    ? `${saudacao}! Quero mais informações sobre o imóvel ${itemLabel}.`
    : `${saudacao}! ${ROCHA_COSTA.whatsappMensagem}`;
  return `https://wa.me/${ROCHA_COSTA.whatsappNumber}?text=${encodeURIComponent(base)}`;
}

// ---- Liga todos os botões/links marcados com data-wa ----
function ligarBotoesWhatsApp(scope = document) {
  scope.querySelectorAll('[data-wa]').forEach((el) => {
    const item = el.getAttribute('data-wa-item') || undefined;
    el.setAttribute('href', linkWhatsApp(item));
    el.setAttribute('target', '_blank');
    el.setAttribute('rel', 'noopener');
  });
}

// ---- Menu mobile ----
function iniciarMenuMobile() {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (!toggle || !links) return;
  toggle.setAttribute('aria-expanded', 'false');
  const definirAberto = (aberto) => {
    links.classList.toggle('open', aberto);
    toggle.classList.toggle('open', aberto);
    toggle.setAttribute('aria-expanded', String(aberto));
  };
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    definirAberto(!links.classList.contains('open'));
  });
  links.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => definirAberto(false));
  });
  // Fecha ao clicar fora ou apertar Esc (antes o menu ficava aberto por cima da página)
  document.addEventListener('click', (e) => {
    if (links.classList.contains('open') && !links.contains(e.target)) definirAberto(false);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') definirAberto(false); });
}

// ---- Marca o link ativo do menu conforme a página atual ----
function marcarLinkAtivo() {
  let atual = location.pathname.split('/').pop() || 'index.html';
  // Páginas de detalhe acendem o item de menu da seção a que pertencem
  const secaoPai = { 'imovel.html': 'imoveis.html', 'empreendimento.html': 'portfolio.html', 'blog-post.html': 'blog.html' };
  atual = secaoPai[atual] || atual;
  document.querySelectorAll('.nav-links a').forEach((a) => {
    const href = a.getAttribute('href');
    if (href === atual) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    }
  });
}

// ---- Formulário de contato (genérico, usado em várias páginas) ----
// Envia os dados para o backend (POST /api/leads), que grava em
// server/data/leads.json e aparece na aba "Leads" do painel admin.
function iniciarFormularioContato() {
  document.querySelectorAll('form[data-contact-form]').forEach((form) => {
    // Campo-armadilha contra robôs: invisível e fora da navegação por teclado.
    // O servidor descarta em silêncio qualquer envio em que ele venha preenchido.
    if (!form.querySelector('input[name="site"]')) {
      const isca = document.createElement('div');
      isca.setAttribute('aria-hidden', 'true');
      isca.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;';
      isca.innerHTML = '<label>Não preencha este campo<input type="text" name="site" tabindex="-1" autocomplete="off"></label>';
      form.appendChild(isca);
    }
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const dados = Object.fromEntries(new FormData(form).entries());
      Object.keys(dados).forEach((k) => { if (typeof dados[k] === 'string') dados[k] = dados[k].trim(); });
      const botao = form.querySelector('button[type="submit"]');
      const sucesso = form.parentElement.querySelector('.form-success') || form.querySelector('.form-success');

      const partesMensagem = [];
      if (dados.interesse) partesMensagem.push(`Interesse: ${dados.interesse}`);
      if (dados.imovel) partesMensagem.push(`Imóvel: ${dados.imovel}`);
      if (dados.mensagem) partesMensagem.push(dados.mensagem);

      // Abre a aba do WhatsApp AINDA dentro do clique: se abrir depois do
      // "await", o navegador trata como pop-up e bloqueia.
      const abrirWa = form.getAttribute('data-open-whatsapp') === 'true';
      if (abrirWa) window.open(linkWhatsApp(dados.imovel || undefined), '_blank', 'noopener');

      if (botao) {
        botao.disabled = true;
        botao.classList.add('is-loading');
      }
      try {
        await apiPost('/api/leads', {
          nome: dados.nome || '',
          telefone: dados.telefone || '',
          email: dados.email || '',
          mensagem: partesMensagem.join(' — '),
          origem: 'contato',
          site: dados.site || '', // campo-armadilha: pessoas deixam vazio, robôs preenchem
        });
        if (sucesso) {
          sucesso.classList.remove('erro');
          sucesso.classList.add('show');
          sucesso.textContent = 'Recebemos seus dados! Nossa equipe entrará em contato em breve. Você também pode falar agora mesmo pelo WhatsApp.';
        }
        form.reset();
      } catch (err) {
        if (sucesso) {
          sucesso.classList.add('show', 'erro');
          sucesso.textContent = 'Não foi possível enviar pelo site agora. Fale com a gente pelo WhatsApp, por favor.';
        }
      } finally {
        if (botao) {
          botao.disabled = false;
          botao.classList.remove('is-loading');
        }
      }
    });
  });
}

// ---- Ano automático no rodapé ----
function preencherAnoRodape() {
  document.querySelectorAll('[data-ano]').forEach((el) => {
    el.textContent = new Date().getFullYear();
  });
}

// ---- Formata número em Real (BRL) ----
function formatarBRL(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '—';
  return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

// Preço de imóvel: sem valor cadastrado mostra "Sob consulta" em vez de "R$ 0"
function formatarPrecoImovel(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? formatarBRL(numero) : 'Sob consulta';
}

// Sem zoom por pinça no celular (o iPhone ignora a configuração da página,
// então o gesto é cancelado aqui).
['gesturestart', 'gesturechange', 'gestureend'].forEach((tipo) => {
  document.addEventListener(tipo, (e) => e.preventDefault(), { passive: false });
});
document.addEventListener('touchmove', (e) => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

// ---- Cookies: gerenciador de consentimento (LGPD) ----
// Nada opcional é ativado antes de a pessoa escolher. A escolha fica guardada
// por categoria, com data e versão, e pode ser mudada a qualquer momento pelo
// link "Preferências de cookies" do rodapé.
const RC_CONSENT_COOKIE = 'rc_consent';
const RC_CONSENT_VERSAO = 1;          // aumente se as categorias mudarem: o aviso volta a aparecer
const RC_CONSENT_DIAS = 180;

const RC_CATEGORIAS = [
  {
    id: 'necessarios', fixa: true, titulo: 'Necessários',
    descricao: 'Fazem o site funcionar e guardam a sua escolha de privacidade. Não podem ser desativados.',
    cookies: [
      ['rc_consent', 'Rocha Costa', 'Guarda as suas preferências de cookies', '6 meses'],
      ['rc_sessao', 'Rocha Costa', 'Mantém o acesso de quem administra o site (só no painel)', '8 horas'],
    ],
  },
  {
    id: 'funcionais', titulo: 'Funcionais',
    descricao: 'Permitem mostrar os mapas do Google Maps com a localização das obras e dos imóveis. O Google pode gravar cookies próprios ao exibir o mapa.',
    cookies: [
      ['NID, AEC e outros', 'Google Maps', 'Exibição do mapa e preferências do Google', 'Até 6 meses (definido pelo Google)'],
    ],
  },
  {
    id: 'estatisticas', titulo: 'Estatísticas',
    descricao: 'Ajudariam a entender, de forma anônima, como o site é usado. No momento o site não usa cookies deste tipo; se passar a usar, só com a sua permissão.',
    cookies: [],
  },
  {
    id: 'marketing', titulo: 'Marketing',
    descricao: 'Serviriam para mostrar anúncios relacionados aos seus interesses. No momento o site não usa cookies deste tipo; se passar a usar, só com a sua permissão.',
    cookies: [],
  },
];

function lerCookie(nome) {
  const par = document.cookie.split('; ').find((c) => c.startsWith(nome + '='));
  return par ? decodeURIComponent(par.slice(nome.length + 1)) : '';
}

function lerConsentimento() {
  try {
    const dados = JSON.parse(lerCookie(RC_CONSENT_COOKIE) || 'null');
    return dados && dados.v === RC_CONSENT_VERSAO ? dados : null;
  } catch (e) {
    return null;
  }
}

function gravarConsentimento(escolhas) {
  const dados = { v: RC_CONSENT_VERSAO, d: new Date().toISOString().slice(0, 10) };
  RC_CATEGORIAS.forEach((c) => { if (!c.fixa) dados[c.id] = escolhas[c.id] ? 1 : 0; });
  const seguro = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${RC_CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(dados))}; Max-Age=${60 * 60 * 24 * RC_CONSENT_DIAS}; Path=/; SameSite=Lax${seguro}`;
  document.cookie = 'rc_cookies=; Max-Age=0; Path=/'; // formato antigo
  document.querySelectorAll('iframe[data-mapa-liberado]').forEach((f) => f.removeAttribute('data-mapa-liberado'));
  tratarMapas();
  document.dispatchEvent(new CustomEvent('rc:consentimento', { detail: dados }));
}

function cookiesPermitidos(categoria) {
  if (categoria === 'necessarios') return true;
  const dados = lerConsentimento();
  return !!(dados && dados[categoria]);
}

// ---- Mapas do Google: só carregam com a categoria "Funcionais" ou no clique ----
const EH_MAPA_GOOGLE = /^https:\/\/www\.google\.com\/maps/;

function tratarMapa(iframe) {
  if (iframe.closest('#admin-app')) return;
  const origem = iframe.getAttribute('data-mapa-src') || iframe.getAttribute('src') || '';
  if (!EH_MAPA_GOOGLE.test(origem)) return;
  const aviso = iframe.parentElement.querySelector('.mapa-bloqueado');
  if (cookiesPermitidos('funcionais') || iframe.hasAttribute('data-mapa-liberado')) {
    if (aviso) aviso.remove();
    iframe.hidden = false;
    if (iframe.getAttribute('src') !== origem) iframe.setAttribute('src', origem);
    return;
  }
  iframe.setAttribute('data-mapa-src', origem);
  iframe.removeAttribute('src');
  iframe.hidden = true;
  if (aviso) return;
  const caixa = document.createElement('div');
  caixa.className = 'mapa-bloqueado';
  caixa.innerHTML = `
    <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.800 12 21 12 21z"/><circle cx="12" cy="9.500" r="2.500"/></svg>
    <p>Este mapa é exibido pelo Google Maps, que pode gravar cookies próprios.</p>
    <div class="mapa-bloqueado-botoes">
      <button type="button" class="btn btn-primary btn-sm" data-mapa="este">Mostrar este mapa</button>
      <button type="button" class="btn btn-outline-navy btn-sm" data-mapa="sempre">Sempre mostrar mapas</button>
    </div>`;
  caixa.querySelector('[data-mapa="este"]').addEventListener('click', () => {
    iframe.setAttribute('data-mapa-liberado', '');
    tratarMapa(iframe);
  });
  caixa.querySelector('[data-mapa="sempre"]').addEventListener('click', () => {
    const atual = lerConsentimento() || {};
    gravarConsentimento({ ...atual, funcionais: 1 });
    fecharAvisoDeCookies();
  });
  iframe.insertAdjacentElement('afterend', caixa);
}

function tratarMapas(scope = document) {
  scope.querySelectorAll('iframe').forEach(tratarMapa);
}

// ---- Faixa de aviso (primeira visita) ----
function fecharAvisoDeCookies() {
  const aviso = document.querySelector('.cookie-aviso');
  if (!aviso) return;
  aviso.classList.remove('visivel');
  setTimeout(() => aviso.remove(), 350);
}

function escolherTodos(valor) {
  const escolhas = {};
  RC_CATEGORIAS.forEach((c) => { escolhas[c.id] = valor; });
  gravarConsentimento(escolhas);
  fecharAvisoDeCookies();
  fecharPreferenciasDeCookies();
}

function mostrarAvisoDeCookies() {
  if (document.querySelector('.cookie-aviso')) return;
  const aviso = document.createElement('section');
  aviso.className = 'cookie-aviso';
  aviso.setAttribute('aria-label', 'Aviso de cookies');
  aviso.innerHTML = `
    <div class="cookie-aviso-texto">
      <strong>A sua privacidade é muito importante para nós</strong>
      <p>Nós usamos cookies para o site funcionar bem e, com a sua permissão, para mostrar os mapas das obras e dos imóveis. Ao clicar em "Aceitar todos", você concorda com o uso de todos os cookies, como descrito na nossa <a href="privacidade.html">Política de Privacidade</a>.</p>
    </div>
    <div class="cookie-aviso-botoes">
      <button type="button" class="cookie-btn cookie-btn--cheio" data-cookies="aceitar">Aceitar todos</button>
      <button type="button" class="cookie-btn cookie-btn--contorno" data-cookies="recusar">Rejeitar todos</button>
      <button type="button" class="cookie-btn cookie-btn--texto" data-cookies="personalizar">Configurações de cookies</button>
    </div>`;
  aviso.querySelector('[data-cookies="aceitar"]').addEventListener('click', () => escolherTodos(1));
  aviso.querySelector('[data-cookies="recusar"]').addEventListener('click', () => escolherTodos(0));
  aviso.querySelector('[data-cookies="personalizar"]').addEventListener('click', abrirPreferenciasDeCookies);
  document.body.appendChild(aviso);
  requestAnimationFrame(() => aviso.classList.add('visivel'));
}

// ---- Janela de preferências (categorias com chave liga/desliga) ----
let _cookieFocoAnterior = null;

function fecharPreferenciasDeCookies() {
  const fundo = document.querySelector('.cookie-janela-fundo');
  if (!fundo) return;
  fundo.remove();
  document.documentElement.classList.remove('cookie-janela-aberta');
  if (_cookieFocoAnterior && document.contains(_cookieFocoAnterior)) _cookieFocoAnterior.focus();
  if (!lerConsentimento()) mostrarAvisoDeCookies();
}

function abrirPreferenciasDeCookies() {
  if (document.querySelector('.cookie-janela-fundo')) return;
  _cookieFocoAnterior = document.activeElement;
  const atual = lerConsentimento() || {};
  const fundo = document.createElement('div');
  fundo.className = 'cookie-janela-fundo';
  const categoriasHTML = RC_CATEGORIAS.map((c) => {
    const ligado = c.fixa || atual[c.id] ? 'checked' : '';
    const tabela = c.cookies.length
      ? `<details><summary>Ver cookies (${c.cookies.length})</summary>
           <div class="cookie-tabela-rolavel"><table>
             <thead><tr><th>Cookie</th><th>De quem</th><th>Para que serve</th><th>Duração</th></tr></thead>
             <tbody>${c.cookies.map((l) => `<tr>${l.map((v) => `<td>${escHTML(v)}</td>`).join('')}</tr>`).join('')}</tbody>
           </table></div>
         </details>`
      : '';
    return `
      <div class="cookie-categoria">
        <div class="cookie-categoria-topo">
          <div>
            <h3 id="cookie-cat-${c.id}">${c.titulo}${c.fixa ? ' <span class="cookie-selo">Sempre ativos</span>' : ''}</h3>
            <p>${c.descricao}</p>
          </div>
          <label class="cookie-chave">
            <input type="checkbox" data-categoria="${c.id}" ${ligado} ${c.fixa ? 'disabled' : ''} aria-labelledby="cookie-cat-${c.id}">
            <span aria-hidden="true"></span>
          </label>
        </div>
        ${tabela}
      </div>`;
  }).join('');
  const registro = atual.d
    ? `Sua última escolha foi registrada em ${atual.d.split('-').reverse().join('/')}.`
    : 'Você ainda não registrou uma escolha.';
  fundo.innerHTML = `
    <div class="cookie-janela" role="dialog" aria-modal="true" aria-labelledby="cookie-janela-titulo" tabindex="-1">
      <header>
        <h2 id="cookie-janela-titulo">Configurações de cookies</h2>
        <button type="button" class="cookie-fechar" aria-label="Fechar">×</button>
      </header>
      <div class="cookie-janela-corpo">
        <p>Cookies são pequenos arquivos que o site guarda no seu navegador. Escolha abaixo quais tipos você permite. Os necessários ficam sempre ativos; os demais só funcionam se você ligar.</p>
        ${categoriasHTML}
        <p class="cookie-registro">${registro} A escolha vale por 6 meses neste navegador. Saiba mais na <a href="privacidade.html">Política de Privacidade</a>.</p>
      </div>
      <footer>
        <button type="button" class="cookie-btn cookie-btn--contorno" data-acao="recusar">Rejeitar todos</button>
        <button type="button" class="cookie-btn cookie-btn--contorno" data-acao="salvar">Salvar minhas escolhas</button>
        <button type="button" class="cookie-btn cookie-btn--cheio" data-acao="aceitar">Aceitar todos</button>
      </footer>
    </div>`;
  const janela = fundo.querySelector('.cookie-janela');
  fundo.querySelector('.cookie-fechar').addEventListener('click', fecharPreferenciasDeCookies);
  fundo.addEventListener('mousedown', (e) => { if (e.target === fundo) fecharPreferenciasDeCookies(); });
  fundo.querySelector('[data-acao="aceitar"]').addEventListener('click', () => escolherTodos(1));
  fundo.querySelector('[data-acao="recusar"]').addEventListener('click', () => escolherTodos(0));
  fundo.querySelector('[data-acao="salvar"]').addEventListener('click', () => {
    const escolhas = {};
    fundo.querySelectorAll('[data-categoria]').forEach((caixa) => { escolhas[caixa.getAttribute('data-categoria')] = caixa.checked ? 1 : 0; });
    gravarConsentimento(escolhas);
    fecharAvisoDeCookies();
    fecharPreferenciasDeCookies();
  });
  // Teclado: Esc fecha e o Tab não sai da janela
  fundo.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') return fecharPreferenciasDeCookies();
    if (e.key !== 'Tab') return;
    const focaveis = [...janela.querySelectorAll('button, a[href], input:not([disabled]), summary')];
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
  });
  const aviso = document.querySelector('.cookie-aviso');
  if (aviso) aviso.remove();
  document.body.appendChild(fundo);
  document.documentElement.classList.add('cookie-janela-aberta');
  janela.focus();
}

// Para futuros scripts de estatística/anúncio: só rode se window.rcConsentimento.permitido('estatisticas')
window.rcConsentimento = { permitido: cookiesPermitidos, abrirPreferencias: abrirPreferenciasDeCookies };

function iniciarCookies() {
  // Fora do painel admin e do modo de edição de páginas
  if (document.getElementById('admin-app') || window.RC_EDITANDO) return;
  tratarMapas();
  // Mapas montados depois pelo JavaScript (páginas de imóvel e de obra)
  new MutationObserver((mudancas) => {
    mudancas.forEach((m) => m.addedNodes.forEach((no) => {
      if (no.nodeType !== 1 || no.closest('.cookie-janela-fundo, .cookie-aviso')) return;
      if (no.tagName === 'IFRAME') tratarMapa(no); else tratarMapas(no);
    }));
  }).observe(document.body, { childList: true, subtree: true });
  // Link permanente no rodapé de todas as páginas
  const rodape = document.querySelector('.site-footer .footer-bottom');
  if (rodape && !rodape.querySelector('.link-cookies')) {
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'link-cookies';
    link.textContent = 'Preferências de cookies';
    link.setAttribute('data-cookies-abrir', '');
    rodape.appendChild(link);
  }
  document.querySelectorAll('[data-cookies-abrir]').forEach((botao) => botao.addEventListener('click', abrirPreferenciasDeCookies));
  if (!lerConsentimento()) mostrarAvisoDeCookies();
}

document.addEventListener('DOMContentLoaded', () => {
  iniciarCookies();
  iniciarMenuMobile();
  marcarLinkAtivo();
  ligarBotoesWhatsApp();
  iniciarFormularioContato();
  preencherAnoRodape();
});
