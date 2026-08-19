/**
 * Lecture d'un export GSC croisant page et requête.
 *
 * L'export standard de l'interface Search Console ne convient pas : il livre
 * `Requêtes.csv` et `Pages.csv` côte à côte, sans jointure entre les deux. Pour
 * savoir sur quoi rank une URL précise, il faut un export qui porte les deux
 * dimensions sur la même ligne (Looker Studio « URL Impression », l'API, ou un
 * connecteur type Supermetrics).
 *
 * Le parseur est volontairement tolérant sur les en-têtes : français ou
 * anglais, ordre libre, séparateur virgule, point-virgule ou tabulation.
 */

export type GscRow = {
  page: string;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export class GscParseError extends Error {}

const HEADER_ALIASES: Record<keyof GscRow, string[]> = {
  page: ["page", "pages", "landing page", "page de destination", "url", "adresse", "top pages", "pages les plus populaires"],
  query: ["query", "queries", "requête", "requêtes", "requetes", "mot-clé", "mot clé", "search query", "requêtes les plus fréquentes"],
  clicks: ["clicks", "clics", "url clicks", "clics sur l'url"],
  impressions: ["impressions", "url impressions", "impressions de l'url"],
  ctr: ["ctr", "taux de clics", "url ctr"],
  position: ["position", "position moyenne", "average position", "url position"],
};

function normalizeHeader(value: string): string {
  return value
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/"/g, "");
}

function detectDelimiter(headerLine: string): string {
  const counts = [
    { d: ",", n: (headerLine.match(/,/g) ?? []).length },
    { d: ";", n: (headerLine.match(/;/g) ?? []).length },
    { d: "\t", n: (headerLine.match(/\t/g) ?? []).length },
  ];
  return counts.sort((a, b) => b.n - a.n)[0].d;
}

/** Découpe une ligne CSV en respectant les guillemets. */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      out.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  out.push(current);
  return out.map((value) => value.trim());
}

function toNumber(value: string): number {
  const cleaned = value
    .replace(/\s/g, "")
    .replace(/%/g, "")
    .replace(/ /g, "")
    .replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export type ParsedGsc = {
  rows: GscRow[];
  /** Faux pour un export « Pages » : métriques par URL, sans le détail des requêtes. */
  hasQuery: boolean;
};

export function parseGscCsv(content: string): ParsedGsc {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new GscParseError("Fichier vide ou sans ligne de données.");
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delimiter).map(normalizeHeader);

  const indexOf = (field: keyof GscRow): number => {
    const aliases = HEADER_ALIASES[field].map(normalizeHeader);
    return headers.findIndex((header) => aliases.includes(header));
  };

  const pageIndex = indexOf("page");
  const queryIndex = indexOf("query");

  if (pageIndex === -1) {
    throw new GscParseError(
      `Aucune colonne d'URL trouvée. En-têtes lus : ${headers.join(", ")}. ` +
        `Attendu une colonne « Pages les plus populaires », « Landing Page », « Page » ou « URL ».`,
    );
  }

  // Sans dimension requête, l'export reste utile : les métriques par URL
  // suffisent à prioriser les catégories. Le détail des requêtes viendra d'un
  // export croisant page et requête.
  const hasQuery = queryIndex !== -1;

  const clicksIndex = indexOf("clicks");
  const impressionsIndex = indexOf("impressions");
  const ctrIndex = indexOf("ctr");
  const positionIndex = indexOf("position");

  const rows: GscRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitLine(line, delimiter);
    const page = cells[pageIndex] ?? "";
    const query = hasQuery ? (cells[queryIndex] ?? "") : "";
    if (!page) continue;
    if (hasQuery && !query) continue;

    rows.push({
      page,
      query,
      clicks: clicksIndex === -1 ? 0 : toNumber(cells[clicksIndex] ?? ""),
      impressions: impressionsIndex === -1 ? 0 : toNumber(cells[impressionsIndex] ?? ""),
      ctr: ctrIndex === -1 ? 0 : toNumber(cells[ctrIndex] ?? ""),
      position: positionIndex === -1 ? 0 : toNumber(cells[positionIndex] ?? ""),
    });
  }

  if (rows.length === 0) {
    throw new GscParseError("Aucune ligne exploitable : colonne d'URL vide partout.");
  }

  return { rows, hasQuery };
}

