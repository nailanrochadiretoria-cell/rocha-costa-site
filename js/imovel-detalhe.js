/* =========================================================
   Rocha Costa — Página de detalhe do imóvel (imovel.html?id=)
   ========================================================= */

async function iniciarDetalheImovel() {
  const container = document.getElementById('imovel-detalhe');
  if (!container) return;

  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  let im = null;
  if (id) {
    try {
      im = await apiGet(`/api/imoveis/${encodeURIComponent(id)}`);
    } catch (e) {
      im = null;
    }
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

  // Mapa: posição do próprio imóvel, se cadastrada; senão a da obra a que ele
  // pertence; senão o bairro e a cidade (o Google localiza pelo nome).
  let obra = null;
  if (im.empreendimento_id) {
    try {
      obra = await apiGet(`/api/empreendimentos/${encodeURIComponent(im.empreendimento_id)}`);
    } catch (e) {
      obra = null;
    }
  }
  const coordValida = (loc) => loc && Number.isFinite(Number(loc.lat)) && Number.isFinite(Number(loc.lng))
    && (Number(loc.lat) !== 0 || Number(loc.lng) !== 0);
  let consultaMapa;
  let mapaExato = true;
  if (coordValida(im.localizacao)) {
    consultaMapa = `${Number(im.localizacao.lat)},${Number(im.localizacao.lng)}`;
  } else if (obra && coordValida(obra.localizacao)) {
    consultaMapa = `${Number(obra.localizacao.lat)},${Number(obra.localizacao.lng)}`;
  } else {
    mapaExato = false;
    consultaMapa = [im.bairro, im.cidade || 'Petrolina', im.estado || 'PE', 'Brasil'].filter(Boolean).join(', ');
  }
  const consultaUrl = encodeURIComponent(consultaMapa);

  // Antes havia 3 miniaturas fixas do picsum (fotos aleatórias que não eram do
  // imóvel). Agora mostra só a foto cadastrada, com zoom ao passar o mouse.
  container.innerHTML = `
    <div class="breadcrumb" style="margin-bottom:20px;">
      <a href="index.html">Início</a> / <a href="imoveis.html">Imóveis</a> / ${escHTML(im.titulo)}
    </div>
    <div class="grid grid-2" style="align-items:flex-start;">
      <div class="detalhe-foto" data-anim="zoom">
        <img src="${urlSegura(im.imagem, IMAGEM_PADRAO_IMOVEL)}" alt="${escHTML(im.titulo)}" onerror="this.onerror=null;this.src='${IMAGEM_PADRAO_IMOVEL}';this.classList.add('img-fallback')">
      </div>
      <div data-anim="left">
        ${im.status ? `<span class="tag ${badgeStatusClasse(im.status)}">${escHTML(im.status)}</span>` : ''}
        ${im.tipo ? `<span class="tag">${escHTML(im.tipo)}</span>` : ''}
        <h1 style="margin-top:14px;">${escHTML(im.titulo)}</h1>
        <p class="meta" style="color:var(--gray-500);">${escHTML(localImovel(im))}</p>
        <div class="property-price" style="font-size:2rem;">${formatarPrecoImovel(im.preco)}</div>

        <div class="property-specs" style="font-size:1rem;gap:22px;">
          ${im.quartos ? `<span>${ICON_BED} ${escHTML(im.quartos)} quarto(s)</span>` : ''}
          ${im.banheiros ? `<span>${ICON_SHOWER} ${escHTML(im.banheiros)} banheiro(s)</span>` : ''}
          ${im.vagas ? `<span>${ICON_CAR} ${escHTML(im.vagas)} vaga(s)</span>` : ''}
          ${im.area ? `<span>${ICON_RULER} ${escHTML(im.area)} m²</span>` : ''}
        </div>

        <div class="divider"></div>
        <h3>Sobre o imóvel</h3>
        <p style="white-space:pre-line;">${escHTML(im.descricao || 'Fale com a nossa equipe para receber todos os detalhes deste imóvel.')}</p>

        ${obra ? `<p class="card-obra" style="margin-top:14px;">${ICON_OBRA} Faz parte da obra <a href="empreendimento.html?id=${encodeURIComponent(obra.id)}">${escHTML(obra.nome)}</a></p>` : ''}

        <div class="divider"></div>
        <h3>Onde fica</h3>
        ${mapaExato ? '' : '<p class="form-note" style="margin-top:-6px;">Região aproximada (bairro). Fale com a nossa equipe para o endereço exato.</p>'}
        <div class="map-embed">
          <iframe src="https://www.google.com/maps?q=${consultaUrl}&z=${mapaExato ? 16 : 14}&output=embed" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Mapa de ${escHTML(im.titulo)}"></iframe>
        </div>
        <div class="mapa-acoes">
          <a class="btn btn-outline-navy btn-sm" href="https://www.google.com/maps/search/?api=1&query=${consultaUrl}" target="_blank" rel="noopener">Abrir no Google Maps</a>
          <a class="btn btn-outline-navy btn-sm" href="https://www.google.com/maps/dir/?api=1&destination=${consultaUrl}" target="_blank" rel="noopener">Como chegar</a>
        </div>

        <div class="hero-card" style="background:var(--off-white);border:1px solid var(--gray-100);margin-top:24px;">
          <h3 class="mt-0">Interessou? Fale agora com a gente</h3>
          <p style="color:var(--gray-700);">Preencha o formulário ou chame direto no WhatsApp que a nossa equipe te retorna com todos os detalhes, condições de pagamento e visita agendada.</p>
          <div class="hero-actions" style="margin-top:16px;">
            <a class="btn btn-whatsapp" href="#" data-wa data-wa-item="${escHTML(im.titulo)}"><svg class="icon" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path fill-rule="evenodd" d="M43.75 18.35 C28.02 19.25 19.76 21.87 14.05 27.78 C10.58 31.38 8.64 35.95 8.42 41.08 C8.00 50.82 13.74 59.10 23.56 62.95 C24.18 63.19 24.68 63.44 24.68 63.53 C24.68 63.61 23.54 67.08 22.15 71.25 C20.76 75.42 19.62 78.98 19.62 79.18 C19.64 79.93 20.34 80.62 21.08 80.62 C21.69 80.62 19.88 81.99 39.20 67.00 L40.06 66.34 L42.01 66.50 C44.60 66.71 53.59 66.71 56.07 66.50 C70.70 65.25 77.57 62.87 83.36 57.07 C92.00 48.42 91.43 33.84 82.16 26.11 C77.85 22.52 72.30 20.34 64.66 19.24 C58.88 18.39 49.77 18.01 43.75 18.35 Z"/></svg> Chamar no WhatsApp</a>
            <a class="btn btn-outline-navy" href="contato.html?imovel=${encodeURIComponent(im.titulo)}">Preencher formulário</a>
          </div>
        </div>
      </div>
    </div>

    <div class="section-head" style="margin-top:60px;">
      <h2>Outros imóveis que podem te interessar</h2>
    </div>
    <div class="grid grid-3" id="relacionados-grid"></div>
  `;

  ligarBotoesWhatsApp(container);

  let todosImoveis = [];
  try {
    todosImoveis = await carregarImoveis();
  } catch (e) {
    todosImoveis = [];
  }
  const outros = todosImoveis.filter((x) => String(x.id) !== String(im.id));
  const relacionados = outros.filter((x) => x.bairro === im.bairro).slice(0, 3);
  const listaFinal = relacionados.length ? relacionados : outros.slice(0, 3);
  if (!listaFinal.length) {
    // Sem outros imóveis: esconde a seção "Veja também" em vez de mostrar vazio
    document.getElementById('relacionados-grid')?.previousElementSibling?.remove();
    document.getElementById('relacionados-grid')?.remove();
    return;
  }
  renderGridImoveis(listaFinal, 'relacionados-grid');
}

document.addEventListener('DOMContentLoaded', iniciarDetalheImovel);
