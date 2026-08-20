/**
 * Extraction d'une page catégorie e-commerce.
 *
 * Récupère tout ce dont la moulinette a besoin pour rédiger : les balises
 * actuelles, la structure Hn, le texte SEO en place, les produits listés et les
 * facettes de filtrage. Les produits et les filtres sont la matière première la
 * plus utile — ce sont eux qui rendent chaque texte réellement différent d'une
 * catégorie à l'autre.
 *
 * Écrit pour PrestaShop en priorité (sélecteurs du thème classic et de ses
 * dérivés), avec des repêchages génériques. `diagnostics` indique quel sélecteur
 * a répondu, pour pouvoir affiner sur un thème custom sans deviner.
 */

import * as cheerio from "cheerio";

import {
  fetchPageHtml as fetchViaDataForSeo,
  hasDataForSeoCredentials,
} from "@/lib/dataforseo";
import {
  fetchPageHtml as fetchViaFirecrawl,
  hasFirecrawlCredentials,
} from "@/lib/firecrawl";

export type Facet = { name: string; values: string[] };

export type Extraction = {
  url: string;
  finalUrl: string;
  httpStatus: number;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  h1: string | null;
  headings: { level: 2 | 3; text: string }[];
  seoText: string | null;
  breadcrumb: string[];
  products: string[];
  productCount: number | null;
  facets: Facet[];
  diagnostics: string[];
};

