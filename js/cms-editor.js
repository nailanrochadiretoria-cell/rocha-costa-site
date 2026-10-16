/* =========================================================
   Rocha Costa — Editor visual das páginas (modo "Editar páginas" do admin)
   ---------------------------------------------------------
   Carregado só quando a página é aberta com ?editar=1 pelo admin.
   - Toque/clique em qualquer texto para editar (Ctrl+B negrito, Ctrl+I itálico)
   - Pinte um trecho e toque em "Aa Fonte" para trocar a fonte só daquele trecho
   - Toque/clique em uma imagem para trocar (envia a foto)
   - Toque/clique em um link/botão para mudar o endereço
   - "Salvar" grava tudo no servidor; vale para todos os visitantes
   ========================================================= */

(function () {
  const ROTAS_ADMIN = [
    ['#destaques-grid, #hero-cartoes, #imoveis-grid, #relacionados-grid, #empreendimento-unidades-grid, #imovel-detalhe', 'Os imóveis são editados na aba "Imóveis" do admin.'],
    ['#portfolio-grid, #empreendimento-detalhe', 'As obras são editadas na aba "Empreendimentos" do admin.'],
    ['#depoimentos-grid, #depoimentos-preview', 'Os depoimentos são editados na aba "Depoimentos" do admin.'],
    ['#blog-grid, #post-container', 'Os artigos são editados na aba "Blog" do admin.'],
    ['[data-wa]', 'O número e a mensagem do WhatsApp ficam na aba "Configurações" do admin.'],
  ];

  const alteracoes = { textos: {}, imagens: {}, links: {} };
  const originais = new Map(); // elemento → estado original, para "Desfazer"

  function contar() {
    return Object.keys(alteracoes.textos).length + Object.keys(alteracoes.imagens).length + Object.keys(alteracoes.links).length;
  }

  // ---------- Estilos do modo edição ----------
  const css = document.createElement('style');
  css.textContent = `
    body.cms-editando { padding-bottom: 96px; }
    .cms-editando [data-cms] { outline: 1.5px dashed rgba(227,5,45,.35); outline-offset: 3px; border-radius: 4px; cursor: text; min-width: 1ch; }
    .cms-editando [data-cms]:hover, .cms-editando [data-cms]:focus { outline: 2px solid var(--red); background: rgba(227,5,45,.06); }
    .cms-editando [data-cms].cms-alterado { outline: 2px solid #1a9d55; }
    .cms-editando img[data-cms-img] { outline: 2px dashed rgba(0,31,62,.35); outline-offset: -2px; cursor: pointer; }
    .cms-editando img[data-cms-img]:hover { outline: 3px solid var(--red); filter: brightness(.9); }
    .cms-editando img.cms-alterado { outline: 3px solid #1a9d55; }
    .cms-barra { position: fixed; left: 12px; right: 12px; bottom: calc(12px + env(safe-area-inset-bottom)); z-index: 5000; display: flex; align-items: center; gap: 10px;
      background: #001327; color: #fff; padding: 12px 14px; border-radius: 16px; box-shadow: 0 20px 50px rgba(0,0,0,.35); font: 600 14px/1.3 system-ui, sans-serif; flex-wrap: wrap; }
    .cms-barra .cms-info { flex: 1; min-width: 160px; }
    .cms-barra .cms-info small { display: block; font-weight: 400; color: #c9d2de; font-size: 12px; margin-top: 2px; }
    .cms-barra button { border: none; border-radius: 999px; padding: 11px 18px; font: 700 14px system-ui, sans-serif; cursor: pointer; min-height: 44px; }
    .cms-barra .cms-salvar { background: var(--red); color: #fff; }
    .cms-barra .cms-salvar:disabled { opacity: .45; cursor: default; }
    .cms-barra .cms-desfazer { background: rgba(255,255,255,.12); color: #fff; }
    .cms-aviso { position: fixed; left: 50%; bottom: 96px; transform: translateX(-50%); z-index: 5001; max-width: calc(100vw - 32px);
      background: #fff; color: #001F3E; padding: 12px 16px; border-radius: 12px; box-shadow: 0 12px 30px rgba(0,0,0,.25); font: 500 14px/1.4 system-ui, sans-serif; }
    .cms-link-editor { position: fixed; left: 12px; right: 12px; bottom: 90px; z-index: 5002; background: #fff; border-radius: 14px; padding: 14px;
      box-shadow: 0 20px 50px rgba(0,0,0,.3); max-width: 520px; margin: 0 auto; font: 500 14px system-ui, sans-serif; color: #001F3E; }
    .cms-link-editor input { width: 100%; margin: 8px 0 10px; font-size: 16px; }
    .cms-link-editor div { display: flex; gap: 8px; justify-content: flex-end; }
    .cms-link-editor button { border: none; border-radius: 999px; padding: 10px 16px; font-weight: 700; cursor: pointer; min-height: 42px; }
    .cms-barra .cms-fonte { background: #fff; color: #001327; }
    .cms-fontes-fundo { position: fixed; inset: 0; z-index: 5003; background: rgba(0,10,25,.55); display: flex; align-items: center; justify-content: center; padding: 16px; }
    .cms-fontes { background: #fff; color: #141a26; width: 100%; max-width: 620px; height: min(680px, calc(100vh - 32px)); border-radius: 18px;
      box-shadow: 0 30px 80px rgba(0,0,0,.4); display: flex; flex-direction: column; overflow: hidden; font: 500 14px/1.4 system-ui, sans-serif; }
    .cms-fontes header { padding: 18px 20px 12px; border-bottom: 1px solid #e6e9ef; }
    .cms-fontes .cms-fontes-topo { display: flex; align-items: center; gap: 12px; }
    .cms-fontes h2 { margin: 0; flex: 1; font: 700 18px/1.2 system-ui, sans-serif !important; color: #141a26 !important; -webkit-text-fill-color: #141a26; background: none; }
    .cms-fontes .cms-fontes-fechar { border: none; background: #f0f2f6; width: 38px; height: 38px; border-radius: 50%; font-size: 20px; cursor: pointer; color: #141a26; }
    .cms-fontes .cms-fontes-trecho { margin: 6px 0 12px; color: #5b6475; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cms-fontes input[type=search] { width: 100%; box-sizing: border-box; font: 500 16px system-ui, sans-serif; padding: 12px 14px 12px 40px; border: 1.5px solid #d6dbe4; border-radius: 12px;
      color: #141a26; background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' fill='none' stroke='%235b6475' stroke-width='2' viewBox='0 0 24 24'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E") no-repeat 13px center; }
    .cms-fontes input[type=search]:focus { outline: none; border-color: var(--red); }
    .cms-fontes .cms-fontes-filtros { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .cms-fontes .cms-fontes-filtros button { flex: none; border: 1.5px solid #d6dbe4; background: #fff; color: #141a26; border-radius: 999px; padding: 6px 12px; font: 600 13px system-ui, sans-serif; cursor: pointer; }
    .cms-fontes .cms-fontes-filtros button[aria-pressed=true] { background: #141a26; border-color: #141a26; color: #fff; }
    .cms-fontes .cms-fontes-lista { flex: 1; overflow-y: auto; padding: 6px 10px; overscroll-behavior: contain; }
    .cms-fontes .cms-fonte-item { display: block; width: 100%; text-align: left; border: none; background: none; padding: 10px 12px; border-radius: 10px; cursor: pointer; color: #141a26; }
    .cms-fontes .cms-fonte-item:hover, .cms-fontes .cms-fonte-item:focus-visible { background: #f2f4f8; outline: none; }
    .cms-fontes .cms-fonte-item small { display: block; font: 500 12px system-ui, sans-serif; color: #7a8394; margin-bottom: 2px; }
    .cms-fontes .cms-fonte-item span { display: block; font-size: 22px; line-height: 1.3; color: #141a26; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cms-fontes .cms-fontes-vazio { padding: 30px 12px; text-align: center; color: #5b6475; }
    .cms-fontes footer { display: flex; gap: 8px; justify-content: space-between; align-items: center; padding: 12px 20px; border-top: 1px solid #e6e9ef; flex-wrap: wrap; }
    .cms-fontes footer span { color: #5b6475; font-size: 13px; }
    .cms-fontes footer button { border: 1.5px solid #d6dbe4; background: #fff; color: #141a26; border-radius: 999px; padding: 9px 16px; font: 700 13px system-ui, sans-serif; cursor: pointer; }
  `;
  document.head.appendChild(css);

  // ---------- Barra inferior ----------
  const barra = document.createElement('div');
  barra.className = 'cms-barra';
  barra.innerHTML = `
    <div class="cms-info"><span class="cms-contagem">Modo edição</span>
      <small>Toque num texto para editar, numa imagem para trocar ou num botão/link para mudar o endereço. Para mudar a fonte, pinte o trecho e toque em "Aa Fonte".</small></div>
    <button type="button" class="cms-desfazer" hidden>Desfazer</button>
    <button type="button" class="cms-salvar" disabled>Salvar</button>`;
  const botaoSalvar = barra.querySelector('.cms-salvar');
  const botaoDesfazer = barra.querySelector('.cms-desfazer');
  const rotuloContagem = barra.querySelector('.cms-contagem');

  function atualizarBarra() {
    const n = contar();
    rotuloContagem.textContent = n ? `${n} alteração(ões) não salva(s)` : 'Modo edição';
    botaoSalvar.disabled = n === 0;
    botaoDesfazer.hidden = n === 0;
    window.parent?.postMessage({ tipo: 'cms-pendentes', total: n }, location.origin);
  }

  let avisoTimer;
  function avisar(texto) {
    let aviso = document.querySelector('.cms-aviso');
    if (!aviso) {
      aviso = document.createElement('div');
      aviso.className = 'cms-aviso';
      aviso.setAttribute('role', 'status');
      document.body.appendChild(aviso);
    }
    aviso.textContent = texto;
    aviso.hidden = false;
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => { aviso.hidden = true; }, 3500);
  }

  function guardarOriginal(el, tipo) {
    if (!originais.has(el)) {
      originais.set(el, { tipo, html: el.innerHTML, src: el.getAttribute('src'), href: el.getAttribute('href') });
    }
  }

  // ---------- Textos ----------
  function registrarTexto(el) {
    alteracoes.textos[el.dataset.cms] = el.innerHTML;
    el.classList.add('cms-alterado');
    // O mesmo texto pode aparecer mais de uma vez (ex.: cabeçalho): mantém tudo igual
    document.querySelectorAll(`[data-cms="${el.dataset.cms}"]`).forEach((outro) => {
      if (outro !== el) outro.innerHTML = el.innerHTML;
    });
    atualizarBarra();
  }

  function prepararTextos() {
    document.querySelectorAll('[data-cms]').forEach((el) => {
      if (el.closest('.cms-barra')) return;
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'true');
      el.addEventListener('focus', () => guardarOriginal(el, 'texto'));
      el.addEventListener('input', () => registrarTexto(el));
      el.addEventListener('keydown', (e) => {
        const multilinha = el.tagName === 'P' || el.tagName === 'LI';
        if (e.key === 'Enter') {
          e.preventDefault();
          if (multilinha) document.execCommand('insertLineBreak');
        } else if (e.key === ' ' && el.closest('button, a')) {
          // Dentro de botão/link, o espaço "clicaria" o botão em vez de inserir espaço
          e.preventDefault();
          document.execCommand('insertText', false, ' ');
        }
      });
      // Colar sempre como texto puro (evita trazer formatação/scripts de outros sites)
      el.addEventListener('paste', (e) => {
        e.preventDefault();
        const texto = (e.clipboardData || window.clipboardData).getData('text/plain');
        document.execCommand('insertText', false, texto);
      });
    });
  }

  // ---------- Imagens ----------
  const seletorArquivo = document.createElement('input');
  seletorArquivo.type = 'file';
  seletorArquivo.accept = 'image/png,image/jpeg,image/webp,image/gif';
  seletorArquivo.hidden = true;
  let imagemAlvo = null;

  seletorArquivo.addEventListener('change', async () => {
    const arquivo = seletorArquivo.files[0];
    seletorArquivo.value = '';
    if (!arquivo || !imagemAlvo) return;
    const img = imagemAlvo;
    avisar('Enviando imagem...');
    try {
      const { url } = await apiUploadImagem(arquivo);
      guardarOriginal(img, 'imagem');
      document.querySelectorAll(`[data-cms-img="${img.dataset.cmsImg}"]`).forEach((i) => {
        i.src = url;
        i.classList.add('cms-alterado');
      });
      alteracoes.imagens[img.dataset.cmsImg] = url;
      atualizarBarra();
      avisar('Imagem trocada. Clique em "Salvar" para publicar.');
    } catch (err) {
      avisar(err.sessaoExpirada ? 'Sua sessão expirou. Entre de novo no admin.' : `Erro ao enviar: ${err.message}`);
    }
  });

  // ---------- Links ----------
  function editarLink(a) {
    document.querySelector('.cms-link-editor')?.remove();
    const caixa = document.createElement('div');
    caixa.className = 'cms-link-editor';
    caixa.innerHTML = `
      <label>Endereço deste link/botão
        <input type="text" inputmode="url" autocomplete="off" placeholder="ex.: contato.html ou https://...">
      </label>
      <div><button type="button" class="cms-cancelar">Cancelar</button><button type="button" class="cms-aplicar" style="background:var(--red);color:#fff;">Aplicar</button></div>`;
    const input = caixa.querySelector('input');
    input.value = alteracoes.links[a.dataset.cmsLink] || a.getAttribute('href') || '';
    caixa.querySelector('.cms-cancelar').addEventListener('click', () => caixa.remove());
    caixa.querySelector('.cms-aplicar').addEventListener('click', () => {
      const url = input.value.trim();
      if (!/^(https?:\/\/|\/|#|tel:|mailto:)/i.test(url) && !/^[\w-]+\.html/.test(url)) {
        avisar('Use um endereço do site (ex.: contato.html) ou completo (https://...).');
        return;
      }
      guardarOriginal(a, 'link');
      a.setAttribute('href', url);
      alteracoes.links[a.dataset.cmsLink] = url;
      atualizarBarra();
      caixa.remove();
    });
    document.body.appendChild(caixa);
    input.focus();
  }

  // ---------- Cliques: nada navega nem envia formulário no modo edição ----------
  document.addEventListener('click', (e) => {
    if (e.target.closest('.cms-barra, .cms-link-editor, .cms-fontes-fundo')) return;
    const img = e.target.closest('img[data-cms-img]');
    if (img) {
      e.preventDefault();
      e.stopPropagation();
      imagemAlvo = img;
      seletorArquivo.click();
      return;
    }
    const link = e.target.closest('a[href]');
    if (link) {
      e.preventDefault();
      e.stopPropagation();
      if (link.hasAttribute('data-cms-link') && !e.target.closest('[data-cms]')) {
        editarLink(link);
      } else if (link.hasAttribute('data-cms-link')) {
        // Clicou no texto do link: edita o texto; o endereço fica no botão "🔗" da barra
        ultimoLink = link;
        botaoLink.hidden = false;
      } else {
        const rota = ROTAS_ADMIN.find(([sel]) => link.closest(sel));
        if (rota) avisar(rota[1]);
      }
      return;
    }
    if (!e.target.closest('[data-cms]')) {
      const rota = ROTAS_ADMIN.find(([sel]) => e.target.closest(sel));
      if (rota) avisar(rota[1]);
    }
  }, true);
  document.addEventListener('submit', (e) => { e.preventDefault(); e.stopImmediatePropagation(); }, true);

  let ultimoLink = null;
  const botaoLink = document.createElement('button');
  botaoLink.type = 'button';
  botaoLink.className = 'cms-desfazer';
  botaoLink.textContent = '🔗 Endereço do link';
  botaoLink.hidden = true;
  botaoLink.addEventListener('click', () => { if (ultimoLink) editarLink(ultimoLink); });
  barra.insertBefore(botaoLink, botaoDesfazer);

  // ---------- Fontes: trocar a fonte de um trecho do texto ----------
  // O catálogo (js/fontes-google.json) tem as fontes do Google Fonts: [nome, categoria, tem negrito].
  const CATEGORIAS = [['', 'Todas'], ['s', 'Sem serifa'], ['r', 'Com serifa'], ['d', 'Decorativas'], ['h', 'Escritas à mão'], ['m', 'Monoespaçadas']];
  const GENERICA = { s: 'sans-serif', r: 'serif', d: 'sans-serif', h: 'cursive', m: 'monospace' };
  let catalogo = null;
  let trechoGuardado = null; // { el, range } — o que estava selecionado antes de abrir a janela

  function semAcento(t) {
    return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function carregarFonte(nome, negrito, texto) {
    const familia = nome.replace(/ /g, '+') + (!texto && negrito ? ':wght@400;700' : '');
    const href = `https://fonts.googleapis.com/css2?family=${familia}${texto ? `&text=${encodeURIComponent(texto)}` : ''}&display=swap`;
    if ([...document.querySelectorAll('link[rel=stylesheet]')].some((l) => l.getAttribute('href') === href)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function textoCmsDaSelecao() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    const no = range.commonAncestorContainer;
    const el = (no.nodeType === 1 ? no : no.parentElement)?.closest('[data-cms]');
    return el ? { el, range: range.cloneRange() } : null;
  }

  // No celular, tocar no botão pode apagar a seleção: guarda a última seleção válida
  document.addEventListener('selectionchange', () => {
    if (document.querySelector('.cms-fontes-fundo')) return;
    const atual = textoCmsDaSelecao();
    if (atual) trechoGuardado = atual;
  });

  function desembrulharFontes(raiz) {
    raiz.querySelectorAll('span[data-fonte]').forEach((sp) => sp.replaceWith(...sp.childNodes));
  }

  function aplicarFonte(nome, negrito, categoria) {
    const { el, range } = trechoGuardado;
    guardarOriginal(el, 'texto');
    const span = document.createElement('span');
    span.dataset.fonte = nome;
    span.style.fontFamily = `'${nome}', ${GENERICA[categoria] || 'sans-serif'}`;
    if (range.collapsed) {
      // Nada pintado: a fonte vale para o texto inteiro
      desembrulharFontes(el);
      span.append(...el.childNodes);
      el.appendChild(span);
    } else {
      const pedaco = range.extractContents();
      desembrulharFontes(pedaco);
      span.appendChild(pedaco);
      range.insertNode(span);
      // Pedaço vazio que sobrou de uma fonte anterior: limpa
      el.querySelectorAll('span[data-fonte]').forEach((sp) => { if (!sp.textContent) sp.remove(); });
    }
    el.normalize();
    carregarFonte(nome, negrito);
    registrarTexto(el);
    const nova = document.createRange();
    nova.selectNodeContents(span);
    trechoGuardado = { el, range: nova };
    avisar(`Fonte "${nome}" aplicada. Toque em "Salvar" para publicar.`);
  }

  function tirarFontes() {
    const { el } = trechoGuardado;
    if (!el.querySelector('span[data-fonte]')) {
      avisar('Este texto já está com a fonte original do site.');
      return;
    }
    guardarOriginal(el, 'texto');
    desembrulharFontes(el);
    el.normalize();
    registrarTexto(el);
    avisar('Este texto voltou para a fonte original do site.');
  }

  async function abrirFontes() {
    const atual = textoCmsDaSelecao() || trechoGuardado;
    if (!atual || !document.contains(atual.el)) {
      avisar('Primeiro toque no texto (ou pinte só o trecho) que você quer mudar. Depois toque em "Aa Fonte".');
      return;
    }
    trechoGuardado = atual;
    if (!catalogo) {
      try {
        catalogo = await fetch('/js/fontes-google.json').then((r) => r.json());
      } catch (e) {
        avisar('Não consegui carregar a lista de fontes. Verifique a internet e tente de novo.');
        return;
      }
    }
    const trecho = (atual.range.collapsed ? atual.el.textContent : atual.range.toString()).replace(/\s+/g, ' ').trim();
    const amostra = trecho.slice(0, 40) || 'Rocha Costa Construtora';

    const fundo = document.createElement('div');
    fundo.className = 'cms-fontes-fundo';
    fundo.innerHTML = `
      <div class="cms-fontes" role="dialog" aria-modal="true" aria-labelledby="cms-fontes-titulo">
        <header>
          <div class="cms-fontes-topo"><h2 id="cms-fontes-titulo">Escolher fonte</h2>
            <button type="button" class="cms-fontes-fechar" aria-label="Fechar">×</button></div>
          <p class="cms-fontes-trecho"></p>
          <input type="search" placeholder="Pesquisar fonte (ex.: Roboto, Playfair...)" aria-label="Pesquisar fonte" autocomplete="off" spellcheck="false">
          <div class="cms-fontes-filtros" role="group" aria-label="Tipo de fonte">
            ${CATEGORIAS.map(([c, nome]) => `<button type="button" data-cat="${c}" aria-pressed="${c === ''}">${nome}</button>`).join('')}
          </div>
        </header>
        <div class="cms-fontes-lista" role="listbox" aria-label="Fontes"></div>
        <footer><span class="cms-fontes-total"></span><button type="button" class="cms-fontes-original">Voltar à fonte original deste texto</button></footer>
      </div>`;
    const reticencias = trecho.length > 40 ? '…' : '';
    fundo.querySelector('.cms-fontes-trecho').textContent = atual.range.collapsed
      ? `Vale para o texto inteiro: "${amostra}${reticencias}"`
      : `Vale para o trecho: "${amostra}${reticencias}"`;
    const lista = fundo.querySelector('.cms-fontes-lista');
    const busca = fundo.querySelector('input[type=search]');
    const total = fundo.querySelector('.cms-fontes-total');
    let categoria = '';

    // Cada fonte só é baixada quando aparece na tela (e só as letras da amostra)
    const observador = new IntersectionObserver((entradas) => {
      entradas.forEach((en) => {
        if (!en.isIntersecting) return;
        observador.unobserve(en.target);
        carregarFonte(en.target.dataset.nome, false, en.target.dataset.nome + amostra);
      });
    }, { root: lista, rootMargin: '200px 0px' });

    function desenhar() {
      const termo = semAcento(busca.value.trim());
      const achadas = catalogo.filter(([nome, cat]) => (!categoria || cat === categoria) && (!termo || semAcento(nome).includes(termo)));
      observador.disconnect();
      lista.innerHTML = '';
      const frag = document.createDocumentFragment();
      achadas.forEach(([nome, cat, negrito]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cms-fonte-item';
        b.setAttribute('role', 'option');
        b.dataset.nome = nome;
        b.dataset.cat = cat;
        b.dataset.negrito = negrito ? '1' : '';
        const rotulo = document.createElement('small');
        rotulo.textContent = nome;
        const exemplo = document.createElement('span');
        exemplo.textContent = amostra;
        exemplo.style.fontFamily = `'${nome}', ${GENERICA[cat]}`;
        b.append(rotulo, exemplo);
        frag.appendChild(b);
      });
      lista.appendChild(frag);
      lista.querySelectorAll('.cms-fonte-item').forEach((b) => observador.observe(b));
      if (!achadas.length) lista.innerHTML = '<p class="cms-fontes-vazio">Nenhuma fonte com esse nome. Tente outra palavra.</p>';
      total.textContent = `${achadas.length} fonte(s)`;
      lista.scrollTop = 0;
    }

    function fechar() {
      observador.disconnect();
      fundo.remove();
      document.removeEventListener('keydown', teclaEsc, true);
    }
    function teclaEsc(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        fechar();
      }
    }

    let espera;
    busca.addEventListener('input', () => {
      clearTimeout(espera);
      espera = setTimeout(desenhar, 120);
    });
    fundo.querySelector('.cms-fontes-filtros').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-cat]');
      if (!b) return;
      categoria = b.dataset.cat;
      fundo.querySelectorAll('.cms-fontes-filtros button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      desenhar();
    });
    lista.addEventListener('click', (e) => {
      const b = e.target.closest('.cms-fonte-item');
      if (!b) return;
      aplicarFonte(b.dataset.nome, !!b.dataset.negrito, b.dataset.cat);
      fechar();
    });
    fundo.querySelector('.cms-fontes-original').addEventListener('click', () => {
      tirarFontes();
      fechar();
    });
    fundo.querySelector('.cms-fontes-fechar').addEventListener('click', fechar);
    fundo.addEventListener('click', (e) => { if (e.target === fundo) fechar(); });
    document.addEventListener('keydown', teclaEsc, true);

    document.body.appendChild(fundo);
    desenhar();
    busca.focus();
  }

  const botaoFonte = document.createElement('button');
  botaoFonte.type = 'button';
  botaoFonte.className = 'cms-fonte';
  botaoFonte.textContent = 'Aa Fonte';
  botaoFonte.title = 'Trocar a fonte do trecho selecionado';
  // Não deixa o clique no botão tirar a seleção do texto
  botaoFonte.addEventListener('mousedown', (e) => e.preventDefault());
  botaoFonte.addEventListener('click', abrirFontes);
  barra.insertBefore(botaoFonte, botaoLink);

  // ---------- Salvar / desfazer ----------
  botaoSalvar.addEventListener('click', async () => {
    botaoSalvar.disabled = true;
    botaoSalvar.textContent = 'Salvando...';
    try {
      await apiAuth('/api/conteudo', 'PUT', alteracoes);
      Object.keys(alteracoes).forEach((tipo) => { alteracoes[tipo] = {}; });
      originais.clear();
      document.querySelectorAll('.cms-alterado').forEach((el) => el.classList.remove('cms-alterado'));
      avisar('Alterações salvas! Já estão no ar para todos os visitantes.');
      window.parent?.postMessage({ tipo: 'cms-salvo' }, location.origin);
    } catch (err) {
      avisar(err.sessaoExpirada ? 'Sua sessão expirou. Entre de novo no admin e tente outra vez.' : `Não foi possível salvar: ${err.message}`);
    } finally {
      botaoSalvar.textContent = 'Salvar';
      atualizarBarra();
    }
  });

  botaoDesfazer.addEventListener('click', () => {
    originais.forEach((estado, el) => {
      if (estado.tipo === 'texto') el.innerHTML = estado.html;
      if (estado.tipo === 'imagem') el.setAttribute('src', estado.src);
      if (estado.tipo === 'link') el.setAttribute('href', estado.href);
      el.classList.remove('cms-alterado');
    });
    document.querySelectorAll('.cms-alterado').forEach((el) => el.classList.remove('cms-alterado'));
    originais.clear();
    Object.keys(alteracoes).forEach((tipo) => { alteracoes[tipo] = {}; });
    atualizarBarra();
  });

  window.addEventListener('beforeunload', (e) => {
    if (contar()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  async function iniciar() {
    const logado = await apiSessao().then((s) => s.logado).catch(() => false);
    if (!logado) {
      avisar('Para editar, abra esta página pelo painel admin (faça login primeiro).');
      return;
    }
    document.body.classList.add('cms-editando');
    document.body.appendChild(barra);
    document.body.appendChild(seletorArquivo);
    prepararTextos();
    atualizarBarra();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
