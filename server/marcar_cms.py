"""
Marca os textos, imagens e links das páginas do site como editáveis pelo
painel admin (modo "Editar páginas").

Cada elemento ganha uma chave fixa:
  data-cms="pagina:N"        → texto (pode ter negrito/itálico/quebra de linha)
  data-cms-img="pagina:iN"   → imagem
  data-cms-link="pagina:lN"  → endereço (href) de um link
Cabeçalho e rodapé são iguais em todas as páginas, então usam chaves
globais ("global:...") — editar o rodapé uma vez muda em todas as páginas.

Rode de novo sempre que criar uma página nova ou acrescentar conteúdo:
    python server/marcar_cms.py
Elementos já marcados mantêm a chave (as edições salvas continuam valendo).
"""

import os
import re

from bs4 import BeautifulSoup, NavigableString, Tag
from bs4.dammit import EntitySubstitution
from bs4.formatter import HTMLFormatter

# Saída HTML com acentos normais (sem &ccedil; etc.) e <br> sem barra
FORMATO_HTML = HTMLFormatter(entity_substitution=EntitySubstitution.substitute_xml,
                             void_element_close_prefix=None, empty_attributes_are_booleans=True)

SITE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGINAS_IGNORADAS = {'admin.html', 'site-unico.html'}

INLINE = {'strong', 'b', 'em', 'i', 'br', 'u', 'small'}
NUNCA = {'script', 'style', 'svg', 'select', 'option', 'textarea', 'input', 'noscript', 'iframe', 'form-fields'}
# Contêineres preenchidos pelo JavaScript (conteúdo vem da API, editado nas outras abas do admin)
DINAMICOS = {'hero-track', 'hero-dots', 'nav-search-resultados'}


def _eh_folha_de_texto(el):
    """Só texto e formatação simples dentro (sem ícones, blocos etc.)."""
    if el.name in NUNCA or not el.get_text(strip=True):
        return False
    return all(filho.name in INLINE for filho in el.find_all(True))


def _prefixo(el, pagina):
    if el.find_parent('header', class_='site-header') or (el.name == 'header'):
        return 'global:h'
    if el.find_parent('footer', class_='site-footer') or (el.name == 'footer'):
        return 'global:f'
    return f'{pagina}:'


class Contadores:
    def __init__(self, soup):
        self.proximo = {}
        for attr in ('data-cms', 'data-cms-img', 'data-cms-link'):
            for el in soup.find_all(attrs={attr: True}):
                m = re.match(r'^(.*?)(\d+)$', el[attr])
                if m:
                    base = m.group(1)
                    self.proximo[base] = max(self.proximo.get(base, 0), int(m.group(2)) + 1)

    def nova(self, base):
        n = self.proximo.get(base, 0)
        self.proximo[base] = n + 1
        return f'{base}{n}'


def marcar(caminho):
    pagina = os.path.basename(caminho).replace('.html', '')
    with open(caminho, encoding='utf-8') as fh:
        soup = BeautifulSoup(fh.read(), 'html.parser')
    body = soup.body
    if body is None:
        return 0
    cont = Contadores(soup)
    marcados = 0

    def visitar(el):
        nonlocal marcados
        if not isinstance(el, Tag) or el.name in NUNCA:
            return
        if el.get('id') in DINAMICOS or el.has_attr('data-ano') or el.has_attr('data-cms-ignorar'):
            return
        if el.has_attr('data-cms'):
            return
        if el is not body and _eh_folha_de_texto(el):
            el['data-cms'] = cont.nova(_prefixo(el, pagina))
            marcados += 1
            return
        # Conteúdo misto (ex.: <a><svg/> Texto</a>): embrulha o texto solto num <span> editável
        for filho in list(el.children):
            if isinstance(filho, NavigableString) and type(filho) is NavigableString and filho.strip():
                span = soup.new_tag('span')
                span['data-cms'] = cont.nova(_prefixo(el, pagina))
                texto = str(filho)
                antes = texto[:len(texto) - len(texto.lstrip())]
                depois = texto[len(texto.rstrip()):]
                span.string = texto.strip()
                filho.replace_with(span)
                if antes:
                    span.insert_before(antes)
                if depois:
                    span.insert_after(depois)
                marcados += 1
        for filho in list(el.children):
            visitar(filho)

    visitar(body)

    for img in body.find_all('img'):
        if not img.has_attr('data-cms-img') and not img.find_parent(id=list(DINAMICOS)):
            img['data-cms-img'] = cont.nova(_prefixo(img, pagina) + 'i')
            marcados += 1
    for a in body.find_all('a', href=True):
        if a.has_attr('data-wa') or a.has_attr('data-cms-link'):
            continue
        a['data-cms-link'] = cont.nova(_prefixo(a, pagina) + 'l')
        marcados += 1

    with open(caminho, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(soup.decode(formatter=FORMATO_HTML))
    return marcados


if __name__ == '__main__':
    for nome in sorted(os.listdir(SITE_DIR)):
        if nome.endswith('.html') and nome not in PAGINAS_IGNORADAS:
            print(f'{nome}: {marcar(os.path.join(SITE_DIR, nome))} elementos marcados')