/**
 * Potentiel d'une catégorie : le volume déjà capté, pondéré par la marge de
 * progression que laisse sa position.
 *
 * Une page en position 12 avec 3 000 impressions vaut bien plus qu'une page en
 * position 2 avec le même volume : la première a tout à gagner, la seconde n'a
 * presque plus rien à prendre. Les positions au-delà de 30 sont dépondérées —
 * remonter de la page 4 demande davantage qu'une réécriture de texte.
 */
export function opportunityScore(impressions: number, position: number): number {
  const weight =
    position < 4
      ? 0.15
      : position <= 10
        ? 1
        : position <= 20
          ? 0.9
          : position <= 30
            ? 0.5
            : 0.25;
  return Math.round(impressions * weight);
}

/** Normalise une URL pour rapprocher les lignes GSC des catégories enregistrées. */
export function urlKey(rawUrl: string): string {
  try {
    const url = new URL(rawUrl.trim());
    return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return rawUrl.trim().replace(/\/$/, "").toLowerCase();
  }
}

/** Regroupe les lignes par URL, triées par impressions décroissantes. */
export function groupByPage(rows: GscRow[]): Map<string, GscRow[]> {
  const grouped = new Map<string, GscRow[]>();
  for (const row of rows) {
    const key = urlKey(row.page);
    const bucket = grouped.get(key);
    if (bucket) bucket.push(row);
    else grouped.set(key, [row]);
  }
  for (const bucket of grouped.values()) {
    bucket.sort((a, b) => b.impressions - a.impressions);
  }
  return grouped;
}

/**
 * Détecte la cannibalisation : une même requête portée par plusieurs URL.
 * Ne retient que les cas où la requête pèse réellement sur chacune des pages.
 */
export function findCannibalization(
  rows: GscRow[],
  minImpressions = 10,
): { query: string; pages: { page: string; impressions: number; position: number }[] }[] {
  const byQuery = new Map<string, GscRow[]>();
  for (const row of rows) {
    if (row.impressions < minImpressions) continue;
    const key = row.query.toLowerCase();
    const bucket = byQuery.get(key);
    if (bucket) bucket.push(row);
    else byQuery.set(key, [row]);
  }

  const conflicts: {
    query: string;
    pages: { page: string; impressions: number; position: number }[];
  }[] = [];

  for (const [query, bucket] of byQuery) {
    const pages = new Map<string, { page: string; impressions: number; position: number }>();
    for (const row of bucket) {
      const key = urlKey(row.page);
      const existing = pages.get(key);
      if (existing) {
        existing.impressions += row.impressions;
      } else {
        pages.set(key, {
          page: row.page,
          impressions: row.impressions,
          position: row.position,
        });
      }
    }
    if (pages.size > 1) {
      conflicts.push({
        query,
        pages: [...pages.values()].sort((a, b) => b.impressions - a.impressions),
      });
    }
  }

  return conflicts.sort(
    (a, b) =>
      b.pages.reduce((s, p) => s + p.impressions, 0) -
      a.pages.reduce((s, p) => s + p.impressions, 0),
  );
}

/* ------------------------------------------- reconnaissance des catégories */

/**
 * Reconnaît une URL de catégorie PrestaShop dans un lot d'URL mélangées.
 *
 * Nomenclature observée sur opalook.eu :
 *   catégorie -> /fr/13-grossiste-bijoux-revendeur-professionnel
 *   produit   -> /fr/<categorie>/1234-nom-du-produit.html
 *
 * Deux signaux discriminants : la catégorie tient en deux segments
 * (langue + identifiant-slug) et ne porte pas d'extension .html, là où la fiche
 * produit descend d'un cran et se termine par .html. On refuse aussi tout ce qui
 * porte une chaîne de requête : ce sont les URL à facettes, pas les catégories.
 */
export function looksLikeCategoryUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return false;
  }

  if (url.search) return false;

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 2) return false;

  const [lang, slug] = segments;
  if (!/^[a-z]{2}(-[a-z]{2})?$/i.test(lang)) return false;
  if (slug.endsWith(".html")) return false;

  return /^\d+-[a-z0-9]/i.test(slug);
}

/** Dérive un nom lisible depuis le slug : "13-grossiste-bijoux-pro" -> "Grossiste bijoux pro". */
export function nameFromUrl(rawUrl: string): string {
  try {
    const segment = new URL(rawUrl).pathname.split("/").filter(Boolean).pop() ?? rawUrl;
    const words = segment
      .replace(/\.html$/i, "")
      .replace(/^\d+[-_]/, "")
      .replace(/[-_]+/g, " ")
      .trim();
    return words.charAt(0).toUpperCase() + words.slice(1);
  } catch {
    return rawUrl;
  }
}
