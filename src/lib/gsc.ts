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

export function parseGscCsv(content: string): GscRow[] {
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

  if (pageIndex === -1 || queryIndex === -1) {
    throw new GscParseError(
      `Le fichier doit contenir une colonne page ET une colonne requête sur la même ligne. ` +
        `En-têtes trouvés : ${headers.join(", ")}. ` +
        `L'export standard de Search Console sépare les deux et ne convient pas — ` +
        `utilise un export Looker Studio « URL Impression » avec les dimensions Landing Page + Query.`,
    );
  }

  const clicksIndex = indexOf("clicks");
  const impressionsIndex = indexOf("impressions");
  const ctrIndex = indexOf("ctr");
  const positionIndex = indexOf("position");

  const rows: GscRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitLine(line, delimiter);
    const page = cells[pageIndex] ?? "";
    const query = cells[queryIndex] ?? "";
    if (!page || !query) continue;

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
    throw new GscParseError("Aucune ligne exploitable : page ou requête vide partout.");
  }

  return rows;
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
