/* =========================================================
   Rocha Costa — Simulador de financiamento (estimativa)
   As regras (faixas do Minha Casa Minha Vida, juros, quanto da renda
   a parcela pode usar, seguros, prazo...) vêm do admin, aba "Simulador",
   e chegam na página em window.RC_CONFIG.simulador.
   IMPORTANTE: o resultado é uma estimativa — as condições reais
   dependem da análise de crédito do banco.
   ========================================================= */

const SIMULADOR_REGRAS_PADRAO = {
  sistema: 'SAC',
  comprometimento_renda: 30,
  prazo_max_anos: 35,
  idade_max_fim: 80.5,
  seguros_mensal_pct: 0.03,
  taxa_adm_mensal: 25,
  custos_cartorio_pct: 4,
  faixas: [
    { nome: 'Minha Casa Minha Vida - Faixa 1', renda_max: 2850, valor_max: 210000, taxa: 4.25, cota_max: 80, subsidio: 30000 },
    { nome: 'Minha Casa Minha Vida - Faixa 2', renda_max: 4700, valor_max: 210000, taxa: 6.0, cota_max: 80, subsidio: 15000 },
    { nome: 'Minha Casa Minha Vida - Faixa 3', renda_max: 8600, valor_max: 350000, taxa: 8.16, cota_max: 80, subsidio: 0 },
    { nome: 'Minha Casa Minha Vida - Faixa 4', renda_max: 12000, valor_max: 500000, taxa: 10.5, cota_max: 80, subsidio: 0 },
  ],
  fora_programa: { nome: 'Financiamento bancário (SBPE)', taxa: 11.5, cota_max: 70 },
  aviso: 'Estimativa com base nas regras atuais dos programas habitacionais. O valor final, a taxa e o desconto dependem da análise de crédito do banco.',
};

function regrasDoSimulador() {
  const r = (window.RC_CONFIG && window.RC_CONFIG.simulador) || {};
  return { ...SIMULADOR_REGRAS_PADRAO, ...r, fora_programa: { ...SIMULADOR_REGRAS_PADRAO.fora_programa, ...(r.fora_programa || {}) } };
}

// Escolhe a modalidade pela renda (a faixa) e confere o limite de valor do imóvel da faixa
function escolherModalidade(regras, renda, valorImovel) {
  const faixas = [...(regras.faixas || [])].sort((a, b) => a.renda_max - b.renda_max);
  const faixa = faixas.find((f) => renda <= f.renda_max);
  if (faixa && valorImovel <= faixa.valor_max) return { ...faixa, programa: true };
  const fora = { ...regras.fora_programa, subsidio: 0, programa: false };
  if (faixa) fora.motivo = `O imóvel passa do limite de ${formatarBRL(faixa.valor_max)} da ${faixa.nome}, então entra como financiamento comum.`;
  else if (faixas.length) fora.motivo = `A renda passa do limite do programa (${formatarBRL(faixas[faixas.length - 1].renda_max)}), então entra como financiamento comum.`;
  return fora;
}

// Simula mês a mês: juros + seguros sobre o saldo devedor + taxa de administração
function simularFinanciamento(valor, taxaAnual, meses, sistema, segurosPct, taxaAdm) {
  const i = taxaAnual / 100 / 12;
  const seg = segurosPct / 100;
  const pmt = i === 0 ? valor / meses : valor * (i / (1 - Math.pow(1 + i, -meses)));
  let saldo = valor;
  let primeira = 0;
  let ultima = 0;
  let total = 0;
  for (let m = 1; m <= meses; m++) {
    const juros = saldo * i;
    const amortizacao = sistema === 'PRICE' ? pmt - juros : valor / meses;
    const parcela = amortizacao + juros + saldo * seg + taxaAdm;
    if (m === 1) primeira = parcela;
    ultima = parcela;
    total += parcela;
    saldo = Math.max(0, saldo - amortizacao);
  }
  return { primeira, ultima, total };
}

// Quanto dá para financiar com uma primeira parcela de até "limite"
function maximoFinanciavel(limite, taxaAnual, meses, sistema, segurosPct, taxaAdm) {
  const i = taxaAnual / 100 / 12;
  const seg = segurosPct / 100;
  const disponivel = limite - taxaAdm;
  if (disponivel <= 0) return 0;
  const fator = sistema === 'PRICE'
    ? (i === 0 ? 1 / meses : i / (1 - Math.pow(1 + i, -meses)))
    : 1 / meses + i;
  return disponivel / (fator + seg);
}

