/**
 * Lecture d'un export de catalogue PrestaShop.
 *
 * Le fichier fourni par le client porte une ligne par catégorie et, par langue,
 * quatre colonnes : `name_xx`, `link_rewrite_xx`, `url_xx`, `description_xx`,
 * `additional_description_xx`. On en tire trois choses que le reste de l'outil
 * n'a nulle part ailleurs :
 *
 *  1. la liste faisant autorité des catégories actives — plus fiable qu'une
 *     déduction depuis un export Search Console, qui ne voit que les URL ayant
 *     reçu des impressions ;
 *  2. l'arborescence (`id_parent`), sans laquelle on ne peut pas différencier un
 *     texte de sa catégorie mère et de ses sœurs, ce qu'exige la règle métier ;
 *  3. les descriptions déjà en ligne, courte et longue, qui disent ce qu'il
 *     faut remplacer.
 *
 * Le parseur ne peut pas se contenter d'un découpage ligne à ligne : les
 * descriptions sont du HTML entre guillemets et contiennent des retours à la
 * ligne. Il faut donc un automate qui suit l'état « dans les guillemets ».
 */

import { detectDelimiter, normalizeHeader } from "@/lib/csv";

export class CatalogueParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogueParseError";
  }
}

export type CatalogueRow = {
  externalId: number;
  parentExternalId: number | null;
  productsCount: number | null;
  name: string;
  url: string;
  shortDescription: string | null;
  longDescription: string | null;
};

export type CatalogueParseResult = {
  rows: CatalogueRow[];
  /** Langues détectées dans les en-têtes, dans l'ordre du fichier. */
  locales: string[];
  /** Langue effectivement lue. */
  locale: string;
  /** Lignes écartées, avec la raison — un import muet cache toujours un écart. */
  skipped: { line: number; reason: string }[];
};

/**
 * Découpe le contenu en enregistrements, en respectant les guillemets.
 *
 * Un retour à la ligne entre guillemets appartient à la cellule ; ailleurs il
 * termine l'enregistrement. Les guillemets doublés valent un guillemet
 * littéral, comme le veut la RFC 4180.
 */
function parseRecords(content: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = "";
  let inQuotes = false;

  const pushCell = () => {
    record.push(cell);
    cell = "";
  };
  const pushRecord = () => {
    pushCell();
    // Une ligne vide en fin de fichier ne fait pas un enregistrement.
    if (record.length > 1 || record[0] !== "") records.push(record);
    record = [];
  };

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      pushCell();
    } else if (char === "\r") {
      // Absorbé : c'est le \n qui suit qui termine l'enregistrement.
    } else if (char === "\n") {
      pushRecord();
    } else {
      cell += char;
    }
  }

  if (cell !== "" || record.length > 0) pushRecord();
  return records;
}

/** Langues présentes, déduites des colonnes `name_xx`. */
function detectLocales(headers: string[]): string[] {
  const out: string[] = [];
  for (const header of headers) {
    const match = header.match(/^name_([a-z]{2})$/);
    if (match && !out.includes(match[1])) out.push(match[1]);
  }
  return out;
}

/**
 * Retire le balisage d'une description PrestaShop.
 *
 * On garde le texte, pas le HTML : ce contenu sert à montrer ce qui est en
 * ligne et à donner au modèle la matière existante, pas à être republié tel
 * quel.
 */
