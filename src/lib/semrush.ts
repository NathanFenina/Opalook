/**
 * Lecture d'un export Semrush de volumes et difficulté.
 *
 * Couvre les exports Keyword Overview / Bulk Analysis / Keyword Magic Tool,
 * en anglais comme en français, sans imposer un ordre de colonnes. Seule la
 * colonne mot-clé est obligatoire : un export réduit au couple mot-clé/volume
 * reste utile.
 */

import { findColumn, parseTable, toNumber } from "@/lib/csv";

export type SemrushRow = {
  keyword: string;
  volume: number | null;
  difficulty: number | null;
  cpc: number | null;
  intent: string | null;
};

export class SemrushParseError extends Error {}

const ALIASES = {
  keyword: ["keyword", "mot-cle", "mot cle", "requete", "keywords"],
  volume: ["volume", "search volume", "volume de recherche", "avg. search volume", "volume mensuel"],
  difficulty: [
    "keyword difficulty",
    "difficulty",
    "kd",
    "kd %",
    "difficulte",
    "difficulte du mot-cle",
  ],
  cpc: ["cpc", "cpc (usd)", "cpc (eur)", "cout par clic"],
  intent: ["intent", "intention", "search intent", "intention de recherche"],
} as const;

/** Semrush écrit parfois l'intention en codes ; on la rend lisible. */
function normalizeIntent(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;

  const map: Record<string, string> = {
    "0": "Commercial",
    "1": "Informational",
    "2": "Navigational",
    "3": "Transactional",
    c: "Commercial",
    i: "Informational",
    n: "Navigational",
    t: "Transactional",
    commercial: "Commercial",
    informational: "Informational",
    informationnel: "Informational",
    navigational: "Navigational",
    navigationnel: "Navigational",
    transactional: "Transactional",
    transactionnel: "Transactional",
  };

  return map[value] ?? raw.trim();
}

export function parseSemrushCsv(content: string): SemrushRow[] {
  let table;
  try {
    table = parseTable(content);
  } catch (error) {
    throw new SemrushParseError((error as Error).message);
  }

  const keywordIndex = findColumn(table.headers, [...ALIASES.keyword]);
  if (keywordIndex === -1) {
    throw new SemrushParseError(
      `Aucune colonne de mot-clé trouvée. En-têtes lus : ${table.headers.join(", ")}. ` +
        `Attendu une colonne « Keyword » ou « Mot-clé ».`,
    );
  }

  const volumeIndex = findColumn(table.headers, [...ALIASES.volume]);
  const difficultyIndex = findColumn(table.headers, [...ALIASES.difficulty]);
  const cpcIndex = findColumn(table.headers, [...ALIASES.cpc]);
  const intentIndex = findColumn(table.headers, [...ALIASES.intent]);

  if (volumeIndex === -1 && difficultyIndex === -1) {
    throw new SemrushParseError(
      `Ni volume ni difficulté dans ce fichier. En-têtes lus : ${table.headers.join(", ")}.`,
    );
  }

  const rows: SemrushRow[] = [];
  for (const cells of table.rows) {
    const keyword = (cells[keywordIndex] ?? "").trim();
    if (!keyword) continue;

    rows.push({
      keyword,
      volume: volumeIndex === -1 ? null : Math.round(toNumber(cells[volumeIndex] ?? "")),
      difficulty:
        difficultyIndex === -1 ? null : Math.round(toNumber(cells[difficultyIndex] ?? "")),
      cpc: cpcIndex === -1 ? null : toNumber(cells[cpcIndex] ?? ""),
      intent: intentIndex === -1 ? null : normalizeIntent(cells[intentIndex] ?? ""),
    });
  }

  if (rows.length === 0) {
    throw new SemrushParseError("Aucune ligne exploitable : colonne mot-clé vide partout.");
  }

  return rows;
}

/** Clé de rapprochement avec `categories.target_keyword`. */
export function keywordKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, " ")
    .replace(/\s+/g, " ");
}
