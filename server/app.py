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

import base64
import io
import os
import random
import threading
from datetime import datetime, timedelta, timezone
from functools import wraps
from urllib.parse import urlsplit

import jwt
from dotenv import load_dotenv
import hashlib
import hmac
import json
import re
import secrets
import unicodedata
import uuid

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from bs4 import BeautifulSoup
from bs4.dammit import EntitySubstitution
from bs4.formatter import HTMLFormatter
from flask import Flask, abort, jsonify, make_response, request, send_from_directory
from google import genai
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from google.genai import errors as genai_errors, types as genai_types
from werkzeug.utils import secure_filename

import store


# Saída HTML com acentos normais (sem &ccedil; etc.) e <br> sem barra
FORMATO_HTML = HTMLFormatter(entity_substitution=EntitySubstitution.substitute_xml,
                             void_element_close_prefix=None, empty_attributes_are_booleans=True)

SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
SITE_DIR = os.path.dirname(SERVER_DIR)
UPLOAD_DIR = os.path.join(SITE_DIR, 'img', 'uploads')
EXTENSOES_PERMITIDAS = {'png', 'jpg', 'jpeg', 'webp', 'gif'}
load_dotenv(os.path.join(SERVER_DIR, '.env'))

# ---------- Senha do admin e segredo dos tokens ----------
# A senha NÃO tem mais valor padrão no código. Formas aceitas, nesta ordem:
#   ADMIN_PASSWORD_HASH  → hash Argon2id (recomendado; gere com: python definir_senha.py)
#   ADMIN_PASSWORD       → senha em texto (compatibilidade); é convertida em
#                          hash Argon2id na memória ao iniciar e nunca comparada em texto.
# Senhas conhecidas/fracas são recusadas: sem senha válida, o login fica desligado.
SENHAS_PROIBIDAS = {'rochacosta2026', 'escolha-uma-senha-forte', 'admin', '123456', 'senha', 'password'}
SENHA_TAMANHO_MINIMO = 10
_argon2 = PasswordHasher()  # Argon2id com os parâmetros recomendados da biblioteca


def _carregar_hash_da_senha():
    hash_env = os.environ.get('ADMIN_PASSWORD_HASH', '').strip()
    if hash_env:
        if hash_env.startswith('$argon2'):
            return hash_env
        print('AVISO: ADMIN_PASSWORD_HASH não é um hash Argon2 válido. Gere outro com: python definir_senha.py')
        return None
    senha = os.environ.get('ADMIN_PASSWORD', '')
    if not senha:
        print('AVISO: nenhuma senha de admin configurada — o login do painel está DESLIGADO. '
              'Defina uma com: python definir_senha.py')
        return None
    if senha.lower() in SENHAS_PROIBIDAS or len(senha) < SENHA_TAMANHO_MINIMO:
        print('AVISO: a senha de admin configurada é a padrão/fraca e foi RECUSADA — o login do painel '
              'está DESLIGADO. Defina uma senha forte com: python definir_senha.py')
        return None
    return _argon2.hash(senha)


ADMIN_PASSWORD_HASH = _carregar_hash_da_senha()

# Nome de usuário do painel (não diferencia maiúsculas). Definido na criação do
# acesso; "admin" só vale para instalações antigas que ainda não escolheram um.
USUARIO_VALIDO = re.compile(r'^[a-z0-9._@-]{3,60}$')
ADMIN_USER = os.environ.get('ADMIN_USER', '').strip().lower()
if not USUARIO_VALIDO.match(ADMIN_USER):
    ADMIN_USER = 'admin'

# Segredo que assina os tokens: sem valor padrão. Se não estiver configurado (ou
# for o antigo valor de exemplo), usa um aleatório só deste processo — os logins
# caem a cada reinício, mas ninguém consegue forjar um token.
JWT_SECRET = os.environ.get('JWT_SECRET', '')
if len(JWT_SECRET) < 32 or JWT_SECRET in ('troque-este-segredo-antes-de-publicar', 'uma-string-aleatoria-longa'):
    JWT_SECRET = secrets.token_urlsafe(48)
    print('AVISO: JWT_SECRET ausente ou fraco — usando um segredo aleatório temporário '
          '(as sessões do admin caem quando o servidor reinicia). Rode: python definir_senha.py')
TOKEN_HORAS_VALIDADE = 8

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
GEMINI_MODEL = os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')
_gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# static_folder=None: os arquivos do site são servidos pela rota controlada no
# fim deste arquivo, que só libera páginas .html da raiz e as pastas css/js/img.
# Antes o Flask servia a pasta inteira — inclusive server/.env (senhas e chave
# da IA), server/data/leads.json (dados de clientes) e a pasta .git.
app = Flask(__name__, static_folder=None)
app.config['MAX_CONTENT_LENGTH'] = 8 * 1024 * 1024  # 8 MB por upload


# ---------- Autenticação ----------

def _versao_da_senha():
    """Impressão digital da senha atual: entra no token. Trocar a senha muda a
    versão e invalida na hora todos os tokens emitidos com a senha antiga."""
    return hashlib.sha256((ADMIN_PASSWORD_HASH or '').encode('utf-8')).hexdigest()[:16]


# Tokens encerrados com "Sair" (jti -> quando expirariam). Fica em memória:
# reiniciar o servidor limpa a lista, mas aí os tokens antigos já venceram ou
# foram invalidados pela troca de segredo/senha.
_tokens_revogados = {}
_tokens_lock = threading.Lock()