export class ExtractionError extends Error {
  constructor(
    message: string,
    readonly kind:
      | "blocked"
      | "http"
      | "network"
      | "not_html"
      | "invalid_url",
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

/**
 * Laissez-passer pour franchir un pare-feu applicatif.
 *
 * Cloudflare bloque les requêtes serveur d'Opalook en 403, quelle que soit
 * l'apparence des en-têtes : il faut une autorisation explicite côté site, pas
 * une imitation de navigateur plus convaincante. La méthode robuste est une
 * règle WAF qui laisse passer les requêtes portant un en-tête secret — plus
 * fiable qu'une liste d'IP, celles de Vercel étant mouvantes.
 *
 * Renseigner EXTRACT_BYPASS_HEADER et EXTRACT_BYPASS_TOKEN côté serveur, et
 * créer la règle correspondante côté Cloudflare.
 */
function bypassHeader(): Record<string, string> {
  const name = process.env.EXTRACT_BYPASS_HEADER;
  const token = process.env.EXTRACT_BYPASS_TOKEN;
  return name && token ? { [name]: token } : {};
}

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

/* ------------------------------------------------------------------ utils */

function clean(value: string | undefined | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

/** Texte d'un bloc en préservant les sauts de paragraphe. */
function blockText($: cheerio.CheerioAPI, el: cheerio.Cheerio<never>): string {
  const parts: string[] = [];
  el.find("h2, h3, h4, p, li").each((_, node) => {
    const tag = node.tagName?.toLowerCase();
    const text = clean($(node).text());
    if (!text) return;
    if (tag === "h2") parts.push(`## ${text}`);
    else if (tag === "h3") parts.push(`### ${text}`);
    else if (tag === "h4") parts.push(`#### ${text}`);
    else if (tag === "li") parts.push(`- ${text}`);
    else parts.push(text);
  });
  if (parts.length === 0) {
    const flat = clean(el.text());
    return flat;
  }
  return parts.join("\n\n");
}

function firstMatch(
  $: cheerio.CheerioAPI,
  selectors: string[],
  diagnostics: string[],
  label: string,
): cheerio.Cheerio<never> | null {
  for (const selector of selectors) {
    const found = $(selector).first() as unknown as cheerio.Cheerio<never>;
    if (found.length > 0 && clean(found.text()).length > 0) {
      diagnostics.push(`${label}: "${selector}"`);
      return found;
    }
  }
  diagnostics.push(`${label}: aucun sélecteur n'a répondu`);
  return null;
}

/* -------------------------------------------------------------- sélecteurs */

const SEO_TEXT_SELECTORS = [
  "#category-description",
  ".category-description",
  "#category_description",
  ".category-description-bottom",
  "#js-product-list-header .block-category",
  ".block-category .category-description",
  "[itemprop='description']",
  ".seo-text",
  ".cms-description",
];

const PRODUCT_SELECTORS = [
  "article.product-miniature .product-title",
  ".product-miniature .product-title",
  ".js-product-miniature .product-title",
  ".product-miniature h3",
  ".ajax_block_product .product-name",
  ".product_list .product-name",
  "[itemtype*='Product'] [itemprop='name']",
];

const FACET_BLOCK_SELECTORS = [
  "#search_filters .facet",
  "#search_filters_wrapper .facet",
  ".facet",
  "#layered_block_left .layered_filter",
  "#search_filters section",
];

/* ------------------------------------------------------------ extraction */

function parse(html: string, url: string, finalUrl: string, httpStatus: number): Extraction {
  const $ = cheerio.load(html);
  const diagnostics: string[] = [];

  const title = clean($("head title").first().text()) || null;

  // Le repli DataForSEO intervient avant d'arriver ici. Si un challenge passe
  // quand même, c'est que la protection résiste aussi à leurs crawleurs.
  if (title && /just a moment|un instant|attention required|access denied/i.test(title)) {
    throw new ExtractionError(
      `Page de challenge anti-robot reçue (titre : « ${title} »), y compris après repli. ` +
        `Il faut une autorisation explicite côté site : règle Cloudflare avec en-tête secret, ` +
        `ou API PrestaShop.`,
      "blocked",
    );
  }

  const metaDescription =
    clean($("meta[name='description']").attr("content")) || null;
  const canonical = clean($("link[rel='canonical']").attr("href")) || null;
  const h1 = clean($("h1").first().text()) || null;

  // On ignore les Hn de la navigation et des blocs latéraux : seuls ceux du
  // contenu nous renseignent sur la structure éditoriale réelle.
  const headings: { level: 2 | 3; text: string }[] = [];
  $("main h2, main h3, #content h2, #content h3, #main h2, #main h3").each(
    (_, node) => {
      const text = clean($(node).text());
      if (!text) return;
      const level = node.tagName.toLowerCase() === "h2" ? 2 : 3;
      if (!headings.some((h) => h.text === text)) headings.push({ level, text });
    },
  );

  const seoBlock = firstMatch($, SEO_TEXT_SELECTORS, diagnostics, "texte SEO");
  const seoText = seoBlock ? blockText($, seoBlock) || null : null;

  const breadcrumb: string[] = [];
  $(".breadcrumb li, nav[aria-label='breadcrumb'] li, #wrapper .breadcrumb a").each(
    (_, node) => {
      const text = clean($(node).text());
      if (text && !breadcrumb.includes(text)) breadcrumb.push(text);
    },
  );

  const products: string[] = [];
  for (const selector of PRODUCT_SELECTORS) {
    $(selector).each((_, node) => {
      const text = clean($(node).text());
      if (text && !products.includes(text)) products.push(text);
    });
    if (products.length > 0) {
      diagnostics.push(`produits: "${selector}" (${products.length})`);
      break;
    }
  }
  if (products.length === 0) diagnostics.push("produits: aucun sélecteur n'a répondu");

  const countText = clean(
    $("#js-product-list-top .total-products, .total-products, .heading-counter").first().text(),
  );
  const countMatch = countText.match(/(\d[\d\s.,]*)/);
  const productCount = countMatch
    ? Number(countMatch[1].replace(/[^\d]/g, "")) || null
    : null;

  const facets: Facet[] = [];
  for (const blockSelector of FACET_BLOCK_SELECTORS) {
    $(blockSelector).each((_, node) => {
      const block = $(node);
      const name = clean(
        block.find(".facet-title, .facet-label-title, h3, .layered_subtitle").first().text(),
      );
      const values: string[] = [];
      block.find("label .facet-label, label, li a").each((_, valueNode) => {
        const text = clean($(valueNode).text());
        if (text && text !== name && text.length < 60 && !values.includes(text)) {
          values.push(text);
        }
      });
      if (name && values.length > 0 && !facets.some((f) => f.name === name)) {
        facets.push({ name, values: values.slice(0, 40) });
      }
    });
    if (facets.length > 0) {
      diagnostics.push(`filtres: "${blockSelector}" (${facets.length} facettes)`);
      break;
    }
  }
  if (facets.length === 0) diagnostics.push("filtres: aucun sélecteur n'a répondu");

  return {
    url,
    finalUrl,
    httpStatus,
    title,
    metaDescription,
    canonical,
    h1,
    headings,
    seoText,
    breadcrumb,
    products: products.slice(0, 60),
    productCount,
    facets,
    diagnostics,
  };
}

/** Une réponse de challenge anti-robot ressemble à du HTML valide : on la reconnaît au titre. */
function looksLikeChallenge(html: string): boolean {
  return /<title[^>]*>\s*(just a moment|un instant|attention required|access denied)/i.test(html);
}

/**
 * Récupère et analyse une page catégorie.
 *
 * Tente d'abord la requête directe. Si le site la refuse — pare-feu applicatif,
 * page de challenge — bascule sur l'infrastructure de crawl de DataForSEO,
 * dont les IP et le rendu navigateur passent là où les nôtres échouent. Les
 * sélecteurs d'analyse sont les mêmes dans les deux cas : seule la façon
 * d'obtenir le HTML change. `diagnostics` indique la voie empruntée.
 */
export async function extractFromUrl(rawUrl: string): Promise<Extraction> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ExtractionError(`URL invalide : ${rawUrl}`, "invalid_url");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new ExtractionError(`Protocole non supporté : ${url.protocol}`, "invalid_url");
  }

  let directFailure: string | null = null;
  let html: string | null = null;
  let status = 0;
  let finalUrl = rawUrl;

  try {
    const response = await fetch(url, {
      headers: { ...BROWSER_HEADERS, ...bypassHeader() },
      redirect: "follow",
      cache: "no-store",
    });

    const contentType = response.headers.get("content-type") ?? "";
    const body = await response.text();

    if (response.ok && contentType.includes("html") && !looksLikeChallenge(body)) {
      html = body;
      status = response.status;
      finalUrl = response.url || rawUrl;
    } else if (!response.ok) {
      directFailure = `${url.hostname} a répondu ${response.status}`;
    } else if (!contentType.includes("html")) {
      directFailure = `réponse non HTML (${contentType || "type inconnu"})`;
    } else {
      directFailure = "page de challenge anti-robot";
    }
  } catch (error) {
    directFailure = (error as Error).message;
  }

  const diagnostics: string[] = [];

  if (html === null) {
    // Cascade de replis, du plus efficace au moins coûteux. Firecrawl d'abord :
    // proxies résidentiels et rendu navigateur, c'est son métier. DataForSEO
    // ensuite, déjà payé pour la SERP.
    const fallbacks: { name: string; available: boolean; fetch: () => Promise<string> }[] = [
      {
        name: "Firecrawl",
        available: hasFirecrawlCredentials(),
        fetch: () => fetchViaFirecrawl(rawUrl),
      },
      {
        name: "DataForSEO",
        available: hasDataForSeoCredentials(),
        fetch: () => fetchViaDataForSeo(rawUrl),
      },
    ];

    const attempts: string[] = [];

    for (const fallback of fallbacks) {
      if (!fallback.available) {
        attempts.push(`${fallback.name} non configuré`);
        continue;
      }
      try {
        html = await fallback.fetch();
        diagnostics.push(
          `accès : direct refusé (${directFailure}), page récupérée via ${fallback.name}`,
        );
        break;
      } catch (error) {
        attempts.push(`${fallback.name} : ${(error as Error).message}`);
      }
    }

    if (html === null) {
      throw new ExtractionError(
        `Accès direct refusé (${directFailure}). Replis épuisés — ${attempts.join(" | ")}`,
        "blocked",
      );
    }
  } else {
    diagnostics.push("accès : direct");
  }

  const extraction = parse(html, rawUrl, finalUrl, status);
  extraction.diagnostics = [...diagnostics, ...extraction.diagnostics];
  return extraction;
}
