"""
Rocha Costa — camada de persistência (arquivo JSON).

Guarda imóveis e depoimentos em server/data/*.json. Simples de propósito:
o volume de dados de uma construtora local (dezenas/centenas de imóveis,
poucas dezenas de depoimentos) não justifica um banco de dados completo.
Se o site crescer muito, trocar por um banco real é só trocar este módulo.
"""

import json
import os
import threading
from datetime import datetime, timezone

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
IMOVEIS_PATH = os.path.join(DATA_DIR, 'imoveis.json')
DEPOIMENTOS_PATH = os.path.join(DATA_DIR, 'depoimentos.json')
HERO_SLIDES_PATH = os.path.join(DATA_DIR, 'hero_slides.json')
EMPREENDIMENTOS_PATH = os.path.join(DATA_DIR, 'empreendimentos.json')
LEADS_PATH = os.path.join(DATA_DIR, 'leads.json')

STATUS_EMPREENDIMENTO = ['Lançamento', 'Em construção', 'Entregue']

# Trava simples para não corromper o arquivo se duas escritas acontecerem
# ao mesmo tempo (baixíssimo risco aqui, mas custa nada garantir).
_lock = threading.Lock()

BAIRROS_PETROLINA = [
    'Centro', 'Vila Eduardo', 'Vila Mocó', 'Cohab', 'Areia Branca',
    'Padre Cícero', 'Cidade Universitária', 'Angical', 'José e Maria',
    'Distrito Industrial', 'Jardim Amazonas', 'Ana Deusa',
]
TIPOS_IMOVEL = ['Apartamento', 'Casa', 'Casa em condomínio', 'Terreno']
STATUS_OBRA = ['Lançamento', 'Em obras', 'Pronto para morar']


def _seed_random(seed):
    """Mesmo gerador determinístico usado em js/imoveis-data.js, para o
    catálogo inicial ser idêntico ao que já estava no site estático."""
    state = {'s': seed}

    def rnd():
        state['s'] = (state['s'] * 9301 + 49297) % 233280
        return state['s'] / 233280

    return rnd


def _gerar_imoveis_seed(qtd=54):
    rnd = _seed_random(42)
    imoveis = []
    for i in range(1, qtd + 1):
        bairro = BAIRROS_PETROLINA[int(rnd() * len(BAIRROS_PETROLINA))]
        tipo = TIPOS_IMOVEL[int(rnd() * len(TIPOS_IMOVEL))]
        status = STATUS_OBRA[int(rnd() * len(STATUS_OBRA))]
        is_terreno = tipo == 'Terreno'
        quartos = 0 if is_terreno else 1 + int(rnd() * 4)
        banheiros = 0 if is_terreno else 1 + int(rnd() * 3)
        vagas = 0 if is_terreno else int(rnd() * 3)
        area = (150 + int(rnd() * 500)) if is_terreno else (45 + int(rnd() * 180))
        preco_base = (60000 + area * 220) if is_terreno else (90000 + area * 1450 + quartos * 18000)
        preco = round(preco_base / 1000) * 1000

        if is_terreno:
            descricao = (
                f'Terreno bem localizado no bairro {bairro}, em Petrolina/PE. '
                f'Terreno plano, documentação regularizada, pronto para construir. '
                f'Status atual: {status.lower()}.'
            )
        else:
            descricao = (
                f'{tipo} bem localizado no bairro {bairro}, em Petrolina/PE. '
                f'Projeto com acabamento de qualidade Rocha Costa, {quartos} quarto(s) '
                f'e {vagas} vaga(s) de garagem. Status atual: {status.lower()}.'
            )

        imoveis.append({
            'id': i,
            'titulo': f'{tipo} {"no" if is_terreno else "em"} {bairro}',
            'tipo': tipo,
            'status': status,
            'bairro': bairro,
            'cidade': 'Petrolina',
            'estado': 'PE',
            'preco': preco,
            'area': area,
            'quartos': quartos,
            'banheiros': banheiros,
            'vagas': vagas,
            'destaque': i % 6 == 0,
            'imagem': f'https://picsum.photos/seed/rochacosta{i}/640/440',
            'descricao': descricao,
        })
    return imoveis


