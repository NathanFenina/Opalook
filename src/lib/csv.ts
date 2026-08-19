/**
 * Lecture tolérante de CSV d'outils SEO.
 *
 * Search Console, Semrush et les exports maison ne s'accordent sur rien :
 * séparateur, casse des en-têtes, langue des colonnes, virgule ou point
 * décimal, guillemets ou non. Plutôt que d'imposer un format, on détecte.
 */

/** Retire l'ordre des octets, la casse et les diacritiques d'un en-tête. */
export function normalizeHeader(value: string): string {
  return value
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/"/g, "");
}

/** Le séparateur le plus présent dans la ligne d'en-tête l'emporte. */
export function detectDelimiter(headerLine: string): string {
  const counts = [
    { delimiter: ",", n: (headerLine.match(/,/g) ?? []).length },
    { delimiter: ";", n: (headerLine.match(/;/g) ?? []).length },
    { delimiter: "\t", n: (headerLine.match(/\t/g) ?? []).length },
  ];
  return counts.sort((a, b) => b.n - a.n)[0].delimiter;
}

/** Découpe une ligne CSV en respectant les guillemets et les doublements. */
export function splitLine(line: string, delimiter: string): string[] {
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

/**
 * Convertit une cellule en nombre. Absorbe les pourcentages, les espaces
 * insécables des milliers et la virgule décimale française.
 */
export function toNumber(value: string): number {
  const cleaned = value
    .replace(/\s/g, "")
    .replace(/ /g, "")
    .replace(/%/g, "")
    .replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export type ParsedTable = {
  headers: string[];
  rows: string[][];
  delimiter: string;
};

/** Découpe le contenu en en-têtes normalisés et lignes de cellules. */
export function parseTable(content: string): ParsedTable {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error("Fichier vide ou sans ligne de données.");
  }

  const delimiter = detectDelimiter(lines[0]);
  return {
    headers: splitLine(lines[0], delimiter).map(normalizeHeader),
    rows: lines.slice(1).map((line) => splitLine(line, delimiter)),
    delimiter,
  };
}

/** Position de la première colonne dont l'en-tête figure parmi les alias. */
export function findColumn(headers: string[], aliases: string[]): number {
  const normalized = aliases.map(normalizeHeader);
  return headers.findIndex((header) => normalized.includes(header));
}
