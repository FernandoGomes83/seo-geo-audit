# seo-geo-audit

Skill de agente (Claude Code, Codex e outros compatíveis com `SKILL.md`) que faz auditoria de
**SEO técnico** e de **prontidão para IA (GEO/AEO)**.

Gera duas notas de 0 a 100:

- **SEO**: chance de ranquear no Google
- **GEO**: chance de ser citado por ChatGPT, Perplexity, Claude e afins

Cada critério sai como 🟢 verde, 🟡 âmbar, 🔴 vermelho ou ⚪ cinza, com a correção concreta. Os
critérios e a pontuação seguem os da ferramenta [Automarticles](https://automarticles.com).

## O que ela audita

- **URL ao vivo**: um coletor em Node puro (`scripts/collect.mjs`) busca a página, o `robots.txt`,
  o `sitemap.xml` e o `llms.txt` e devolve JSON com evidência e nota de cada check.
- **Código-fonte** (Next.js): `metadata`/`generateMetadata`, `robots.ts`, `sitemap.ts`, JSON-LD.
- **Modo híbrido**: compara o que o repo gera com o que produção serve de fato. É aí que aparecem
  divergências como um `robots.ts` que libera tudo e um `robots.txt` em produção que bloqueia os
  crawlers de IA.

A lista completa de critérios, faixas e correções está em
[references/criteria.md](references/criteria.md).

## Instalação

### Com `npx skills`

```bash
npx skills add https://github.com/FernandoGomes83/seo-geo-audit
```

### Manual (Claude Code)

```bash
git clone https://github.com/FernandoGomes83/seo-geo-audit ~/.claude/skills/seo-geo-audit
```

Para um projeto só, clone em `.claude/skills/seo-geo-audit` dentro do repo.

## Uso

Peça ao agente algo como:

> Faz uma auditoria de SEO e GEO de https://meusite.com.br

> Revisa o SEO da landing antes do deploy

O coletor também roda sozinho:

```bash
node scripts/collect.mjs https://meusite.com.br
node scripts/collect.mjs https://meusite.com.br --no-linkcheck   # pula a amostra de links quebrados
```

Requer Node 18 ou mais recente. Não tem dependências.

## Pontuação

Dentro de cada nota, todo critério tem o mesmo peso: verde = 1, âmbar = 0,5, vermelho = 0. Cinza
(informativo ou não aplicável) fica fora da conta.

```
nota = round(soma_dos_pesos / nº_de_itens_coloridos × 100)
```

O critério "Proposta de valor clara no topo" não é pontuado pelo coletor: quem julga é o agente,
depois de ler o começo da página.

## Licença

[MIT](LICENSE)