function calcularSimulacao(dados, regras) {
  const modalidade = escolherModalidade(regras, dados.renda, dados.valor);
  const taxa = dados.taxa != null ? dados.taxa : modalidade.taxa;
  const alertas = [];

  let anos = Math.min(dados.prazo, regras.prazo_max_anos);
  if (dados.idade) {
    const anosPelaIdade = Math.floor(regras.idade_max_fim - dados.idade);
    if (anosPelaIdade < 1) {
      return { erro: 'Pela idade informada, os bancos não costumam aprovar financiamento. Fale com a nossa equipe para ver outras opções.' };
    }
    if (anosPelaIdade < anos) {
      anos = anosPelaIdade;
      alertas.push(`Pela idade, o prazo máximo fica em ${anos} anos (idade + prazo não pode passar de ${String(regras.idade_max_fim).replace('.', ',')} anos).`);
    }
  }
  if (anos < dados.prazo && !dados.idade) alertas.push(`O prazo máximo é de ${anos} anos.`);
  const meses = anos * 12;

  const recursos = dados.entrada + dados.fgts;
  const subsidio = Math.min(modalidade.subsidio || 0, Math.max(0, dados.valor - recursos));
  let financiado = Math.max(0, dados.valor - recursos - subsidio);
  if (financiado === 0) {
    return { erro: 'Com a entrada e o FGTS informados, não sobra valor para financiar. Diminua a entrada ou aumente o valor do imóvel.' };
  }

  const cota = (modalidade.cota_max / 100) * dados.valor;
  if (financiado > cota + 1) {
    const entradaMinima = dados.valor - cota - subsidio;
    alertas.push(`Nessa modalidade o banco financia até ${modalidade.cota_max}% do imóvel (${formatarBRL(cota)}). Para esse valor, a entrada + FGTS precisa ser de pelo menos ${formatarBRL(entradaMinima)}.`);
  }

  const sim = simularFinanciamento(financiado, taxa, meses, dados.sistema, regras.seguros_mensal_pct, regras.taxa_adm_mensal);
  const limiteParcela = dados.renda * (regras.comprometimento_renda / 100);
  if (sim.primeira > limiteParcela + 0.5) {
    const maximo = maximoFinanciavel(limiteParcela, taxa, meses, dados.sistema, regras.seguros_mensal_pct, regras.taxa_adm_mensal);
    alertas.push(`A primeira parcela passa de ${regras.comprometimento_renda}% da renda (${formatarBRL(limiteParcela)}), que é o limite dos bancos. Com essa renda, dá para financiar cerca de ${formatarBRL(maximo)}: seria preciso uma entrada maior ou incluir a renda de outra pessoa.`);
  }

  return {
    modalidade, taxa, anos, meses, recursos, subsidio, financiado,
    primeira: sim.primeira, ultima: sim.ultima, total: sim.total + recursos,
    rendaMinima: sim.primeira / (regras.comprometimento_renda / 100),
    cartorio: dados.valor * (regras.custos_cartorio_pct / 100),
    alertas,
  };
}

