# Critérios — SEO + GEO

Cada critério: faixa de verdict, chave no coletor (`collect.mjs`), evidência esperada e correção.
Faixas replicam a ferramenta Automarticles. Peso igual por critério dentro de cada nota.

## SEO — ranquear no Google

| Critério | Chave | 🟢 pass | 🟡 warn | 🔴 fail | Correção |
|---|---|---|---|---|---|
| Indexação (sem noindex) | `noindex` | sem noindex | — | `noindex` em meta robots ou `X-Robots-Tag` | Remover noindex da página que deve ranquear. Motivo nº 1 de sumiço do Google. |
| Código HTTP | `status` | 2xx | — | 4xx/5xx | Página deve responder 200; erro tira do índice. |
| Título | `title` | 50–60 chars | fora da faixa | sem `<title>` | Reescrever entre 50 e 60 caracteres. |
| Meta description | `metadesc` | 120–160 chars | fora da faixa / ausente | — | Ajustar para 120–160; não é fator de rank mas move clique. |
| Um único H1 | `h1` | exatamente 1 | — | 0 ou 2+ | Deixar um H1 com o tema da página. |
| Hierarquia de headings | `headings` | sem pular nível | pula nível (H2→H4) | — | Reordenar H1>H2>H3 sem saltos. |
| Texto descritivo dos links | `anchortext` | ≥80% descritivos | muitos "clique aqui" | — | Âncora que descreve o destino. |
| Links rastreáveis (href real) | `crawlable` | ≥90% com href | navegação só por JS | — | Todo link com `href` real, não `onClick`. |
| Links internos | `internal` | ≥3 | <3 | — | Adicionar links internos (distribuem autoridade). |
| Links quebrados | `broken` | 0 na amostra | — | 404/410 na amostra | Corrigir 404. Bloqueados por bot = inconclusivo. |
| Alt em imagens | `alt` | todas com alt | faltam alts | — | `alt` descritivo; decorativa pode ter alt vazio. |
| Canonical | `canonical` | única e válida | ausente / múltipla | — | Uma `rel=canonical` por página. |
| Canonical self-referential | `canonical_self` | aponta pra si | aponta pra outra | — | Em geral canonical = própria URL. |
| Conflito noindex×canonical | `canonical_noindex` | **info (cinza)** | | | Nunca apontar canonical pra página com noindex. |
| hreflang | `hreflang` | válido | códigos inválidos | — | **`na` (cinza)** se site não é multilíngue. |
| robots.txt válido | `robots_valid` | bem formado / ausente | — | linha inválida | Só `User-agent/Disallow/Allow/Sitemap/Crawl-delay`. `Host:` e `Content-Signal:` **não** são padrão → contam como inválidas. Ausente = ok. |
| Sitemap declarado no robots | `sitemap_declared` | declara | não declara | — | `Sitemap: https://.../sitemap.xml` no robots.txt. |
| Sitemap.xml válido | `sitemap_valid` | XML válido | inválido/ausente | — | `<urlset>`/`<sitemapindex>` bem formado. |
| Cadeia de redirects | `redirects` | ≤1 salto | 2+ | — | Manter 301 direto. |
| HTTP→HTTPS | `https` | http redireciona | — | não redireciona | Forçar HTTPS (fator de rank + segurança). |
| Conteúdo misto | `mixed` | nenhum recurso http | — | recurso via http em página https | Trocar URLs de recurso para https. |
| TTFB | `ttfb` | <800 ms | 800–1800 ms | >1800 ms | Cache, CDN, revisar cold start / hospedagem. |
| lang + charset | `langcharset` | ambos declarados | falta um | — | `<html lang>` + `<meta charset=utf-8>`. |
| Favicon | `favicon` | declarado | ausente | — | Aparece na SERP, reforça marca. |
| Open Graph + Twitter | `og` | OG completo + Twitter | incompleto | — | og:title/description/image + twitter:card. |
| JSON-LD | `jsonld` | **info (cinza)** | | | Presença/tipos listados; informativo. |
| Organization/WebSite (SEO) | `org_website_seo` | Organization ou WebSite | nenhum | — | Schema da marca (logo, sitelinks). |
| Volume de conteúdo | `volume` | ≥15 páginas no sitemap | <15 | — | Mais artigos = autoridade temática. |
| Tem blog (linkado) | `blog` | linka pra /blog | não linka | — | Blog é o principal motor de tráfego orgânico. |
| Frequência de postagem | `frequency` | ≥4 posts/30d | ≥1/60d | 0 em 60d | Publicar com regularidade. |

## GEO — prontidão para IA (AEO)

| Critério | Chave | 🟢 pass | 🟡 warn | 🔴 fail | Correção |
|---|---|---|---|---|---|
| Crawlers de IA liberados | `ai_crawlers` | nenhum bloqueado | — | bloqueia algum | Não dar `Disallow: /` a GPTBot, ChatGPT-User, ClaudeBot, anthropic-ai, PerplexityBot, CCBot, Google-Extended, Applebot-Extended, Bytespider, Amazonbot, Meta-ExternalAgent. |
| Conteúdo no HTML cru | `html_raw` | ≥1000 chars no HTML inicial | — | quase vazio (SPA) | SSR/pré-render: conteúdo principal no HTML, não só via JS. |
| llms.txt | `llmstxt` | presente com conteúdo | ausente | — | Criar `/llms.txt` (llmstxt.org) orientando as IAs. |
| Organization + WebSite (GEO) | `org_website_geo` | ambos (ideal SearchAction) | falta um | — | Schema Organization **e** WebSite. |
| Entidade (sameAs) | `sameas` | tem sameAs | sem sameAs | — | `sameAs` → Wikipedia/Wikidata/LinkedIn/redes: ancora a marca no grafo. |
| Schema da página | `page_schema` | WebPage/Product/Service/SoftwareApplication/FAQPage... | sem tipo | — | Marcar a página com o tipo certo. |
| Proposta de valor no topo | `value_prop` | **needs_review** — o agente julga | | | Topo deixa claro *o que é, pra quem, o que resolve*? IA cita quem se descreve com clareza. |
| Listas e tabelas | `lists_tables` | tem `<ul>/<ol>/<table>` | nenhuma | — | Estruturar features/preços/passos em listas/tabelas (mais citável). |
| FAQ (FAQPage) | `faq` | schema FAQPage | sem FAQ | — | Seção de FAQ com `FAQPage`. |
| About/Contato + marca | `about_contact` | link About/Contato + Organization | falta algo | — | Páginas About e Contato acessíveis + Organization = E-E-A-T. |

## Notas de calibração

- Fórmula validada contra um report real da ferramenta: SEO (23×1 + 2×0,5 + 2×0)/27 = **89**;
  GEO (6×1 + 3×0,5 + 1×0)/10 = **75**.
- Itens **cinza** (`info`/`na`) nunca entram no denominador.
- `value_prop` exige leitura da página pelo agente (o coletor não pontua sozinho) — inclua no
  denominador de GEO só depois de julgar (pass/warn/fail).
- **Sempre** compare o servido ao vivo com o fonte do repo: num caso real, `robots.ts` liberava tudo,
  mas o `robots.txt` em produção tinha `Host:` + `Content-Signal:` (linhas inválidas) e bloqueava
  os crawlers de IA — divergência que só o modo híbrido pega.
