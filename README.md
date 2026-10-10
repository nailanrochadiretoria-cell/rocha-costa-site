# Site Rocha Costa Construtora

Site institucional + catálogo de imóveis para a Rocha Costa (Petrolina/PE). O front-end é HTML/CSS/JS puro, e agora tem um **backend real em Python (Flask)** que guarda os imóveis e depoimentos em arquivo (`server/data/*.json`) — ou seja, o que você edita no painel `admin.html` passa a aparecer para todo mundo que visita o site, não só no seu navegador.

## Como rodar localmente

O site inteiro (páginas + API) é servido por um único processo Python.

```bash
cd rocha-costa-site/server
python3 -m venv .venv && source .venv/bin/activate   # opcional, mas recomendado
pip install -r requirements.txt
cp .env.example .env
python definir_senha.py                               # define a senha do admin (grava só o hash)
python3 app.py
```

Acesse **http://localhost:5000** (ou a porta que você definir em `.env`). Isso serve tanto o site (`/`, `/imoveis.html` etc.) quanto a API (`/api/...`).

Pré-requisito: **Python 3** instalado (não precisa de Node.js).

## Como hospedar

Como agora existe um backend, a hospedagem deixou de ser "só arquivos estáticos" — precisa de um lugar que rode Python continuamente. Opções simples, sem servidor próprio:

- **Render** ou **Railway** (planos gratuitos/baixo custo): conecte o repositório, comando de start `python3 server/app.py`, configure as variáveis de ambiente `ADMIN_PASSWORD_HASH` (gerada por `server/definir_senha.py`) e `JWT_SECRET` no painel do serviço.
- **Um VPS simples** (ex: Hostinger VPS, DigitalOcean): rodar com `gunicorn` + `systemd`/`pm2` para manter o processo no ar, atrás de um Nginx.

Qualquer uma dessas opções funciona bem para o volume de acesso de um site institucional local. Antes de publicar, troque a senha padrão em `server/.env` (veja a seção Backend abaixo).

## Estrutura das páginas

| Arquivo | Conteúdo |
|---|---|
| `index.html` | Home institucional, destaques de imóveis, depoimentos, formulário |
| `sobre.html` | História completa, linha do tempo, valores |
| `portfolio.html` | Obras/empreendimentos já entregues |
| `imoveis.html` | Catálogo com filtro (bairro, tipo, status, preço) — 54 imóveis de exemplo |
| `imovel.html` | Detalhe de um imóvel (`?id=`) |
| `simulador.html` | Simulador de financiamento (Tabela Price) |
| `depoimentos.html` | Depoimentos de clientes |
| `blog.html` / `blog-post.html` | Blog/notícias |
| `contato.html` | Formulário completo + WhatsApp + mapa |
| `privacidade.html` | Política de privacidade (LGPD) |
| `admin.html` | Painel administrativo — **veja aviso importante abaixo** |

## Conteúdo de exemplo (o que trocar)

Como você indicou que ainda não tem fotos, textos e depoimentos reais, o site foi criado com **conteúdo de exemplo realista** para já dar pra visualizar e aprovar o formato. Troque quando tiver o material definitivo:

- **Imóveis e depoimentos:** não são mais arquivos JS — agora moram em `server/data/imoveis.json` e `server/data/depoimentos.json` (criados automaticamente na primeira vez que o servidor roda). Edite direto pelo painel `admin.html`, ou editando os arquivos JSON manualmente com o servidor parado.
- **Blog:** editado no admin (aba Blog), salvo em `server/data/blog.json`.
- **Fotos:** hoje usam imagens de placeholder (picsum.photos). Troque o campo `imagem` de cada imóvel pela URL da foto real.
- **Textos institucionais** (Sobre, história, timeline): direto em `sobre.html`, `index.html` e `portfolio.html`.

## Identidade visual aplicada

- Azul-marinho `#001F3E` e vermelho `#E3052D`, conforme o manual de marca enviado.
- Fontes: Montserrat (títulos) e Inter (texto), via Google Fonts.
- Tudo centralizado em `css/style.css` — para mudar uma cor em todo o site, basta editar as variáveis no topo do arquivo (`:root`).

## WhatsApp

- Número configurado: **(87) 99914-3998**.
- A mensagem já abre com saudação automática (Bom dia / Boa tarde / Boa noite conforme o horário) seguida de "Quero mais informações sobre o imóvel escolhido", exatamente como pedido.
- Para trocar o número ou o texto padrão, edite `ROCHA_COSTA.whatsappNumber` em `js/main.js`.

## Editar o site pelo admin

Tudo é editável em `admin.html`:

- **Editar páginas**: abre a página escolhida em modo edição. Toque num texto para editar, numa imagem para trocar (upload) ou num botão/link para mudar o endereço, e depois em **Salvar**. Cabeçalho e rodapé são compartilhados por todas as páginas. As edições ficam em `server/data/conteudo.json` e o servidor aplica antes de enviar a página. "Restaurar textos originais" desfaz as edições de uma página.
- **Slides do topo, Empreendimentos, Imóveis, Depoimentos, Blog**: cadastros completos (criar, editar, excluir, fotos).
- **Configurações**: número e mensagem do WhatsApp, links do Instagram/Facebook (em branco = ícone escondido) e as duas cores do site.

