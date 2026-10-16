/* =========================================================
   Rocha Costa — Simulador de financiamento (estimativa)
   Cálculo pela Tabela Price (amortização francesa).
   IMPORTANTE: resultado é apenas uma estimativa educativa —
   as condições reais dependem do banco/agente financeiro.
   ========================================================= */

function calcularParcelaPrice(valorFinanciado, taxaAnualPercent, prazoAnos) {
  const i = (taxaAnualPercent / 100) / 12; // taxa mensal
  const n = prazoAnos * 12;
  if (i === 0) return valorFinanciado / n;
  const parcela = valorFinanciado * (i / (1 - Math.pow(1 + i, -n)));
  return parcela;
}

// Mostra o valor final contando a partir do zero (quando o módulo de
// animações está carregado); senão, só escreve o valor.
function _mostrarValorSimulador(id, valor) {
  const el = document.getElementById(id);
  if (!el) return;
  if (typeof animarNumero === 'function') {
    animarNumero(el, valor, formatarBRL);
  } else {
    el.textContent = formatarBRL(valor);
  }
}

// Barra deslizante do valor: arrastar o ponto atualiza o valor exibido, o
// campo numérico (para digitar um valor exato) e o preenchimento da barra.
function iniciarSliderValor(aoMudar) {
  const slider = document.getElementById('sim-valor-slider');
  const exato = document.getElementById('sim-valor');
  const exibido = document.getElementById('sim-valor-exibido');
  if (!slider || !exato) return;

  function pintar() {
    const pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.setProperty('--pct', `${Math.min(100, Math.max(0, pct))}%`);
  }
  function mostrar(valor) {
    if (exibido) exibido.textContent = formatarBRL(valor);
  }

  slider.addEventListener('input', () => {
    exato.value = slider.value;
    mostrar(Number(slider.value));
    pintar();
    aoMudar();
  });
  exato.addEventListener('input', () => {
    const v = Number(exato.value);
    if (!Number.isFinite(v) || v <= 0) return;
    slider.value = Math.min(Number(slider.max), Math.max(Number(slider.min), v));
    mostrar(v);
    pintar();
    aoMudar();
  });
  mostrar(Number(exato.value));
  pintar();
}

function iniciarSimulador() {
  const form = document.getElementById('form-simulador');
  if (!form) return;

  // Recalcula na hora ao arrastar a barra ou mudar qualquer campo (sem animação
  // de contagem, para acompanhar o dedo); o botão continua fazendo o cálculo completo.
  let calculouUmaVez = false;
  function recalcularAoVivo() {
    if (!calculouUmaVez || !form.checkValidity()) return;
    const valorImovel = Number(document.getElementById('sim-valor').value);
    const entradaPercent = Number(document.getElementById('sim-entrada').value);
    const prazoAnos = Number(document.getElementById('sim-prazo').value);
    const taxaAnual = Number(document.getElementById('sim-taxa').value);
    const valorEntrada = valorImovel * (entradaPercent / 100);
    const valorFinanciado = valorImovel - valorEntrada;
    const parcela = calcularParcelaPrice(valorFinanciado, taxaAnual, prazoAnos);
    const valores = { 'res-entrada': valorEntrada, 'res-financiado': valorFinanciado, 'res-parcela': parcela, 'res-total': parcela * prazoAnos * 12 + valorEntrada };
    Object.entries(valores).forEach(([id, v]) => { document.getElementById(id).textContent = formatarBRL(v); });
  }
  iniciarSliderValor(recalcularAoVivo);
  ['sim-entrada', 'sim-prazo', 'sim-taxa'].forEach((id) => document.getElementById(id)?.addEventListener('input', recalcularAoVivo));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    calculouUmaVez = true;

    const valorImovel = Number(document.getElementById('sim-valor').value);
    const entradaPercent = Number(document.getElementById('sim-entrada').value);
    const prazoAnos = Number(document.getElementById('sim-prazo').value);
    const taxaAnual = Number(document.getElementById('sim-taxa').value);

    // O navegador já valida min/max, mas garante que nada vire NaN/Infinity
    if (![valorImovel, entradaPercent, prazoAnos, taxaAnual].every(Number.isFinite)
        || valorImovel <= 0 || prazoAnos <= 0 || entradaPercent < 0 || entradaPercent >= 100 || taxaAnual < 0) {
      form.reportValidity();
      return;
    }

    const valorEntrada = valorImovel * (entradaPercent / 100);
    const valorFinanciado = valorImovel - valorEntrada;
    const parcela = calcularParcelaPrice(valorFinanciado, taxaAnual, prazoAnos);
    const totalPago = parcela * prazoAnos * 12 + valorEntrada;

    const resultado = document.getElementById('sim-resultado');
    resultado.style.display = 'block';
    resultado.classList.remove('sim-resultado--in');
    void resultado.offsetWidth; // reinicia a animação de entrada a cada novo cálculo
    resultado.classList.add('sim-resultado--in');

    _mostrarValorSimulador('res-entrada', valorEntrada);
    _mostrarValorSimulador('res-financiado', valorFinanciado);
    _mostrarValorSimulador('res-parcela', parcela);
    _mostrarValorSimulador('res-total', totalPago);

    resultado.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

document.addEventListener('DOMContentLoaded', iniciarSimulador);
