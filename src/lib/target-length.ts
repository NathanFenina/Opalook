/**
 * Longueur cible d'un texte, déduite du top 10 réel.
 *
 * « Combien de caractères ? » n'a pas de bonne réponse générale. Sur « grossiste
 * bijoux » les dix premiers publient des pages longues ; sur « bracelet ambre
 * bébé » ils tiennent en quelques lignes. Viser 5 000 caractères partout produit
 * des textes gonflés là où personne n'en lit, et courts là où il faudrait
 * couvrir. La seule référence utilisable est ce que Google classe déjà sur CE
 * mot-clé, dans CETTE langue.
 *
 * Ce qu'on mesure et ce qu'on ne mesure pas
 * ----------------------------------------
 * On ne compte pas tout le texte visible d'une page catégorie : une grille de
 * cent produits pèse plus lourd que n'importe quelle prose, et le total ne
 * dirait plus rien de la rédaction. On ne retient donc que ce qui ressemble à de
 * la prose — les paragraphes d'une longueur minimale, et les intertitres. Une
 * vignette produit ne contient pas de paragraphe de cent vingt caractères ; un
 * texte de catégorie, oui.
 *
 * C'est une approximation, et elle se lit comme telle : le détail par page est
 * renvoyé avec le verdict, pour qu'un chiffre aberrant se repère au lieu de se
 * propager.
 *
 * On prend la médiane, pas la moyenne : un concurrent avec un article de blog de
 * 30 000 caractères dans le top 10 ne doit pas déplacer la cible à lui seul.
 */

import * as cheerio from "cheerio";

/** En dessous, un « paragraphe » est une étiquette, un prix ou un nom de produit. */
const PROSE_MIN = 120;

/** Au-delà, on n'attend plus de gain SEO, seulement du texte que personne ne lit. */
const MAX_TARGET = 12000;
/** En dessous, la page n'a plus de quoi couvrir un sujet marchand. */
const MIN_TARGET = 1500;

const FETCH_TIMEOUT_MS = 12000;
/** Assez pour ne pas attendre dix pages en série, assez peu pour rester poli. */
const CONCURRENCY = 4;

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export type PageMeasure = {
  rank: number;
  domain: string;
  url: string;
  /** Caractères de prose relevés, ou null si la page n'a pas pu être lue. */
  length: number | null;
  raison?: string;
};

export type TargetLength = {
  /** Longueur visée, en caractères. Null si aucune page n'a pu être mesurée. */
  target: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  /** Nombre de pages effectivement lues. */
  mesurees: number;
  pages: PageMeasure[];
  measuredAt: string;
  /** Ce que la mesure ne garantit pas, à afficher tel quel. */
  reserve: string;
};

/** Longueur de prose d'un document HTML. */
export function proseLength(html: string): number {
  const $ = cheerio.load(html);

  // Ces blocs sont présents sur toutes les pages du site : les compter
  // mesurerait le gabarit, pas le contenu.
  $("script, style, noscript, nav, header, footer, aside, form, select, template").remove();

  let total = 0;

  $("p, li, h2, h3, h4").each((_, element) => {
    const text = $(element).text().replace(/\s+/g, " ").trim();
    if (!text) return;

    // Les intertitres comptent quelle que soit leur longueur : ils structurent
    // le texte et pèsent dans le volume rédactionnel.
    const isHeading = ["h2", "h3", "h4"].includes(
      (element as { tagName?: string }).tagName?.toLowerCase() ?? "",
    );
    if (isHeading || text.length >= PROSE_MIN) total += text.length;
  });

  return total;
}

async function measureOne(result: {
  rank: number;
  url: string;
  domain: string;
}): Promise<PageMeasure> {
  const base = { rank: result.rank, domain: result.domain, url: result.url };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(result.url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return { ...base, length: null, raison: `HTTP ${response.status}` };
    }

    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("html")) {
      return { ...base, length: null, raison: `type ${type || "inconnu"}` };
    }

    return { ...base, length: proseLength(await response.text()) };
  } catch (error) {
    const message = (error as Error).name === "AbortError"
      ? "délai dépassé"
      : (error as Error).message;
    return { ...base, length: null, raison: message };
  } finally {
    clearTimeout(timer);
  }
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

/**
 * Mesure le top N d'une SERP et en déduit la longueur à viser.
 *
 * Les pages sont lues par petits paquets : dix requêtes simultanées vers dix
 * sites différents finissent par ressembler à un scan, et rien n'oblige à aller
 * plus vite.
 *
 * Un échec sur une page n'en est pas un sur la mesure : la médiane de sept pages
 * vaut celle de dix. En revanche une médiane sur une seule page ne vaut rien, et
 * c'est ce que dit `mesurees`.
 */
export async function measureTargetLength(
  results: { rank: number; url: string; domain: string }[],
  top = 10,
): Promise<TargetLength> {
  const cibles = results
    .filter((result) => /^https?:\/\//i.test(result.url))
    .slice(0, top);

  const pages: PageMeasure[] = [];
  for (let i = 0; i < cibles.length; i += CONCURRENCY) {
    const lot = cibles.slice(i, i + CONCURRENCY);
    pages.push(...(await Promise.all(lot.map(measureOne))));
  }

  const lengths = pages
    .map((page) => page.length)
    .filter((length): length is number => length !== null && length > 0);

  const med = median(lengths);

  // Arrondi à la centaine : un objectif à 4 637 caractères donnerait l'illusion
  // d'une précision que la méthode n'a pas.
  const target =
    med === null
      ? null
      : Math.min(MAX_TARGET, Math.max(MIN_TARGET, Math.round(med / 100) * 100));

  return {
    target,
    median: med,
    min: lengths.length > 0 ? Math.min(...lengths) : null,
    max: lengths.length > 0 ? Math.max(...lengths) : null,
    mesurees: lengths.length,
    pages: pages.sort((a, b) => a.rank - b.rank),
    measuredAt: new Date().toISOString(),
    reserve:
      "Mesure des paragraphes et intertitres uniquement : les noms de produits, " +
      "menus et pieds de page sont exclus. Une page qui charge son texte en " +
      "JavaScript est comptée à zéro et n'entre pas dans la médiane.",
  };
}