function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&rsquo;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toInt(value: string): number | null {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Lit un export de catalogue et renvoie les catégories d'une langue.
 *
 * `locale` par défaut : la première langue du fichier, qui est le français dans
 * les deux catalogues fournis. La signature accepte les autres dès maintenant :
 * le passage au multilingue ne demandera pas de retoucher le parseur.
 */
export function parseCatalogueCsv(
  content: string,
  locale?: string,
): CatalogueParseResult {
  const firstLine = content.split(/\r?\n/, 1)[0] ?? "";
  if (!firstLine.trim()) throw new CatalogueParseError("Fichier vide.");

  const delimiter = detectDelimiter(firstLine);
  const records = parseRecords(content, delimiter);
  if (records.length < 2) {
    throw new CatalogueParseError("Fichier sans ligne de données.");
  }

  const headers = records[0].map(normalizeHeader);
  const locales = detectLocales(headers);
  if (locales.length === 0) {
    throw new CatalogueParseError(
      "Aucune colonne « name_xx » trouvée. Attendu : un export PrestaShop avec " +
        "id_category, id_parent, puis name_fr, url_fr, description_fr… par langue.",
    );
  }

  const chosen = locale && locales.includes(locale) ? locale : locales[0];
  const index = (name: string) => headers.indexOf(name);

  const idColumn = index("id_category");
  const nameColumn = index(`name_${chosen}`);
  const urlColumn = index(`url_${chosen}`);
  if (idColumn < 0 || nameColumn < 0 || urlColumn < 0) {
    throw new CatalogueParseError(
      `Colonnes manquantes pour la langue « ${chosen} » : id_category, name_${chosen} et url_${chosen} sont requises.`,
    );
  }

  const parentColumn = index("id_parent");
  const countColumn = index("products_count");
  const shortColumn = index(`description_${chosen}`);
  const longColumn = index(`additional_description_${chosen}`);

  const rows: CatalogueRow[] = [];
  const skipped: { line: number; reason: string }[] = [];
  const seen = new Set<number>();

  for (let i = 1; i < records.length; i++) {
    const cells = records[i];
    const cell = (position: number) =>
      position >= 0 ? (cells[position] ?? "").trim() : "";

    const externalId = toInt(cell(idColumn));
    const url = cell(urlColumn);
    const name = cell(nameColumn);

    if (externalId === null) {
      skipped.push({ line: i + 1, reason: "id_category illisible" });
      continue;
    }
    if (!/^https?:\/\//i.test(url)) {
      skipped.push({ line: i + 1, reason: `pas d'URL en ${chosen}` });
      continue;
    }
    if (seen.has(externalId)) {
      skipped.push({ line: i + 1, reason: `id_category ${externalId} en double` });
      continue;
    }
    seen.add(externalId);

    // PrestaShop rattache les catégories de premier niveau à elles-mêmes plutôt
    // qu'à la racine. Laisser passer ça ferait d'une catégorie sa propre mère,
    // et de ses filles ses sœurs : on remet la racine à null.
    const rawParent = parentColumn >= 0 ? toInt(cell(parentColumn)) : null;
    const parent = rawParent === externalId ? null : rawParent;
    const short = stripHtml(cell(shortColumn));
    const long = stripHtml(cell(longColumn));

    rows.push({
      externalId,
      parentExternalId: parent,
      productsCount: countColumn >= 0 ? toInt(cell(countColumn)) : null,
      name: name || url,
      url,
      shortDescription: short || null,
      longDescription: long || null,
    });
  }

  if (rows.length === 0) {
    throw new CatalogueParseError(
      `Aucune catégorie exploitable pour la langue « ${chosen} ».`,
    );
  }

  return { rows, locales, locale: chosen, skipped };
}

/* --------------------------------------------------------------- famille -- */

export type FamilyMember = {
  name: string;
  url: string;
  keyword: string | null;
  editorialAngle?: string | null;
};

export type Family = {
  parent: FamilyMember | null;
  /** Catégories partageant la même mère. */
  siblings: FamilyMember[];
  /** Catégories filles directes. */
  children: FamilyMember[];
};

type FamilyInput = {
  id: string;
  external_id: number | null;
  parent_external_id: number | null;
  name: string;
  url: string;
  target_keyword: string | null;
};

/**
 * Situe une catégorie dans son arborescence.
 *
 * La règle métier l'exige noir sur blanc : deux textes interchangeables où seul
 * le nom change sont un échec, et c'est de la mère et des sœurs qu'il faut se
 * démarquer en premier — ce sont elles qui parlent du même univers.
 */
export function buildFamily(
  target: FamilyInput,
  all: FamilyInput[],
  angles: Map<string, string | null> = new Map(),
): Family {
  const member = (row: FamilyInput): FamilyMember => ({
    name: row.name,
    url: row.url,
    keyword: row.target_keyword,
    editorialAngle: angles.get(row.id) ?? null,
  });

  const parentId = target.parent_external_id;
  const parent =
    parentId === null
      ? null
      : (all.find((row) => row.external_id === parentId) ?? null);

  // Les catégories de premier niveau sont sœurs entre elles : ce sont les
  // grands univers du site, et rien n'oblige plus à les différencier que deux
  // sous-catégories d'une même mère.
  const siblings = all.filter(
    (row) =>
      row.id !== target.id &&
      row.external_id !== null &&
      row.parent_external_id === parentId,
  );

  const children =
    target.external_id === null
      ? []
      : all.filter((row) => row.parent_external_id === target.external_id);

  return {
    parent: parent ? member(parent) : null,
    siblings: siblings.map(member),
    children: children.map(member),
  };
}