// Mostra o valor final contando a partir do zero (quando o módulo de
// animações está carregado); senão, só escreve o valor.
function _mostrarValorSimulador(id, valor, animar) {
  const el = document.getElementById(id);
  if (!el) return;
  if (animar && typeof animarNumero === 'function') animarNumero(el, valor, formatarBRL);
  else el.textContent = formatarBRL(valor);
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
  const regras = regrasDoSimulador();
  const erro = document.getElementById('sim-erro');

  document.getElementById('sim-sistema').value = regras.sistema === 'PRICE' ? 'PRICE' : 'SAC';
  const campoPrazo = document.getElementById('sim-prazo');
  campoPrazo.max = regras.prazo_max_anos;
  if (Number(campoPrazo.value) > regras.prazo_max_anos) campoPrazo.value = regras.prazo_max_anos;
  const avisoRegras = document.getElementById('sim-aviso-regras');
  if (avisoRegras) avisoRegras.textContent = regras.aviso;

  function numeroDe(id) {
    const texto = document.getElementById(id).value.trim();
    if (texto === '') return null;
    const n = Number(texto);
    return Number.isFinite(n) ? n : NaN;
  }

  function lerDados() {
    const dados = {
      valor: numeroDe('sim-valor'),
      renda: numeroDe('sim-renda'),
      entrada: numeroDe('sim-entrada-valor') || 0,
      fgts: numeroDe('sim-fgts') || 0,
      idade: numeroDe('sim-idade'),
      prazo: numeroDe('sim-prazo'),
      taxa: numeroDe('sim-taxa'),
      sistema: document.getElementById('sim-sistema').value,
    };
    if (!(dados.valor > 0)) return { erro: 'Informe o valor do imóvel.', campo: 'sim-valor' };
    if (!(dados.renda > 0)) return { erro: 'Informe a renda bruta mensal da família.', campo: 'sim-renda' };
    if (!(dados.prazo >= 1)) return { erro: 'Informe o prazo em anos.', campo: 'sim-prazo' };
    if ([dados.entrada, dados.fgts].some((n) => Number.isNaN(n) || n < 0)) return { erro: 'Confira os valores de entrada e FGTS.', campo: 'sim-entrada-valor' };
    if (dados.idade != null && (Number.isNaN(dados.idade) || dados.idade < 18 || dados.idade > 100)) return { erro: 'Confira a idade (de 18 anos em diante).', campo: 'sim-idade' };
    if (dados.taxa != null && (Number.isNaN(dados.taxa) || dados.taxa < 0 || dados.taxa > 40)) return { erro: 'Confira a taxa de juros (de 0 a 40% ao ano).', campo: 'sim-taxa' };
    dados.prazo = Math.round(dados.prazo);
    return dados;
  }

  function linkWhatsAppSimulacao(dados, r) {
    const numero = typeof ROCHA_COSTA !== 'undefined' ? ROCHA_COSTA.whatsappNumber : '';
    const saudacao = typeof saudacaoPorHorario === 'function' ? saudacaoPorHorario() : 'Olá';
    const texto = `${saudacao}! Fiz uma simulação no site: imóvel de ${formatarBRL(dados.valor)}, renda de ${formatarBRL(dados.renda)}, `
      + `entrada + FGTS de ${formatarBRL(r.recursos)} em ${r.anos} anos. A primeira parcela ficou em torno de ${formatarBRL(r.primeira)} `
      + `(${r.modalidade.nome}). Quero saber as condições reais.`;
    return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
  }

  let calculouUmaVez = false;

  function mostrarResultado(animar) {
    const dados = lerDados();
    erro.hidden = true;
    if (dados.erro) {
      if (animar) {
        erro.textContent = dados.erro;
        erro.hidden = false;
        document.getElementById(dados.campo)?.focus();
      }
      return false;
    }
    const r = calcularSimulacao(dados, regras);
    if (r.erro) {
      erro.textContent = r.erro;
      erro.hidden = false;
      return false;
    }

    document.getElementById('res-modalidade').textContent =
      `${r.modalidade.nome} · juros de ${r.taxa.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% ao ano`
      + (dados.taxa != null ? ' (taxa informada por você)' : '');
    _mostrarValorSimulador('res-valor', dados.valor, false);
    _mostrarValorSimulador('res-entrada', r.recursos, animar);
    document.getElementById('res-subsidio-linha').hidden = !r.subsidio;
    if (r.subsidio) _mostrarValorSimulador('res-subsidio', r.subsidio, animar);
    _mostrarValorSimulador('res-financiado', r.financiado, animar);
    document.getElementById('res-parcela-rotulo').textContent = dados.sistema === 'PRICE' ? 'Parcela mensal' : 'Primeira parcela';
    _mostrarValorSimulador('res-parcela', r.primeira, animar);
    document.getElementById('res-ultima-linha').hidden = dados.sistema === 'PRICE';
    _mostrarValorSimulador('res-ultima', r.ultima, false);
    _mostrarValorSimulador('res-renda-min', r.rendaMinima, false);
    _mostrarValorSimulador('res-total', r.total, false);
    _mostrarValorSimulador('res-cartorio', r.cartorio, false);
    document.getElementById('res-prazo').textContent = `${r.anos} anos (${r.meses} parcelas)`;

    const alertas = [...r.alertas];
    if (r.modalidade.motivo) alertas.unshift(r.modalidade.motivo);
    const caixa = document.getElementById('res-alertas');
    caixa.innerHTML = '';
    alertas.forEach((texto) => {
      const p = document.createElement('p');
      p.textContent = texto;
      caixa.appendChild(p);
    });
    caixa.hidden = !alertas.length;

    document.getElementById('res-aviso').textContent = `As parcelas já incluem seguros obrigatórios e taxa de administração. ${regras.aviso}`;
    document.getElementById('sim-whatsapp').href = linkWhatsAppSimulacao(dados, r);
    return true;
  }

  // Depois do primeiro cálculo, qualquer mudança recalcula na hora
  function recalcularAoVivo() {
    if (calculouUmaVez) mostrarResultado(false);
  }
  iniciarSliderValor(recalcularAoVivo);
  form.querySelectorAll('input:not(.slider-range), select').forEach((el) => el.addEventListener('input', recalcularAoVivo));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!mostrarResultado(true)) return;
    calculouUmaVez = true;
    const resultado = document.getElementById('sim-resultado');
    resultado.style.display = 'block';
    resultado.classList.remove('sim-resultado--in');
    void resultado.offsetWidth; // reinicia a animação de entrada a cada novo cálculo
    resultado.classList.add('sim-resultado--in');
    resultado.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

document.addEventListener('DOMContentLoaded', iniciarSimulador);
