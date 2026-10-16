/* =========================================================
   Rocha Costa — Carrosséis com loop infinito de verdade
   (clona a ponta oposta e "teleporta" sem transição quando
   o clone termina de entrar, então nunca há salto visível)
   ========================================================= */

// ---- Topo da home: texto à esquerda (editável no admin em "Editar páginas")
// e cartões flutuantes à direita, montados com imóveis reais do catálogo.
function _cartaoImovelHero(im, classe) {
  const preco = typeof formatarPrecoImovel === 'function' ? formatarPrecoImovel(im.preco) : '';
  return `
    <a class="cartao-flutuante ${classe}" href="imovel?id=${encodeURIComponent(im.id)}" tabindex="-1">
      <span class="cartao-foto"><img src="${urlSegura(im.imagem, 'img/logo-simbolo.png')}" alt="" onerror="this.onerror=null;this.src='img/logo-simbolo.png';this.classList.add('img-fallback')"></span>
      <span class="cartao-info">
        <span class="cartao-marca"><img src="img/logo-simbolo.png" alt="">Rocha Costa</span>
        <span class="cartao-titulo">${escHTML(im.titulo)}</span>
        <span class="cartao-linha"><span>${escHTML(im.bairro || im.cidade || '')}</span><strong>${preco}</strong></span>
      </span>
    </a>`;
}

// Cartões flutuantes: usa os imóveis em destaque (ou os mais recentes)
async function montarCartoesHero() {
  const wrap = document.getElementById('hero-cartoes');
  if (!wrap) return;
  let imoveis = [];
  try {
    imoveis = typeof carregarImoveis === 'function' ? await carregarImoveis() : await apiGet('/api/imoveis');
  } catch (e) {
    imoveis = [];
  }
  const marcados = imoveis.filter((im) => im.destaque);
  const [a, b] = (marcados.length >= 2 ? marcados : [...imoveis].reverse());
  if (!a) {
    // Catálogo vazio: mostra a marca no lugar dos imóveis
    wrap.innerHTML = '<div class="cartao-flutuante cartao-a cartao-so-marca"><img src="img/logo-rocha-costa-branca.png" alt=""></div>';
  } else {
    wrap.innerHTML = `
      ${b ? _cartaoImovelHero(b, 'cartao-b') : ''}
      ${_cartaoImovelHero(a, 'cartao-a')}
      ${a.status ? `<span class="chip-flutuante chip-1"><span class="chip-icone">✓</span><span><strong>${escHTML(a.status)}</strong><small>${escHTML(a.titulo)}</small></span></span>` : ''}
      <span class="chip-flutuante chip-2"><span class="chip-icone chip-icone--mcmv">R$</span><span><strong>Minha Casa Minha Vida</strong><small>Suporte no financiamento</small></span></span>`;
  }
  wrap.classList.add('pronto');

  // Os cartões inclinam de leve acompanhando o mouse (profundidade)
  const hero = wrap.closest('.hero');
  if (hero && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let quadro = null;
    hero.addEventListener('pointermove', (e) => {
      if (quadro) return;
      quadro = requestAnimationFrame(() => {
        quadro = null;
        const r = hero.getBoundingClientRect();
        wrap.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
        wrap.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
      });
    });
    hero.addEventListener('pointerleave', () => {
      wrap.style.setProperty('--px', 0);
      wrap.style.setProperty('--py', 0);
    });
  }
}

// Hero com 1 slide só: marca como ativo para a animação de entrada rodar
function ativarSlideUnicoHero() {
  const track = document.getElementById('hero-track');
  if (track && track.children.length === 1) track.children[0].classList.add('is-active');
}

