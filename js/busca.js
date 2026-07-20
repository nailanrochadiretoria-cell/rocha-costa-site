/* =========================================================
   Rocha Costa — Busca inteligente do header
   =========================================================
   Sem IA/backend de busca dedicado: casa palavras-chave e
   sinônimos simples contra (1) as seções institucionais do
   site e (2) o catálogo de imóveis (via API já existente).
   ========================================================= */

const BUSCA_SECOES = [
  { url: 'index.html', titulo: 'Início', palavras: ['inicio', 'home', 'pagina inicial'] },
  { url: 'sobre.html', titulo: 'Sobre nós', palavras: ['sobre', 'historia', 'quem somos', 'valores', 'empresa', 'construtora'] },
  { url: 'portfolio.html', titulo: 'Portfólio de obras', palavras: ['portfolio', 'obras', 'empreendimentos entregues', 'projetos entregues'] },
  { url: 'imoveis.html', titulo: 'Catálogo de imóveis', palavras: ['imoveis', 'imovel', 'casas', 'apartamentos', 'comprar', 'catalogo', 'terrenos'] },
  { url: 'simulador.html', titulo: 'Simulador de financiamento', palavras: ['simulador', 'simulacao', 'financiamento', 'financiar', 'parcela', 'juros', 'entrada', 'mcmv', 'minha casa minha vida'] },
  { url: 'depoimentos.html', titulo: 'Depoimentos de clientes', palavras: ['depoimentos', 'avaliacoes', 'clientes', 'opinioes', 'quem comprou'] },
  { url: 'blog.html', titulo: 'Blog', palavras: ['blog', 'noticias', 'artigos', 'conteudo', 'dicas'] },
  { url: 'contato.html', titulo: 'Contato / onde atuamos', palavras: ['contato', 'telefone', 'whatsapp', 'email', 'endereco', 'onde atuamos', 'onde voces atuam', 'localizacao', 'regiao', 'atuacao', 'mapa', 'petrolina', 'agendar visita'] },
  { url: 'privacidade.html', titulo: 'Política de Privacidade', palavras: ['privacidade', 'lgpd', 'termos', 'dados'] },
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

  const precoMatch = consulta.match(/(?:ate|até|abaixo de|menos de|maximo de|máximo de)?\s*r?\$?\s*(\d[\d.,]*)\s*(mil|k)?/);
  if (precoMatch && precoMatch[1] && /\d/.test(precoMatch[1])) {
    let valor = Number(precoMatch[1].replace(/\./g, '').replace(',', '.'));
    if (precoMatch[2]) valor *= 1000;
    if (valor >= 1000) filtros.precoMax = valor; // evita capturar "2 quartos" como preço
  }

  return filtros;
}

async function _buscarImoveisRelevantes(consulta, filtros) {
  let imoveis = [];
  try {
    imoveis = await apiGet('/api/imoveis');
  } catch (e) {
    return [];
  }
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
    meta: `${im.bairro}, ${im.cidade}/${im.estado} · ${formatarBRL(im.preco)}`,
    url: `imovel.html?id=${im.id}`,
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

  const imoveisTmp = await apiGet('/api/imoveis').catch(() => []);
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
    <a href="${r.url}" data-resultado-busca="${i}">
      <span class="nsr-titulo">${r.titulo}</span>
      <span class="nsr-meta">${r.meta}</span>
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

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const consulta = input.value;
    debounceTimer = setTimeout(async () => {
      resultadosAtuais = await _buscarTudo(consulta);
      _renderResultadosBusca(resultadosAtuais, _semAcento(consulta));
    }, 220);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (resultadosAtuais.length) {
      window.location.href = resultadosAtuais[0].url;
    } else if (input.value.trim()) {
      window.location.href = `imoveis.html?busca=${encodeURIComponent(input.value.trim())}`;
    }
  });
}

document.addEventListener('DOMContentLoaded', iniciarBuscaHeader);
