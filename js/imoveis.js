/* =========================================================
   Rocha Costa — Renderização e filtro do catálogo de imóveis
   Dados vêm da API (server/app.py) via js/api.js
   ========================================================= */

let IMOVEIS_CACHE = [];
let _imoveisPromise = null;

// Uma única requisição por página, mesmo se várias partes pedirem ao mesmo
// tempo (antes, destaques + catálogo + relacionados buscavam em duplicidade).
async function carregarImoveis() {
  if (IMOVEIS_CACHE.length) return IMOVEIS_CACHE;
  if (!_imoveisPromise) {
    _imoveisPromise = apiGet('/api/imoveis')
      .then((lista) => { IMOVEIS_CACHE = Array.isArray(lista) ? lista : []; return IMOVEIS_CACHE; })
      .finally(() => { _imoveisPromise = null; });
  }
  return _imoveisPromise;
}

const IMAGEM_PADRAO_IMOVEL = 'img/logo-rocha-costa.png';

// Obras (empreendimentos) por id, para mostrar no card a qual obra o imóvel pertence
let OBRAS_POR_ID = {};
async function carregarObras() {
  try {
    const lista = await apiGet('/api/empreendimentos');
    OBRAS_POR_ID = Object.fromEntries(lista.map((e) => [String(e.id), e]));
  } catch (e) {
    OBRAS_POR_ID = {}; // sem as obras, o card só não mostra a linha da obra
  }
}
const ICON_OBRA = '<svg class="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M15 10h.01"/></svg>';

function badgeStatusClasse(status) {
  if (status === 'Pronto para morar') return 'tag--green';
  if (status === 'Lançamento') return 'tag--gold';
  return 'tag--red';
}