Os elementos editáveis são marcados nos arquivos HTML com `data-cms`, `data-cms-img` e `data-cms-link`. Ao criar uma página nova ou acrescentar texto no HTML, rode `python server/marcar_cms.py` para marcá-los (as chaves existentes são mantidas).

O widget de chat com IA foi retirado do site (o arquivo foi removido; a rota `/api/atendente/chat` continua no servidor, sem uso).

## Formulário de contato — importante

O site é só arquivos estáticos, então o formulário **não envia e-mail nem grava em banco de dados sozinho** — ele valida os campos, mostra uma confirmação visual e abre o WhatsApp. Para o formulário funcionar de verdade (enviar para e-mail, planilha, CRM ou o agente de IA de atendimento), é preciso plugar um backend. Duas opções simples:

1. **Serviço pronto** (mais rápido): Formspree, Getform ou EmailJS — só trocar o comentário `// TODO: enviar dados` em `js/main.js` por uma chamada `fetch()` para o serviço.
2. **Seu futuro agente de IA:** quando ele estiver pronto, é essa mesma função que deve apontar para o webhook/endpoint dele.

## Painel administrativo (`admin.html`)

Agora é um painel de verdade: login autentica contra o servidor, e criar/editar/excluir imóveis e depoimentos grava em `server/data/*.json` — a mudança aparece para qualquer visitante assim que ele recarregar a página.

- Ao entrar, o servidor devolve um token (válido por 12h) guardado no navegador; toda ação de escrita (criar/editar/excluir) envia esse token — sem ele, a API recusa com erro 401.
- **É uma senha única e compartilhada**, não contas individuais por pessoa. Serve bem para "só eu (ou minha equipe de confiança) mexo no site", mas não tem controle de permissões por usuário — se isso vier a ser necessário, é uma evolução futura.
- A página tem `<meta name="robots" content="noindex, nofollow">` para não aparecer no Google.
- **Senha do painel:** não existe mais senha padrão. Na pasta `server`, rode `python definir_senha.py`: ele pede a senha e grava no `.env` apenas o hash Argon2id (`ADMIN_PASSWORD_HASH`). Sem senha forte configurada, o login fica desligado. Trocar a senha derruba todas as sessões abertas.

## Backend (`server/`)

```
server/
  app.py            → rotas da API + serve o site
  store.py          → leitura/escrita dos dados em JSON
  requirements.txt  → dependências Python (Flask, PyJWT, python-dotenv, google-genai)
  .env.example      → modelo de configuração (copie para .env)
  data/             → imoveis.json e depoimentos.json (criados automaticamente)
```

Rotas da API:

| Rota | Método | Autenticação | O que faz |
|---|---|---|---|
| `/api/auth/login` | POST | — | Recebe `{ senha }`, devolve `{ token }` |
| `/api/imoveis` | GET | não | Lista todos os imóveis |
| `/api/imoveis/:id` | GET | não | Detalhe de um imóvel |
| `/api/imoveis` | POST | sim | Cria imóvel |
| `/api/imoveis/:id` | PUT | sim | Atualiza imóvel |
| `/api/imoveis/:id` | DELETE | sim | Exclui imóvel |
| `/api/depoimentos` | GET | não | Lista depoimentos |
| `/api/depoimentos` | POST | sim | Cria depoimento |
| `/api/depoimentos/:id` | DELETE | sim | Exclui depoimento |
| `/api/atendente/chat` | POST | não | Recebe `{ mensagens: [{role, content}] }` e devolve `{ resposta }` do atendente de IA |

Rotas autenticadas exigem o cabeçalho `Authorization: Bearer <token>` obtido no login.

**Backup:** como os dados ficam em dois arquivos JSON simples (`server/data/imoveis.json` e `depoimentos.json`), fazer backup é só copiar esses dois arquivos periodicamente.

## Simulador de financiamento

Cálculo estimado pela Tabela Price (`js/simulador.js`), com aviso deixado claro na própria página de que é uma **estimativa educativa** — as condições reais dependem sempre da análise do banco/agente financeiro.

## Próximos passos sugeridos

1. Substituir conteúdo de exemplo por fotos, textos e imóveis reais (agora direto pelo painel admin).
2. Trocar a senha padrão do admin em `server/.env` antes de publicar.
3. Escolher onde hospedar o backend (Render, Railway ou um VPS — veja "Como hospedar" acima) e registrar domínio, se ainda não tiver.
4. Conectar o formulário de contato a um destino real (serviço de formulário ou o agente de IA).
5. Se o número de admins crescer e for preciso controle de permissões por pessoa, evoluir a autenticação de "senha única" para contas individuais.
