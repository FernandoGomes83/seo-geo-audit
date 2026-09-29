#!/usr/bin/env node
// Coletor determinístico de sinais de SEO + GEO para uma URL ao vivo.
// Sem dependências: usa apenas fetch nativo (Node 18+) e regex.
// Espelha os checks da ferramenta Automarticles. Emite JSON no stdout.
//
// Uso:  node collect.mjs <url> [--no-linkcheck]
//
// Verdicts por check: "pass" | "warn" | "fail" | "na" | "info"
// A pontuação (verde=1, âmbar=0.5, vermelho=0, cinza fora) é calculada aqui.

const rawUrl = process.argv[2];
const NO_LINKCHECK = process.argv.includes("--no-linkcheck");
if (!rawUrl) {
  console.error("uso: node collect.mjs <url> [--no-linkcheck]");
  process.exit(2);
}

const UA =
  "Mozilla/5.0 (compatible; seo-geo-audit/1.0; +https://github.com/FernandoGomes83/seo-geo-audit)";

// Crawlers de IA que a ferramenta verifica (bloqueio => GEO cai).
const AI_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "anthropic-ai",
  "Claude-Web",
  "PerplexityBot",
  "CCBot",
  "Google-Extended",
  "Applebot-Extended",
  "Bytespider",
  "Amazonbot",
  "Meta-ExternalAgent",
  "cohere-ai",
];

// Diretivas válidas num robots.txt (o resto conta como linha inválida).
const ROBOTS_DIRECTIVES = [
  "user-agent",
  "disallow",
  "allow",
  "sitemap",
  "crawl-delay",
  "clean-param",
  // "host" é NÃO-padrão (só Yandex) — a ferramenta trata como linha inválida.
];

const checks = {}; // key -> { label, group:"seo"|"geo", verdict, evidence }
function set(key, group, label, verdict, evidence) {
  checks[key] = { group, label, verdict, evidence };
}

