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

function iniciarSimulador() {
  const form = document.getElementById('form-simulador');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const valorImovel = Number(document.getElementById('sim-valor').value);
    const entradaPercent = Number(document.getElementById('sim-entrada').value);
    const prazoAnos = Number(document.getElementById('sim-prazo').value);
    const taxaAnual = Number(document.getElementById('sim-taxa').value);

    const valorEntrada = valorImovel * (entradaPercent / 100);
    const valorFinanciado = valorImovel - valorEntrada;
    const parcela = calcularParcelaPrice(valorFinanciado, taxaAnual, prazoAnos);
    const totalPago = parcela * prazoAnos * 12 + valorEntrada;

    document.getElementById('sim-resultado').style.display = 'block';
    document.getElementById('res-entrada').textContent = formatarBRL(valorEntrada);
    document.getElementById('res-financiado').textContent = formatarBRL(valorFinanciado);
    document.getElementById('res-parcela').textContent = formatarBRL(parcela);
    document.getElementById('res-total').textContent = formatarBRL(totalPago);

    document.getElementById('sim-resultado').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

document.addEventListener('DOMContentLoaded', iniciarSimulador);
