/* =========================================================
   Rocha Costa — JS compartilhado (todas as páginas)
   ========================================================= */

// ---- Configuração central de contato ----
// Troque aqui quando tiver os dados reais/definitivos.
const ROCHA_COSTA = {
  whatsappNumber: '5587999143998', // 55 + DDD 87 + número, formato E.164 sem "+"
  phoneDisplay: '(87) 99914-3998',
  email: 'rochacosta@rochacosta.com',
  cidade: 'Petrolina',
  estado: 'PE',
  enderecoCurto: 'Petrolina, Pernambuco',
};

// ---- Saudação dinâmica por horário ----
function saudacaoPorHorario() {
  const hora = new Date().getHours();
  if (hora >= 5 && hora < 12) return 'Bom dia';
  if (hora >= 12 && hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

// ---- Monta o link do WhatsApp com saudação dinâmica ----
// itemLabel (opcional): nome do imóvel/empreendimento para personalizar a mensagem
function linkWhatsApp(itemLabel) {
  const saudacao = saudacaoPorHorario();
  const base = itemLabel
    ? `${saudacao}! Quero mais informações sobre o imóvel ${itemLabel}.`
    : `${saudacao}! Quero mais informações sobre o imóvel escolhido.`;
  return `https://wa.me/${ROCHA_COSTA.whatsappNumber}?text=${encodeURIComponent(base)}`;
}

// ---- Liga todos os botões/links marcados com data-wa ----
function ligarBotoesWhatsApp(scope = document) {
  scope.querySelectorAll('[data-wa]').forEach((el) => {
    const item = el.getAttribute('data-wa-item') || undefined;
    el.setAttribute('href', linkWhatsApp(item));
    el.setAttribute('target', '_blank');
    el.setAttribute('rel', 'noopener');
  });
}

// ---- Menu mobile ----
function iniciarMenuMobile() {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => {
    links.classList.toggle('open');
  });
  links.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => links.classList.remove('open'));
  });
}

// ---- Marca o link ativo do menu conforme a página atual ----
function marcarLinkAtivo() {
  const atual = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach((a) => {
    const href = a.getAttribute('href');
    if (href === atual) a.classList.add('active');
  });
}

// ---- Formulário de contato (genérico, usado em várias páginas) ----
// OBS: este é um site estático (só arquivos). O formulário abaixo NÃO envia
// e-mail nem grava em banco de dados por conta própria — ele apenas valida
// e mostra uma confirmação visual, e some junto abre o WhatsApp.
// Para o formulário funcionar de verdade, plugue um destino aqui, por exemplo:
//   - um serviço de formulário (Formspree, Getform, EmailJS) trocando a
//     linha "// TODO: enviar dados" pelo fetch() correspondente; ou
//   - o webhook do futuro agente de IA de atendimento, assim que ele existir.
function iniciarFormularioContato() {
  document.querySelectorAll('form[data-contact-form]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const dados = Object.fromEntries(new FormData(form).entries());

      // TODO: enviar dados (fetch para backend / agente de IA / serviço de formulário)
      console.log('Formulário de contato preenchido:', dados);

      const sucesso = form.parentElement.querySelector('.form-success') || form.querySelector('.form-success');
      if (sucesso) {
        sucesso.classList.add('show');
        sucesso.textContent = 'Recebemos seus dados! Nossa equipe entrará em contato em breve. Você também pode falar agora mesmo pelo WhatsApp.';
      }

      // Abre o WhatsApp automaticamente com os dados preenchidos, se configurado
      const abrirWa = form.getAttribute('data-open-whatsapp') === 'true';
      if (abrirWa) {
        const nomeImovel = dados.imovel || undefined;
        window.open(linkWhatsApp(nomeImovel), '_blank', 'noopener');
      }

      form.reset();
    });
  });
}

// ---- Ano automático no rodapé ----
function preencherAnoRodape() {
  document.querySelectorAll('[data-ano]').forEach((el) => {
    el.textContent = new Date().getFullYear();
  });
}

// ---- Formata número em Real (BRL) ----
function formatarBRL(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

// ---- Scroll reveal: movimento sutil (fade + leve translação) ao entrar na tela ----
// Aplica-se às seções de conteúdo (.section); o hero já está visível no carregamento
// e não precisa de reveal.
function iniciarScrollReveal() {
  const alvos = document.querySelectorAll('.section');
  if (!alvos.length) return;

  if (!('IntersectionObserver' in window)) {
    alvos.forEach((el) => el.classList.add('reveal', 'in'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -60px 0px' });

  alvos.forEach((el) => {
    el.classList.add('reveal');
    io.observe(el);
  });

  // Revela de imediato qualquer seção que já esteja visível ao carregar a página
  requestAnimationFrame(() => {
    alvos.forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('in');
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  iniciarMenuMobile();
  marcarLinkAtivo();
  ligarBotoesWhatsApp();
  iniciarFormularioContato();
  preencherAnoRodape();
  iniciarScrollReveal();
});
