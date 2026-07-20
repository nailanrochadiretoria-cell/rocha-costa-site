/* =========================================================
   Rocha Costa — Página de detalhe do imóvel (imovel.html?id=)
   ========================================================= */

async function iniciarDetalheImovel() {
  const container = document.getElementById('imovel-detalhe');
  if (!container) return;

  const params = new URLSearchParams(location.search);
  let im;
  try {
    im = await apiGet(`/api/imoveis/${params.get('id')}`);
  } catch (e) {
    im = null;
  }

  if (!im) {
    container.innerHTML = `
      <div class="center" style="padding:60px 0;">
        <h2>Imóvel não encontrado</h2>
        <p>O imóvel que você procura não existe ou foi removido.</p>
        <a class="btn btn-secondary" href="imoveis.html">Ver todos os imóveis</a>
      </div>`;
    return;
  }

  document.title = `${im.titulo} — Rocha Costa`;

  container.innerHTML = `
    <div class="breadcrumb" style="margin-bottom:20px;">
      <a href="index.html">Início</a> / <a href="imoveis.html">Imóveis</a> / ${im.titulo}
    </div>
    <div class="grid grid-2" style="align-items:flex-start;">
      <div>
        <img src="${im.imagem}" alt="${im.titulo}" style="border-radius:22px;box-shadow:var(--shadow);">
        <div class="grid grid-3" style="margin-top:16px;">
          <img src="https://picsum.photos/seed/rochacosta${im.id}b/300/200" style="border-radius:16px;">
          <img src="https://picsum.photos/seed/rochacosta${im.id}c/300/200" style="border-radius:16px;">
          <img src="https://picsum.photos/seed/rochacosta${im.id}d/300/200" style="border-radius:16px;">
        </div>
      </div>
      <div>
        <span class="tag ${badgeStatusClasse(im.status)}">${im.status}</span>
        <span class="tag">${im.tipo}</span>
        <h1 style="margin-top:14px;">${im.titulo}</h1>
        <p class="meta" style="color:var(--gray-500);">${im.bairro}, ${im.cidade}/${im.estado}</p>
        <div class="property-price" style="font-size:2rem;">${formatarBRL(im.preco)}</div>

        <div class="property-specs" style="font-size:1rem;gap:22px;">
          ${im.quartos ? `<span>${ICON_BED} ${im.quartos} quarto(s)</span>` : ''}
          ${im.banheiros ? `<span>${ICON_SHOWER} ${im.banheiros} banheiro(s)</span>` : ''}
          ${im.vagas ? `<span>${ICON_CAR} ${im.vagas} vaga(s)</span>` : ''}
          <span>${ICON_RULER} ${im.area} m²</span>
        </div>

        <div class="divider"></div>
        <h3>Sobre o imóvel</h3>
        <p>${im.descricao}</p>

        <div class="hero-card" style="background:var(--off-white);border:1px solid var(--gray-100);margin-top:24px;">
          <h3 class="mt-0">Interessou? Fale agora com a gente</h3>
          <p style="color:var(--gray-700);">Preencha o formulário ou chame direto no WhatsApp que a nossa equipe te retorna com todos os detalhes, condições de pagamento e visita agendada.</p>
          <div class="hero-actions" style="margin-top:16px;">
            <a class="btn btn-whatsapp" href="#" data-wa data-wa-item="${im.titulo}"><svg class="icon" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path fill-rule="evenodd" d="M43.75 18.35 C28.02 19.25 19.76 21.87 14.05 27.78 C10.58 31.38 8.64 35.95 8.42 41.08 C8.00 50.82 13.74 59.10 23.56 62.95 C24.18 63.19 24.68 63.44 24.68 63.53 C24.68 63.61 23.54 67.08 22.15 71.25 C20.76 75.42 19.62 78.98 19.62 79.18 C19.64 79.93 20.34 80.62 21.08 80.62 C21.69 80.62 19.88 81.99 39.20 67.00 L40.06 66.34 L42.01 66.50 C44.60 66.71 53.59 66.71 56.07 66.50 C70.70 65.25 77.57 62.87 83.36 57.07 C92.00 48.42 91.43 33.84 82.16 26.11 C77.85 22.52 72.30 20.34 64.66 19.24 C58.88 18.39 49.77 18.01 43.75 18.35 Z"/></svg> Chamar no WhatsApp</a>
            <a class="btn btn-outline-navy" href="contato.html?imovel=${encodeURIComponent(im.titulo)}">Preencher formulário</a>
          </div>
        </div>
      </div>
    </div>

    <div class="section-head" style="margin-top:60px;">
      <span class="eyebrow">Veja também</span>
      <h2>Outros imóveis que podem te interessar</h2>
    </div>
    <div class="grid grid-3" id="relacionados-grid"></div>
  `;

  ligarBotoesWhatsApp(container);

  const todosImoveis = await carregarImoveis();
  const relacionados = todosImoveis.filter((x) => x.id !== im.id && x.bairro === im.bairro).slice(0, 3);
  const listaFinal = relacionados.length ? relacionados : todosImoveis.filter((x) => x.id !== im.id).slice(0, 3);
  renderGridImoveis(listaFinal, 'relacionados-grid');
}

document.addEventListener('DOMContentLoaded', iniciarDetalheImovel);
