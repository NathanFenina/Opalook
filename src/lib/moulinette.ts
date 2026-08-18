/**
 * La moulinette : cœur métier d'Opalook.
 *
 * Prend une page catégorie e-commerce (données brutes récupérées sur le site du
 * client) et produit une version optimisée + un audit scoré.
 *
 * v0 : moteur déterministe à base de règles, sans appel LLM. Volontairement pur
 * (aucune I/O) pour rester testable et pour qu'on puisse brancher un moteur
 * `llm` à côté sans toucher aux appelants — cf. `OptimizationEngine`.
 */

export type OptimizationEngine = "rules-v0";

export const DEFAULT_ENGINE: OptimizationEngine = "rules-v0";

/** Bornes utilisées à la fois pour générer et pour auditer. */
export const LIMITS = {
  title: { min: 45, max: 60 },
  metaDescription: { min: 140, max: 160 },
  h1: { min: 20, max: 70 },
  content: { min: 600, max: 2500 },
} as const;

export type CheckStatus = "ok" | "warn" | "fail";

export type Check = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  /** Poids du critère dans le score final. */
  weight: number;
};

export type MoulinetteInput = {
  name: string;
  url: string;
  targetKeyword: string | null;
  sourceTitle: string | null;
  sourceMetaDescription: string | null;
  sourceH1: string | null;
  sourceContent: string | null;
  brand?: string | null;
};

export type MoulinetteResult = {
  engine: OptimizationEngine;
  title: string;
  metaDescription: string;
  h1: string;
  content: string;
  score: number;
  checks: Check[];
};

/* ------------------------------------------------------------------ utils */

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, " ");
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function includesKeyword(haystack: string, keyword: string): boolean {
  if (!keyword) return false;
  return normalize(haystack).includes(normalize(keyword));
}

function countOccurrences(haystack: string, keyword: string): number {
  if (!keyword) return 0;
  const escaped = normalize(keyword).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return normalize(haystack).match(new RegExp(escaped, "g"))?.length ?? 0;
}

