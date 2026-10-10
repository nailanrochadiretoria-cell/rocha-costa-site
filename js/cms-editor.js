/* =========================================================
   Rocha Costa — Editor visual das páginas (modo "Editar páginas" do admin)
   ---------------------------------------------------------
   Carregado só quando a página é aberta com ?editar=1 pelo admin.
   - Toque/clique em qualquer texto para editar (Ctrl+B negrito, Ctrl+I itálico)
   - Toque/clique em uma imagem para trocar (envia a foto)
   - Toque/clique em um link/botão para mudar o endereço
   - "Salvar" grava tudo no servidor; vale para todos os visitantes
   ========================================================= */

(function () {
  const ROTAS_ADMIN = [
    ['#hero-track, .hero', 'Os banners do topo são editados na aba "Banners do topo" do admin.'],
    ['#destaques-grid, #imoveis-grid, #relacionados-grid, #empreendimento-unidades-grid, #imovel-detalhe', 'Os imóveis são editados na aba "Imóveis" do admin.'],
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
  `;
  document.head.appendChild(css);

  // ---------- Barra inferior ----------
  const barra = document.createElement('div');
  barra.className = 'cms-barra';
  barra.innerHTML = `
    <div class="cms-info"><span class="cms-contagem">Modo edição</span>
      <small>Toque num texto para editar, numa imagem para trocar ou num botão/link para mudar o endereço.</small></div>
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
  function prepararTextos() {
    document.querySelectorAll('[data-cms]').forEach((el) => {
      if (el.closest('.cms-barra')) return;
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'true');
      el.addEventListener('focus', () => guardarOriginal(el, 'texto'));
      el.addEventListener('input', () => {
        alteracoes.textos[el.dataset.cms] = el.innerHTML;
        el.classList.add('cms-alterado');
        // O mesmo texto pode aparecer mais de uma vez (ex.: cabeçalho): mantém tudo igual
        document.querySelectorAll(`[data-cms="${el.dataset.cms}"]`).forEach((outro) => {
          if (outro !== el) outro.innerHTML = el.innerHTML;
        });
        atualizarBarra();
      });
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
    if (e.target.closest('.cms-barra, .cms-link-editor')) return;
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
