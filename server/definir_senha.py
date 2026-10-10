"""
Define o usuário e a senha do painel admin de forma segura.
(Alternativa ao primeiro acesso pelo navegador em /admin.html.)

Uso (na pasta server):
    python definir_senha.py

O que faz:
  - pede o nome de usuário e a senha duas vezes (ela não aparece na tela enquanto você digita);
  - grava no arquivo .env apenas o HASH Argon2id da senha (ADMIN_PASSWORD_HASH).
    Um hash não pode ser "desfeito": mesmo que alguém leia o .env, não descobre a senha;
  - remove a linha antiga ADMIN_PASSWORD (senha em texto puro), se existir;
  - cria um JWT_SECRET forte se o atual estiver ausente ou fraco.

Depois, reinicie o servidor. Todas as sessões abertas com a senha antiga caem.
"""

import getpass
import os
import re
import secrets
import sys

from argon2 import PasswordHasher

SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(SERVER_DIR, '.env')
TAMANHO_MINIMO = 10
PROIBIDAS = {'rochacosta2026', 'escolha-uma-senha-forte', 'admin', '123456', 'senha', 'password'}
SEGREDOS_FRACOS = {'', 'troque-este-segredo-antes-de-publicar', 'uma-string-aleatoria-longa'}


def pedir_usuario(atual):
    while True:
        dica = f' [Enter mantém "{atual}"]' if atual else ''
        usuario = input(f'Usuário do admin (pode ser um e-mail){dica}: ').strip().lower() or atual
        if re.fullmatch(r'[a-z0-9._@-]{3,60}', usuario or ''):
            return usuario
        print('  Use de 3 a 60 caracteres: letras, números, ponto, traço, _ ou @.')


def pedir_senha():
    while True:
        senha = getpass.getpass('Nova senha do admin (não aparece ao digitar): ')
        if len(senha) < TAMANHO_MINIMO:
            print(f'  A senha precisa ter pelo menos {TAMANHO_MINIMO} caracteres. Tente outra.')
            continue
        if senha.lower() in PROIBIDAS:
            print('  Essa senha é conhecida/óbvia demais. Escolha outra.')
            continue
        if senha.isdigit() or senha.isalpha():
            print('  Misture letras e números (uma frase com números funciona bem). Tente outra.')
            continue
        if getpass.getpass('Repita a senha: ') != senha:
            print('  As duas senhas não são iguais. Vamos de novo.')
            continue
        return senha


def main():
    linhas = []
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH, encoding='utf-8') as fh:
            linhas = fh.read().splitlines()

    usuario_atual = next((l.split('=', 1)[1].strip().lower() for l in linhas if l.split('=', 1)[0].strip() == 'ADMIN_USER'), '')
    usuario = pedir_usuario(usuario_atual)
    senha = pedir_senha()
    novo_hash = PasswordHasher().hash(senha)  # Argon2id, com sal aleatório embutido

    saida = []
    segredo_atual = ''
    for linha in linhas:
        chave = linha.split('=', 1)[0].strip()
        if chave in ('ADMIN_USER', 'ADMIN_PASSWORD', 'ADMIN_PASSWORD_HASH'):
            continue  # sai a senha em texto e o hash antigo
        if chave == 'JWT_SECRET':
            segredo_atual = linha.split('=', 1)[1].strip()
            continue
        saida.append(linha)
    if len(segredo_atual) < 32 or segredo_atual in SEGREDOS_FRACOS:
        segredo_atual = secrets.token_urlsafe(48)
        print('JWT_SECRET ausente ou fraco: gerei um novo, aleatório.')

    saida = [f'ADMIN_USER={usuario}', f'ADMIN_PASSWORD_HASH={novo_hash}', f'JWT_SECRET={segredo_atual}'] + saida
    tmp = ENV_PATH + '.tmp'
    with open(tmp, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write('\n'.join(saida) + '\n')
    os.replace(tmp, ENV_PATH)
    print('\nPronto: senha gravada como hash Argon2id em server/.env.')
    print('Reinicie o servidor para valer. (No Render, copie os valores de ADMIN_USER e ADMIN_PASSWORD_HASH para o painel.)')


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\nCancelado. Nada foi alterado.')
        sys.exit(1)