/** Tronque sans couper un mot en deux. */
function truncateOnWord(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd();
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/* ------------------------------------------------------------- génération */

function buildTitle(keyword: string, name: string, brand: string): string {
  const base = capitalize(keyword || name);
  const candidates = [
    brand ? `${base} : notre sélection au meilleur prix | ${brand}` : "",
    `${base} : notre sélection au meilleur prix`,
    brand ? `${base} | ${brand}` : "",
    base,
  ].filter(Boolean);

  const fitting = candidates.find((c) => c.length <= LIMITS.title.max);
  return truncateOnWord(fitting ?? base, LIMITS.title.max);
}

function buildMetaDescription(keyword: string, name: string): string {
  const base = keyword || name;
  const meta =
    `Découvrez notre gamme ${base} : large choix, conseils d'experts et ` +
    `livraison rapide. Comparez les modèles et trouvez le vôtre au meilleur prix.`;

  if (meta.length <= LIMITS.metaDescription.max) return meta;
  return truncateOnWord(meta, LIMITS.metaDescription.max);
}

function buildH1(keyword: string, name: string): string {
  const h1 = capitalize(keyword || name);
  return truncateOnWord(h1, LIMITS.h1.max);
}

function buildContent(keyword: string, name: string, source: string): string {
  const base = keyword || name;
  const intro = [
    `Vous cherchez ${base} ? Cette page rassemble notre offre complète, ` +
      `sélectionnée pour couvrir tous les usages et tous les budgets.`,
    `Chaque référence est présentée avec ses caractéristiques clés pour vous ` +
      `permettre de comparer rapidement et de choisir en confiance.`,
  ].join(" ");

  const guide = [
    `## Comment choisir ${base} ?`,
    `Trois critères font la différence : l'usage prévu, le niveau de finition ` +
      `attendu et le budget. Commencez par définir votre usage, puis affinez ` +
      `avec les filtres de la page pour ne garder que les modèles pertinents.`,
    `## Notre sélection ${base}`,
    `Nos équipes mettent en avant les références qui offrent le meilleur ` +
      `rapport qualité-prix, ainsi que les nouveautés de la saison.`,
    `## Livraison, garantie et accompagnement`,
    `Livraison suivie, retours facilités et conseillers disponibles pour vous ` +
      `guider avant comme après l'achat.`,
  ].join("\n\n");

  const existing = clean(stripTags(source));
  const legacy = existing
    ? `\n\n## À retenir\n\n${truncateOnWord(existing, 600)}`
    : "";

  return `${intro}\n\n${guide}${legacy}`.trim();
}

/* ------------------------------------------------------------------ audit */

function lengthCheck(
  id: string,
  label: string,
  value: string,
  bounds: { min: number; max: number },
  weight: number,
): Check {
  const len = value.length;
  if (len === 0) {
    return { id, label, status: "fail", detail: "Champ vide.", weight };
  }
  if (len < bounds.min) {
    return {
      id,
      label,
      status: "warn",
      detail: `${len} caractères — trop court (visez ${bounds.min}–${bounds.max}).`,
      weight,
    };
  }
  if (len > bounds.max) {
    return {
      id,
      label,
      status: "warn",
      detail: `${len} caractères — trop long (visez ${bounds.min}–${bounds.max}).`,
      weight,
    };
  }
  return {
    id,
    label,
    status: "ok",
    detail: `${len} caractères — dans la cible ${bounds.min}–${bounds.max}.`,
    weight,
  };
}

function keywordCheck(
  id: string,
  label: string,
  value: string,
  keyword: string,
  weight: number,
): Check {
  if (!keyword) {
    return {
      id,
      label,
      status: "warn",
      detail: "Aucun mot-clé cible défini sur la catégorie.",
      weight,
    };
  }
  return includesKeyword(value, keyword)
    ? { id, label, status: "ok", detail: `« ${keyword} » présent.`, weight }
    : {
        id,
        label,
        status: "fail",
        detail: `« ${keyword} » absent.`,
        weight,
      };
}

function scoreFrom(checks: Check[]): number {
  const total = checks.reduce((sum, c) => sum + c.weight, 0);
  if (total === 0) return 0;
  const earned = checks.reduce((sum, c) => {
    const ratio = c.status === "ok" ? 1 : c.status === "warn" ? 0.5 : 0;
    return sum + c.weight * ratio;
  }, 0);
  return Math.round((earned / total) * 100);
}

/**
 * Audite un contenu (généré ou existant) et renvoie les critères + le score.
 * Exporté pour pouvoir scorer aussi la version d'origine et montrer le delta.
 */
export function audit(
  parts: { title: string; metaDescription: string; h1: string; content: string },
  keyword: string,
): { checks: Check[]; score: number } {
  const contentText = clean(stripTags(parts.content));
  const density = countOccurrences(contentText, keyword);

  const checks: Check[] = [
    lengthCheck("title-length", "Longueur du title", parts.title, LIMITS.title, 3),
    keywordCheck("title-keyword", "Mot-clé dans le title", parts.title, keyword, 3),
    lengthCheck(
      "meta-length",
      "Longueur de la meta description",
      parts.metaDescription,
      LIMITS.metaDescription,
      2,
    ),
    keywordCheck(
      "meta-keyword",
      "Mot-clé dans la meta description",
      parts.metaDescription,
      keyword,
      2,
    ),
    lengthCheck("h1-length", "Longueur du H1", parts.h1, LIMITS.h1, 2),
    keywordCheck("h1-keyword", "Mot-clé dans le H1", parts.h1, keyword, 3),
    lengthCheck(
      "content-length",
      "Volume de texte de catégorie",
      contentText,
      LIMITS.content,
      3,
    ),
    {
      id: "content-density",
      label: "Occurrences du mot-clé dans le texte",
      weight: 2,
      ...(!keyword
        ? {
            status: "warn" as const,
            detail: "Aucun mot-clé cible défini.",
          }
        : density === 0
          ? { status: "fail" as const, detail: "Mot-clé jamais employé." }
          : density < 3
            ? {
                status: "warn" as const,
                detail: `${density} occurrence(s) — visez 3 à 8.`,
              }
            : density > 12
              ? {
                  status: "warn" as const,
                  detail: `${density} occurrences — risque de sur-optimisation.`,
                }
              : { status: "ok" as const, detail: `${density} occurrences.` }),
    },
    {
      id: "content-structure",
      label: "Structure Hn du texte",
      weight: 2,
      ...(/^##\s+/m.test(parts.content)
        ? { status: "ok" as const, detail: "Sous-titres H2 présents." }
        : {
            status: "fail" as const,
            detail: "Aucun sous-titre : le texte n'est pas structuré.",
          }),
    },
  ];

  return { checks, score: scoreFrom(checks) };
}

/** Passe une catégorie à la moulinette. */
export function optimize(input: MoulinetteInput): MoulinetteResult {
  const name = clean(input.name);
  const keyword = clean(input.targetKeyword) || name.toLowerCase();
  const brand = clean(input.brand);

  const title = buildTitle(keyword, name, brand);
  const metaDescription = buildMetaDescription(keyword, name);
  const h1 = buildH1(keyword, name);
  const content = buildContent(keyword, name, input.sourceContent ?? "");

  const { checks, score } = audit(
    { title, metaDescription, h1, content },
    keyword,
  );

  return {
    engine: DEFAULT_ENGINE,
    title,
    metaDescription,
    h1,
    content,
    score,
    checks,
  };
}

/** Score la version d'origine, pour afficher le gain apporté par la moulinette. */
export function auditSource(input: MoulinetteInput): { checks: Check[]; score: number } {
  const keyword = clean(input.targetKeyword) || clean(input.name).toLowerCase();
  return audit(
    {
      title: clean(input.sourceTitle),
      metaDescription: clean(input.sourceMetaDescription),
      h1: clean(input.sourceH1),
      content: input.sourceContent ?? "",
    },
    keyword,
  );
}
