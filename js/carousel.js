/* =========================================================
   Rocha Costa — Carrosséis com loop infinito de verdade
   (clona a ponta oposta e "teleporta" sem transição quando
   o clone termina de entrar, então nunca há salto visível)
   ========================================================= */

// ---- Hero: monta os slides a partir da API (editável em admin.html) ----
const HERO_ROTAS = {
  imoveis: 'imoveis.html',
  portfolio: 'portfolio.html',
  simulador: 'simulador.html',
  depoimentos: 'depoimentos.html',
  contato: 'contato.html',
};

function _hrefDoSlideHero(slide) {
  if (slide.cta_tipo === 'url') return slide.cta_valor || '#';
  if (slide.cta_tipo === 'whatsapp') return '#';
  return HERO_ROTAS[slide.cta_tipo] || '#';
}

function _areaClicavelHeroHTML(slide) {
  if (!slide.area_clicavel) return '';
  const a = slide.area_clicavel;
  const href = _hrefDoSlideHero(slide);
  const waAttr = slide.cta_tipo === 'whatsapp' ? 'data-wa' : '';
  const externo = slide.cta_tipo === 'url' ? ' target="_blank" rel="noopener"' : '';
  return `<a href="${href}" ${waAttr}${externo} class="hero-area-clicavel"
    style="left:${a.x}%;top:${a.y}%;width:${a.largura}%;height:${a.altura}%;"
    aria-label="${slide.cta_texto || 'Saiba mais'}"></a>`;
}

// Slide em tela cheia: só a imagem (ou o fundo navy do .hero quando não há
// imagem), sem selo/título/texto/estatísticas/botões sobrepostos. A área
// clicável manual (definida no admin) continua funcionando sobre a imagem.
function _slideHeroHTML(slide) {
  const desktop = slide.imagem || slide.imagem_mobile;
  if (!desktop) return '<div class="hero-slide"></div>';
  const fonteMobile = slide.imagem_mobile && slide.imagem_mobile !== desktop
    ? `<source media="(max-width: 767px)" srcset="${slide.imagem_mobile}">`
    : '';
  return `
    <div class="hero-slide">
      <div class="hero-imagem-wrap-full">
        <picture>
          ${fonteMobile}
          <img class="hero-imagem-full" src="${desktop}" alt="${slide.titulo || ''}">
        </picture>
        ${_areaClicavelHeroHTML(slide)}
      </div>
    </div>`;
}

async function renderizarHeroSlides() {
  const track = document.getElementById('hero-track');
  if (!track) return;
  let slides = [];
  try {
    slides = await apiGet('/api/hero-slides');
  } catch (e) {
    slides = [];
  }
  if (!slides.length) return;
  track.innerHTML = slides.map(_slideHeroHTML).join('');
  ligarBotoesWhatsApp(track);
}

// ---- Hero: carrossel de slides full-width, autoplay + dots + swipe (sem setas) ----
function iniciarHeroCarousel() {
  const track = document.getElementById('hero-track');
  const dotsWrap = document.getElementById('hero-dots');
  if (!track) return;

  const originais = [...track.children];
  if (originais.length <= 1) return; // nada para "circular"

  const primeiroClone = originais[0].cloneNode(true);
  const ultimoClone = originais[originais.length - 1].cloneNode(true);
  primeiroClone.setAttribute('data-clone', '');
  ultimoClone.setAttribute('data-clone', '');
  track.appendChild(primeiroClone);
  track.insertBefore(ultimoClone, track.firstChild);

  let idx = 1; // 1 = primeiro slide real (posição 0 é o clone do último)
  let timer;

  function aplicarTransform(comTransicao) {
    track.style.transition = comTransicao ? '' : 'none';
    track.style.transform = `translateX(-${idx * 100}%)`;
  }
  function atualizarDots() {
    if (!dotsWrap) return;
    const pagina = ((idx - 1) % originais.length + originais.length) % originais.length;
    [...dotsWrap.children].forEach((d, i) => d.classList.toggle('active', i === pagina));
  }
  function reiniciarAutoplay() {
    clearInterval(timer);
    timer = setInterval(() => mover(1), 6000);
  }
  function mover(delta) {
    idx += delta;
    aplicarTransform(true);
    atualizarDots();
    reiniciarAutoplay();
  }
  function irPara(pagina) {
    idx = pagina + 1;
    aplicarTransform(true);
    atualizarDots();
    reiniciarAutoplay();
  }

  // Quando a transição termina de deslizar para um slide "clone", teleporta
  // instantaneamente (sem transição) para o slide real equivalente.
  track.addEventListener('transitionend', (e) => {
    if (e.target !== track) return;
    if (idx >= originais.length + 1) {
      idx = 1;
      aplicarTransform(false);
      void track.offsetWidth;
    } else if (idx <= 0) {
      idx = originais.length;
      aplicarTransform(false);
      void track.offsetWidth;
    }
  });

  if (dotsWrap) {
    originais.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.setAttribute('aria-label', `Slide ${i + 1}`);
      dot.addEventListener('click', () => irPara(i));
      dotsWrap.appendChild(dot);
    });
  }

  // swipe no touch
  let startX = null;
  track.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) mover(dx < 0 ? 1 : -1);
    startX = null;
  });

  aplicarTransform(false); // posiciona no slide 1 sem animação inicial
  atualizarDots();
  reiniciarAutoplay();
  window.addEventListener('resize', () => aplicarTransform(false));
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

  function mover(delta) {
    idx += delta;
    aplicarTransform(true);
    atualizarDots();
  }
  function irPagina(pagina) {
    idx = loopAtivo ? pagina + porView : Math.min(pagina, totalPaginas() - 1);
    aplicarTransform(true);
    atualizarDots();
  }

  track.addEventListener('transitionend', (e) => {
    if (e.target !== track || !loopAtivo) return;
    const max = porView + originais.length - 1;
    if (idx > max) {
      idx -= originais.length;
      aplicarTransform(false);
      void track.offsetWidth;
    } else if (idx < porView) {
      idx += originais.length;
      aplicarTransform(false);
      void track.offsetWidth;
    }
  });

  prevBtn?.addEventListener('click', () => mover(-1));
  nextBtn?.addEventListener('click', () => mover(1));
  prevBtn?.classList.remove('off');
  nextBtn?.classList.remove('off');

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
  aplicarTransform(false);

  window.addEventListener('resize', () => {
    montarClones();
    montarDots();
    aplicarTransform(false);
  });
}