def _depoimentos_seed():
    return [
        {'id': 1, 'nome': 'João', 'empreendimento': 'Nova Vida 02', 'estrelas': 5,
         'texto': 'Muito boa a casa, qualidade nota 1000. Sempre tive o sonho e agora foi '
                   'realizado graças à Rocha Costa. Estou muito agradecido pelo atendimento '
                   'e qualidade da casa.'},
        {'id': 2, 'nome': 'Maria Eduarda Silva', 'empreendimento': 'Residencial Vila Eduardo', 'estrelas': 5,
         'texto': 'Realizamos o sonho da casa própria com a Rocha Costa. Do primeiro contato até '
                   'a entrega das chaves, fomos muito bem atendidos e o acabamento superou nossa '
                   'expectativa.'},
        {'id': 3, 'nome': 'João Paulo Barbosa', 'empreendimento': 'Condomínio Areia Branca', 'estrelas': 5,
         'texto': 'Comprei na planta e acompanhei toda a obra. Prazo cumprido, comunicação '
                   'transparente e suporte total na hora da documentação e financiamento.'},
        {'id': 4, 'nome': 'Fernanda Costa Lima', 'empreendimento': 'Residencial Padre Cícero', 'estrelas': 5,
         'texto': 'Equipe muito atenciosa, sempre disponível para tirar dúvidas. Recomendo a '
                   'Rocha Costa para quem busca uma construtora séria em Petrolina.'},
        {'id': 5, 'nome': 'Roberto Andrade', 'empreendimento': 'Loteamento Cidade Universitária', 'estrelas': 4,
         'texto': 'Processo de compra do terreno foi rápido e sem burocracia. A equipe explicou '
                   'cada etapa com muita clareza.'},
    ]


def _hero_slides_seed():
    """Reflete os 2 slides que já existiam fixos no HTML, agora editáveis pelo admin."""
    return [
        {
            'id': 1,
            'eyebrow': 'Construtora em Petrolina-PE',
            'titulo': 'Construímos o lugar onde a sua história continua.',
            'texto': 'Há anos entregando empreendimentos residenciais com qualidade, transparência '
                     'e prazo cumprido em Petrolina e região. Da fundação às chaves na mão.',
            'imagem': '',
            'imagem_mobile': '',
            'cta_texto': 'Ver imóveis disponíveis',
            'cta_tipo': 'imoveis',
            'cta_valor': '',
            'area_clicavel': None,
        },
        {
            'id': 2,
            'eyebrow': 'Empreendimentos entregues',
            'titulo': 'Mais de 30 empreendimentos já entregues em Petrolina.',
            'texto': 'Do primeiro tijolo às chaves na mão: conheça as obras que já viraram lar para '
                     'centenas de famílias e veja por que elas confiaram na Rocha Costa.',
            'imagem': '',
            'imagem_mobile': '',
            'cta_texto': 'Ver portfólio de obras',
            'cta_tipo': 'portfolio',
            'cta_valor': '',
            'area_clicavel': None,
        },
    ]


def _empreendimentos_seed():
    """Reflete os 6 cards que já existiam fixos em portfolio.html, agora com
    página própria, galeria e ligação com imóveis (empreendimento_id)."""
    base = [
        ('Residencial Vila Eduardo', 2024, 48, 'obra1', -9.3860, -40.5075),
        ('Condomínio Areia Branca', 2023, 32, 'obra2', -9.3921, -40.4988),
        ('Residencial Padre Cícero', 2022, 60, 'obra3', -9.3799, -40.5102),
        ('Loteamento Cidade Universitária', 2021, 120, 'obra4', -9.3654, -40.5566),
        ('Residencial Angical', 2020, 40, 'obra5', -9.4187, -40.4795),
        ('Condomínio Jardim Amazonas', 2019, 28, 'obra6', -9.3775, -40.4901),
    ]
    seed = []
    for i, (nome, ano, unidades, seed_img, lat, lng) in enumerate(base, start=1):
        seed.append({
            'id': i,
            'nome': nome,
            'descricao': f'{nome} é um empreendimento residencial da Rocha Costa em Petrolina/PE, '
                         f'entregue com acabamento de qualidade e infraestrutura completa.',
            'diferenciais': ['Equipe própria de obra', 'Documentação regularizada', 'Acabamento de qualidade Rocha Costa'],
            'localizacao': {'lat': lat, 'lng': lng},
            'status': 'Entregue',
            'ano': ano,
            'total_unidades': unidades,
            'imagens': [
                f'https://picsum.photos/seed/{seed_img}/900/600',
                f'https://picsum.photos/seed/{seed_img}b/900/600',
                f'https://picsum.photos/seed/{seed_img}c/900/600',
            ],
        })
    return seed