const ICON_BED = '<svg class="icon-sm" viewBox="0 -0.5 14 14" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M12.423 6.06869V2.42398C12.423 1.53299 11.6981 0.808594 10.8076 0.808594H2.73069C1.84021 0.808594 1.11531 1.53299 1.11531 2.42398V6.06869C0.627918 6.4372 0.307617 6.99501 0.307617 7.67398V11.7124C0.307617 11.9346 0.488237 12.1163 0.711463 12.1163C0.934689 12.1163 1.11531 11.9346 1.11531 11.7124V10.5009H12.423V11.7124C12.423 11.9357 12.6036 12.1163 12.8268 12.1163C13.0501 12.1163 13.2307 11.9357 13.2307 11.7124V7.67398C13.2307 6.99501 12.9101 6.4372 12.423 6.06869ZM11.2115 5.65475H7.173V4.84706C7.173 4.40182 7.53495 4.03936 7.98069 4.03936H10.8076C11.2534 4.03936 11.6153 4.40182 11.6153 4.84706V5.69564C11.4841 5.66989 11.3503 5.65475 11.2115 5.65475ZM2.73069 1.61629H10.8076C11.2534 1.61629 11.6153 1.97874 11.6153 2.42398V3.45631C11.3755 3.31749 11.1029 3.23167 10.8076 3.23167H7.98069C7.49608 3.23167 7.06548 3.45071 6.76916 3.78999C6.47384 3.45126 6.04223 3.23167 5.55762 3.23167H2.73069C2.43513 3.23167 2.16152 3.31749 1.923 3.45631V2.42398C1.923 1.97874 2.28495 1.61629 2.73069 1.61629ZM1.923 4.84706C1.923 4.40182 2.28495 4.03936 2.73069 4.03936H5.55762C6.00336 4.03936 6.36531 4.40182 6.36531 4.84706V5.65475H2.32685C2.18853 5.65475 2.05349 5.66989 1.923 5.69513V4.84706ZM12.423 9.69321H1.11531V7.67398C1.11531 7.00511 1.65873 6.46244 2.32685 6.46244H11.2115C11.8803 6.46244 12.423 7.00511 12.423 7.67398V9.69321Z"/></svg>';
const ICON_SHOWER = '<svg class="icon-sm" viewBox="0 -0.5 14 14" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M9.46897 1.85786C9.29995 1.68884 9.026 1.68884 8.85725 1.85786L8.57466 2.14046L8.07895 1.64476C7.14516 0.710963 5.69159 0.624966 4.6553 1.36946L3.94947 0.664178C3.51949 0.235816 2.95158 0 2.34528 0C1.09454 0 0.0769043 1.01763 0.0769043 2.26892V11.6826C0.0769043 11.9206 0.270425 12.1153 0.509594 12.1153C0.748763 12.1153 0.942283 11.9206 0.942283 11.6826V2.26892C0.942283 1.49494 1.57158 0.865379 2.34528 0.865379C2.7201 0.865379 3.07247 1.01157 3.33749 1.27616L4.04169 1.98037C3.71961 2.42847 3.53842 2.96122 3.53842 3.52371C3.53842 4.23441 3.81507 4.90291 4.31753 5.40483L4.81323 5.90053L4.5309 6.18476C4.36188 6.35377 4.36188 6.62772 4.5309 6.79647C4.61473 6.87976 4.72561 6.92303 4.83649 6.92303C4.94737 6.92303 5.05792 6.88079 5.14235 6.79625L9.46924 2.46936C9.63934 2.30137 9.63934 2.02553 9.46897 1.85786ZM5.42603 5.28963L4.92843 4.79474C4.5904 4.4567 4.4038 4.00508 4.4038 3.52371C4.4038 3.04451 4.59056 2.59397 4.92952 2.25512C5.62885 1.55633 6.76709 1.55444 7.46724 2.25512L7.96294 2.75082L5.42603 5.28963ZM8.08166 9.95186C7.72334 9.95186 7.43263 10.2423 7.43263 10.6009C7.43263 10.9592 7.72334 11.2499 8.08166 11.2499C8.43998 11.2499 8.73069 10.9606 8.73069 10.6009C8.73069 10.2412 8.44133 9.95186 8.08166 9.95186ZM9.59607 6.274C9.59607 5.91541 9.30536 5.62496 8.94704 5.62496C8.58872 5.62496 8.298 5.91432 8.298 6.274C8.298 6.63367 8.58737 6.92303 8.94704 6.92303C9.30671 6.92303 9.59607 6.63367 9.59607 6.274ZM7.86531 8.00475C7.86531 7.64616 7.5746 7.35572 7.21628 7.35572C6.85796 7.35572 6.56725 7.64508 6.56725 8.00475C6.56725 8.36308 6.85796 8.65379 7.21628 8.65379C7.5746 8.65379 7.86531 8.36443 7.86531 8.00475ZM11.5432 6.49034C11.1849 6.49034 10.8941 6.78078 10.8941 7.13938C10.8941 7.4977 11.1849 7.78841 11.5432 7.78841C11.9015 7.78841 12.1922 7.49905 12.1922 7.13938C12.1922 6.7797 11.9028 6.49034 11.5432 6.49034ZM13.2739 4.75958C12.9156 4.75958 12.6249 5.05003 12.6249 5.40862C12.6249 5.76829 12.9143 6.05765 13.2739 6.05765C13.6336 6.05765 13.923 5.76829 13.923 5.40862C13.923 5.04895 13.6336 4.75958 13.2739 4.75958ZM11.3268 4.54324C11.3268 4.18465 11.0361 3.89421 10.6778 3.89421C10.3195 3.89421 10.0288 4.18357 10.0288 4.54324C10.0288 4.90291 10.3181 5.19227 10.6778 5.19227C11.0375 5.19227 11.3268 4.90291 11.3268 4.54324ZM9.81242 8.2211C9.4541 8.2211 9.16338 8.51154 9.16338 8.87013C9.16338 9.22845 9.4541 9.51917 9.81242 9.51917C10.1707 9.51917 10.4615 9.22981 10.4615 8.87013C10.4615 8.51046 10.1721 8.2211 9.81242 8.2211Z"/></svg>';
const ICON_CAR = '<svg class="icon-sm" viewBox="0 -3 17 17" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M15.8058 4.27378C15.7085 4.11164 14.7483 3.69689 14.7483 3.69689C14.9153 3.61063 15.0295 3.5928 15.0295 3.2361C15.0295 2.84696 15.0275 2.71725 14.7681 2.71725H13.888C13.8845 2.70947 13.8806 2.70136 13.877 2.69326C13.3089 1.45258 13.2327 1.139 12.3853 0.716796C11.2488 0.151583 9.11794 0.123047 8.28261 0.123047C7.44727 0.123047 5.31646 0.151583 4.18084 0.716796C3.33254 1.13835 3.35362 1.3553 2.68919 2.69326C2.68919 2.69682 2.68238 2.70623 2.67622 2.71725H1.79516C1.53768 2.71725 1.53574 2.84696 1.53574 3.2361C1.53574 3.5928 1.64988 3.61063 1.81688 3.69689C1.81688 3.69689 0.889131 4.14407 0.759421 4.27378C0.62971 4.40349 0.5 5.31146 0.5 6.86799C0.5 8.42451 0.62971 9.98104 0.62971 9.98104H1.0169C1.0169 10.435 1.0837 10.4999 1.27826 10.4999H3.87246C4.06702 10.4999 4.13188 10.435 4.13188 9.98104H12.4333C12.4333 10.435 12.4982 10.4999 12.6928 10.4999H15.3518C15.4815 10.4999 15.5464 10.4026 15.5464 9.98104H15.9355C15.9355 9.98104 16.0652 8.39208 16.0652 6.86799C16.0652 5.34389 15.9031 4.43592 15.8058 4.27378ZM4.04303 5.73107C3.45245 5.79564 2.85883 5.82878 2.26471 5.8303C1.60254 5.8303 1.57984 5.87278 1.53314 5.45933C1.51558 5.27008 1.52113 5.07941 1.54968 4.89152L1.57011 4.79262H1.66739C2.05652 4.79262 2.42198 4.80916 3.11204 5.01248C3.46303 5.1178 3.79314 5.28302 4.08778 5.50084C4.22916 5.60331 4.26159 5.70059 4.26159 5.70059L4.04303 5.73107ZM12.0578 8.06586L11.9145 8.42451H4.65072C4.65072 8.42451 4.66337 8.40473 4.48858 8.06197C4.35887 7.80839 4.52101 7.64625 4.77751 7.55415C5.2743 7.37515 6.72608 6.86799 8.28261 6.86799C9.83913 6.86799 11.3198 7.30511 11.801 7.55415C11.9794 7.64625 12.2008 7.7111 12.0578 8.06781V8.06586ZM3.72394 3.63852C3.6192 3.64455 3.51423 3.64533 3.40939 3.64079C3.49403 3.49033 3.54105 3.32268 3.62374 3.14757C3.88316 2.5963 4.17987 1.97239 4.70812 1.7094C5.47146 1.32935 7.0536 1.15814 8.28261 1.15814C9.51161 1.15814 11.0938 1.32806 11.8571 1.7094C12.3853 1.97239 12.6808 2.59662 12.9415 3.14757C13.0248 3.3243 13.0712 3.49325 13.1581 3.64468C13.0932 3.64825 13.0187 3.64468 12.8406 3.63852H3.72394ZM14.9997 5.45803C14.9303 5.86273 14.9951 5.8303 14.3005 5.8303C13.7064 5.82878 13.1128 5.79564 12.5222 5.73107C12.4298 5.71454 12.4035 5.55856 12.4774 5.50084C12.7706 5.28059 13.1012 5.11515 13.4532 5.01248C14.1432 4.80916 14.5317 4.78192 14.9153 4.79554C14.9411 4.79651 14.9656 4.80702 14.9841 4.82495C15.0026 4.84292 15.0138 4.86711 15.0155 4.89282C15.0339 5.08158 15.0286 5.2719 14.9997 5.45933V5.45803Z"/></svg>';
const ICON_RULER = '<svg class="icon-sm" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M3.80938 7.5375C3.99688 7.45937 4.20937 7.50312 4.35313 7.64687L8.35312 11.6469C8.49687 11.7906 8.54062 12.0031 8.4625 12.1906C8.38437 12.3781 8.20312 12.5 8 12.5H4C3.725 12.5 3.5 12.275 3.5 12V8C3.5 7.79688 3.62188 7.61562 3.80938 7.5375ZM4.5 9.20625V11.5H6.79375L4.5 9.20625ZM2.41438 0.414375L15.5844 13.5844C15.85 13.85 16 14.2094 16 14.5844C16 15.3656 15.3656 16 14.5844 16H2C0.895313 16 0 15.1031 0 14V1.41406C0 0.633125 0.633125 0 1.41406 0C1.78938 0 2.14906 0.149 2.41406 0.414062L2.41438 0.414375ZM1 1.41437V14C1 14.5531 1.44781 15 2 15H14.5844C14.8156 15 15 14.8156 15 14.5844C15 14.475 14.9563 14.3719 14.8781 14.2937L13.6469 13.0594L12.8531 13.8531C12.6594 14.05 12.3406 14.05 12.1469 13.8531C11.95 13.6594 11.95 13.3406 12.1469 13.1469L12.9406 12.3531L11.1469 10.5594L10.3531 11.3531C10.1594 11.55 9.84063 11.55 9.64688 11.3531C9.45 11.1594 9.45 10.8406 9.64688 10.6469L10.4406 9.85312L8.64688 8.05937L7.85313 8.85312C7.65938 9.05 7.34062 9.05 7.14687 8.85312C6.95 8.65937 6.95 8.34063 7.14687 8.14688L7.94063 7.35313L6.14687 5.55937L5.35313 6.35313C5.15938 6.55 4.84062 6.55 4.64687 6.35313C4.45 6.15938 4.45 5.84062 4.64687 5.64687L5.44063 4.85313L3.64687 3.06063L2.85344 3.85313C2.65844 4.05 2.34188 4.05 2.14656 3.85313C1.95125 3.65938 1.95125 3.34062 2.14656 3.14687L2.93937 2.35344L1.70719 1.12125C1.62937 1.04375 1.52406 1 1.41437 1C1.18562 1 1 1.18562 1 1.41437Z"/></svg>';