async function timedFetch(url, opts = {}) {
  const start = performance.now();
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": UA, accept: "text/html,*/*" },
    ...opts,
  });
  const ttfbMs = Math.round(performance.now() - start);
  return { res, ttfbMs };
}

function abs(base, href) {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

async function main() {
  const start = new URL(rawUrl).toString();
  let res, ttfbMs, html, finalUrl, redirects;
  try {
    // Rastreia a cadeia de redirect manualmente para contar saltos.
    redirects = 0;
    let cur = start;
    for (let i = 0; i < 10; i++) {
      const r = await fetch(cur, {
        redirect: "manual",
        headers: { "user-agent": UA },
      });
      if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
        redirects++;
        cur = abs(cur, r.headers.get("location"));
        continue;
      }
      break;
    }
    finalUrl = cur;
    ({ res, ttfbMs } = await timedFetch(finalUrl));
    html = await res.text();
  } catch (e) {
    console.log(
      JSON.stringify({ error: `fetch falhou: ${e.message}`, url: start }),
    );
    process.exit(1);
  }

  const origin = new URL(finalUrl).origin;
  const isHttps = new URL(finalUrl).protocol === "https:";
  const lower = html.toLowerCase();

  // ---- Status HTTP ----
  set(
    "status",
    "seo",
    "Código HTTP de sucesso",
    res.status >= 200 && res.status < 300 ? "pass" : "fail",
    `HTTP ${res.status}`,
  );

  // ---- Indexação (noindex) ----
  const xRobots = (res.headers.get("x-robots-tag") || "").toLowerCase();
  const metaRobots = (
    html.match(
      /<meta[^>]+name=["']robots["'][^>]*content=["']([^"']*)["']/i,
    )?.[1] || ""
  ).toLowerCase();
  const noindex = xRobots.includes("noindex") || metaRobots.includes("noindex");
  set(
    "noindex",
    "seo",
    "Página não bloqueada de indexação",
    noindex ? "fail" : "pass",
    noindex ? "noindex presente" : "indexação permitida",
  );

  // ---- Título ----
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  if (!title) {
    set("title", "seo", "Tamanho do título", "fail", "sem <title>");
  } else {
    const n = title.length;
    set(
      "title",
      "seo",
      "Tamanho do título",
      n >= 50 && n <= 60 ? "pass" : "warn",
      `${n} caracteres (ideal 50 a 60)`,
    );
  }

  // ---- Meta description ----
  const desc = html.match(
    /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i,
  )?.[1];
  if (!desc) {
    set("metadesc", "seo", "Tamanho da meta description", "warn", "ausente");
  } else {
    const n = desc.length;
    set(
      "metadesc",
      "seo",
      "Tamanho da meta description",
      n >= 120 && n <= 160 ? "pass" : "warn",
      `${n} caracteres (ideal 120 a 160)`,
    );
  }

  // ---- Headings ----
  const headings = [...html.matchAll(/<h([1-6])[^>]*>/gi)].map((m) =>
    Number(m[1]),
  );
  const h1s = headings.filter((h) => h === 1).length;
  set(
    "h1",
    "seo",
    "Um único H1",
    h1s === 1 ? "pass" : "fail",
    `${h1s} H1 na página`,
  );
  let ordered = true;
  for (let i = 1; i < headings.length; i++) {
    if (headings[i] - headings[i - 1] > 1) ordered = false;
  }
  set(
    "headings",
    "seo",
    "Hierarquia de headings",
    ordered ? "pass" : "warn",
    `${headings.length} headings ${ordered ? "em ordem" : "com salto de nível"}`,
  );

  // ---- Links ----
  const anchors = [
    ...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi),
  ].map((m) => ({
    attrs: m[1],
    text: m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
    href: m[1].match(/href=["']([^"']*)["']/i)?.[1],
  }));
  const withHref = anchors.filter((a) => a.href);
  set(
    "crawlable",
    "seo",
    "Links rastreáveis",
    withHref.length > 0 && withHref.length >= anchors.length * 0.9
      ? "pass"
      : "warn",
    `${withHref.length}/${anchors.length} âncoras com href`,
  );
  const badText = /^(clique aqui|saiba mais|leia mais|aqui|read more|click here)$/i;
  const descriptive = withHref.filter(
    (a) => a.text && !badText.test(a.text),
  ).length;
  set(
    "anchortext",
    "seo",
    "Links com texto descritivo",
    descriptive >= withHref.length * 0.8 ? "pass" : "warn",
    `${descriptive} link(s) descritivo(s)`,
  );
  const internal = withHref.filter((a) => {
    const u = abs(finalUrl, a.href);
    return u && new URL(u).origin === origin;
  });
  set(
    "internal",
    "seo",
    "Links internos suficientes",
    internal.length >= 3 ? "pass" : "warn",
    `${internal.length} link(s) interno(s)`,
  );

  // ---- Imagens / alt ----
  const imgs = [...html.matchAll(/<img\b([^>]*)>/gi)].map((m) => m[1]);
  const withAlt = imgs.filter((a) => /\balt=/i.test(a)).length;
  set(
    "alt",
    "seo",
    "Imagens com alt",
    imgs.length === 0 || withAlt === imgs.length ? "pass" : "warn",
    imgs.length === 0
      ? "sem imagens"
      : withAlt === imgs.length
        ? `todas as ${imgs.length} com alt`
        : `${withAlt}/${imgs.length} com alt`,
  );

  // ---- Canonical ----
  const canonicals = [
    ...html.matchAll(
      /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']*)["']/gi,
    ),
  ].map((m) => m[1]);
  if (canonicals.length === 0) {
    set("canonical", "seo", "rel=canonical válido", "warn", "sem canonical");
    set("canonical_self", "seo", "Canonical self-referential", "warn", "n/a");
  } else {
    const c = abs(finalUrl, canonicals[0]);
    const unique = canonicals.length === 1;
    set(
      "canonical",
      "seo",
      "rel=canonical válido",
      unique ? "pass" : "warn",
      unique ? c : `${canonicals.length} canonicals`,
    );
    const self =
      c &&
      c.replace(/\/$/, "") === finalUrl.replace(/\/$/, "");
    set(
      "canonical_self",
      "seo",
      "Canonical self-referential",
      self ? "pass" : "warn",
      self ? "aponta pra própria URL" : "aponta pra outra URL",
    );
    set(
      "canonical_noindex",
      "seo",
      "Conflito noindex x canonical",
      "info",
      self ? "canonical é a própria página" : "verificar destino",
    );
  }

  // ---- hreflang ----
  const hreflangs = [
    ...html.matchAll(/<link[^>]+hreflang=["']([^"']*)["']/gi),
  ].map((m) => m[1]);
  set(
    "hreflang",
    "seo",
    "hreflang válido",
    hreflangs.length === 0 ? "na" : "pass",
    hreflangs.length === 0
      ? "sem hreflang (não aplicável)"
      : `${hreflangs.length} versões`,
  );

  // ---- lang / charset ----
  const lang = html.match(/<html[^>]+lang=["']([^"']*)["']/i)?.[1];
  const charset =
    html.match(/<meta[^>]+charset=["']?([^"'>\s]+)/i)?.[1] ||
    (res.headers.get("content-type") || "").match(/charset=([^;]+)/i)?.[1];
  set(
    "langcharset",
    "seo",
    "Idioma (lang) e charset",
    lang && charset ? "pass" : "warn",
    `lang: ${lang || "ausente"} · charset: ${charset || "ausente"}`,
  );

  // ---- Favicon ----
  const favicon = /rel=["'][^"']*icon[^"']*["']/i.test(html);
  set(
    "favicon",
    "seo",
    "Favicon",
    favicon ? "pass" : "warn",
    favicon ? "favicon declarado" : "sem favicon",
  );

  // ---- Open Graph / Twitter ----
  const ogTitle = /property=["']og:title["']/i.test(html);
  const ogDesc = /property=["']og:description["']/i.test(html);
  const ogImg = /property=["']og:image["']/i.test(html);
  const twitter = /name=["']twitter:card["']/i.test(html);
  const ogComplete = ogTitle && ogDesc && ogImg;
  set(
    "og",
    "seo",
    "Open Graph e Twitter Card",
    ogComplete && twitter ? "pass" : "warn",
    `Open Graph: ${ogComplete ? "completo" : "incompleto"} · Twitter Card: ${
      twitter ? "presente" : "ausente"
    }`,
  );

  // ---- JSON-LD ----
  const ldBlocks = [
    ...html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ].map((m) => m[1]);
  const types = new Set();
  let ldValid = ldBlocks.length > 0;
  for (const b of ldBlocks) {
    try {
      const j = JSON.parse(b.trim());
      const collect = (o) => {
        if (!o || typeof o !== "object") return;
        if (Array.isArray(o)) return o.forEach(collect);
        if (o["@type"])
          [].concat(o["@type"]).forEach((t) => types.add(t));
        Object.values(o).forEach(collect);
      };
      collect(j);
    } catch {
      ldValid = false;
    }
  }
  const typeList = [...types];
  set(
    "jsonld",
    "seo",
    "Dados estruturados (JSON-LD)",
    "info",
    ldBlocks.length
      ? `${ldBlocks.length} bloco(s): ${typeList.join(", ")}`
      : "sem JSON-LD",
  );
  const hasOrg = types.has("Organization");
  const hasWebSite = types.has("WebSite");
  set(
    "org_website_seo",
    "seo",
    "Organization / WebSite",
    hasOrg || hasWebSite ? "pass" : "warn",
    `schema: ${typeList.filter((t) => /Organization|WebSite/.test(t)).join(", ") || "nenhum"}`,
  );

  // ---- Conteúdo misto (mixed content) ----
  let mixed = 0;
  if (isHttps) {
    mixed = [
      ...html.matchAll(/(?:src|href)=["'](http:\/\/[^"']+)["']/gi),
    ].filter((m) => !/\.(xml|txt)$/i.test(m[1])).length;
  }
  set(
    "mixed",
    "seo",
    "Conteúdo misto",
    !isHttps || mixed === 0 ? "pass" : "fail",
    mixed === 0 ? "nenhum recurso inseguro" : `${mixed} recurso(s) via HTTP`,
  );

  // ---- Redirecionamentos ----
  set(
    "redirects",
    "seo",
    "Cadeia de redirecionamentos",
    redirects <= 1 ? "pass" : "warn",
    `${redirects} redirecionamento(s)`,
  );

  // ---- TTFB ----
  set(
    "ttfb",
    "seo",
    "TTFB / tempo de resposta",
    ttfbMs < 800 ? "pass" : ttfbMs <= 1800 ? "warn" : "fail",
    `~${ttfbMs} ms até o primeiro byte`,
  );

  // ---- HTTP -> HTTPS ----
  try {
    const httpUrl = start.replace(/^https:/, "http:");
    const r = await fetch(httpUrl, {
      redirect: "manual",
      headers: { "user-agent": UA },
    });
    const loc = r.headers.get("location") || "";
    const ok =
      (r.status >= 300 && r.status < 400 && loc.startsWith("https:")) ||
      isHttps;
    set(
      "https",
      "seo",
      "HTTP redireciona pra HTTPS",
      ok ? "pass" : "fail",
      ok ? "http redireciona pra https" : "http não redireciona",
    );
  } catch {
    set("https", "seo", "HTTP redireciona pra HTTPS", "pass", "só https");
  }

  // ---- robots.txt ----
  let robotsTxt = "";
  try {
    const r = await fetch(origin + "/robots.txt", {
      headers: { "user-agent": UA },
    });
    if (r.ok) robotsTxt = await r.text();
  } catch {}
  const robotsLines = robotsTxt.split(/\r?\n/);
  const invalid = robotsLines.filter((ln) => {
    const t = ln.trim();
    if (!t || t.startsWith("#")) return false;
    const dir = t.split(":")[0].trim().toLowerCase();
    return !ROBOTS_DIRECTIVES.includes(dir);
  });
  set(
    "robots_valid",
    "seo",
    "robots.txt válido",
    !robotsTxt || invalid.length === 0 ? "pass" : "fail",
    !robotsTxt
      ? "ausente (ok)"
      : invalid.length === 0
        ? "bem formado"
        : `${invalid.length} linha(s) inválida(s): ${invalid.map((l) => l.trim()).join(" | ")}`,
  );
  const sitemapDecl = robotsTxt.match(/^sitemap:\s*(\S+)/im)?.[1];
  set(
    "sitemap_declared",
    "seo",
    "Sitemap declarado no robots.txt",
    sitemapDecl ? "pass" : "warn",
    sitemapDecl ? `declara: ${sitemapDecl}` : "não declara sitemap",
  );

  // ---- AI crawlers (GEO) ----
  // Bloqueado = há um bloco "User-agent: <bot>" com "Disallow: /".
  const blocked = [];
  for (const bot of AI_BOTS) {
    const re = new RegExp(
      `user-agent:\\s*${bot}\\b[\\s\\S]*?(?=\\nuser-agent:|$)`,
      "i",
    );
    const block = robotsTxt.match(re)?.[0] || "";
    if (/disallow:\s*\/\s*$/im.test(block)) blocked.push(bot);
  }
  set(
    "ai_crawlers",
    "geo",
    "Crawlers de IA liberados",
    blocked.length === 0 ? "pass" : "fail",
    blocked.length === 0
      ? "todos liberados"
      : `bloqueia: ${blocked.join(", ")}`,
  );

  // ---- Sitemap.xml ----
  let sitemapUrls = [];
  let sitemapValid = false;
  try {
    const sm = sitemapDecl || origin + "/sitemap.xml";
    const r = await fetch(sm, { headers: { "user-agent": UA } });
    if (r.ok) {
      const xml = await r.text();
      sitemapValid = /<urlset|<sitemapindex/i.test(xml);
      sitemapUrls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((m) => ({
        loc: m[1],
      }));
      // lastmod para frequência
      const mods = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/gi)].map(
        (m) => m[1],
      );
      sitemapUrls.forEach((u, i) => (u.lastmod = mods[i]));
    }
  } catch {}
  set(
    "sitemap_valid",
    "seo",
    "Sitemap.xml válido",
    sitemapValid ? "pass" : "warn",
    sitemapValid ? "responde com XML válido" : "inválido ou ausente",
  );

  // ---- Volume de conteúdo ----
  const contentPages = sitemapUrls.length;
  set(
    "volume",
    "seo",
    "Volume de conteúdo",
    contentPages >= 15 ? "pass" : "warn",
    `${contentPages} página(s) de conteúdo no sitemap do site`,
  );

  // ---- Blog + frequência ----
  const blogLink = withHref.find((a) => /\/blog\b/i.test(a.href || ""));
  set(
    "blog",
    "seo",
    "Tem blog (e está linkado)",
    blogLink ? "pass" : "warn",
    blogLink
      ? `a página linka pra um blog/conteúdo (${abs(finalUrl, blogLink.href)}) · heurística`
      : "não linka pra blog",
  );
  // frequência: conta lastmod dos últimos 30/60 dias (sem Date.now no runtime? há em node).
  const now = Date.now();
  const DAY = 86400000;
  const recent30 = sitemapUrls.filter((u) => {
    if (!u.lastmod) return false;
    const t = Date.parse(u.lastmod);
    return !isNaN(t) && now - t <= 30 * DAY;
  }).length;
  const recent60 = sitemapUrls.filter((u) => {
    if (!u.lastmod) return false;
    const t = Date.parse(u.lastmod);
    return !isNaN(t) && now - t <= 60 * DAY;
  }).length;
  set(
    "frequency",
    "seo",
    "Frequência de postagem",
    recent30 >= 4 ? "pass" : recent60 >= 1 ? "warn" : "fail",
    `${recent30} publicação(ões) nos últimos 30 dias`,
  );

  // ================= GEO =================

  // ---- Conteúdo no HTML cru ----
  const textOnly = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  set(
    "html_raw",
    "geo",
    "Conteúdo no HTML cru (não só JS)",
    textOnly.length >= 1000 ? "pass" : "fail",
    `${textOnly.length} caracteres no HTML inicial`,
  );

  // ---- llms.txt ----
  let llms = "";
  try {
    const r = await fetch(origin + "/llms.txt", {
      headers: { "user-agent": UA },
    });
    if (r.ok) llms = await r.text();
  } catch {}
  set(
    "llmstxt",
    "geo",
    "Arquivo llms.txt",
    llms.trim().length > 0 ? "pass" : "warn",
    llms.trim().length > 0
      ? `presente (${llms.length} caracteres)`
      : "ausente",
  );

  // ---- Org + WebSite (GEO, com SearchAction) ----
  const hasSearchAction = /SearchAction/i.test(html);
  set(
    "org_website_geo",
    "geo",
    "Organization + WebSite schema",
    hasOrg && hasWebSite ? "pass" : "warn",
    `Organization: ${hasOrg ? "sim" : "não"} · WebSite: ${hasWebSite ? "sim" : "não"}${
      hasWebSite && hasSearchAction ? " (SearchAction)" : ""
    }`,
  );

  // ---- sameAs ----
  const sameAs = /"sameAs"/i.test(html);
  set(
    "sameas",
    "geo",
    "Entidade (sameAs)",
    sameAs ? "pass" : "warn",
    sameAs ? "sameAs presente" : "sem sameAs (Wikipedia/Wikidata/redes)",
  );

  // ---- Schema da página ----
  const pageType = typeList.find((t) =>
    // Subtipos de WebPage (AboutPage, ContactPage, CollectionPage...) também contam.
    /(WebPage|Page)$|Product|Service|SoftwareApplication|Article|FAQPage/.test(t),
  );
  set(
    "page_schema",
    "geo",
    "Schema da página",
    pageType ? "pass" : "warn",
    pageType ? `tipo: ${pageType}` : "sem schema de tipo de página",
  );

  // ---- FAQ ----
  const faq = types.has("FAQPage");
  set(
    "faq",
    "geo",
    "FAQ na página (FAQPage)",
    faq ? "pass" : "warn",
    faq ? "tem FAQPage schema" : "sem FAQPage",
  );

  // ---- Listas e tabelas ----
  const lists = (html.match(/<(ul|ol)\b/gi) || []).length;
  const tables = (html.match(/<table\b/gi) || []).length;
  set(
    "lists_tables",
    "geo",
    "Listas e tabelas",
    lists + tables > 0 ? "pass" : "warn",
    `${lists} lista(s), ${tables} tabela(s)`,
  );

  // ---- About/Contato + marca ----
  const aboutLink = withHref.some((a) =>
    /\/(sobre|about|contato|contact|quem-somos)\b/i.test(a.href || ""),
  );
  set(
    "about_contact",
    "geo",
    "About/Contato + marca",
    aboutLink && hasOrg ? "pass" : "warn",
    `About/Contato: ${aboutLink ? "sim" : "não"} · Organization: ${hasOrg ? "sim" : "não"}`,
  );

  // ---- Links quebrados (amostra, opcional) ----
  if (!NO_LINKCHECK) {
    const sample = internal.slice(0, 8);
    let broken = 0;
    await Promise.all(
      sample.map(async (a) => {
        try {
          const u = abs(finalUrl, a.href);
          const r = await fetch(u, {
            method: "HEAD",
            headers: { "user-agent": UA },
          });
          if (r.status === 404 || r.status === 410) broken++;
        } catch {}
      }),
    );
    set(
      "broken",
      "seo",
      "Links quebrados",
      broken === 0 ? "pass" : "fail",
      `${sample.length} checado(s)${broken ? ` · ${broken} quebrado(s)` : ""}`,
    );
  }

  // ---- Itens que precisam de julgamento de IA (deixa para o agente) ----
  set(
    "value_prop",
    "geo",
    "Proposta de valor clara no topo",
    "needs_review",
    "julgar pelo texto do topo (o agente avalia)",
  );

  // ================= Pontuação =================
  const W = { pass: 1, warn: 0.5, fail: 0 };
  function score(group) {
    const items = Object.values(checks).filter(
      (c) =>
        c.group === group &&
        ["pass", "warn", "fail"].includes(c.verdict),
    );
    if (!items.length) return null;
    const sum = items.reduce((s, c) => s + W[c.verdict], 0);
    return Math.round((sum / items.length) * 100);
  }

  const out = {
    url: start,
    finalUrl,
    fetchedStatus: res.status,
    scores: { seo: score("seo"), geo: score("geo") },
    needsReview: Object.entries(checks)
      .filter(([, c]) => c.verdict === "needs_review")
      .map(([k]) => k),
    checks,
  };
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.log(JSON.stringify({ error: e.message }));
  process.exit(1);
});
