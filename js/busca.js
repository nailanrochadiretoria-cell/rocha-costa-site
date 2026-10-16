/* =========================================================
   Rocha Costa — Busca inteligente do header
   =========================================================
   Sem IA/backend de busca dedicado: casa palavras-chave e
   sinônimos simples contra (1) as seções institucionais do
   site e (2) o catálogo de imóveis (via API já existente).
   ========================================================= */

const BUSCA_SECOES = [
  { url: '/', titulo: 'Início', palavras: ['inicio', 'home', 'pagina inicial'] },
  { url: 'sobre', titulo: 'Sobre nós', palavras: ['sobre', 'historia', 'quem somos', 'valores', 'empresa', 'construtora'] },
  { url: 'portfolio', titulo: 'Portfólio de obras', palavras: ['portfolio', 'obras', 'empreendimentos entregues', 'projetos entregues'] },
  { url: 'imoveis', titulo: 'Catálogo de imóveis', palavras: ['imoveis', 'imovel', 'casas', 'apartamentos', 'comprar', 'catalogo', 'terrenos'] },
  { url: 'simulador', titulo: 'Simulador de financiamento', palavras: ['simulador', 'simulacao', 'financiamento', 'financiar', 'parcela', 'juros', 'entrada', 'mcmv', 'minha casa minha vida'] },
  { url: 'depoimentos', titulo: 'Depoimentos de clientes', palavras: ['depoimentos', 'avaliacoes', 'clientes', 'opinioes', 'quem comprou'] },
  { url: 'blog', titulo: 'Blog', palavras: ['blog', 'noticias', 'artigos', 'conteudo', 'dicas'] },
  { url: 'contato', titulo: 'Contato / onde atuamos', palavras: ['contato', 'telefone', 'whatsapp', 'email', 'endereco', 'onde atuamos', 'onde voces atuam', 'localizacao', 'regiao', 'atuacao', 'mapa', 'petrolina', 'agendar visita'] },
  { url: 'privacidade', titulo: 'Política de Privacidade', palavras: ['privacidade', 'lgpd', 'termos', 'dados'] },
];