def gerar_token():
    agora = datetime.now(timezone.utc)
    payload = {
        'sub': 'admin',
        'iat': agora,
        'exp': agora + timedelta(hours=TOKEN_HORAS_VALIDADE),
        'jti': uuid.uuid4().hex,
        'pv': _versao_da_senha(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')


def _validar_token(token):
    """Devolve o conteúdo do token ou lança jwt.InvalidTokenError."""
    dados = jwt.decode(token, JWT_SECRET, algorithms=['HS256'], options={'require': ['exp', 'jti', 'pv']})
    if not hmac.compare_digest(str(dados.get('pv', '')), _versao_da_senha()):
        raise jwt.InvalidTokenError('senha alterada')
    with _tokens_lock:
        if dados['jti'] in _tokens_revogados:
            raise jwt.InvalidTokenError('sessão encerrada')
    return dados


# A sessão do admin fica num cookie HttpOnly: o navegador envia sozinho e o
# JavaScript da página não consegue ler (um script malicioso não rouba a sessão).
COOKIE_SESSAO = 'rc_sessao'


def _requisicao_https():
    return request.is_secure or (CONFIAR_NO_PROXY and request.headers.get('X-Forwarded-Proto', '') == 'https')


def _gravar_cookie_sessao(resposta, token):
    resposta.set_cookie(COOKIE_SESSAO, token, max_age=TOKEN_HORAS_VALIDADE * 3600, path='/',
                        httponly=True, samesite='Strict', secure=_requisicao_https())
    return resposta


def _apagar_cookie_sessao(resposta):
    resposta.delete_cookie(COOKIE_SESSAO, path='/', httponly=True, samesite='Strict', secure=_requisicao_https())
    return resposta


def _token_da_requisicao():
    """Devolve (token, veio_de_cookie). O cabeçalho Authorization continua aceito
    para integrações e testes; o painel usa o cookie."""
    header = request.headers.get('Authorization', '')
    if header.startswith('Bearer '):
        return header.split(' ', 1)[1], False
    return request.cookies.get(COOKIE_SESSAO, ''), True


def _mesma_origem():
    """Proteção contra CSRF: como o cookie vai sozinho em toda requisição, quem
    altera dados precisa vir de uma página do próprio site (além do SameSite=Strict)."""
    if request.headers.get('Sec-Fetch-Site', 'same-origin') not in ('same-origin', 'none'):
        return False
    origem = request.headers.get('Origin') or request.headers.get('Referer')
    if not origem:
        return True  # navegadores sempre mandam Origin em POST/PUT/DELETE; sem ele não é um navegador
    return urlsplit(origem).netloc.lower() == request.host.lower()


def requer_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        token, por_cookie = _token_da_requisicao()
        if not token:
            return jsonify({'erro': 'Não autenticado. Faça login novamente.'}), 401
        if por_cookie and request.method not in ('GET', 'HEAD', 'OPTIONS') and not _mesma_origem():
            return jsonify({'erro': 'Requisição recusada: origem não permitida.'}), 403
        try:
            _validar_token(token)
        except jwt.ExpiredSignatureError:
            return jsonify({'erro': 'Sessão expirada. Faça login novamente.'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'erro': 'Sessão inválida. Faça login novamente.'}), 401
        return fn(*args, **kwargs)
    return wrapper


# ---------- Entradas: toda string vinda de formulário passa por aqui ----------

def limpar_texto(valor, limite, multilinha=False):
    """Normaliza texto recebido: vira string, remove caracteres de controle e
    invisíveis (inclusive os usados para falsificar texto), normaliza Unicode,
    apara espaços e corta no limite. A saída ainda é ESCAPADA ao ser exibida —
    isto aqui é higiene de entrada, não substitui o escape."""
    if valor is None:
        return ''
    texto = unicodedata.normalize('NFC', str(valor))
    permitidos = '\n\t' if multilinha else ''
    texto = ''.join(ch for ch in texto if ch in permitidos or unicodedata.category(ch)[0] != 'C')
    if not multilinha:
        texto = re.sub(r'\s+', ' ', texto)
    return texto.strip()[:limite]


EMAIL_VALIDO = re.compile(r'^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s.]{2,}$')


def json_para_script(dados):
    """JSON seguro para colocar dentro de <script>: escapa <, >, & e os
    separadores de linha do JavaScript, para que nenhum valor consiga fechar a
    tag (</script>) ou abrir um comentário HTML."""
    return (json.dumps(dados, ensure_ascii=False)
            .replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
            .replace('\u2028', '\\u2028').replace('\u2029', '\\u2029'))


# ---------- Cabeçalhos de segurança em todas as respostas ----------

CSP = '; '.join([
    "default-src 'self'",
    # 'unsafe-inline' ainda é necessário: as páginas têm scripts e estilos embutidos.
    "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self'",
    "frame-src 'self' https://www.google.com",  # mapas do Google e o editor de páginas do admin
    "frame-ancestors 'self'",                # ninguém de fora coloca o site (ou o admin) num iframe
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
])


@app.after_request
def cabecalhos_de_seguranca(resposta):
    resposta.headers.setdefault('Content-Security-Policy', CSP)
    resposta.headers.setdefault('X-Frame-Options', 'SAMEORIGIN')
    resposta.headers.setdefault('X-Content-Type-Options', 'nosniff')
    resposta.headers.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
    resposta.headers.setdefault('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    if request.is_secure or request.headers.get('X-Forwarded-Proto', '') == 'https':
        resposta.headers.setdefault('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    if request.path.startswith('/api/'):
        resposta.headers['Cache-Control'] = 'no-store'  # respostas da API (leads, token) nunca ficam em cache
    return resposta


# Rate limiter simples em memória (por IP), reutilizado em rotas sensíveis a
# abuso: login (força bruta) e endpoints públicos que custam dinheiro/spam.
_rate_limit_registros = {}  # chave -> [timestamps dentro da janela]
_rate_limit_lock = threading.Lock()


# O cabeçalho X-Forwarded-For só é confiável quando existe um proxy na frente
# (Render, Nginx). Sem proxy ele é escrito pelo próprio visitante — e trocá-lo a
# cada tentativa burlava o limite de logins. Por isso só é usado se o ambiente
# disser que há proxy: CONFIAR_NO_PROXY=1 (o Render define RENDER=true sozinho).
CONFIAR_NO_PROXY = os.environ.get('CONFIAR_NO_PROXY', '') == '1' or os.environ.get('RENDER', '') == 'true'


def _ip_da_requisicao():
    if CONFIAR_NO_PROXY:
        # o proxy acrescenta o IP real no FIM; os itens anteriores vêm do cliente
        encaminhado = request.headers.get('X-Forwarded-For', '')
        if encaminhado:
            return encaminhado.split(',')[-1].strip() or 'desconhecido'
    return request.remote_addr or 'desconhecido'


def _rate_limit_excedido(chave, max_tentativas, janela_minutos):
    agora = datetime.now(timezone.utc)
    limite = agora - timedelta(minutes=janela_minutos)
    with _rate_limit_lock:
        tentativas = [t for t in _rate_limit_registros.get(chave, []) if t > limite]
        excedido = len(tentativas) >= max_tentativas
        if not excedido:
            tentativas.append(agora)
        _rate_limit_registros[chave] = tentativas
        # Faxina: sem isso o dicionário cresce para sempre (um item por IP).
        if len(_rate_limit_registros) > 5000:
            corte = agora - timedelta(hours=2)
            for k in [k for k, v in _rate_limit_registros.items() if not v or v[-1] < corte]:
                del _rate_limit_registros[k]
        return excedido


LOGIN_MAX_TENTATIVAS = 5
LOGIN_BLOQUEIO_MINUTOS = 15
LOGIN_MAX_GLOBAL_POR_HORA = 60     # teto somando todos os IPs (ataque distribuído)
LEAD_MAX_POR_HORA = 10
LEAD_MAX_GLOBAL_POR_HORA = 120     # teto somando todos os IPs
LEADS_MAXIMO_GUARDADOS = 3000      # acima disso, o formulário pede para falar pelo WhatsApp
ATENDENTE_MAX_POR_HORA = 30
ATENDENTE_MAX_GLOBAL_POR_HORA = 400


# ---------- CAPTCHA próprio (imagem com letras distorcidas) ----------
# Sem serviços de fora: nada de cookies de terceiros nem chave de API. A resposta
# certa nunca vai para o navegador — vai só um "vale" assinado, que serve uma
# única vez e expira em poucos minutos.
CAPTCHA_LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  # sem 0/O, 1/I: evita confusão
CAPTCHA_TAMANHO = 5
CAPTCHA_MINUTOS = 5
_captchas_usados = {}  # jti -> quando expira
_captcha_lock = threading.Lock()
_sorteio = random.SystemRandom()


def _captcha_assinatura(jti, resposta):
    return hmac.new(JWT_SECRET.encode('utf-8'), f'{jti}:{resposta.upper()}'.encode('utf-8'), hashlib.sha256).hexdigest()


def _captcha_imagem(texto):
    largura, altura = 220, 76
    img = Image.new('RGB', (largura, altura), (245, 247, 250))
    desenho = ImageDraw.Draw(img)
    for _ in range(7):  # riscos de fundo
        cor = tuple(_sorteio.randint(140, 205) for _ in range(3))
        desenho.line([(_sorteio.randint(0, largura), _sorteio.randint(0, altura)),
                      (_sorteio.randint(0, largura), _sorteio.randint(0, altura))], fill=cor, width=_sorteio.randint(1, 2))
    x = 14
    for letra in texto:
        fonte = ImageFont.load_default(size=_sorteio.randint(40, 48))
        bloco = Image.new('RGBA', (60, 66), (0, 0, 0, 0))
        cor = (_sorteio.randint(0, 70), _sorteio.randint(20, 80), _sorteio.randint(60, 130), 255)
        ImageDraw.Draw(bloco).text((10, 4), letra, font=fonte, fill=cor)
        bloco = bloco.rotate(_sorteio.uniform(-28, 28), resample=Image.BICUBIC, expand=False)
        img.paste(bloco, (x + _sorteio.randint(-4, 4), _sorteio.randint(0, 12)), bloco)
        x += _sorteio.randint(34, 40)
    for _ in range(3):  # riscos por cima das letras
        cor = tuple(_sorteio.randint(40, 120) for _ in range(3))
        pontos = [(px, altura / 2 + _sorteio.randint(-22, 22)) for px in range(0, largura + 1, 44)]
        desenho.line(pontos, fill=cor, width=2)
    for _ in range(260):  # pontilhado
        desenho.point((_sorteio.randint(0, largura - 1), _sorteio.randint(0, altura - 1)),
                      fill=tuple(_sorteio.randint(60, 200) for _ in range(3)))
    img = img.filter(ImageFilter.SMOOTH)
    saida = io.BytesIO()
    img.save(saida, format='PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(saida.getvalue()).decode('ascii')


@app.get('/api/auth/captcha')
def captcha():
    if _rate_limit_excedido(f'captcha:{_ip_da_requisicao()}', 40, 10):
        return jsonify({'erro': 'Muitos pedidos. Aguarde alguns minutos.'}), 429
    texto = ''.join(_sorteio.choice(CAPTCHA_LETRAS) for _ in range(CAPTCHA_TAMANHO))
    jti = uuid.uuid4().hex
    vale = jwt.encode({'t': 'captcha', 'jti': jti, 'h': _captcha_assinatura(jti, texto),
                       'exp': datetime.now(timezone.utc) + timedelta(minutes=CAPTCHA_MINUTOS)}, JWT_SECRET, algorithm='HS256')
    return jsonify({'vale': vale, 'imagem': _captcha_imagem(texto)})


def _captcha_confere(vale, resposta):
    """Cada vale serve para UMA tentativa, certa ou errada."""
    try:
        dados = jwt.decode(str(vale or ''), JWT_SECRET, algorithms=['HS256'], options={'require': ['exp', 'jti']})
    except jwt.InvalidTokenError:
        return False
    if dados.get('t') != 'captcha':
        return False
    agora = datetime.now(timezone.utc).timestamp()
    with _captcha_lock:
        if dados['jti'] in _captchas_usados:
            return False
        _captchas_usados[dados['jti']] = dados['exp']
        for jti in [j for j, exp in _captchas_usados.items() if exp < agora]:
            del _captchas_usados[jti]
    resposta = re.sub(r'\s+', '', str(resposta or ''))[:20]
    return hmac.compare_digest(str(dados.get('h', '')), _captcha_assinatura(dados['jti'], resposta))


# Hash de mentira: quando o usuário está errado, a senha é conferida contra ele
# mesmo assim, para a resposta demorar o mesmo tempo (não revela se o usuário existe).
_HASH_ISCA = _argon2.hash(secrets.token_urlsafe(24))


def _credenciais_conferem(usuario, senha):
    usuario_ok = hmac.compare_digest(usuario.encode('utf-8'), ADMIN_USER.encode('utf-8'))
    try:
        _argon2.verify(ADMIN_PASSWORD_HASH if usuario_ok else _HASH_ISCA, senha)
    except (VerificationError, InvalidHashError):
        return False
    return usuario_ok


@app.post('/api/auth/login')
def login():
    ip = _ip_da_requisicao()
    if not ADMIN_PASSWORD_HASH:
        return jsonify({'erro': 'O painel ainda não tem acesso criado. Abra esta página no computador onde o site '
                                'está instalado para criar o usuário e a senha.'}), 503
    dados = request.get_json(silent=True)
    if not isinstance(dados, dict):
        dados = {}
    if _rate_limit_excedido(f'captcha-erro:{ip}', 30, 15):
        return jsonify({'erro': 'Muitas tentativas. Aguarde 15 minutos e tente de novo.'}), 429
    if not _captcha_confere(dados.get('captcha_vale'), dados.get('captcha')):
        return jsonify({'erro': 'O código da imagem não confere. Tente de novo com a nova imagem.', 'captcha': True}), 400
    # Só depois do CAPTCHA certo é que a tentativa de senha conta para o bloqueio.
    if _rate_limit_excedido(f'login:{ip}', LOGIN_MAX_TENTATIVAS, LOGIN_BLOQUEIO_MINUTOS):
        return jsonify({'erro': f'Muitas tentativas. Aguarde {LOGIN_BLOQUEIO_MINUTOS} minutos e tente de novo.'}), 429
    if _rate_limit_excedido('login:global', LOGIN_MAX_GLOBAL_POR_HORA, 60):
        return jsonify({'erro': 'Muitas tentativas de login no momento. Tente de novo mais tarde.'}), 429
    usuario = str(dados.get('usuario') or '').strip().lower()[:60]
    senha = str(dados.get('senha') or '')[:200]  # limite: Argon2 em senha gigante seria um jeito de travar o servidor
    if not _credenciais_conferem(usuario, senha):
        return jsonify({'erro': 'Usuário ou senha incorretos.'}), 401
    return _gravar_cookie_sessao(jsonify({'ok': True}), gerar_token())


@app.post('/api/auth/logout')
def logout():
    """Encerra a sessão de verdade: o token deixa de valer no servidor e o cookie é apagado."""
    token, _ = _token_da_requisicao()
    try:
        dados = _validar_token(token)
    except jwt.InvalidTokenError:
        dados = None  # sessão já vencida: só apaga o cookie
    if dados:
        agora = datetime.now(timezone.utc).timestamp()
        with _tokens_lock:
            _tokens_revogados[dados['jti']] = dados['exp']
            for jti in [j for j, exp in _tokens_revogados.items() if exp < agora]:
                del _tokens_revogados[jti]  # faxina dos que já venceram
    return _apagar_cookie_sessao(jsonify({'ok': True}))


def _acesso_do_proprio_computador():
    """Só quem abre o painel no computador onde o site está instalado (localhost)
    pode criar a primeira senha — nunca alguém da rede ou da internet."""
    if CONFIAR_NO_PROXY:
        return False
    host = (urlsplit('//' + request.host).hostname or '').lower()
    return request.remote_addr in ('127.0.0.1', '::1') and host in ('localhost', '127.0.0.1', '::1')


@app.get('/api/auth/sessao')
def sessao():
    """O painel pergunta aqui se já está logado (o cookie não é legível pelo JavaScript)."""
    logado = False
    token, _ = _token_da_requisicao()
    if token:
        try:
            _validar_token(token)
            logado = True
        except jwt.InvalidTokenError:
            pass
    return jsonify({
        'logado': logado,
        'usuario': ADMIN_USER if logado else None,
        'configurado': bool(ADMIN_PASSWORD_HASH),
        'pode_configurar': not ADMIN_PASSWORD_HASH and _acesso_do_proprio_computador(),
        'senha_minimo': SENHA_TAMANHO_MINIMO,
    })


def _gravar_acesso_no_env(usuario, novo_hash):
    """Guarda no server/.env o usuário, só o HASH da senha e um segredo de sessão
    forte, removendo a antiga senha em texto puro."""
    caminho = os.path.join(SERVER_DIR, '.env')
    linhas = []
    if os.path.exists(caminho):
        with open(caminho, encoding='utf-8') as fh:
            linhas = fh.read().splitlines()
    fora = ('ADMIN_USER', 'ADMIN_PASSWORD', 'ADMIN_PASSWORD_HASH', 'JWT_SECRET')
    resto = [l for l in linhas if l.split('=', 1)[0].strip() not in fora]
    saida = [f'ADMIN_USER={usuario}', f'ADMIN_PASSWORD_HASH={novo_hash}', f'JWT_SECRET={JWT_SECRET}'] + resto
    tmp = caminho + '.tmp'
    with open(tmp, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write('\n'.join(saida) + '\n')
    os.replace(tmp, caminho)


def _erro_no_usuario(usuario):
    if not USUARIO_VALIDO.match(usuario):
        return 'O usuário precisa ter de 3 a 60 caracteres: letras, números, ponto, traço, _ ou @ (pode ser um e-mail).'
    return None


def _erro_na_senha(senha, usuario):
    if len(senha) < SENHA_TAMANHO_MINIMO or len(senha) > 200:
        return f'A senha precisa ter pelo menos {SENHA_TAMANHO_MINIMO} caracteres.'
    if senha.lower() in SENHAS_PROIBIDAS:
        return 'Essa senha é conhecida/óbvia demais. Escolha outra.'
    if senha.isdigit() or senha.isalpha():
        return 'Misture letras e números na senha.'
    if usuario and usuario.split('@')[0] in senha.lower():
        return 'A senha não pode conter o nome de usuário.'
    return None


@app.post('/api/auth/configurar')
def configurar_acesso():
    """Primeiro acesso: cria o usuário e a senha do painel pelo navegador. Só
    funciona enquanto não existe senha e apenas no próprio computador do site."""
    global ADMIN_PASSWORD_HASH, ADMIN_USER, JWT_SECRET
    if ADMIN_PASSWORD_HASH:
        return jsonify({'erro': 'O painel já tem acesso criado. Faça login.'}), 409
    if not _acesso_do_proprio_computador() or not _mesma_origem():
        return jsonify({'erro': 'Por segurança, o primeiro acesso só pode ser criado no computador onde o site está instalado.'}), 403
    if _rate_limit_excedido('configurar', 20, 60):
        return jsonify({'erro': 'Muitas tentativas. Tente de novo mais tarde.'}), 429
    dados = request.get_json(silent=True)
    if not isinstance(dados, dict):
        dados = {}
    usuario = str(dados.get('usuario') or '').strip().lower()
    senha = str(dados.get('senha') or '')
    erro = _erro_no_usuario(usuario) or _erro_na_senha(senha, usuario)
    if erro:
        return jsonify({'erro': erro}), 400
    novo_hash = _argon2.hash(senha)
    JWT_SECRET = secrets.token_urlsafe(48)  # segredo de sessão novo junto com o primeiro acesso
    try:
        _gravar_acesso_no_env(usuario, novo_hash)
    except OSError:
        return jsonify({'erro': 'Não foi possível salvar o acesso no computador.'}), 500
    ADMIN_USER, ADMIN_PASSWORD_HASH = usuario, novo_hash
    return _gravar_cookie_sessao(jsonify({'ok': True}), gerar_token())


@app.post('/api/auth/credenciais')
@requer_auth
def trocar_credenciais():
    """Troca o usuário e/ou a senha de dentro do painel. Exige a senha atual e
    derruba todas as outras sessões abertas."""
    global ADMIN_PASSWORD_HASH, ADMIN_USER
    if os.environ.get('RENDER', '') == 'true':
        return jsonify({'erro': 'Neste servidor o acesso é definido no painel da hospedagem '
                                '(variáveis ADMIN_USER e ADMIN_PASSWORD_HASH).'}), 400
    if _rate_limit_excedido(f'credenciais:{_ip_da_requisicao()}', 8, 15):
        return jsonify({'erro': 'Muitas tentativas. Aguarde 15 minutos.'}), 429
    dados = request.get_json(silent=True)
    if not isinstance(dados, dict):
        dados = {}
    if not _credenciais_conferem(ADMIN_USER, str(dados.get('senha_atual') or '')[:200]):
        return jsonify({'erro': 'A senha atual não confere.'}), 400
    usuario = str(dados.get('usuario') or '').strip().lower() or ADMIN_USER
    nova = str(dados.get('nova_senha') or '')
    erro = _erro_no_usuario(usuario) or (_erro_na_senha(nova, usuario) if nova else None)
    if erro:
        return jsonify({'erro': erro}), 400
    novo_hash = _argon2.hash(nova) if nova else ADMIN_PASSWORD_HASH
    try:
        _gravar_acesso_no_env(usuario, novo_hash)
    except OSError:
        return jsonify({'erro': 'Não foi possível salvar o acesso no computador.'}), 500
    ADMIN_USER, ADMIN_PASSWORD_HASH = usuario, novo_hash
    # a troca de senha invalida todos os cookies antigos; este navegador recebe um novo
    return _gravar_cookie_sessao(jsonify({'ok': True, 'usuario': usuario}), gerar_token())


# ---------- Imóveis ----------

LIMITE_STRING_PADRAO = 5000


def _truncar_strings(dados, limite=LIMITE_STRING_PADRAO):
    """Limpa e limita todas as strings de um cadastro (imóvel, obra, slide)."""
    return {k: (limpar_texto(v, limite, multilinha=True) if isinstance(v, str) else v) for k, v in dados.items()}


CAMPOS_IMOVEL_PERMITIDOS = {
    'titulo', 'tipo', 'status', 'bairro', 'cidade', 'estado', 'preco',
    'area', 'quartos', 'banheiros', 'vagas', 'destaque', 'imagem', 'imagens', 'descricao',
    'empreendimento_id', 'localizacao',
}


CAMPOS_IMOVEL_NUMERICOS = {'preco', 'area', 'quartos', 'banheiros', 'vagas'}


def _url_segura(valor):
    """Aceita só caminhos do próprio site ou http(s) — bloqueia 'javascript:' e afins."""
    if not isinstance(valor, str):
        return ''
    valor = valor.strip()
    if valor.startswith('/') and not valor.startswith('//'):
        return valor
    if valor.lower().startswith(('http://', 'https://')):
        return valor
    return ''


def _numero_ou_zero(valor):
    try:
        numero = float(valor)
    except (TypeError, ValueError):
        return 0
    if numero != numero or numero < 0:  # NaN ou negativo
        return 0
    return int(numero) if numero.is_integer() else numero


def _filtrar_campos_imovel(dados):
    limpos = _truncar_strings({k: v for k, v in dados.items() if k in CAMPOS_IMOVEL_PERMITIDOS})
    for campo in CAMPOS_IMOVEL_NUMERICOS & limpos.keys():
        limpos[campo] = _numero_ou_zero(limpos[campo])
    if 'destaque' in limpos:
        limpos['destaque'] = bool(limpos['destaque'])
    if 'imagem' in limpos:
        limpos['imagem'] = _url_segura(limpos['imagem'])
    if 'imagens' in limpos:
        # Galeria de fotos; a primeira é a capa e também fica em "imagem" (usada nos cartões)
        imagens = limpos['imagens'] if isinstance(limpos['imagens'], list) else []
        limpos['imagens'] = [u for u in (_url_segura(i) for i in imagens) if u][:30]
        limpos['imagem'] = limpos['imagens'][0] if limpos['imagens'] else ''
    if 'localizacao' in limpos:
        # {lat, lng} válidos ou None (sem posição própria: usa a da obra ou o bairro)
        loc = limpos['localizacao'] if isinstance(limpos['localizacao'], dict) else {}
        try:
            lat, lng = float(loc.get('lat')), float(loc.get('lng'))
            limpos['localizacao'] = {'lat': lat, 'lng': lng} if abs(lat) <= 90 and abs(lng) <= 180 else None
        except (TypeError, ValueError):
            limpos['localizacao'] = None
    if 'empreendimento_id' in limpos:
        emp_id = limpos['empreendimento_id']
        limpos['empreendimento_id'] = int(emp_id) if str(emp_id or '').isdigit() else None
    return limpos


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
    nome = limpar_texto(dados.get('nome'), 120)
    texto = limpar_texto(dados.get('texto'), 2000, multilinha=True)
    if not nome or not texto:
        return jsonify({'erro': 'Nome e texto são obrigatórios.'}), 400
    try:
        estrelas = max(1, min(5, int(dados.get('estrelas', 5))))
    except (TypeError, ValueError):
        estrelas = 5
    novo = {
        'nome': nome,
        'empreendimento': limpar_texto(dados.get('empreendimento'), 120),
        'texto': texto,
        'estrelas': estrelas,
    }
    return jsonify(store.criar_depoimento(novo)), 201


@app.put('/api/depoimentos/<depoimento_id>')
@requer_auth
def put_depoimento(depoimento_id):
    dados = request.get_json(silent=True) or {}
    limpos = {}
    for campo, limite in (('nome', 120), ('empreendimento', 120), ('texto', 2000)):
        if campo in dados:
            limpos[campo] = limpar_texto(dados.get(campo), limite, multilinha=True)
    if 'estrelas' in dados:
        try:
            limpos['estrelas'] = max(1, min(5, int(dados['estrelas'])))
        except (TypeError, ValueError):
            pass
    if ('nome' in limpos and not limpos['nome']) or ('texto' in limpos and not limpos['texto']):
        return jsonify({'erro': 'Nome e texto são obrigatórios.'}), 400
    atualizado = store.atualizar_depoimento(depoimento_id, limpos)
    if not atualizado:
        return jsonify({'erro': 'Depoimento não encontrado.'}), 404
    return jsonify(atualizado)


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


DESTINOS_HERO = {'imoveis', 'portfolio', 'simulador', 'depoimentos', 'contato', 'blog', 'sobre',
                 'whatsapp', 'imovel', 'empreendimento', 'url', 'nenhum'}


def _filtrar_campos_hero(dados):
    limpos = _truncar_strings({k: v for k, v in dados.items() if k in CAMPOS_HERO_PERMITIDOS})
    for campo in ('imagem', 'imagem_mobile'):
        if campo in limpos:
            limpos[campo] = _url_segura(limpos[campo])
    if 'cta_tipo' in limpos and limpos['cta_tipo'] not in DESTINOS_HERO:
        limpos['cta_tipo'] = 'imoveis'
    if 'cta_valor' in limpos:
        tipo = limpos.get('cta_tipo')
        valor = str(limpos['cta_valor'] or '').strip()
        if tipo in ('imovel', 'empreendimento'):
            limpos['cta_valor'] = valor if valor.isdigit() else ''  # id do item escolhido
        elif tipo == 'url' and re.match(r'^[\w-]+\.html', valor):
            limpos['cta_valor'] = valor  # página do próprio site, ex.: contato.html
        else:
            limpos['cta_valor'] = _url_segura(valor)
    return limpos


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
    if not dados.get('imagem'):
        return jsonify({'erro': 'Envie a imagem para computador.'}), 400
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
    limpos = _truncar_strings({k: v for k, v in dados.items() if k in CAMPOS_EMPREENDIMENTO_PERMITIDOS})
    if 'imagens' in limpos:
        imagens = limpos['imagens'] if isinstance(limpos['imagens'], list) else []
        limpos['imagens'] = [u for u in (_url_segura(i) for i in imagens) if u][:30]
    if 'diferenciais' in limpos:
        difs = limpos['diferenciais'] if isinstance(limpos['diferenciais'], list) else []
        limpos['diferenciais'] = [str(d)[:200] for d in difs if str(d).strip()][:30]
    return limpos


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


# ---------- Leads (formulário de contato) ----------

ORIGENS_LEAD_PERMITIDAS = {'contato', 'simulador', 'imovel', 'empreendimento', 'chat'}


@app.post('/api/leads')
def post_lead():
    ocupado = jsonify({'erro': 'Muitos envios em pouco tempo. Tente novamente mais tarde ou fale pelo WhatsApp.'}), 429
    if _rate_limit_excedido(f'lead:{_ip_da_requisicao()}', LEAD_MAX_POR_HORA, 60):
        return ocupado
    if _rate_limit_excedido('lead:global', LEAD_MAX_GLOBAL_POR_HORA, 60):
        return ocupado
    dados = request.get_json(silent=True)
    if not isinstance(dados, dict):
        return jsonify({'erro': 'Envio inválido.'}), 400
    # Campo-armadilha: fica escondido no formulário; pessoas não preenchem, robôs sim.
    # Responde "ok" sem gravar, para o robô não perceber e tentar de outro jeito.
    if str(dados.get('site') or '').strip():
        return jsonify({'ok': True}), 201
    nome = limpar_texto(dados.get('nome'), 120)
    telefone = re.sub(r'[^0-9+() -]', '', limpar_texto(dados.get('telefone'), 40))
    email = limpar_texto(dados.get('email'), 200).lower()
    mensagem = limpar_texto(dados.get('mensagem'), 2000, multilinha=True)
    origem = dados.get('origem') if dados.get('origem') in ORIGENS_LEAD_PERMITIDAS else 'contato'
    if len(nome) < 2 or (not telefone and not email):
        return jsonify({'erro': 'Nome e ao menos um contato (telefone ou e-mail) são obrigatórios.'}), 400
    if email and not EMAIL_VALIDO.match(email):
        return jsonify({'erro': 'Confira o e-mail informado.'}), 400
    if telefone and len(re.sub(r'\D', '', telefone)) < 8:
        return jsonify({'erro': 'Confira o telefone informado (com DDD).'}), 400
    if store.contar_leads() >= LEADS_MAXIMO_GUARDADOS:
        return jsonify({'erro': 'Não foi possível registrar agora. Fale com a gente pelo WhatsApp, por favor.'}), 503
    novo = {'nome': nome, 'telefone': telefone, 'email': email, 'mensagem': mensagem, 'origem': origem}
    return jsonify({'ok': True, 'id': store.criar_lead(novo)['id']}), 201


@app.get('/api/leads')
@requer_auth
def get_leads():
    return jsonify(store.listar_leads())


@app.put('/api/leads/<lead_id>')
@requer_auth
def put_lead(lead_id):
    dados = request.get_json(silent=True) or {}
    atualizado = store.marcar_lead_lido(lead_id, bool(dados.get('lido', True)))
    if not atualizado:
        return jsonify({'erro': 'Lead não encontrado.'}), 404
    return jsonify(atualizado)


@app.delete('/api/leads/<lead_id>')
@requer_auth
def delete_lead(lead_id):
    if not store.excluir_lead(lead_id):
        return jsonify({'erro': 'Lead não encontrado.'}), 404
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
    if (_rate_limit_excedido(f'atendente:{_ip_da_requisicao()}', ATENDENTE_MAX_POR_HORA, 60)
            or _rate_limit_excedido('atendente:global', ATENDENTE_MAX_GLOBAL_POR_HORA, 60)):
        return jsonify({'erro': 'Muitas mensagens em pouco tempo. Aguarde um pouco antes de continuar.'}), 429
    if not _gemini_client:
        app.logger.warning('Atendente de IA sem GEMINI_API_KEY configurada.')
        return jsonify({'erro': 'Nossa atendente virtual está indisponível no momento.'}), 503

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
        # O detalhe técnico vai para o log do servidor; o visitante recebe uma mensagem amigável.
        app.logger.error('Falha no Gemini (%s): %s', e.code, e)
        return jsonify({'erro': 'Nossa atendente virtual está indisponível no momento.'}), 502
    except Exception as e:  # rede fora, timeout etc. — não deixa virar erro 500 genérico
        app.logger.error('Erro inesperado no atendente: %s', e)
        return jsonify({'erro': 'Nossa atendente virtual está indisponível no momento.'}), 502

    return jsonify({'resposta': texto_resposta or 'Desculpe, não consegui gerar uma resposta agora.'})


# ---------- Upload de imagens (usado pelo admin para trocar fotos do hero) ----------

def _extensao_permitida(nome_arquivo):
    return '.' in nome_arquivo and nome_arquivo.rsplit('.', 1)[1].lower() in EXTENSOES_PERMITIDAS


def _conteudo_e_imagem_valida(cabecalho):
    """Confere a assinatura binária (magic bytes) do arquivo, para não confiar
    só na extensão do nome (qualquer arquivo pode ser renomeado para .png)."""
    if cabecalho.startswith(b'\x89PNG\r\n\x1a\n'):
        return True
    if cabecalho.startswith(b'\xff\xd8\xff'):
        return True  # JPEG
    if cabecalho.startswith(b'GIF87a') or cabecalho.startswith(b'GIF89a'):
        return True
    if cabecalho[:4] == b'RIFF' and cabecalho[8:12] == b'WEBP':
        return True
    return False


@app.post('/api/upload')
@requer_auth
def upload_imagem():
    arquivo = request.files.get('arquivo')
    if not arquivo or arquivo.filename == '':
        return jsonify({'erro': 'Nenhum arquivo enviado.'}), 400
    if not _extensao_permitida(arquivo.filename):
        return jsonify({'erro': 'Formato não permitido. Use PNG, JPG, WEBP ou GIF.'}), 400
    cabecalho = arquivo.stream.read(16)
    arquivo.stream.seek(0)
    if not _conteudo_e_imagem_valida(cabecalho):
        return jsonify({'erro': 'O arquivo não é uma imagem válida.'}), 400
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    extensao = arquivo.filename.rsplit('.', 1)[1].lower()
    nome_seguro = secure_filename(arquivo.filename)
    # secure_filename remove acentos/caracteres especiais e pode "comer" a
    # extensão (ex.: "fotó.jpg" vira "foto.jpg", mas "图.jpg" vira só "jpg").
    if not nome_seguro.lower().endswith(f'.{extensao}'):
        nome_seguro = f'imagem.{extensao}'
    # Prefixo aleatório: dois envios no mesmo segundo com o mesmo nome não se sobrescrevem.
    nome_final = f"{int(datetime.now(timezone.utc).timestamp())}-{secrets.token_hex(3)}-{nome_seguro}"
    arquivo.save(os.path.join(UPLOAD_DIR, nome_final))
    return jsonify({'url': f'/img/uploads/{nome_final}'}), 201


# ---------- Blog ----------

def _filtrar_post(dados):
    limpos = {}
    for campo, limite in (('titulo', 200), ('resumo', 500), ('categoria', 80), ('corpo', 20000)):
        if campo in dados:
            limpos[campo] = limpar_texto(dados.get(campo), limite, multilinha=True)
    if 'data' in dados:
        data = str(dados.get('data') or '')[:10]
        limpos['data'] = data if re.fullmatch(r'\d{4}-\d{2}-\d{2}', data) else ''
    if 'imagem' in dados:
        limpos['imagem'] = _url_segura(dados.get('imagem'))
    return limpos


@app.get('/api/blog')
def get_blog():
    return jsonify(store.listar_posts())


@app.get('/api/blog/<post_id>')
def get_post(post_id):
    post = store.obter_post(post_id)
    if not post:
        return jsonify({'erro': 'Artigo não encontrado.'}), 404
    return jsonify(post)


@app.post('/api/blog')
@requer_auth
def post_blog():
    dados = _filtrar_post(request.get_json(silent=True) or {})
    if not dados.get('titulo'):
        return jsonify({'erro': 'Título é obrigatório.'}), 400
    return jsonify(store.salvar_post(dados)), 201


@app.put('/api/blog/<post_id>')
@requer_auth
def put_blog(post_id):
    dados = _filtrar_post(request.get_json(silent=True) or {})
    if 'titulo' in dados and not dados['titulo']:
        return jsonify({'erro': 'Título é obrigatório.'}), 400
    atualizado = store.salvar_post(dados, post_id)
    if not atualizado:
        return jsonify({'erro': 'Artigo não encontrado.'}), 404
    return jsonify(atualizado)


@app.delete('/api/blog/<post_id>')
@requer_auth
def delete_blog(post_id):
    if not store.excluir_post(post_id):
        return jsonify({'erro': 'Artigo não encontrado.'}), 404
    return jsonify({'ok': True})


# ---------- Configurações gerais (WhatsApp, redes sociais, cores) ----------

COR_HEX = re.compile(r'^#[0-9a-fA-F]{6}$')


def _filtrar_config(dados):
    limpos = {}
    if 'whatsapp_numero' in dados:
        limpos['whatsapp_numero'] = re.sub(r'\D', '', str(dados.get('whatsapp_numero') or ''))[:15]
    if 'whatsapp_mensagem' in dados:
        limpos['whatsapp_mensagem'] = limpar_texto(dados.get('whatsapp_mensagem'), 300)
    for campo in ('instagram_url', 'facebook_url'):
        if campo in dados:
            limpos[campo] = _url_segura(dados.get(campo))
    for campo in ('cor_principal', 'cor_destaque'):
        if campo in dados and COR_HEX.match(str(dados.get(campo) or '')):
            limpos[campo] = dados[campo].upper()
    return limpos


@app.get('/api/configuracoes')
def get_config():
    return jsonify(store.obter_config())


@app.put('/api/configuracoes')
@requer_auth
def put_config():
    config = store.salvar_config(_filtrar_config(request.get_json(silent=True) or {}))
    _cache_paginas.clear()
    return jsonify(config)


# ---------- Conteúdo editável das páginas (textos, imagens e links) ----------

TAGS_TEXTO_PERMITIDAS = {'strong', 'b', 'em', 'i', 'br', 'u', 'small'}
CHAVE_CMS = re.compile(r'^[a-z0-9-]+:[a-z]*\d+$')

# Fontes que o editor deixa escolher (catálogo do Google Fonts em js/fontes-google.json:
# [nome, categoria, tem negrito]). Só nomes desta lista entram no HTML salvo.
_FONTE_GENERICA = {'s': 'sans-serif', 'r': 'serif', 'd': 'sans-serif', 'h': 'cursive', 'm': 'monospace'}


def _carregar_fontes():
    try:
        with open(os.path.join(SITE_DIR, 'js', 'fontes-google.json'), encoding='utf-8') as fh:
            return {nome: (categoria, bool(negrito)) for nome, categoria, negrito in json.load(fh)}
    except (OSError, ValueError):
        print('AVISO: js/fontes-google.json não encontrado — troca de fonte desligada.')
        return {}


FONTES = _carregar_fontes()


def _estilo_da_fonte(nome):
    return f"font-family:'{nome}', {_FONTE_GENERICA.get(FONTES[nome][0], 'sans-serif')}"


def _link_das_fontes(nomes):
    """Um único <link> do Google Fonts com todas as fontes usadas na página."""
    familias = '&'.join('family=' + nome.replace(' ', '+') + (':wght@400;700' if FONTES[nome][1] else '')
                        for nome in nomes)
    return f'https://fonts.googleapis.com/css2?{familias}&display=swap'


def _limpar_html_texto(html):
    """Texto editado no admin: mantém só negrito/itálico/quebra de linha (sem atributos)
    e trechos com fonte escolhida no editor (<span data-fonte>, só fontes do catálogo)."""
    soup = BeautifulSoup(str(html)[:8000], 'html.parser')
    for tag in soup.find_all(True):
        if tag.name in ('script', 'style'):
            tag.decompose()
        elif tag.name in TAGS_TEXTO_PERMITIDAS:
            tag.attrs = {}
        elif tag.name == 'span' and tag.get('data-fonte') in FONTES:
            nome = tag['data-fonte']
            tag.attrs = {'data-fonte': nome, 'style': _estilo_da_fonte(nome)}  # o estilo é refeito aqui, nunca copiado
        else:
            tag.unwrap()
    return soup.decode(formatter=FORMATO_HTML).strip()


@app.get('/api/conteudo')
@requer_auth
def get_conteudo():
    return jsonify(store.obter_conteudo())


@app.put('/api/conteudo')
@requer_auth
def put_conteudo():
    dados = request.get_json(silent=True) or {}
    alteracoes = {'textos': {}, 'imagens': {}, 'links': {}}
    for chave, valor in (dados.get('textos') or {}).items():
        if CHAVE_CMS.match(chave):
            alteracoes['textos'][chave] = _limpar_html_texto(valor)
    for chave, valor in (dados.get('imagens') or {}).items():
        if CHAVE_CMS.match(chave) and _url_segura(valor):
            alteracoes['imagens'][chave] = _url_segura(valor)
    for chave, valor in (dados.get('links') or {}).items():
        url = str(valor or '').strip()
        # links podem ser páginas do site ("contato.html"), âncoras, tel:, mailto: ou http(s)
        if CHAVE_CMS.match(chave) and (re.match(r'^(https?://|/|#|tel:|mailto:)', url, re.I) or re.match(r'^[\w-]+\.html', url)):
            alteracoes['links'][chave] = url[:500]
    store.salvar_conteudo(alteracoes)
    _cache_paginas.clear()
    return jsonify({'ok': True, 'salvos': sum(len(v) for v in alteracoes.values())})


@app.delete('/api/conteudo/<pagina>')
@requer_auth
def delete_conteudo_pagina(pagina):
    """Restaura o texto original de uma página inteira (ou 'global' = cabeçalho/rodapé)."""
    if not re.fullmatch(r'[a-z0-9-]+', pagina):
        abort(404)
    store.salvar_conteudo({}, remover_prefixo=f'{pagina}:')
    _cache_paginas.clear()
    return jsonify({'ok': True})


def _escurecer(hex_cor, fator):
    r, g, b = (int(hex_cor[i:i + 2], 16) for i in (1, 3, 5))
    return '#{:02X}{:02X}{:02X}'.format(*(max(0, min(255, int(c * fator))) for c in (r, g, b)))


_cache_paginas = {}


def _renderizar_pagina(nome, editar=False):
    """Aplica as edições do admin (textos, imagens, links, cores, WhatsApp) no HTML."""
    caminho = os.path.join(SITE_DIR, nome)
    chave_cache = (nome, editar, os.path.getmtime(caminho))
    if chave_cache in _cache_paginas:
        return _cache_paginas[chave_cache]

    with open(caminho, encoding='utf-8') as fh:
        soup = BeautifulSoup(fh.read(), 'html.parser')
    conteudo = store.obter_conteudo()
    config = store.obter_config()

    for el in soup.find_all(attrs={'data-cms': True}):
        novo = conteudo.get('textos', {}).get(el['data-cms'])
        if novo is not None:
            el.clear()
            el.append(BeautifulSoup(novo, 'html.parser'))
    for img in soup.find_all(attrs={'data-cms-img': True}):
        nova = conteudo.get('imagens', {}).get(img['data-cms-img'])
        if nova:
            img['src'] = nova
    for a in soup.find_all(attrs={'data-cms-link': True}):
        novo = conteudo.get('links', {}).get(a['data-cms-link'])
        if novo:
            a['href'] = novo
    fontes_usadas = sorted({el['data-fonte'] for el in soup.find_all(attrs={'data-fonte': True}) if el['data-fonte'] in FONTES})
    # Redes sociais configuradas no admin (ícones do rodapé)
    for rede, campo in (('Instagram', 'instagram_url'), ('Facebook', 'facebook_url')):
        for a in soup.find_all('a', attrs={'aria-label': rede}):
            if config.get(campo):
                a['href'] = config[campo]
                a['target'] = '_blank'
                a['rel'] = 'noopener'
            elif a.get('href') in ('#', None) and not conteudo.get('links', {}).get(a.get('data-cms-link')):
                a.decompose()  # sem link cadastrado: esconde o ícone em vez de levar a lugar nenhum

    if soup.head:
        principal, destaque = config['cor_principal'], config['cor_destaque']
        estilo = soup.new_tag('style')
        estilo.string = (f':root{{--navy:{principal};--navy-light:{_escurecer(principal, 1.6)};'
                         f'--navy-dark:{_escurecer(principal, .62)};--red:{destaque};--red-dark:{_escurecer(destaque, .8)};}}')
        soup.head.append(estilo)
        if fontes_usadas:
            soup.head.append(soup.new_tag('link', rel='stylesheet', href=_link_das_fontes(fontes_usadas)))
        dados_js = soup.new_tag('script')
        publico = {k: config[k] for k in ('whatsapp_numero', 'whatsapp_mensagem')}
        dados_js.string = (f'window.RC_CONFIG={json_para_script(publico)};'
                           + ('window.RC_EDITANDO=true;' if editar else ''))
        soup.head.insert(0, dados_js)
        if editar:
            editor = soup.new_tag('script', src='/js/cms-editor.js', defer=True)
            soup.head.append(editor)

    html = soup.decode(formatter=FORMATO_HTML)
    if len(_cache_paginas) > 200:
        _cache_paginas.clear()
    _cache_paginas[chave_cache] = html
    return html


def _resposta_pagina(nome, status=200):
    editar = request.args.get('editar') == '1'
    resposta = make_response(_renderizar_pagina(nome, editar), status)
    resposta.headers['Content-Type'] = 'text/html; charset=utf-8'
    resposta.headers['Cache-Control'] = 'no-cache'
    return resposta


# ---------- Site estático ----------

PASTAS_PUBLICAS = {'css', 'js', 'img'}
PAGINAS_OCULTAS = {'site-unico.html'}  # versão antiga de página única, não faz parte do site


@app.get('/')
def home():
    return _resposta_pagina('index.html')


@app.get('/<path:caminho>')
def arquivo_publico(caminho):
    partes = caminho.split('/')
    if any(p.startswith('.') or p == '' for p in partes):
        abort(404)
    if len(partes) == 1:
        if not caminho.endswith('.html') or caminho in PAGINAS_OCULTAS:
            abort(404)
    elif partes[0] not in PASTAS_PUBLICAS:
        abort(404)
    if len(partes) == 1 and caminho != 'admin.html':
        if not os.path.isfile(os.path.join(SITE_DIR, caminho)):
            abort(404)
        return _resposta_pagina(caminho)
    return send_from_directory(SITE_DIR, caminho)


@app.errorhandler(404)
def nao_encontrado(_erro):
    if request.path.startswith('/api/'):
        return jsonify({'erro': 'Rota não encontrada.'}), 404
    return _resposta_pagina('404.html', 404)


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_DEBUG', '0') == '1'
    if debug:
        # O depurador permite executar código: nunca exposto para a rede.
        app.run(host='127.0.0.1', port=port, debug=True)
    else:
        # Waitress: reaproveita conexões e atende várias requisições ao mesmo
        # tempo (o servidor de desenvolvimento do Flask abria uma conexão por
        # arquivo). Também escuta em IPv6 local: no Windows, "localhost" tenta
        # IPv6 primeiro e, sem isso, cada conexão esperava 0,2 s antes de cair no IPv4.
        try:
            from waitress import serve
        except ImportError:
            app.run(host='0.0.0.0', port=port)
        else:
            print(f'Site no ar: http://localhost:{port}  (admin: http://localhost:{port}/admin.html)')
            try:
                serve(app, listen=f'0.0.0.0:{port} [::1]:{port}', threads=8)
            except OSError:
                serve(app, host='0.0.0.0', port=port, threads=8)  # máquina sem IPv6
