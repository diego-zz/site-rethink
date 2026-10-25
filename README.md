# Site Rethink Consultoria — www.rethink.ad

Site institucional da Rethink Consultoria em **Astro 7 + EmDash 1.3 (CMS)**, hospedado em **Cloudflare Workers**. Todo o conteúdo é editado no painel `/_emdash/admin`.

## Visão geral

| Camada | Tecnologia | Recurso Cloudflare (prefixo `rethink-ad`) |
|---|---|---|
| Site e painel | Astro SSR + EmDash | Worker `rethink-ad-site` (homologação: `rethink-ad-site-preview`) |
| Banco de dados | D1 | `rethink-ad-db` / `rethink-ad-db-preview` |
| Mídia enviada no painel | R2 | `rethink-ad-media` / `rethink-ad-media-preview` |
| Imagens iniciais do seed | R2 público | `rethink-ad-assets` |
| Cache de consultas | KV | `rethink-ad-cache` / `rethink-ad-cache-preview` |
| Posts do Instagram | KV | `rethink-ad-instagram` / `rethink-ad-instagram-preview` |
| Avisos de contato e login por e-mail | Email Sending (`send_email`) | domínio `rethink.ad` |
| Antirrobô do formulário | Turnstile | widget `rethink-ad-turnstile` |
| Métricas | GTM `GTM-PMBGLB5P` (GA4 e mídia configurados no GTM) | — |

### O que é editável no painel

- **Páginas** (Início, Quem somos, Soluções, Cases, Insights, Contato, Privacidade, 404): cada página é uma lista de seções (18 tipos de bloco).
- **Soluções**, **Cases**, **Insights** (com categorias, tags e autoria), **Clientes** (logos só aparecem com “uso autorizado” marcado).
- **Dados da empresa** (item “rethink”): e-mail, WhatsApp, endereço, redes, CNPJ, barra de aviso no topo, faixas finais e descrição para buscadores/IAs.
- **Menus** (principal, rodapé, legais), **Configurações** (título, SEO, verificação do Google/Bing) e o painel **SEO** de cada página.
- **Contatos** (menu Plugins → Contatos): mensagens do formulário, marcar como respondido, excluir, excluir por e-mail (pedido do titular) e exportar CSV.

Ficam no código apenas rótulos de interface (ex.: “Trilha”, “Compartilhar”, “Resultados”).

### Configurações no `wrangler.jsonc` (`vars`)

| Variável | Uso |
|---|---|
| `CONTACT_NOTIFY_TO` | Quem recebe o aviso de novo contato (vários: separe por vírgula). Hoje: `diegodieh@gmail.com`. |
| `CONTACT_NOTIFY_FROM` | Remetente (domínio precisa estar no Email Sending). |
| `CONTACT_RETENTION_MONTHS` | Meses até os contatos serem excluídos automaticamente (LGPD). Hoje: `24`. |
| `PUBLIC_GTM_ID` | Contêiner do Google Tag Manager. |
| `PUBLIC_TURNSTILE_SITE_KEY` | Chave pública do Turnstile (preencher no passo 5). |
| `NOINDEX` | `"1"` só em homologação: tira o site dos buscadores e desliga o GTM. |

Segredos (nunca no código): `TURNSTILE_SECRET_KEY`, `INSTAGRAM_TOKEN` (opcional).

## Desenvolvimento local

```bash
corepack enable
pnpm install
pnpm dev                      # http://localhost:4321
# primeiro acesso: http://localhost:4321/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin
```

Scripts: `pnpm typecheck`, `pnpm build`, `pnpm seed:build` (gera `seed/seed.json` a partir de `scripts/seed/build-seed.py`), `pnpm seed:validate`.

O seed só é aplicado num banco vazio. Depois disso, mudanças de conteúdo e de esquema são feitas no painel.

## Estrutura

