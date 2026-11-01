---
name: seo-geo-audit
description: 'Auditoria de SEO técnico + prontidão para IA (GEO/AEO), espelhando a ferramenta Automarticles. Gera duas notas 0-100 (SEO e GEO) e uma lista de itens verde/âmbar/vermelho com correção concreta. Modo híbrido — audita a URL ao vivo e/ou o código-fonte (Next.js: metadata, robots.ts, sitemap.ts, JSON-LD). Use quando o usuário pedir análise/checklist de SEO, GEO, AEO, "otimização para IA", ranquear no Google, ser citado por ChatGPT/Perplexity, ou revisar SEO de uma página antes do deploy.'
---

# Auditoria de SEO + GEO/AEO

Reproduz o diagnóstico da ferramenta Automarticles: **duas notas de 0 a 100** (SEO = ranquear
no Google; GEO = ser citado por IAs) e itens em **verde / âmbar / vermelho / cinza**.

GEO e AEO são sinônimos. GEO bem feito é, na prática, SEO bem feito.

## Como pontuar (regra exata — validada contra a ferramenta)

Cada critério, dentro da sua nota, tem **peso igual**:

- 🟢 **verde** (pass) = 1,0
- 🟡 **âmbar** (warn) = 0,5
- 🔴 **vermelho** (fail) = 0,0
- ⚪ **cinza** (info/na) = **fora do denominador** (não conta)

`nota = round( soma_dos_pesos / nº_de_itens_coloridos × 100 )`, separada para SEO e para GEO.

## Workflow

1. **Descubra o alvo.** URL ao vivo, arquivos do repo, ou os dois (híbrido). Se o usuário deu
   URL e o site está no ar → priorize o coletor ao vivo. Se pediu revisão pré-deploy → audite o repo.
2. **Colete ao vivo** (se houver URL):
   `node "${CLAUDE_SKILL_DIR}/scripts/collect.mjs" <url>` → JSON com verdict + evidência de cada check e as
   notas já calculadas. Use `--no-linkcheck` para pular a amostra de links quebrados (mais rápido).
   Roda com `node` puro (Node 18+, `fetch` nativo) — **não** precisa instalar nada. Fora do Claude Code,
   o caminho é `scripts/collect.mjs` dentro da pasta desta skill.
3. **Renderize pós-JS** (quando o check "Conteúdo no HTML cru" der baixo ou for SPA): use as
   ferramentas de navegador disponíveis (Claude in Chrome, Playwright, headless Chrome) pra comparar o texto do HTML inicial com o
   texto após o JS. Crawlers de IA **não** rodam JS — o que importa é o HTML cru.
4. **Audite o repo** (Next.js): confira que o código gera os sinais certos —
   `src/app/**/metadata`/`generateMetadata` (title 50-60, description 120-160, OG/Twitter),
   `src/app/robots.ts`, `src/app/sitemap.ts`, blocos JSON-LD, `llms.txt`. **Compare com o ao vivo**:
   robots/sitemap servidos podem divergir do fonte (deploy antigo, edge, `_headers`).
   **Astro:** `site` no `astro.config.*` (base do canonical e do sitemap), `@astrojs/sitemap`,
   `public/robots.txt` ou `src/pages/robots.txt.ts`, `<head>` e JSON-LD no layout base,
   `public/llms.txt`. Na Cloudflare, confira também se a zona não injeta `robots.txt` gerenciado
   nem bloqueia bots de IA (`ai_bots_protection`).
5. **Julgue os itens que pedem IA** (o coletor marca `needs_review`): **Proposta de valor clara
   no topo** — leia o começo da página e diga se deixa claro *o que é, pra quem, o que resolve*.
6. **Monte o relatório** no formato abaixo.

Detalhe de cada critério (faixas, evidência esperada e correção): veja
[references/criteria.md](references/criteria.md).

## Formato de saída

Comece pelas duas notas, depois os itens agrupados por nota e por status, os que falham primeiro:

```
# Diagnóstico de SEO e GEO — <url>

**SEO 89/100** · 2 a corrigir     **GEO 75/100** · 1 a corrigir

## Ranquear no Google (SEO)
### 🔴 Corrigir
- **robots.txt válido** — 1 linha inválida (`Host:` não é padrão). → remover `host` do robots.ts
- **TTFB** — ~2236 ms. → cache/CDN, revisar cold start
### 🟡 Atenção
- **Tamanho do título** — 40 caracteres (ideal 50-60).
### 🟢 Tudo certo (23)
- Indexação, HTTP 200, canonical, meta description, H1, OG/Twitter... (resumir)
### ⚪ Não aplicável / informativo
- hreflang (site não é multilíngue), JSON-LD (informativo)

## Ser citado pelas IAs (GEO)
### 🔴 Corrigir
- **Crawlers de IA liberados** — robots.txt bloqueia GPTBot, ClaudeBot, CCBot... → liberar
...
```

Para cada 🔴/🟡 dê a **correção concreta** e, no modo híbrido, **o arquivo/linha do repo** onde mudar.

## Regras

- **Confie no HTML cru** para SEO/GEO — é o que Google e IAs veem primeiro. SPA que só monta via
  JS = prontidão baixa.
- **Repo ≠ produção.** Sempre sinalize divergências (ex.: `robots.ts` libera tudo, mas o
  `robots.txt` servido bloqueia crawlers de IA — caso real que motivou a skill).
- O coletor não instala nada (só `node`); use o gerenciador de pacotes do projeto se precisar de algo.
- Não invente números: toda evidência vem do coletor, do browser ou do arquivo lido.
- **Calibração:** se a nota ou um item divergir do que a Automarticles mostra para a mesma URL,
  registre em `references/criteria.md`, seção Notas de calibração (data, URL, item, valor da
  ferramenta × do coletor) e, se for erro do coletor, corrija o `collect.mjs` no mesmo commit.