// ---- Slider genérico de cards (destaques, portfólio) — loop infinito ----
// Espera a estrutura:
// <div class="slider">
//   <div class="slider-viewport"><div class="slider-track" id="...">...cards...</div></div>
//   <button class="slider-arrow prev" data-slider-prev>‹</button>
//   <button class="slider-arrow next" data-slider-next>›</button>
//   <div class="slider-dots"></div>
// </div>
function iniciarSliderCards(sliderSelector) {
  const slider = document.querySelector(sliderSelector);
  if (!slider) return;
  const viewport = slider.querySelector('.slider-viewport');
  const track = slider.querySelector('.slider-track');
  const prevBtn = slider.querySelector('[data-slider-prev]');
  const nextBtn = slider.querySelector('[data-slider-next]');
  const dotsWrap = slider.querySelector('.slider-dots');
  if (!viewport || !track || !track.children.length) return;

  const originais = [...track.children];
  let idx = 0;
  let porView = 1;
  let loopAtivo = false;

  function gap() { return parseFloat(getComputedStyle(track).gap) || 28; }
  function stepWidth() { return originais[0].getBoundingClientRect().width + gap(); }
  function calcularPorView() { return Math.max(1, Math.round((viewport.getBoundingClientRect().width + gap()) / stepWidth())); }

  function montarClones() {
    track.querySelectorAll('[data-clone]').forEach((el) => el.remove());
    porView = Math.min(calcularPorView(), originais.length);
    loopAtivo = originais.length > porView;

    track.innerHTML = '';
    if (loopAtivo) {
      originais.slice(-porView).forEach((el) => {
        const c = el.cloneNode(true);
        c.setAttribute('data-clone', '');
        track.appendChild(c);
      });
    }
    originais.forEach((el) => track.appendChild(el));
    if (loopAtivo) {
      originais.slice(0, porView).forEach((el) => {
        const c = el.cloneNode(true);
        c.setAttribute('data-clone', '');
        track.appendChild(c);
      });
    }
    idx = loopAtivo ? porView : 0;
  }

  function totalPaginas() { return Math.max(1, originais.length - porView + 1); }
  function paginaAtual() {
    if (!loopAtivo) return idx;
    const p = (idx - porView) % totalPaginas();
    return (p + totalPaginas()) % totalPaginas();
  }

  function montarDots() {
    if (!dotsWrap) return;
    dotsWrap.innerHTML = '';
    for (let i = 0; i < totalPaginas(); i++) {
      const dot = document.createElement('span');
      dot.addEventListener('click', () => irPagina(i));
      dotsWrap.appendChild(dot);
    }
    atualizarDots();
  }
  function atualizarDots() {
    if (!dotsWrap) return;
    const atual = paginaAtual();
    [...dotsWrap.children].forEach((d, i) => d.classList.toggle('active', i === atual));
  }

  function aplicarTransform(comTransicao) {
    track.style.transition = comTransicao ? '' : 'none';
    track.style.transform = `translateX(-${idx * stepWidth()}px)`;
  }

  let animando = false;
  let travaTimeout;

  function corrigirClone() {
    animando = false;
    clearTimeout(travaTimeout);
    if (!loopAtivo) return;
    const max = porView + originais.length - 1;
    if (idx > max) {
      idx -= originais.length;
    } else if (idx < porView) {
      idx += originais.length;
    } else {
      return;
    }
    aplicarTransform(false);
    void track.offsetWidth;
  }

  function mover(delta) {
    if (animando) return; // evita atravessar os clones com cliques rápidos (tela em branco)
    if (loopAtivo) {
      idx = Math.max(0, Math.min(porView * 2 + originais.length - 1, idx + delta));
    } else {
      // Sem loop (poucos cards): não deixa passar do último/primeiro
      idx = Math.max(0, Math.min(totalPaginas() - 1, idx + delta));
    }
    animando = true;
    clearTimeout(travaTimeout);
    travaTimeout = setTimeout(corrigirClone, 800);
    aplicarTransform(true);
    atualizarDots();
  }
  function irPagina(pagina) {
    if (animando) corrigirClone();
    idx = loopAtivo ? pagina + porView : Math.min(pagina, totalPaginas() - 1);
    aplicarTransform(true);
    atualizarDots();
  }

  track.addEventListener('transitionend', (e) => {
    if (e.target !== track) return;
    corrigirClone();
  });

  function atualizarSetas() {
    // Setas e bolinhas só aparecem quando há o que rolar
    const rolavel = originais.length > porView;
    prevBtn?.classList.toggle('off', !rolavel);
    nextBtn?.classList.toggle('off', !rolavel);
    if (prevBtn) prevBtn.hidden = !rolavel;
    if (nextBtn) nextBtn.hidden = !rolavel;
    if (dotsWrap) dotsWrap.hidden = !rolavel;
  }

  prevBtn?.addEventListener('click', () => mover(-1));
  nextBtn?.addEventListener('click', () => mover(1));

  let startX = null;
  viewport.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
  viewport.addEventListener('touchend', (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) mover(dx < 0 ? 1 : -1);
    startX = null;
  });

  montarClones();
  montarDots();
  atualizarSetas();
  aplicarTransform(false);

  // Só remonta quando a largura muda de verdade (no celular, a barra de
  // endereço dispara "resize" ao rolar e fazia o slider pular para o início).
  let larguraAnterior = window.innerWidth;
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (window.innerWidth === larguraAnterior) return;
      larguraAnterior = window.innerWidth;
      corrigirClone();
      montarClones();
      montarDots();
      atualizarSetas();
      aplicarTransform(false);
    }, 150);
  });
}