function _semAcento(txt) {
  return (txt || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function _pontuarSecao(secaoPalavras, consulta) {
  let pontos = 0;
  secaoPalavras.forEach((p) => {
    const alvo = _semAcento(p);
    if (consulta.includes(alvo) || alvo.includes(consulta)) pontos += alvo.length >= consulta.length ? 2 : 1;
  });
  return pontos;
}

// Extrai sinais de busca de imóvel (bairro, tipo, quartos, preço-máximo) da consulta em texto livre
function _extrairFiltrosImovel(consulta, imoveis) {
  const filtros = {};
  const bairros = [...new Set(imoveis.map((im) => im.bairro))];
  const bairroAchado = bairros.find((b) => consulta.includes(_semAcento(b)));
  if (bairroAchado) filtros.bairro = bairroAchado;

  const tipos = ['apartamento', 'casa em condominio', 'casa', 'terreno'];
  const tipoAchado = tipos.find((t) => consulta.includes(t));
  if (tipoAchado) {
    filtros.tipo = imoveis.find((im) => _semAcento(im.tipo) === tipoAchado)?.tipo
      || (tipoAchado === 'casa em condominio' ? 'Casa em condomínio' : tipoAchado[0].toUpperCase() + tipoAchado.slice(1));
  }

  const quartosMatch = consulta.match(/(\d+)\s*(quarto|dormitorio|qto)/);
  if (quartosMatch) filtros.quartos = Number(quartosMatch[1]);

  // Procura TODOS os números da frase (antes só o primeiro era olhado, então em
  // "2 quartos até 300 mil" o "2" era lido como preço e o "300 mil" ignorado).
  for (const m of consulta.matchAll(/(\d[\d.,]*)\s*(mil|k)?\b(?!\s*(?:quarto|dormitorio|qto|banheiro|vaga|m2|m²))/g)) {
    let valor = Number(m[1].replace(/\./g, '').replace(',', '.'));
    if (m[2]) valor *= 1000;
    if (valor >= 1000) { filtros.precoMax = valor; break; } // números pequenos não são preço
  }

  return filtros;
}

// Catálogo buscado uma vez só por página (antes eram 2 requisições por tecla digitada)
let _buscaCatalogoPromise = null;
function _catalogoBusca() {
  if (!_buscaCatalogoPromise) {
    _buscaCatalogoPromise = apiGet('/api/imoveis').catch(() => {
      _buscaCatalogoPromise = null; // tenta de novo na próxima busca
      return [];
    });
  }
  return _buscaCatalogoPromise;
}

async function _buscarImoveisRelevantes(consulta, filtros) {
  const imoveis = await _catalogoBusca();
  const temFiltro = Object.keys(filtros).length > 0;
  let lista = imoveis;
  if (temFiltro) {
    lista = imoveis.filter((im) => {
      if (filtros.bairro && im.bairro !== filtros.bairro) return false;
      if (filtros.tipo && im.tipo !== filtros.tipo) return false;
      if (filtros.quartos && im.quartos !== filtros.quartos) return false;
      if (filtros.precoMax && im.preco > filtros.precoMax) return false;
      return true;
    });
  } else {
    // sem filtro estruturado: procura a palavra digitada no título/bairro
    lista = imoveis.filter((im) => _semAcento(im.titulo).includes(consulta) || _semAcento(im.bairro).includes(consulta));
  }
  return lista.slice(0, 5).map((im) => ({
    tipo: 'imovel',
    titulo: im.titulo,
    meta: `${[im.bairro, im.cidade].filter(Boolean).join(', ')} · ${formatarPrecoImovel(im.preco)}`,
    url: `imovel?id=${im.id}`,
  }));
}

function _resultadosSecoes(consulta) {
  return BUSCA_SECOES
    .map((s) => ({ secao: s, pontos: _pontuarSecao(s.palavras, consulta) }))
    .filter((r) => r.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, 4)
    .map((r) => ({ tipo: 'secao', titulo: r.secao.titulo, meta: 'Página do site', url: r.secao.url }));
}

async function _buscarTudo(consultaOriginal) {
  const consulta = _semAcento(consultaOriginal);
  if (consulta.length < 2) return [];

  const imoveisTmp = await _catalogoBusca();
  const filtros = _extrairFiltrosImovel(consulta, imoveisTmp);
  const temSinalImovel = Object.keys(filtros).length > 0;

  const secoes = _resultadosSecoes(consulta);
  const imoveisResultado = (temSinalImovel || secoes.length === 0)
    ? await _buscarImoveisRelevantes(consulta, filtros)
    : [];

  // Prioriza imóveis quando a consulta claramente descreve um imóvel (bairro/tipo/preço/quartos)
  return temSinalImovel ? [...imoveisResultado, ...secoes] : [...secoes, ...imoveisResultado];
}

function _renderResultadosBusca(lista, consulta) {
  const wrap = document.getElementById('nav-search-resultados');
  if (!lista.length) {
    wrap.innerHTML = consulta.length < 2
      ? ''
      : '<div class="nav-search-vazio">Nenhum resultado. Tente "simulador", um bairro ou "2 quartos até 300 mil".</div>';
    return;
  }
  wrap.innerHTML = lista.map((r, i) => `
    <a href="${escHTML(r.url)}" data-resultado-busca="${i}" style="animation-delay:${i * 40}ms">
      <span class="nsr-titulo">${escHTML(r.titulo)}</span>
      <span class="nsr-meta">${escHTML(r.meta)}</span>
    </a>`).join('');
}

function iniciarBuscaHeader() {
  const wrap = document.getElementById('nav-search');
  const toggle = document.getElementById('nav-search-toggle');
  const form = document.getElementById('nav-search-form');
  const input = document.getElementById('nav-search-input');
  if (!wrap || !toggle || !form || !input) return;

  let resultadosAtuais = [];
  let debounceTimer;

  function abrir() {
    form.classList.add('open');
    setTimeout(() => input.focus(), 50);
  }
  function fechar() {
    form.classList.remove('open');
  }

  toggle.addEventListener('click', () => {
    form.classList.contains('open') ? fechar() : abrir();
  });
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) fechar();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fechar();
  });

  let buscaSeq = 0;
  let buscaPendente = null;
  function buscarAgora() {
    const consulta = input.value;
    const minhaSeq = ++buscaSeq;
    buscaPendente = _buscarTudo(consulta).then((lista) => {
      // Ignora respostas atrasadas: sem isso, uma busca antiga que termina
      // depois sobrescreve o resultado da busca mais recente.
      if (minhaSeq !== buscaSeq) return resultadosAtuais;
      resultadosAtuais = lista;
      _renderResultadosBusca(resultadosAtuais, _semAcento(consulta));
      return lista;
    });
    return buscaPendente;
  }

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(buscarAgora, 220);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    // Enter antes do debounce terminar: busca na hora com o texto atual
    // (antes levava para o resultado da busca anterior, já desatualizado).
    clearTimeout(debounceTimer);
    if (input.value.trim().length >= 2) await buscarAgora();
    if (resultadosAtuais.length) {
      window.location.href = resultadosAtuais[0].url;
    } else if (input.value.trim()) {
      window.location.href = `imoveis?busca=${encodeURIComponent(input.value.trim())}`;
    }
  });
}

document.addEventListener('DOMContentLoaded', iniciarBuscaHeader);
