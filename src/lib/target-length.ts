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
  /** Intertitres de la page : ce qu'elle a jugé utile de traiter. */
  headings: string[];
  raison?: string;
};

/** Un sujet traité par plusieurs pages du top 10. */
export type Sujet = {
  titre: string;
  /** Sur combien des pages lues il revient. */
  pages: number;
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
  /**
   * Ce que traitent les pages classées, par fréquence décroissante.
   *
   * La longueur dit combien écrire, pas quoi écrire. Un sujet que six des dix
   * premiers abordent est un sujet que Google associe à cette requête : ne pas
   * le traiter, c'est accepter un désavantage qu'aucune qualité d'écriture ne
   * compense.
   */
  sujets: Sujet[];
  measuredAt: string;
  /** Ce que la mesure ne garantit pas, à afficher tel quel. */
  reserve: string;
};

/**
 * Longueur de prose et intertitres d'un document HTML.
 *
 * Les deux sortent de la même lecture parce qu'ils sortent du même nettoyage :
 * relire la page une seconde fois pour ses titres coûterait un aller-retour de
 * plus vers un site qu'on n'a pas à solliciter deux fois.
 */
export function readPage(html: string): { length: number; headings: string[] } {
  const $ = cheerio.load(html);

  // Ces blocs sont présents sur toutes les pages du site : les compter
  // mesurerait le gabarit, pas le contenu.
  $("script, style, noscript, nav, header, footer, aside, form, select, template").remove();

  const headings: string[] = [];
  $("h2, h3").each((_, element) => {
    const texte = $(element).text().replace(/\s+/g, " ").trim();
    // Un intertitre d'une page catégorie fait quelques mots. En dessous c'est
    // une étiquette de filtre, au-dessus c'est un paragraphe mal balisé.
    if (texte.length >= 8 && texte.length <= 120) headings.push(texte);
  });

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

  return { length: total, headings: headings.slice(0, 25) };
}

/** Rétro-compatibilité : la seule longueur, pour qui n'a pas besoin du reste. */
export function proseLength(html: string): number {
  return readPage(html).length;
}

async function measureOne(result: {
  rank: number;
  url: string;
  domain: string;
}): Promise<PageMeasure> {
  const base = {
    rank: result.rank,
    domain: result.domain,
    url: result.url,
    headings: [] as string[],
  };

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

    const { length, headings } = readPage(await response.text());
    return { ...base, length, headings };
  } catch (error) {
    const message = (error as Error).name === "AbortError"
      ? "délai dépassé"
      : (error as Error).message;
    return { ...base, length: null, raison: message };
  } finally {
    clearTimeout(timer);
  }
}

/** Neutralise la forme d'un intertitre pour reconnaître le même sujet ailleurs. */
function sujetKey(titre: string): string {
  return titre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Les sujets que plusieurs pages du top 10 traitent.
 *
 * Le rapprochement se fait sur les mots pleins communs plutôt que sur le titre
 * entier : « Comment choisir son collier d'ambre » et « Choisir un collier
 * d'ambre » sont le même sujet, et les compter séparément reviendrait à
 * conclure qu'aucun ne revient.
 */
function sujetsCommuns(pages: PageMeasure[]): Sujet[] {
  const VIDES = new Set([
    "le", "la", "les", "un", "une", "des", "du", "de", "au", "aux", "et", "ou",
    "en", "a", "pour", "par", "sur", "avec", "son", "sa", "ses", "nos", "notre",
    "quel", "quelle", "comment", "pourquoi", "est", "sont", "the", "and", "of",
    "for", "to", "your", "how", "what", "why", "is", "are",
  ]);

  /**
   * Racine grossière d'un mot : ses cinq premières lettres.
   *
   * « Entretien de vos bijoux » et « Entretenir un bijou en ambre » sont le même
   * sujet, et une comparaison sur les mots entiers les sépare — « entretien »
   * n'est pas « entretenir », « bijoux » n'est pas « bijou ». Une vraie
   * lemmatisation demanderait un dictionnaire par langue pour dix langues ;
   * cinq lettres attrapent l'essentiel des flexions sans rien installer, au prix
   * de quelques rapprochements abusifs sans conséquence ici — au pire deux
   * sujets voisins sont comptés comme un.
   */
  const racine = (mot: string) => mot.slice(0, 5);

  const mots = (titre: string) =>
    new Set(
      sujetKey(titre)
        .split(" ")
        .filter((mot) => mot.length > 2 && !VIDES.has(mot))
        .map(racine),
    );

  type Groupe = { titre: string; mots: Set<string>; pages: Set<number> };
  const groupes: Groupe[] = [];

  for (const page of pages) {
    // Un même intertitre répété sur une page ne compte qu'une fois pour elle.
    const vusIci = new Set<Groupe>();

    for (const titre of page.headings) {
      const cles = mots(titre);
      if (cles.size === 0) continue;

      const existant = groupes.find((groupe) => {
        const communs = [...cles].filter((mot) => groupe.mots.has(mot)).length;
        return communs >= Math.min(2, Math.min(cles.size, groupe.mots.size));
      });

      if (existant) {
        if (!vusIci.has(existant)) {
          existant.pages.add(page.rank);
          vusIci.add(existant);
        }
      } else {
        const groupe = { titre, mots: cles, pages: new Set([page.rank]) };
        groupes.push(groupe);
        vusIci.add(groupe);
      }
    }
  }

  return groupes
    .filter((groupe) => groupe.pages.size >= 2)
    .map((groupe) => ({ titre: groupe.titre, pages: groupe.pages.size }))
    .sort((a, b) => b.pages - a.pages)
    .slice(0, 15);
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
    sujets: sujetsCommuns(pages),
    measuredAt: new Date().toISOString(),
    reserve:
      "Mesure des paragraphes et intertitres uniquement : les noms de produits, " +
      "menus et pieds de page sont exclus. Une page qui charge son texte en " +
      "JavaScript est comptée à zéro et n'entre ni dans la médiane ni dans les " +
      "sujets. Le rapprochement des sujets se fait sur les mots communs : il " +
      "préfère séparer deux formulations voisines que fondre deux sujets " +
      "distincts, donc les comptes sont un plancher, jamais un plafond.",
  };
}
