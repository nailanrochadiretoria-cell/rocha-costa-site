"""
Rocha Costa — backend (Flask).

Serve o site (arquivos estáticos) e uma API simples para o painel
administrativo editar imóveis e depoimentos de verdade — as mudanças
passam a valer para todo mundo que visita o site, não só no navegador
de quem está editando.

Como rodar localmente:
    cd server
    python3 -m venv .venv && source .venv/bin/activate   (opcional, recomendado)
    pip install -r requirements.txt
    export ADMIN_PASSWORD="escolha-uma-senha-forte"
    export JWT_SECRET="uma-string-aleatoria-longa"
    python3 app.py
Depois acesse http://localhost:5000
"""

import os
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from google import genai
from google.genai import errors as genai_errors, types as genai_types
from werkzeug.utils import secure_filename

import store

SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
SITE_DIR = os.path.dirname(SERVER_DIR)
UPLOAD_DIR = os.path.join(SITE_DIR, 'img', 'uploads')
EXTENSOES_PERMITIDAS = {'png', 'jpg', 'jpeg', 'webp', 'gif'}
load_dotenv(os.path.join(SERVER_DIR, '.env'))

ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'rochacosta2026')
JWT_SECRET = os.environ.get('JWT_SECRET', 'troque-este-segredo-antes-de-publicar')
TOKEN_HORAS_VALIDADE = 12

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
GEMINI_MODEL = os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')
_gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

app = Flask(__name__, static_folder=SITE_DIR, static_url_path='')
app.config['MAX_CONTENT_LENGTH'] = 8 * 1024 * 1024  # 8 MB por upload


# ---------- Autenticação ----------