```
src/
  layouts/Base.astro          <head> (SEO, JSON-LD, GTM + consentimento), cabeçalho, rodapé
  components/blocos/*.astro   os 18 tipos de seção do CMS
  components/Blocos.astro     mapa tipo de seção → componente
  pages/                      /, /[slug], /solucoes/[slug], /cases/[slug], /insights/[slug], 404, llms.txt
  plugins/contatos/           plugin rethink-ad-contatos (formulário, painel, retenção)
  lib/                        utilitários, Instagram, formulário
  middleware.ts               cabeçalhos de segurança, noindex em homologação, sitemap
seed/                         esquema do CMS + conteúdo inicial + imagens
.github/workflows/deploy.yml  CI/CD
```

---

## Roteiro de publicação (passo a passo)

Recursos já criados na conta Cloudflare `1aa4e3b1c5929cd8f5acddd2b6b3f012`: D1, R2 e KV listados acima (os IDs estão no `wrangler.jsonc`).

### 1. Repositório no GitHub

Repositório oficial: https://github.com/diego-zz/site-rethink (já configurado como `origin`). Na pasta do projeto:

```bash
git push -u origin main
```

### 2. Token da Cloudflare para o deploy

Cloudflare → *My Profile* → *API Tokens* → *Create Token* → *Custom token* `rethink-ad-deploy`:

- Account → Workers Scripts: Edit · Workers KV Storage: Edit · D1: Edit · Workers R2 Storage: Edit · Account Settings: Read
- Zone (`rethink.ad`) → Workers Routes: Edit · DNS: Edit · Zone: Read

No GitHub → *Settings* → *Secrets and variables* → *Actions*:

- `CLOUDFLARE_API_TOKEN` = token acima
- `CLOUDFLARE_ACCOUNT_ID` = `1aa4e3b1c5929cd8f5acddd2b6b3f012`

### 3. Ambientes no GitHub

*Settings* → *Environments*:

- `preview`: sem regras.
- `production`: marque *Required reviewers* e adicione você. Todo deploy em produção espera sua aprovação.

### 4. Plano Workers Paid (obrigatório)

O Worker do site com o EmDash tem cerca de 5 MB compactado; o plano gratuito aceita até 3 MB e limita o processamento a 10 ms por requisição. Ative *Workers Paid* (US$ 5/mês) em *Workers & Pages* → *Plans* antes do primeiro deploy.

### 5. Turnstile (antirrobô do formulário)

1. Cloudflare → *Turnstile* → *Add widget* `rethink-ad-turnstile`, modo *Managed*, domínios `www.rethink.ad` e `rethink-ad-site-preview.ddiehl.workers.dev`.
2. Copie a **Site key** para `PUBLIC_TURNSTILE_SITE_KEY` nos dois blocos `vars` do `wrangler.jsonc` e faça commit.
3. Guarde a **Secret key** como segredo (o Worker precisa existir; rode depois do 1º deploy de homologação):
   ```bash
   npx wrangler secret put TURNSTILE_SECRET_KEY --env preview
   npx wrangler secret put TURNSTILE_SECRET_KEY
   ```

Sem as duas chaves o formulário continua funcionando, mas sem a verificação.

### 6. Email Sending (avisos de contato e login por e-mail)

1. Cloudflare → *Email* → *Email Sending* → *Onboard domain* → `rethink.ad`. A Cloudflare cria registros no subdomínio `cf-bounce` e um `_dmarc`.
2. **Não ative o Email Routing**: as caixas de e-mail continuam no Zoho (MX, SPF e DKIM do Zoho ficam como estão).
3. Se já existir um `_dmarc`, mantenha um só registro e comece com `p=none` até conferir os relatórios.
4. Quando o domínio aparecer como verificado, envie um contato de teste pelo site.

### 7. Primeiro deploy (homologação)