function cardImovelHTML(im) {
  return `
    <a class="card property-card" href="imovel?id=${encodeURIComponent(im.id)}" style="text-decoration:none;color:inherit;">
      <div class="img-wrap">
        <img src="${urlSegura(im.imagem, IMAGEM_PADRAO_IMOVEL)}" alt="${escHTML(im.titulo)}" loading="lazy" onerror="this.onerror=null;this.src='${IMAGEM_PADRAO_IMOVEL}';this.classList.add('img-fallback')">
        ${im.status ? `<span class="status-badge">${escHTML(im.status)}</span>` : ''}
      </div>
      <div class="card-body">
        ${im.tipo ? `<span class="tag ${badgeStatusClasse(im.status)}">${escHTML(im.tipo)}</span>` : ''}
        <h3>${escHTML(im.titulo)}</h3>
        <div class="meta">${escHTML(localImovel(im))}</div>
        ${OBRAS_POR_ID[String(im.empreendimento_id)] ? `<div class="card-obra">${ICON_OBRA} ${escHTML(OBRAS_POR_ID[String(im.empreendimento_id)].nome)}</div>` : ''}
        <div class="property-price">${formatarPrecoImovel(im.preco)}</div>
        <div class="property-specs">
          ${im.quartos ? `<span>${ICON_BED} ${escHTML(im.quartos)} qto(s)</span>` : ''}
          ${im.banheiros ? `<span>${ICON_SHOWER} ${escHTML(im.banheiros)} banh.</span>` : ''}
          ${im.vagas ? `<span>${ICON_CAR} ${escHTML(im.vagas)} vaga(s)</span>` : ''}
          ${im.area ? `<span>${ICON_RULER} ${escHTML(im.area)} m²</span>` : ''}
        </div>
      </div>
    </a>`;
}

