/* =========================================================
   Rocha Costa — Atendente de IA (widget de chat flutuante)
   Fala com o backend em /api/atendente/chat, que usa a chave
   do Gemini configurada em server/.env (nunca fica exposta
   no navegador).
   ========================================================= */

(function () {
  const CHAVE_HISTORICO = 'rc_atendente_historico';
  const MENSAGEM_BOAS_VINDAS =
    'Oi! Eu sou a Marina, da Rocha Costa 👋 Me conta o que você procura — bairro, tipo de imóvel, quantos quartos — que eu te ajudo a encontrar a opção certa.';

  function carregarHistorico() {
    try {
      return JSON.parse(sessionStorage.getItem(CHAVE_HISTORICO)) || [];
    } catch {
      return [];
    }
  }

  function salvarHistorico(historico) {
    sessionStorage.setItem(CHAVE_HISTORICO, JSON.stringify(historico));
  }

  function montarWidget() {
    const fab = document.createElement('button');
    fab.className = 'rc-atendente-fab';
    fab.setAttribute('aria-label', 'Abrir atendente virtual');
    fab.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<span class="rc-atendente-badge"></span>';

    const painel = document.createElement('div');
    painel.className = 'rc-atendente-painel';
    painel.innerHTML =
      '<div class="rc-atendente-header">' +
      '<div><strong>Marina · Rocha Costa</strong><span>Normalmente responde em segundos</span></div>' +
      '<button type="button" aria-label="Fechar">&times;</button>' +
      '</div>' +
      '<div class="rc-atendente-msgs"></div>' +
      '<form class="rc-atendente-form">' +
      '<input type="text" maxlength="2000" autocomplete="off" placeholder="Escreva sua mensagem..." aria-label="Mensagem" />' +
      '<button type="submit" aria-label="Enviar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2 11 13" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 2 15 22l-4-9-9-4 20-7z" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      '</form>';

    document.body.appendChild(painel);
    document.body.appendChild(fab);

    const msgsEl = painel.querySelector('.rc-atendente-msgs');
    const form = painel.querySelector('.rc-atendente-form');
    const input = painel.querySelector('input');
    const botaoEnviar = form.querySelector('button');
    const botaoFechar = painel.querySelector('.rc-atendente-header button');

    let historico = carregarHistorico();
    let carregando = false;

    function renderizarMensagem(role, texto, extraClasse) {
      const bolha = document.createElement('div');
      bolha.className = `rc-atendente-msg ${extraClasse || role}`;
      bolha.textContent = texto;
      msgsEl.appendChild(bolha);
      msgsEl.scrollTop = msgsEl.scrollHeight;
      return bolha;
    }

    function renderizarHistoricoCompleto() {
      msgsEl.innerHTML = '';
      renderizarMensagem('assistant', MENSAGEM_BOAS_VINDAS);
      historico.forEach((m) => renderizarMensagem(m.role, m.content));
    }

    function mostrarDigitando() {
      const el = document.createElement('div');
      el.className = 'rc-atendente-digitando';
      el.innerHTML = '<span></span><span></span><span></span>';
      msgsEl.appendChild(el);
      msgsEl.scrollTop = msgsEl.scrollHeight;
      return el;
    }

    async function enviarMensagem(texto) {
      historico.push({ role: 'user', content: texto });
      salvarHistorico(historico);
      renderizarMensagem('user', texto);

      carregando = true;
      input.disabled = true;
      botaoEnviar.disabled = true;
      const digitando = mostrarDigitando();

      try {
        const res = await fetch('/api/atendente/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mensagens: historico }),
        });
        const dados = await res.json().catch(() => ({}));
        digitando.remove();

        if (!res.ok) {
          const erroTexto =
            (dados.erro || 'Não consegui responder agora.') +
            ` Se preferir, fale com a gente pelo WhatsApp ${ROCHA_COSTA?.phoneDisplay || ''}.`;
          renderizarMensagem('assistant', erroTexto, 'erro');
          return;
        }

        historico.push({ role: 'assistant', content: dados.resposta });
        salvarHistorico(historico);
        renderizarMensagem('assistant', dados.resposta);
      } catch {
        digitando.remove();
        renderizarMensagem(
          'assistant',
          'Não consegui me conectar agora. Tente de novo em instantes ou fale com a gente pelo WhatsApp.',
          'erro'
        );
      } finally {
        carregando = false;
        input.disabled = false;
        botaoEnviar.disabled = false;
        input.focus();
      }
    }

    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const texto = input.value.trim();
      if (!texto || carregando) return;
      input.value = '';
      enviarMensagem(texto);
    });

    function abrir() {
      painel.classList.add('aberto');
      if (!msgsEl.childElementCount) renderizarHistoricoCompleto();
      input.focus();
    }
    function fechar() {
      painel.classList.remove('aberto');
    }

    fab.addEventListener('click', () => {
      painel.classList.contains('aberto') ? fechar() : abrir();
    });
    botaoFechar.addEventListener('click', fechar);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', montarWidget);
  } else {
    montarWidget();
  }
})();