1. Faça um push na `main` (ou rode o workflow *Deploy* manualmente em *Actions*).
2. O job **Homologação** envia as imagens iniciais para `rethink-ad-assets` e publica `https://rethink-ad-site-preview.ddiehl.workers.dev`.
3. Abra `https://rethink-ad-site-preview.ddiehl.workers.dev/_emdash/admin`:
   - nome do site: **Rethink Consultoria**;
   - marque **incluir conteúdo de exemplo** (aplica páginas, soluções e textos);
   - crie a sua **passkey** (Touch ID / Face ID / Windows Hello).
4. Revise todas as páginas no celular e no computador.

Os cases e o insight de exemplo entram como **rascunho**: servem de modelo e não aparecem no site.

### 8. Virada do domínio (sai da Vercel)

Hoje `www.rethink.ad` aponta para a Vercel (CNAME `16fdcdd5b01997fb.vercel-dns-017.com`) e a raiz `rethink.ad` tem um registro A `216.198.79.1`. Faça no horário de menor acesso:

1. Cloudflare → `rethink.ad` → *DNS*: **apague** o CNAME `www` da Vercel. O deploy cria o domínio próprio do Worker, e ele não é criado se o nome já tiver um registro.
2. No GitHub → *Actions* → execução da `main` → **aprove** o job *Produção*. O Worker `rethink-ad-site` passa a responder em `https://www.rethink.ad`.
3. Raiz → www:
   - em *DNS*, troque o registro A `216.198.79.1` por **AAAA `rethink.ad` → `100::` (proxied)**;
   - em *Rules* → *Redirect Rules* → *Create*, regra `rethink-ad-raiz-para-www`: hostname igual a `rethink.ad` → URL dinâmica `concat("https://www.rethink.ad", http.request.uri.path)`, código **301**, preservar a query string.
4. *SSL/TLS* → *Overview*: mude para **Full (strict)**. Em *Edge Certificates*, ative *Always Use HTTPS*.
5. Abra `https://www.rethink.ad/_emdash/admin` e repita a configuração do passo 7.3 (o banco de produção é outro e a passkey vale por domínio).
6. Remova o domínio do projeto na Vercel.

Para voltar atrás: recrie o CNAME `www` da Vercel e o A da raiz (o Worker fica parado sem tráfego).

### 9. Depois da publicação

- **Google Search Console**: adicione `https://www.rethink.ad`, copie o código de verificação para *Configurações → SEO* no painel e envie `https://www.rethink.ad/sitemap.xml`. Faça o mesmo no Bing Webmaster Tools.
- **GTM** (`GTM-PMBGLB5P`): o site envia o Consent Mode v2 e só carrega o GTM depois do aceite no aviso de cookies. No GTM, use as tags do GA4 e de mídia com *consent checks*. O envio do formulário gera o evento `formulario_contato_enviado` no `dataLayer` (use como conversão).
- **Instagram** (opcional): gere um token de longa duração da Instagram API (login do Instagram) e rode `npx wrangler secret put INSTAGRAM_TOKEN`. Os 6 últimos posts aparecem na Home em até 6 horas; o token é renovado sozinho.
- **Conteúdo a validar**: em *Dados da empresa* troque os marcadores `[...]` (CNPJ, razão social, e-mail, WhatsApp, ano de fundação, redes); cadastre os clientes autorizados; publique os primeiros cases e insights; revise a Política de Privacidade com o jurídico.

## Segurança e boas práticas aplicadas

- Recursos isolados por ambiente (produção × homologação); homologação com `noindex`.
- Cabeçalhos: HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, COOP.
- Formulário: validação no servidor, Turnstile, campo-armadilha, limite de 5 envios/hora por origem (guardada como hash), dados pessoais só no painel (não em coleções públicas), retenção automática e exclusão a pedido do titular.
- Painel com passkey; mais tarde pode passar para o Cloudflare Access (`access()` no `astro.config.mjs`).
- Robôs de IA: busca e resposta liberadas; treinamento bloqueado (`robots.txt` + `Content-Signal`). `/llms.txt` gerado a partir do CMS.
- Dependências fixadas (`emdash` 1.3.1), `minimumReleaseAge` no pnpm e lockfile congelado no CI.