const ICON_SEARCH_EMPTY = '<svg class="icon-lg" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M15.0259 13.8474L18.5948 17.4163L17.4163 18.5948L13.8474 15.0259C12.5642 16.0525 10.9367 16.6667 9.16675 16.6667C5.02675 16.6667 1.66675 13.3067 1.66675 9.16669C1.66675 5.02669 5.02675 1.66669 9.16675 1.66669C13.3067 1.66669 16.6667 5.02669 16.6667 9.16669C16.6667 10.9367 16.0526 12.5641 15.0259 13.8474ZM13.354 13.229C14.373 12.1789 15.0001 10.7464 15.0001 9.16669C15.0001 5.94377 12.3897 3.33335 9.16675 3.33335C5.94383 3.33335 3.33341 5.94377 3.33341 9.16669C3.33341 12.3896 5.94383 15 9.16675 15C10.7464 15 12.1789 14.3729 13.2291 13.3539L13.354 13.229Z"/></svg>';

// "Bairro, Cidade/UF" sem vírgulas ou barras sobrando quando falta algum campo
function localImovel(im) {
  const cidadeUf = [im.cidade, im.estado].filter(Boolean).join('/');
  return [im.bairro, cidadeUf].filter(Boolean).join(', ');
}

function renderGridImoveis(lista, containerId, mensagemVazio) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = lista.length
    ? lista.map(cardImovelHTML).join('')
    : `<div class="empty-state">${ICON_SEARCH_EMPTY}<p style="margin:0;">${mensagemVazio || 'Nenhum imóvel encontrado com esses filtros.<br>Tente ampliar a busca.'}</p></div>`;
}