def gerar_token():
    payload = {
        'sub': 'admin',
        'exp': datetime.now(timezone.utc) + timedelta(hours=TOKEN_HORAS_VALIDADE),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')


def requer_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        header = request.headers.get('Authorization', '')
        if not header.startswith('Bearer '):
            return jsonify({'erro': 'Não autenticado. Faça login novamente.'}), 401
        token = header.split(' ', 1)[1]
        try:
            jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        except jwt.ExpiredSignatureError:
            return jsonify({'erro': 'Sessão expirada. Faça login novamente.'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'erro': 'Token inválido.'}), 401
        return fn(*args, **kwargs)
    return wrapper


@app.post('/api/auth/login')
def login():
    dados = request.get_json(silent=True) or {}
    senha = dados.get('senha', '')
    if senha != ADMIN_PASSWORD:
        return jsonify({'erro': 'Senha incorreta.'}), 401
    return jsonify({'token': gerar_token()})


# ---------- Imóveis ----------

CAMPOS_IMOVEL_PERMITIDOS = {
    'titulo', 'tipo', 'status', 'bairro', 'cidade', 'estado', 'preco',
    'area', 'quartos', 'banheiros', 'vagas', 'destaque', 'imagem', 'descricao',
    'empreendimento_id',
}


def _filtrar_campos_imovel(dados):
    return {k: v for k, v in dados.items() if k in CAMPOS_IMOVEL_PERMITIDOS}


@app.get('/api/imoveis')
def get_imoveis():
    return jsonify(store.listar_imoveis())


@app.get('/api/imoveis/<imovel_id>')
def get_imovel(imovel_id):
    imovel = store.obter_imovel(imovel_id)
    if not imovel:
        return jsonify({'erro': 'Imóvel não encontrado.'}), 404
    return jsonify(imovel)


@app.post('/api/imoveis')
@requer_auth
def post_imovel():
    dados = _filtrar_campos_imovel(request.get_json(silent=True) or {})
    if not dados.get('titulo'):
        return jsonify({'erro': 'Título é obrigatório.'}), 400
    return jsonify(store.criar_imovel(dados)), 201


@app.put('/api/imoveis/<imovel_id>')
@requer_auth
def put_imovel(imovel_id):
    dados = _filtrar_campos_imovel(request.get_json(silent=True) or {})
    atualizado = store.atualizar_imovel(imovel_id, dados)
    if not atualizado:
        return jsonify({'erro': 'Imóvel não encontrado.'}), 404
    return jsonify(atualizado)


@app.delete('/api/imoveis/<imovel_id>')
@requer_auth
def delete_imovel(imovel_id):
    if not store.excluir_imovel(imovel_id):
        return jsonify({'erro': 'Imóvel não encontrado.'}), 404
    return jsonify({'ok': True})


# ---------- Depoimentos ----------

@app.get('/api/depoimentos')
def get_depoimentos():
    return jsonify(store.listar_depoimentos())


@app.post('/api/depoimentos')
@requer_auth
def post_depoimento():
    dados = request.get_json(silent=True) or {}
    if not dados.get('nome') or not dados.get('texto'):
        return jsonify({'erro': 'Nome e texto são obrigatórios.'}), 400
    novo = {
        'nome': dados.get('nome'),
        'empreendimento': dados.get('empreendimento', ''),
        'texto': dados.get('texto'),
        'estrelas': int(dados.get('estrelas', 5)),
    }
    return jsonify(store.criar_depoimento(novo)), 201


@app.delete('/api/depoimentos/<depoimento_id>')
@requer_auth
def delete_depoimento(depoimento_id):
    if not store.excluir_depoimento(depoimento_id):
        return jsonify({'erro': 'Depoimento não encontrado.'}), 404
    return jsonify({'ok': True})


# ---------- Hero (slides da home) ----------

CAMPOS_HERO_PERMITIDOS = {
    'eyebrow', 'titulo', 'texto', 'imagem', 'imagem_mobile', 'cta_texto', 'cta_tipo', 'cta_valor', 'area_clicavel',
}


def _filtrar_campos_hero(dados):
    return {k: v for k, v in dados.items() if k in CAMPOS_HERO_PERMITIDOS}


@app.get('/api/hero-slides')
def get_hero_slides():
    return jsonify(store.listar_hero_slides())


@app.get('/api/hero-slides/<slide_id>')
def get_hero_slide(slide_id):
    slide = store.obter_hero_slide(slide_id)
    if not slide:
        return jsonify({'erro': 'Slide não encontrado.'}), 404
    return jsonify(slide)


@app.post('/api/hero-slides')
@requer_auth
def post_hero_slide():
    dados = _filtrar_campos_hero(request.get_json(silent=True) or {})
    if not dados.get('titulo'):
        return jsonify({'erro': 'Título é obrigatório.'}), 400
    return jsonify(store.criar_hero_slide(dados)), 201


@app.put('/api/hero-slides/<slide_id>')
@requer_auth
def put_hero_slide(slide_id):
    dados = _filtrar_campos_hero(request.get_json(silent=True) or {})
    atualizado = store.atualizar_hero_slide(slide_id, dados)
    if not atualizado:
        return jsonify({'erro': 'Slide não encontrado.'}), 404
    return jsonify(atualizado)


@app.delete('/api/hero-slides/<slide_id>')
@requer_auth
def delete_hero_slide(slide_id):
    if not store.excluir_hero_slide(slide_id):
        return jsonify({'erro': 'Slide não encontrado.'}), 404
    return jsonify({'ok': True})


# ---------- Empreendimentos (obras, com galeria de fotos) ----------

CAMPOS_EMPREENDIMENTO_PERMITIDOS = {
    'nome', 'descricao', 'diferenciais', 'localizacao', 'status', 'ano', 'total_unidades', 'imagens',
}


def _filtrar_campos_empreendimento(dados):
    return {k: v for k, v in dados.items() if k in CAMPOS_EMPREENDIMENTO_PERMITIDOS}


@app.get('/api/empreendimentos')
def get_empreendimentos():
    return jsonify(store.listar_empreendimentos())


@app.get('/api/empreendimentos/<empreendimento_id>')
def get_empreendimento(empreendimento_id):
    emp = store.obter_empreendimento(empreendimento_id)
    if not emp:
        return jsonify({'erro': 'Empreendimento não encontrado.'}), 404
    resposta = dict(emp)
    resposta['unidades'] = store.imoveis_do_empreendimento(empreendimento_id)
    return jsonify(resposta)


@app.post('/api/empreendimentos')
@requer_auth
def post_empreendimento():
    dados = _filtrar_campos_empreendimento(request.get_json(silent=True) or {})
    if not dados.get('nome'):
        return jsonify({'erro': 'Nome é obrigatório.'}), 400
    return jsonify(store.criar_empreendimento(dados)), 201


@app.put('/api/empreendimentos/<empreendimento_id>')
@requer_auth
def put_empreendimento(empreendimento_id):
    dados = _filtrar_campos_empreendimento(request.get_json(silent=True) or {})
    atualizado = store.atualizar_empreendimento(empreendimento_id, dados)
    if not atualizado:
        return jsonify({'erro': 'Empreendimento não encontrado.'}), 404
    return jsonify(atualizado)


@app.delete('/api/empreendimentos/<empreendimento_id>')
@requer_auth
def delete_empreendimento(empreendimento_id):
    if not store.excluir_empreendimento(empreendimento_id):
        return jsonify({'erro': 'Empreendimento não encontrado.'}), 404
    return jsonify({'ok': True})


# ---------- Atendente de IA ----------

MENSAGENS_MAX_HISTORICO = 20
MENSAGEM_MAX_CARACTERES = 2000

WHATSAPP_NUMERO = '5587999143998'
WHATSAPP_DISPLAY = '(87) 99914-3998'


def _resumo_imoveis_para_prompt():
    imoveis = store.listar_imoveis()
    linhas = []
    for im in imoveis[:60]:
        preco = im.get('preco')
        preco_fmt = f"R$ {preco:,.0f}".replace(',', '.') if isinstance(preco, (int, float)) else 'a consultar'
        linhas.append(
            f"- #{im.get('id')} {im.get('titulo', 'Sem título')} | {im.get('tipo', '')} | "
            f"{im.get('status', '')} | bairro {im.get('bairro', '')}, {im.get('cidade', '')} | "
            f"{im.get('quartos', '?')} quartos | {im.get('area', '?')} m² | {preco_fmt}"
        )
    return '\n'.join(linhas) if linhas else '(nenhum imóvel cadastrado ainda)'


def _prompt_sistema_atendente():
    return f"""Você é a Marina, atendente da Rocha Costa, construtora e imobiliária de Petrolina/PE. Você conversa pelo chat do site.

Como conversar:
- Fale como uma pessoa de verdade batendo papo por chat: frases curtas, tom caloroso, direto e informal (mas educado) — nunca como um roteiro engessado ou um formulário.
- Se a pessoa ainda não disse o que procura, faça UMA pergunta por vez para entender (bairro, tipo de imóvel, quantos quartos, faixa de preço) antes de despejar uma lista de opções.
- Reaja de verdade ao que a pessoa conta (se ela disser o nome, use o nome; se mencionar filhos, trabalho, mudança de cidade etc., leve isso em conta na sugestão).
- Não repita saudação em toda mensagem, não use listas com bullet em excesso — prefira frases corridas, como numa conversa real.
- Emojis: no máximo um por mensagem, só quando fizer sentido (nada de forçar simpatia).
- Só diga que é uma inteligência artificial se perguntarem diretamente — e se perguntarem, responda com naturalidade, sem parecer aviso legal.

Seu trabalho:
- Ajudar a encontrar imóveis do catálogo abaixo que combinem com o que a pessoa procura.
- Tirar dúvidas gerais sobre a Rocha Costa, financiamento (de forma genérica, sem prometer taxas ou condições específicas) e o processo de compra.
- Quando a pessoa quiser falar com alguém do time, agendar visita ou fechar negócio, direcione para o WhatsApp {WHATSAPP_DISPLAY} (link: https://wa.me/{WHATSAPP_NUMERO}).
- Nunca invente imóveis, preços ou condições que não estejam listados abaixo. Se não tiver a informação, diga isso com naturalidade e ofereça o WhatsApp.
- Responda sempre em português do Brasil.

Catálogo de imóveis disponível agora:
{_resumo_imoveis_para_prompt()}
"""


@app.post('/api/atendente/chat')
def atendente_chat():
    if not _gemini_client:
        return jsonify({
            'erro': 'Atendente de IA não configurado. Defina GEMINI_API_KEY no arquivo server/.env e reinicie o servidor.',
        }), 503

    dados = request.get_json(silent=True) or {}
    mensagens = dados.get('mensagens')
    if not isinstance(mensagens, list) or not mensagens:
        return jsonify({'erro': 'Envie ao menos uma mensagem.'}), 400

    historico = []
    for m in mensagens[-MENSAGENS_MAX_HISTORICO:]:
        papel = m.get('role') if isinstance(m, dict) else None
        texto = m.get('content') if isinstance(m, dict) else None
        if papel not in ('user', 'assistant') or not isinstance(texto, str) or not texto.strip():
            continue
        papel_gemini = 'model' if papel == 'assistant' else 'user'
        historico.append(genai_types.Content(role=papel_gemini, parts=[
            genai_types.Part(text=texto.strip()[:MENSAGEM_MAX_CARACTERES]),
        ]))

    if not historico or historico[-1].role != 'user':
        return jsonify({'erro': 'A última mensagem precisa ser do visitante.'}), 400

    try:
        resposta = _gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=historico,
            config=genai_types.GenerateContentConfig(
                system_instruction=_prompt_sistema_atendente(),
                max_output_tokens=600,
            ),
        )
        texto_resposta = (resposta.text or '').strip()
    except genai_errors.APIError as e:
        return jsonify({'erro': f'Falha ao consultar a IA ({e.code}). Verifique a chave configurada.'}), 502

    return jsonify({'resposta': texto_resposta or 'Desculpe, não consegui gerar uma resposta agora.'})


# ---------- Upload de imagens (usado pelo admin para trocar fotos do hero) ----------

def _extensao_permitida(nome_arquivo):
    return '.' in nome_arquivo and nome_arquivo.rsplit('.', 1)[1].lower() in EXTENSOES_PERMITIDAS


@app.post('/api/upload')
@requer_auth
def upload_imagem():
    arquivo = request.files.get('arquivo')
    if not arquivo or arquivo.filename == '':
        return jsonify({'erro': 'Nenhum arquivo enviado.'}), 400
    if not _extensao_permitida(arquivo.filename):
        return jsonify({'erro': 'Formato não permitido. Use PNG, JPG, WEBP ou GIF.'}), 400
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    nome_seguro = secure_filename(arquivo.filename)
    nome_final = f"{int(datetime.now(timezone.utc).timestamp())}-{nome_seguro}"
    arquivo.save(os.path.join(UPLOAD_DIR, nome_final))
    return jsonify({'url': f'/img/uploads/{nome_final}'}), 201


# ---------- Site estático ----------

@app.get('/')
def home():
    return send_from_directory(SITE_DIR, 'index.html')


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', '0') == '1'
    app.run(host='0.0.0.0', port=port, debug=debug)
