/* =========================================================
   Rocha Costa — Página de detalhe do empreendimento (empreendimento.html?id=)
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
  let emp;
  try {
    emp = await apiGet(`/api/empreendimentos/${params.get('id')}`);
  } catch (e) {
    emp = null;
  }

  if (!emp) {
    container.innerHTML = `
      <div class="center" style="padding:60px 0;">
        <h2>Empreendimento não encontrado</h2>
        <p>O empreendimento que você procura não existe ou foi removido.</p>
        <a class="btn btn-secondary" href="portfolio.html">Ver portfólio de obras</a>
      </div>`;
    return;
  }

  document.title = `${emp.nome} — Rocha Costa`;

  const imagens = emp.imagens && emp.imagens.length ? emp.imagens : ['https://picsum.photos/seed/rochacostaempreendimento/900/600'];
  const capa = imagens[0];
  const galeria = imagens.slice(1);
  const loc = emp.localizacao || {};

  container.innerHTML = `
    <div class="breadcrumb" style="margin-bottom:20px;">
      <a href="index.html">Início</a> / <a href="portfolio.html">Portfólio</a> / ${emp.nome}
    </div>

    <img src="${capa}" alt="${emp.nome}" style="width:100%;max-height:440px;object-fit:cover;border-radius:22px;box-shadow:var(--shadow);margin-bottom:16px;">
    ${galeria.length ? `
    <div class="grid grid-3" style="margin-bottom:40px;">
      ${galeria.map((url) => `<img src="${url}" alt="${emp.nome}" style="border-radius:16px;height:180px;width:100%;object-fit:cover;">`).join('')}
    </div>` : ''}

    <div class="grid grid-2" style="align-items:flex-start;">
      <div>
        <span class="tag ${_tagStatusEmpreendimento(emp.status)}">${emp.status}</span>
        ${emp.ano ? `<span class="tag">Concluído em ${emp.ano}</span>` : ''}
        ${emp.total_unidades ? `<span class="tag">${emp.total_unidades} unidades</span>` : ''}
        <h1 style="margin-top:14px;">${emp.nome}</h1>
        <p>${emp.descricao || ''}</p>

        ${emp.diferenciais && emp.diferenciais.length ? `
        <h3>Diferenciais</h3>
        <ul>${emp.diferenciais.map((d) => `<li>${d}</li>`).join('')}</ul>` : ''}

        ${(loc.lat && loc.lng) ? `
        <div class="divider"></div>
        <h3>Localização</h3>
        <div class="map-embed">
          <iframe src="https://www.google.com/maps?q=${loc.lat},${loc.lng}&output=embed" allowfullscreen loading="lazy" title="Mapa de ${emp.nome}"></iframe>
        </div>` : ''}
      </div>

      <div class="hero-card" style="background:var(--off-white);border:1px solid var(--gray-100);">
        <h3 class="mt-0">Interessado neste empreendimento?</h3>
        <p style="color:var(--gray-700);">Fale com a gente e receba condições, disponibilidade de unidades e agende uma visita.</p>
        <div class="hero-actions" style="margin-top:16px;">
          <a class="btn btn-whatsapp" href="#" data-wa data-wa-item="${emp.nome}">Chamar no WhatsApp</a>
          <a class="btn btn-outline-navy" href="contato.html?imovel=${encodeURIComponent(emp.nome)}">Preencher formulário</a>
        </div>
      </div>
    </div>

    <div class="section-head" style="margin-top:60px;">
      <span class="eyebrow">Unidades</span>
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
      '<p style="color:var(--gray-500);">Nenhuma unidade vinculada a este empreendimento no momento. <a href="imoveis.html">Veja o catálogo completo</a>.</p>';
  }
}

document.addEventListener('DOMContentLoaded', iniciarDetalheEmpreendimento);