function renderErroImoveis(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<div class="empty-state">${ICON_SEARCH_EMPTY}<p style="margin:0;">Não foi possível carregar os imóveis agora.<br><a href="#" data-wa>Fale com a gente pelo WhatsApp</a> ou tente recarregar a página.</p></div>`;
  ligarBotoesWhatsApp(el);
}

function _normalizarBusca(txt) {
  return String(txt || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function popularFiltros(imoveis) {
  const selBairro = document.getElementById('filtro-bairro');
  if (selBairro) {
    const bairros = [...new Set(imoveis.map((im) => im.bairro).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    bairros.forEach((b) => {
      const opt = document.createElement('option');
      opt.value = b; opt.textContent = b;
      selBairro.appendChild(opt);
    });
  }
}

function lerFiltrosEAplicar() {
  const bairro = document.getElementById('filtro-bairro')?.value || '';
  const tipo = document.getElementById('filtro-tipo')?.value || '';
  const status = document.getElementById('filtro-status')?.value || '';
  const precoMax = document.getElementById('filtro-preco')?.value || '';
  const textoOriginal = (document.getElementById('filtro-texto')?.value || '').trim();
  const texto = _normalizarBusca(textoOriginal);

  const filtrados = IMOVEIS_CACHE.filter((im) => {
    if (texto && !_normalizarBusca(`${im.titulo} ${im.bairro} ${im.tipo} ${im.descricao}`).includes(texto)) return false;
    if (bairro && im.bairro !== bairro) return false;
    if (tipo && im.tipo !== tipo) return false;
    if (status && im.status !== status) return false;
    if (precoMax && im.preco > Number(precoMax)) return false;
    return true;
  });

  renderGridImoveis(filtrados, 'imoveis-grid');
  const contagem = document.getElementById('resultados-count');
  if (contagem) {
    const n = filtrados.length;
    contagem.textContent = `${n} ${n === 1 ? 'imóvel encontrado' : 'imóveis encontrados'}${texto ? ` para “${textoOriginal}”` : ''}`;
  }
}

async function iniciarCatalogoImoveis() {
  const grid = document.getElementById('imoveis-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading-state"><span class="loading-spinner"></span>Carregando imóveis...</div>';
  let imoveis;
  try {
    [imoveis] = await Promise.all([carregarImoveis(), carregarObras()]);
  } catch (e) {
    renderErroImoveis('imoveis-grid');
    return;
  }
  popularFiltros(imoveis);

  // Filtros vindos da URL: busca do header (?busca=) e bairro (?bairro=).
  // Antes o header mandava ?busca= mas a página ignorava o parâmetro.
  const params = new URLSearchParams(location.search);
  const campoTexto = document.getElementById('filtro-texto');
  if (campoTexto && params.get('busca')) campoTexto.value = params.get('busca');
  const selBairro = document.getElementById('filtro-bairro');
  if (selBairro && params.get('bairro')) selBairro.value = params.get('bairro');

  ['filtro-bairro', 'filtro-tipo', 'filtro-status', 'filtro-preco'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', lerFiltrosEAplicar);
  });
  // Celular: filtros recolhidos atrás de um botão (a barra inteira ocupava a tela)
  const barraFiltros = document.getElementById('filtros-imoveis');
  if (barraFiltros && !barraFiltros.querySelector('.filtros-toggle')) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'btn btn-outline-navy filtros-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    const rotulo = () => {
      const ativos = ['filtro-bairro', 'filtro-tipo', 'filtro-status', 'filtro-preco']
        .filter((id) => document.getElementById(id)?.value).length;
      return `Filtros${ativos ? ` (${ativos})` : ''}`;
    };
    toggle.textContent = rotulo();
    toggle.addEventListener('click', () => {
      const aberto = barraFiltros.classList.toggle('filtros-abertos');
      toggle.setAttribute('aria-expanded', String(aberto));
    });
    barraFiltros.querySelector('.field-busca')?.after(toggle);
    barraFiltros.addEventListener('change', () => { toggle.textContent = rotulo(); });
    document.getElementById('filtro-limpar')?.addEventListener('click', () => { toggle.textContent = rotulo(); });
    if (params.get('bairro')) barraFiltros.classList.add('filtros-abertos');
  }

  let debounce;
  campoTexto?.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(lerFiltrosEAplicar, 200);
  });
  document.getElementById('filtro-limpar')?.addEventListener('click', () => {
    document.querySelectorAll('#filtros-imoveis select').forEach((s) => (s.value = ''));
    if (campoTexto) campoTexto.value = '';
    history.replaceState(null, '', location.pathname);
    lerFiltrosEAplicar();
  });
  lerFiltrosEAplicar();
}

async function iniciarDestaquesHome() {
  const grid = document.getElementById('destaques-grid');
  if (!grid) return;
  let imoveis;
  try {
    [imoveis] = await Promise.all([carregarImoveis(), carregarObras()]);
  } catch (e) {
    renderErroImoveis('destaques-grid');
    return;
  }
  if (!imoveis.length) {
    renderGridImoveis([], 'destaques-grid', 'Em breve novos imóveis por aqui.');
    return;
  }
  const marcados = imoveis.filter((im) => im.destaque);
  // Se ninguém marcou "destaque" ainda no admin, mostra os imóveis mais recentes
  // em vez de deixar a seção vazia.
  const destaques = (marcados.length ? marcados : [...imoveis].reverse()).slice(0, 6);
  renderGridImoveis(destaques, 'destaques-grid');
  iniciarSliderCards('#destaques-slider');
}

document.addEventListener('DOMContentLoaded', () => {
  iniciarCatalogoImoveis();
  iniciarDestaquesHome();
});
