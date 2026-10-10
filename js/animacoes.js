/* =========================================================
   Rocha Costa — Animações do site
   ---------------------------------------------------------
   - Revela elementos ao rolar (vários estilos, em cascata)
   - Títulos que entram palavra por palavra
   - Header que compacta/some ao rolar
   - Inclinação 3D + reflexo nos cards, ondinha nos botões
   - Bolhas flutuantes, brilho que segue o mouse, parallax
   - Linha do tempo que se desenha, contadores animados
   Com "reduzir movimento" ligado no sistema, fica só o esmaecer
   suave: sem inclinação 3D, parallax nem deslocamentos grandes.
   ========================================================= */

(function () {
  const reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ponteiroFino = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  // No modo edição do admin tudo fica parado e visível, para dar para editar
  const editando = !!window.RC_EDITANDO;

  // ---------- Contador animado (também usado pelo simulador) ----------
  window.animarNumero = function animarNumero(el, valorFinal, formatar = (n) => Math.round(n).toLocaleString('pt-BR'), duracao = 1100) {
    if (!el) return;
    if (!Number.isFinite(valorFinal)) {
      el.textContent = formatar(valorFinal);
      return;
    }
    const inicio = performance.now();
    const passo = (agora) => {
      const t = Math.min(1, (agora - inicio) / duracao);
      const suave = 1 - Math.pow(1 - t, 3); // desacelera no final
      el.textContent = formatar(valorFinal * suave);
      if (t < 1) requestAnimationFrame(passo);
      else el.textContent = formatar(valorFinal);
    };
    requestAnimationFrame(passo);
  };

  // ---------- Revelar ao rolar ----------
  // [seletor, estilo, cascata entre irmãos?]
  const REGRAS_REVEAL = [
    ['.section-head', 'up', false],
    ['.testimonial-card', 'flip', true],
    ['.timeline-item', 'left', true],
    ['.section .grid-3 > *, .section .grid-4 > *', 'up', true],
    ['.section .grid-2 > :first-child', 'right', false],
    ['.section .grid-2 > :last-child:not(:first-child)', 'left', false],
    ['.filters-bar', 'down', false],
    ['.form-card', 'zoom', false],
    ['.map-embed', 'blur', false],
    ['.results-count', 'fade', false],
    ['.section .slider', 'up', false],
    ['.section .center', 'up', false],
    ['.section .divider', 'fade', false],
    ['.site-footer .footer-grid > *', 'up', true],
    ['[data-anim]', null, false],
  ];
  // Onde NÃO revelar: dentro de carrosséis (clones copiam o estado), hero,
  // painéis flutuantes e elementos que já têm animação própria.
  const IGNORAR = '.slider-track, .hero, .rc-atendente-painel, .nav-search-form, #sim-resultado';

  let observador = null;

  function marcarParaRevelar(el, estilo, atraso) {
    if (el.classList.contains('anim') || el.classList.contains('anim-in')) return;
    if (el.closest(IGNORAR) && !el.hasAttribute('data-anim')) return;
    if (el.parentElement && el.parentElement.closest('.anim')) return; // o pai já anima
    el.setAttribute('data-anim', el.getAttribute('data-anim') || estilo);
    el.style.setProperty('--anim-delay', `${atraso}ms`);
    el.classList.add('anim');
    observador.observe(el);
  }

  function revelar(el) {
    el.classList.add('anim-in');
    // Terminada a entrada, tira a classe "anim": o elemento volta às
    // transições normais (senão o hover dos cards ficaria lento).
    const atraso = parseFloat(el.style.getPropertyValue('--anim-delay')) || 0;
    setTimeout(() => {
      el.classList.remove('anim');
      el.style.removeProperty('--anim-delay');
    }, atraso + 1000);
    // Contadores dentro do elemento
    el.querySelectorAll('[data-contador]').forEach(iniciarContador);
    if (el.matches('[data-contador]')) iniciarContador(el);
  }

  function escanearReveal(raiz = document) {
    if (!observador) return;
    REGRAS_REVEAL.forEach(([seletor, estilo, cascata]) => {
      const lista = [...raiz.querySelectorAll(seletor)];
      if (raiz !== document && raiz.matches && raiz.matches(seletor)) lista.unshift(raiz);
      const indicePorPai = new Map();
      lista.forEach((el) => {
        let atraso = 0;
        if (cascata) {
          const i = indicePorPai.get(el.parentElement) || 0;
          indicePorPai.set(el.parentElement, i + 1);
          atraso = Math.min(i, 6) * 110;
        }
        marcarParaRevelar(el, estilo || 'up', atraso);
      });
    });
  }

  function iniciarReveal() {
    if (!('IntersectionObserver' in window)) return; // sem suporte: tudo fica visível
    observador = new IntersectionObserver((entradas) => {
      entradas.forEach((entrada) => {
        if (entrada.isIntersecting) {
          revelar(entrada.target);
          observador.unobserve(entrada.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    escanearReveal();

    // Conteúdo que chega depois (cards vindos da API) também anima
    let pendente = false;
    new MutationObserver((mutacoes) => {
      if (pendente) return;
      if (!mutacoes.some((m) => m.addedNodes.length)) return;
      pendente = true;
      requestAnimationFrame(() => {
        pendente = false;
        escanearReveal();
        prepararImagens();
        prepararCards();
      });
    }).observe(document.body, { childList: true, subtree: true });

    // Rede de segurança: nada fica invisível para sempre se o observer falhar
    setTimeout(() => {
      document.querySelectorAll('.anim:not(.anim-in)').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) revelar(el);
      });
    }, 2500);
  }

  // ---------- Contadores ----------
  function iniciarContador(el) {
    if (el.dataset.contou) return;
    el.dataset.contou = '1';
    const alvo = Number(el.getAttribute('data-contador'));
    const prefixo = el.getAttribute('data-prefixo') || '';
    const sufixo = el.getAttribute('data-sufixo') || '';
    const semSeparador = el.hasAttribute('data-sem-separador');
    animarNumero(el, alvo, (n) => `${prefixo}${semSeparador ? Math.round(n) : Math.round(n).toLocaleString('pt-BR')}${sufixo}`, 1400);
  }

  function prepararContadores() {
    // Anos da linha do tempo contam até o valor (ex.: 1990 → 2012)
    document.querySelectorAll('.timeline-year').forEach((el) => {
      const ano = parseInt(el.textContent, 10);
      if (!ano || el.hasAttribute('data-contador')) return;
      el.setAttribute('data-contador', ano);
      el.setAttribute('data-sem-separador', '');
    });
  }

  // ---------- Títulos palavra por palavra ----------
  function dividirPalavras(h) {
    if (!h || h.dataset.dividido || h.children.length) return;
    h.dataset.dividido = '1';
    const palavras = h.textContent.trim().split(/\s+/);
    h.setAttribute('aria-label', h.textContent.trim());
    h.innerHTML = palavras
      .map((p, i) => `<span class="palavra" aria-hidden="true"><span style="--i:${i}">${p.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)}</span></span>`)
      .join(' ');
  }

  // ---------- Bolhas flutuantes ----------
  function adicionarBolhas(container, quantidade) {
    if (!container || container.querySelector(':scope > .bolhas')) return;
    const wrap = document.createElement('div');
    wrap.className = 'bolhas';
    wrap.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < quantidade; i++) {
      const b = document.createElement('span');
      const tamanho = 40 + Math.random() * 180;
      b.style.width = `${tamanho}px`;
      b.style.height = `${tamanho}px`;
      b.style.left = `${Math.random() * 95}%`;
      b.style.top = `${10 + Math.random() * 85}%`;
      b.style.setProperty('--dur', `${12 + Math.random() * 14}s`);
      b.style.setProperty('--atraso', `${-Math.random() * 20}s`);
      if (i % 3 === 0) b.classList.add('vermelha');
      wrap.appendChild(b);
    }
    container.prepend(wrap);
  }

  // ---------- Brilho que segue o mouse ----------
  function adicionarBrilhoMouse(container) {
    if (!container || !ponteiroFino || container.querySelector(':scope > .brilho-mouse')) return;
    const brilho = document.createElement('div');
    brilho.className = 'brilho-mouse';
    brilho.setAttribute('aria-hidden', 'true');
    container.prepend(brilho);
    container.addEventListener('pointermove', (e) => {
      const r = container.getBoundingClientRect();
      container.style.setProperty('--gx', `${((e.clientX - r.left) / r.width) * 100}%`);
      container.style.setProperty('--gy', `${((e.clientY - r.top) / r.height) * 100}%`);
    });
  }

  // ---------- Cards com inclinação 3D ----------
  function prepararCards() {
    if (reduzMovimento || !ponteiroFino) return;
    document.querySelectorAll('.card:not([data-tilt])').forEach((card) => {
      if (card.closest('.admin-main, .imoveis-soltos')) return; // imóveis "soltos" na página não inclinam
      card.setAttribute('data-tilt', '1');
      let quadro = null;
      card.addEventListener('pointermove', (e) => {
        if (quadro) return;
        quadro = requestAnimationFrame(() => {
          quadro = null;
          const r = card.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width;
          const py = (e.clientY - r.top) / r.height;
          card.style.setProperty('--ry', `${(px - 0.5) * 9}deg`);
          card.style.setProperty('--rx', `${(0.5 - py) * 9}deg`);
          card.style.setProperty('--mx', `${px * 100}%`);
          card.style.setProperty('--my', `${py * 100}%`);
          card.classList.add('tilt-ativo');
        });
      });
      card.addEventListener('pointerleave', () => {
        if (quadro) cancelAnimationFrame(quadro);
        quadro = null;
        card.classList.remove('tilt-ativo');
      });
    });
  }

  // ---------- Imagens surgem suavemente ao carregar ----------
  function prepararImagens() {
    document.querySelectorAll('.card img:not([data-fade]), .detalhe-foto img:not([data-fade])').forEach((img) => {
      img.setAttribute('data-fade', '1');
      if (img.complete && img.naturalWidth) return;
      img.classList.add('img-carregando');
      const pronto = () => {
        img.classList.add('img-carregada');
        img.classList.remove('img-carregando');
      };
      img.addEventListener('load', pronto, { once: true });
      img.addEventListener('error', pronto, { once: true });
    });
  }

  // ---------- Ondinha no clique dos botões ----------
  function iniciarOndinha() {
    document.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('.btn');
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const tamanho = Math.max(r.width, r.height);
      const onda = document.createElement('span');
      onda.className = 'ondinha';
      onda.style.width = onda.style.height = `${tamanho}px`;
      onda.style.left = `${e.clientX - r.left - tamanho / 2}px`;
      onda.style.top = `${e.clientY - r.top - tamanho / 2}px`;
      btn.appendChild(onda);
      setTimeout(() => onda.remove(), 700);
    });
  }

  // ---------- Rolagem: header, timeline, parallax ----------
  function iniciarRolagem() {
    const header = document.querySelector('.site-header');
    const timelines = [...document.querySelectorAll('.timeline')];
    const parallax = [...document.querySelectorAll('.page-hero .bolhas, .hero .bolhas')];
    let ultimoY = window.scrollY;
    let agendado = false;

    function atualizar() {
      agendado = false;
      const y = window.scrollY;
      document.body.classList.toggle('rolou-pagina', y > 40);

      if (header) {
        header.classList.toggle('rolou', y > 10);
        // Some ao rolar para baixo e volta ao rolar para cima — mas nunca
        // com o menu mobile ou a busca abertos.
        const menuAberto = document.querySelector('.nav-links.open, .nav-search-form.open');
        const descendo = y > ultimoY + 4;
        const subindo = y < ultimoY - 4;
        if (descendo && y > 320 && !menuAberto) header.classList.add('oculto');
        else if (subindo || y < 320 || menuAberto) header.classList.remove('oculto');
      }
      ultimoY = y;

      timelines.forEach((t) => {
        const r = t.getBoundingClientRect();
        const visto = (window.innerHeight * 0.75 - r.top) / r.height;
        t.style.setProperty('--linha', Math.max(0, Math.min(1, visto)).toFixed(3));
      });

      if (!reduzMovimento) {
        parallax.forEach((el) => { el.style.transform = `translateY(${y * 0.25}px)`; });
      }
    }

    window.addEventListener('scroll', () => {
      if (!agendado) {
        agendado = true;
        requestAnimationFrame(atualizar);
      }
    }, { passive: true });
    window.addEventListener('resize', atualizar);
    atualizar();
  }

  function iniciar() {
    if (editando) {
      iniciarRolagem();
      return;
    }
    document.querySelectorAll('.page-hero h1').forEach(dividirPalavras);
    // Enfeites (bolhas, brilho do mouse) só no tema escuro: são bonitos mas
    // pesam, e no tema claro nem aparecem.
    if (document.body.classList.contains('tema-escuro')) {
      document.querySelectorAll('.page-hero, .pagina-404').forEach((el) => {
        adicionarBolhas(el, 7);
        adicionarBrilhoMouse(el);
      });
      document.querySelectorAll('.section--navy').forEach((el) => adicionarBolhas(el, 6));
      const hero = document.querySelector('.hero');
      if (hero) adicionarBrilhoMouse(hero);
    }
    prepararContadores();
    iniciarReveal();
    prepararCards();
    prepararImagens();
    iniciarOndinha();
    iniciarRolagem();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
