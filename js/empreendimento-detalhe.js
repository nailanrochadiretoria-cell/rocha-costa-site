/* =========================================================
   Rocha Costa — Página de detalhe do empreendimento (empreendimento?id=)
   ========================================================= */

function _tagStatusEmpreendimento(status) {
  if (status === 'Entregue') return 'tag--green';
  if (status === 'Lançamento') return 'tag--gold';
  return 'tag--red';
}

async function iniciarDetalheEmpreendimento() {
  const container = document.getElementById('empreendimento-detalhe');
  if (!container) return;

  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  let emp = null;
  if (id) {
    try {
      emp = await apiGet(`/api/empreendimentos/${encodeURIComponent(id)}`);
    } catch (e) {
      emp = null;
    }
  }

  if (!emp) {
    container.innerHTML = `
      <div class="center" style="padding:60px 0;">
        <h2>Empreendimento não encontrado</h2>
        <p>O empreendimento que você procura não existe ou foi removido.</p>
        <a class="btn btn-secondary" href="portfolio">Ver portfólio de obras</a>
      </div>`;
    return;
  }

  document.title = `${emp.nome} — Rocha Costa`;

  const imagens = (emp.imagens || []).filter(Boolean);
  const capa = imagens[0] || 'img/logo-rocha-costa.png';
  const galeria = imagens.slice(1);
  const loc = emp.localizacao || {};
  // Toda obra mostra o mapa. Sem coordenadas cadastradas, o mapa abre no
  // centro de Petrolina/PE (e avisa que a localização exata vem com a equipe).
  let lat = Number(loc.lat);
  let lng = Number(loc.lng);
  const temLocal = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  if (!temLocal) { lat = -9.3891; lng = -40.5030; }
  const zoomMapa = temLocal ? 16 : 13;
  // "Concluído em" só faz sentido para obra entregue
  const rotuloAno = emp.status === 'Entregue' ? `Concluído em ${escHTML(emp.ano)}` : `Previsão ${escHTML(emp.ano)}`;

  container.innerHTML = `
    <div class="breadcrumb" style="margin-bottom:20px;">
      <a href="/">Início</a> / <a href="portfolio">Portfólio</a> / ${escHTML(emp.nome)}
    </div>

    <div class="detalhe-foto detalhe-capa" data-anim="zoom">
      <img src="${urlSegura(capa, 'img/logo-rocha-costa.png')}" alt="${escHTML(emp.nome)}">
    </div>
    ${galeria.length ? `
    <div class="grid grid-3 galeria-empreendimento" style="margin-bottom:40px;">
      ${galeria.map((url) => `<a class="detalhe-foto" href="${urlSegura(url)}" target="_blank" rel="noopener" data-anim="zoom"><img src="${urlSegura(url)}" alt="${escHTML(emp.nome)}" loading="lazy"></a>`).join('')}
    </div>` : ''}

    <div class="grid grid-2" style="align-items:flex-start;">
      <div data-anim="right">
        ${emp.status ? `<span class="tag ${_tagStatusEmpreendimento(emp.status)}">${escHTML(emp.status)}</span>` : ''}
        ${emp.ano ? `<span class="tag">${rotuloAno}</span>` : ''}
        ${emp.total_unidades ? `<span class="tag">${escHTML(emp.total_unidades)} unidades</span>` : ''}
        <h1 style="margin-top:14px;">${escHTML(emp.nome)}</h1>
        <p style="white-space:pre-line;">${escHTML(emp.descricao || '')}</p>

        ${emp.diferenciais && emp.diferenciais.length ? `
        <h3>Diferenciais</h3>
        <ul class="lista-diferenciais">${emp.diferenciais.map((d) => `<li>${escHTML(d)}</li>`).join('')}</ul>` : ''}

        <div class="divider"></div>
        <h3>Onde fica a obra</h3>
        ${temLocal ? '' : '<p class="form-note" style="margin-top:-6px;">Localização aproximada (Petrolina/PE). Fale com a nossa equipe para o endereço exato.</p>'}
        <div class="map-embed">
          <iframe src="https://www.google.com/maps?q=${lat},${lng}&z=${zoomMapa}&output=embed" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Mapa de ${escHTML(emp.nome)}"></iframe>
        </div>
        <div class="mapa-acoes">
          <a class="btn btn-outline-navy btn-sm" href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" target="_blank" rel="noopener">Abrir no Google Maps</a>
          <a class="btn btn-outline-navy btn-sm" href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" rel="noopener">Como chegar</a>
        </div>
      </div>

      <div class="hero-card sticky-card" style="background:var(--off-white);border:1px solid var(--gray-100);" data-anim="left">
        <h3 class="mt-0">Interessado neste empreendimento?</h3>
        <p style="color:var(--gray-700);">Fale com a gente e receba condições, disponibilidade de unidades e agende uma visita.</p>
        <div class="hero-actions" style="margin-top:16px;">
          <a class="btn btn-whatsapp" href="#" data-wa data-wa-item="${escHTML(emp.nome)}">Chamar no WhatsApp</a>
          <a class="btn btn-outline-navy" href="contato?imovel=${encodeURIComponent(emp.nome)}">Preencher formulário</a>
        </div>
      </div>
    </div>

    <div class="section-head" style="margin-top:60px;">
      <h2>Imóveis disponíveis neste empreendimento</h2>
    </div>
    <div class="grid grid-3" id="empreendimento-unidades-grid"></div>
  `;

  ligarBotoesWhatsApp(container);

  const unidades = emp.unidades || [];
  if (unidades.length) {
    renderGridImoveis(unidades, 'empreendimento-unidades-grid');
  } else {
    document.getElementById('empreendimento-unidades-grid').innerHTML =
      '<p style="color:var(--gray-500);">Nenhuma unidade vinculada a este empreendimento no momento. <a href="imoveis">Veja o catálogo completo</a>.</p>';
  }
}

document.addEventListener('DOMContentLoaded', iniciarDetalheEmpreendimento);