def _ensure_seeded():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(IMOVEIS_PATH):
        _write_json(IMOVEIS_PATH, _gerar_imoveis_seed())
    if not os.path.exists(DEPOIMENTOS_PATH):
        _write_json(DEPOIMENTOS_PATH, _depoimentos_seed())
    if not os.path.exists(HERO_SLIDES_PATH):
        _write_json(HERO_SLIDES_PATH, _hero_slides_seed())
    if not os.path.exists(EMPREENDIMENTOS_PATH):
        _write_json(EMPREENDIMENTOS_PATH, _empreendimentos_seed())
    if not os.path.exists(LEADS_PATH):
        _write_json(LEADS_PATH, [])


def _read_json(path):
    with open(path, encoding='utf-8') as fh:
        return json.load(fh)


def _write_json(path, data):
    tmp_path = path + '.tmp'
    with open(tmp_path, 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
    os.replace(tmp_path, path)  # escrita atômica: evita arquivo corrompido pela metade


def listar_imoveis():
    _ensure_seeded()
    with _lock:
        return _read_json(IMOVEIS_PATH)


def obter_imovel(imovel_id):
    imovel_id = str(imovel_id)
    return next((im for im in listar_imoveis() if str(im['id']) == imovel_id), None)


def criar_imovel(dados):
    with _lock:
        lista = _read_json(IMOVEIS_PATH)
        proximo_id = (max((im['id'] for im in lista), default=0)) + 1
        novo = {
            'id': proximo_id,
            'tipo': 'Casa',
            'cidade': 'Petrolina',
            'estado': 'PE',
            'area': 60,
            'quartos': 2,
            'banheiros': 1,
            'vagas': 1,
            'destaque': False,
            'imagem': f'https://picsum.photos/seed/rochacosta{proximo_id}/640/440',
            'descricao': 'Imóvel cadastrado pelo painel administrativo.',
            'empreendimento_id': None,
            **dados,
            'id': proximo_id,
        }
        lista.append(novo)
        _write_json(IMOVEIS_PATH, lista)
        return novo


def atualizar_imovel(imovel_id, dados):
    imovel_id = str(imovel_id)
    with _lock:
        lista = _read_json(IMOVEIS_PATH)
        for idx, im in enumerate(lista):
            if str(im['id']) == imovel_id:
                lista[idx] = {**im, **dados, 'id': im['id']}
                _write_json(IMOVEIS_PATH, lista)
                return lista[idx]
        return None


def excluir_imovel(imovel_id):
    imovel_id = str(imovel_id)
    with _lock:
        lista = _read_json(IMOVEIS_PATH)
        nova_lista = [im for im in lista if str(im['id']) != imovel_id]
        if len(nova_lista) == len(lista):
            return False
        _write_json(IMOVEIS_PATH, nova_lista)
        return True


def listar_depoimentos():
    _ensure_seeded()
    with _lock:
        return _read_json(DEPOIMENTOS_PATH)


def criar_depoimento(dados):
    with _lock:
        lista = _read_json(DEPOIMENTOS_PATH)
        proximo_id = (max((d['id'] for d in lista), default=0)) + 1
        novo = {'id': proximo_id, **dados}
        lista.append(novo)
        _write_json(DEPOIMENTOS_PATH, lista)
        return novo


def excluir_depoimento(depoimento_id):
    depoimento_id = str(depoimento_id)
    with _lock:
        lista = _read_json(DEPOIMENTOS_PATH)
        nova_lista = [d for d in lista if str(d['id']) != depoimento_id]
        if len(nova_lista) == len(lista):
            return False
        _write_json(DEPOIMENTOS_PATH, nova_lista)
        return True


def listar_hero_slides():
    _ensure_seeded()
    with _lock:
        return _read_json(HERO_SLIDES_PATH)


def obter_hero_slide(slide_id):
    slide_id = str(slide_id)
    return next((s for s in listar_hero_slides() if str(s['id']) == slide_id), None)


def criar_hero_slide(dados):
    with _lock:
        lista = _read_json(HERO_SLIDES_PATH)
        proximo_id = (max((s['id'] for s in lista), default=0)) + 1
        novo = {
            'eyebrow': '', 'titulo': '', 'texto': '', 'imagem': '', 'imagem_mobile': '',
            'cta_texto': 'Saiba mais', 'cta_tipo': 'imoveis', 'cta_valor': '',
            'area_clicavel': None,
            **dados,
            'id': proximo_id,
        }
        lista.append(novo)
        _write_json(HERO_SLIDES_PATH, lista)
        return novo


def atualizar_hero_slide(slide_id, dados):
    slide_id = str(slide_id)
    with _lock:
        lista = _read_json(HERO_SLIDES_PATH)
        for idx, s in enumerate(lista):
            if str(s['id']) == slide_id:
                lista[idx] = {**s, **dados, 'id': s['id']}
                _write_json(HERO_SLIDES_PATH, lista)
                return lista[idx]
        return None


def excluir_hero_slide(slide_id):
    slide_id = str(slide_id)
    with _lock:
        lista = _read_json(HERO_SLIDES_PATH)
        nova_lista = [s for s in lista if str(s['id']) != slide_id]
        if len(nova_lista) == len(lista):
            return False
        _write_json(HERO_SLIDES_PATH, nova_lista)
        return True


def listar_empreendimentos():
    _ensure_seeded()
    with _lock:
        return _read_json(EMPREENDIMENTOS_PATH)


def obter_empreendimento(empreendimento_id):
    empreendimento_id = str(empreendimento_id)
    return next((e for e in listar_empreendimentos() if str(e['id']) == empreendimento_id), None)


def criar_empreendimento(dados):
    with _lock:
        lista = _read_json(EMPREENDIMENTOS_PATH)
        proximo_id = (max((e['id'] for e in lista), default=0)) + 1
        novo = {
            'nome': '', 'descricao': '', 'diferenciais': [],
            'localizacao': {'lat': -9.3891, 'lng': -40.5030},
            'status': 'Em construção', 'ano': None, 'total_unidades': None,
            'imagens': [],
            **dados,
            'id': proximo_id,
        }
        lista.append(novo)
        _write_json(EMPREENDIMENTOS_PATH, lista)
        return novo


def atualizar_empreendimento(empreendimento_id, dados):
    empreendimento_id = str(empreendimento_id)
    with _lock:
        lista = _read_json(EMPREENDIMENTOS_PATH)
        for idx, e in enumerate(lista):
            if str(e['id']) == empreendimento_id:
                lista[idx] = {**e, **dados, 'id': e['id']}
                _write_json(EMPREENDIMENTOS_PATH, lista)
                return lista[idx]
        return None


def excluir_empreendimento(empreendimento_id):
    empreendimento_id = str(empreendimento_id)
    with _lock:
        lista = _read_json(EMPREENDIMENTOS_PATH)
        nova_lista = [e for e in lista if str(e['id']) != empreendimento_id]
        if len(nova_lista) == len(lista):
            return False
        _write_json(EMPREENDIMENTOS_PATH, nova_lista)
        return True


def imoveis_do_empreendimento(empreendimento_id):
    empreendimento_id = str(empreendimento_id)
    return [im for im in listar_imoveis() if str(im.get('empreendimento_id') or '') == empreendimento_id]


def listar_leads():
    _ensure_seeded()
    with _lock:
        lista = _read_json(LEADS_PATH)
        return sorted(lista, key=lambda l: l['id'], reverse=True)


def contar_leads():
    _ensure_seeded()
    with _lock:
        return len(_read_json(LEADS_PATH))


def criar_lead(dados):
    with _lock:
        lista = _read_json(LEADS_PATH)
        proximo_id = (max((l['id'] for l in lista), default=0)) + 1
        novo = {
            'nome': '', 'telefone': '', 'email': '', 'mensagem': '', 'origem': 'contato',
            **dados,
            'id': proximo_id,
            'criado_em': datetime.now(timezone.utc).isoformat(),
            'lido': False,
        }
        lista.append(novo)
        _write_json(LEADS_PATH, lista)
        return novo


def marcar_lead_lido(lead_id, lido=True):
    lead_id = str(lead_id)
    with _lock:
        lista = _read_json(LEADS_PATH)
        for idx, l in enumerate(lista):
            if str(l['id']) == lead_id:
                lista[idx] = {**l, 'lido': lido}
                _write_json(LEADS_PATH, lista)
                return lista[idx]
        return None


def excluir_lead(lead_id):
    lead_id = str(lead_id)
    with _lock:
        lista = _read_json(LEADS_PATH)
        nova_lista = [l for l in lista if str(l['id']) != lead_id]
        if len(nova_lista) == len(lista):
            return False
        _write_json(LEADS_PATH, nova_lista)
        return True


# Garante os arquivos já na importação: as funções de criar/editar/excluir
# leem o JSON direto e quebrariam se o arquivo ainda não existisse (ex.:
# primeiro deploy, antes de qualquer GET).
_ensure_seeded()


# ---------- Blog, conteúdo editável das páginas e configurações ----------

BLOG_PATH = os.path.join(DATA_DIR, 'blog.json')
CONTEUDO_PATH = os.path.join(DATA_DIR, 'conteudo.json')
CONFIG_PATH = os.path.join(DATA_DIR, 'configuracoes.json')

CONFIG_PADRAO = {
    'whatsapp_numero': '5587999143998',
    'whatsapp_mensagem': 'Quero mais informações sobre o imóvel escolhido.',
    'instagram_url': '',
    'facebook_url': '',
    'favicon_url': '',            # ícone da aba do navegador (vazio = img/favicon.png)
    'cor_principal': '#001F3E',
    'cor_destaque': '#E3052D',
}


def _blog_seed():
    return [
        {'id': 1, 'titulo': 'Como funciona o financiamento pelo programa Minha Casa Minha Vida em 2026',
         'resumo': 'Entenda as faixas de renda, taxas de juros e documentação necessária para financiar seu imóvel com condições facilitadas.',
         'data': '2026-06-18', 'categoria': 'Financiamento', 'imagem': 'https://picsum.photos/seed/rochacostablog1/700/420',
         'corpo': 'O programa habitacional facilita o acesso à casa própria por meio de subsídios e taxas de juros reduzidas, organizadas por faixas de renda familiar. Antes de assinar qualquer contrato, é fundamental reunir a documentação pessoal, comprovantes de renda e simular as condições junto ao agente financeiro.\n\nNa Rocha Costa, nossa equipe acompanha o cliente durante todo o processo de aprovação, desde a simulação inicial até a assinatura do contrato, reduzindo a burocracia e o tempo de espera.'},
        {'id': 2, 'titulo': '5 sinais de que uma construtora entrega qualidade de verdade',
         'resumo': 'Prazo, transparência, acabamento e suporte pós-obra: veja o que observar antes de fechar negócio.',
         'data': '2026-05-30', 'categoria': 'Mercado imobiliário', 'imagem': 'https://picsum.photos/seed/rochacostablog2/700/420',
         'corpo': 'Escolher uma construtora vai muito além do preço do imóvel. É importante avaliar o histórico de entregas no prazo, a qualidade dos materiais utilizados, a transparência na comunicação durante a obra e o suporte oferecido após a entrega das chaves.\n\nA Rocha Costa preza por manter o cliente informado em cada etapa, com visitas de acompanhamento e canal direto de atendimento.'},
        {'id': 3, 'titulo': 'Petrolina em expansão: os bairros que mais crescem para investir',
         'resumo': 'Um panorama dos bairros com maior valorização imobiliária na cidade nos últimos anos.',
         'data': '2026-05-10', 'categoria': 'Investimento', 'imagem': 'https://picsum.photos/seed/rochacostablog3/700/420',
         'corpo': 'Petrolina tem vivido um ciclo consistente de expansão urbana, impulsionado pelo agronegócio e pelo crescimento populacional. Bairros como Vila Eduardo, Areia Branca e Cidade Universitária vêm concentrando novos lançamentos residenciais e comerciais.\n\nPara quem pensa em investir, entender essas tendências de valorização é essencial antes de decidir onde comprar.'},
    ]


def _garantir(path, padrao):
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(path):
        _write_json(path, padrao)


def listar_posts():
    with _lock:
        _garantir(BLOG_PATH, _blog_seed())
        return sorted(_read_json(BLOG_PATH), key=lambda p: (p.get('data') or '', p['id']), reverse=True)


def obter_post(post_id):
    return next((p for p in listar_posts() if str(p['id']) == str(post_id)), None)


def salvar_post(dados, post_id=None):
    with _lock:
        _garantir(BLOG_PATH, _blog_seed())
        lista = _read_json(BLOG_PATH)
        if post_id is None:
            novo = {'titulo': '', 'resumo': '', 'data': '', 'categoria': '', 'imagem': '', 'corpo': '', **dados,
                    'id': max((p['id'] for p in lista), default=0) + 1}
            lista.append(novo)
            _write_json(BLOG_PATH, lista)
            return novo
        for idx, p in enumerate(lista):
            if str(p['id']) == str(post_id):
                lista[idx] = {**p, **dados, 'id': p['id']}
                _write_json(BLOG_PATH, lista)
                return lista[idx]
        return None


def excluir_post(post_id):
    with _lock:
        _garantir(BLOG_PATH, _blog_seed())
        lista = _read_json(BLOG_PATH)
        nova = [p for p in lista if str(p['id']) != str(post_id)]
        if len(nova) == len(lista):
            return False
        _write_json(BLOG_PATH, nova)
        return True


def atualizar_depoimento(depoimento_id, dados):
    with _lock:
        lista = _read_json(DEPOIMENTOS_PATH)
        for idx, d in enumerate(lista):
            if str(d['id']) == str(depoimento_id):
                lista[idx] = {**d, **dados, 'id': d['id']}
                _write_json(DEPOIMENTOS_PATH, lista)
                return lista[idx]
        return None


def obter_conteudo():
    """{'textos': {chave: html}, 'imagens': {chave: url}, 'links': {chave: url}}"""
    with _lock:
        _garantir(CONTEUDO_PATH, {'textos': {}, 'imagens': {}, 'links': {}})
        return _read_json(CONTEUDO_PATH)


def salvar_conteudo(alteracoes, remover_prefixo=None):
    with _lock:
        _garantir(CONTEUDO_PATH, {'textos': {}, 'imagens': {}, 'links': {}})
        atual = _read_json(CONTEUDO_PATH)
        for tipo in ('textos', 'imagens', 'links'):
            atual.setdefault(tipo, {})
            if remover_prefixo:
                atual[tipo] = {k: v for k, v in atual[tipo].items() if not k.startswith(remover_prefixo)}
            atual[tipo].update((alteracoes or {}).get(tipo, {}))
        _write_json(CONTEUDO_PATH, atual)
        return atual


def obter_config():
    with _lock:
        _garantir(CONFIG_PATH, CONFIG_PADRAO)
        return {**CONFIG_PADRAO, **_read_json(CONFIG_PATH)}


def salvar_config(dados):
    with _lock:
        _garantir(CONFIG_PATH, CONFIG_PADRAO)
        atual = {**CONFIG_PADRAO, **_read_json(CONFIG_PATH), **dados}
        _write_json(CONFIG_PATH, atual)
        return atual
