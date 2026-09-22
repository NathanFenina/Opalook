/**
 * Ce qui entoure une rédaction : le contexte du projet, l'archivage d'une
 * version, et les verdicts qu'on y attache.
 *
 * Ce code vivait dans le fichier d'actions. Il en sort parce que deux fichiers
 * d'actions en ont désormais besoin, et qu'un module « use server » ne peut rien
 * exporter qui ne soit pas une action : chaque export y devient un point
 * d'entrée appelable depuis le navigateur. Une fonction d'archivage exposée
 * comme telle serait un trou, pas une commodité.
 *
 * Tout est indexé sur la LANGUE. Un texte allemand ne se compare qu'aux textes
 * allemands, sa version 1 n'a rien à voir avec la version 3 française, et un
 * angle éditorial occupé en français reste libre en allemand — ce ne sont pas
 * les mêmes lecteurs.
 */

import { buildFamily, type Family } from "@/lib/catalogue";
import { checkCompliance, type ComplianceReport, type Market } from "@/lib/compliance";
import { DEFAULT_LOCALE } from "@/lib/locales";
import { audit } from "@/lib/moulinette";
import { GENERATION_MODEL, type CategoryContent } from "@/lib/generate";
import {
  renderCategoryHtml,
  renderCategoryText,
  renderShortDescriptionHtml,
  renderShortDescriptionText,
} from "@/lib/render";
import { keywordKey } from "@/lib/semrush";
import type { AppSupabaseClient } from "@/lib/session";
import {
  buildReport,
  compare,
  type Neighbour,
  type SimilarityReport,
} from "@/lib/similarity";

export type PipelineStep = {
  label: string;
  status: "ok" | "skipped" | "error";
  detail: string;
};

/** Ce que le projet impose et ce que les autres catégories occupent déjà. */
export type ProjectContext = {
  takenKeywords: string[];
  takenAngles: string[];
  family: Family | null;
};

type CategoryRef = {
  id: string;
  project_id: string;
  external_id: number | null;
  parent_external_id: number | null;
  name: string;
  url: string;
  target_keyword: string | null;
};

/**
 * Les noms, URL et mots-clés du projet dans une langue donnée.
 *
 * L'arborescence est commune à toutes les langues — c'est la même catégorie
 * PrestaShop — mais son nom, son adresse et sa cible ne le sont pas. On lit donc
 * la structure dans `categories` et on la recouvre langue par langue.
 */
async function localizedCategories(
  supabase: AppSupabaseClient,
  projectId: string,
  locale: string,
): Promise<CategoryRef[]> {
  const { data: rows } = await supabase
    .from("categories")
    .select("id, project_id, external_id, parent_external_id, name, url, target_keyword")
    .eq("project_id", projectId);

  const base = (rows ?? []) as CategoryRef[];
  if (locale === DEFAULT_LOCALE) return base;

  const { data: overlays } = await supabase
    .from("category_locales")
    .select("category_id, name, url, target_keyword")
    .eq("project_id", projectId)
    .eq("locale", locale);

  const byCategory = new Map(
    (overlays ?? []).map((row) => [row.category_id as string, row]),
  );

  // Une catégorie sans ligne dans cette langue n'y est pas publiée : la garder
  // avec son nom français la ferait passer pour une sœur à éviter alors qu'elle
  // n'existe pas sur ce marché.
  return base
    .filter((category) => byCategory.has(category.id))
    .map((category) => {
      const overlay = byCategory.get(category.id);
      return {
        ...category,
        name: (overlay?.name as string | null) ?? category.name,
        url: (overlay?.url as string | null) ?? category.url,
        target_keyword: (overlay?.target_keyword as string | null) ?? null,
      };
    });
}

/** La dernière version rédigée de chaque catégorie, dans une langue. */
async function latestVersions(
  supabase: AppSupabaseClient,
  projectId: string,
  locale: string,
): Promise<Map<string, { version: number; angle: string | null; plain: string | null }>> {
  const { data: rows } = await supabase
    .from("optimizations")
    .select(
      "category_id, version, editorial_angle, plain:payload->>plain, categories!inner(project_id)",
    )
    .eq("locale", locale)
    .eq("categories.project_id", projectId)
    .order("version", { ascending: false });

  const out = new Map<string, { version: number; angle: string | null; plain: string | null }>();
  for (const row of rows ?? []) {
    const categoryId = row.category_id as string;
    // La requête est triée par version décroissante : la première rencontrée est
    // la bonne, les suivantes sont de l'historique.
    if (out.has(categoryId)) continue;
    out.set(categoryId, {
      version: row.version as number,
      angle: (row.editorial_angle as string | null) ?? null,
      plain: (row.plain as string | null) ?? null,
    });
  }
  return out;
}

/**
 * Rassemble en une passe ce qui empêche deux textes de se ressembler : les
 * mots-clés déjà attribués sur le site, les angles occupés dans la famille, et
 * la position de la catégorie dans son arborescence.
 *
 * Les deux périmètres sont volontairement différents. Un mot-clé ne peut cibler
 * qu'une seule page du site, sinon les deux se cannibalisent : l'exclusion est
 * donc globale. Un angle éditorial, lui, ne s'exclut que dans la famille — il
 * n'y en a que dix, et les réserver à l'échelle du projet les épuiserait dès la
 * onzième catégorie, laissant le modèle sans aucun angle à retenir. Deux
 * catégories qui ne se croisent jamais peuvent partager un angle sans dommage ;
 * deux sœurs, non.
 */
export async function loadProjectContext(
  supabase: AppSupabaseClient,
  category: CategoryRef,
  locale: string = DEFAULT_LOCALE,
): Promise<ProjectContext> {
  const [all, versions] = await Promise.all([
    localizedCategories(supabase, category.project_id, locale),
    latestVersions(supabase, category.project_id, locale),
  ]);

  const takenKeywords: string[] = [];
  const angles = new Map<string, string | null>();

  for (const row of all) {
    if (row.id === category.id) continue;
    if (row.target_keyword) takenKeywords.push(row.target_keyword);
    const latest = versions.get(row.id);
    if (latest?.angle) angles.set(row.id, latest.angle);
  }

  const family =
    category.external_id === null ? null : buildFamily(category, all, angles);

  // Sans arborescence on n'a pas de famille : on retombe sur le projet entier,
  // en se limitant aux angles les plus récents pour ne pas vider la liste.
  const relatives = family
    ? [family.parent, ...family.siblings, ...family.children]
    : [...angles.values()].map((angle) => ({ editorialAngle: angle }));

  const takenAngles: string[] = [];
  for (const member of relatives) {
    const angle = member?.editorialAngle;
    if (angle && !takenAngles.includes(angle)) takenAngles.push(angle);
  }

  return { takenKeywords, takenAngles: takenAngles.slice(0, 8), family };
}

/**
 * Confronte le texte qu'on vient d'écrire à ceux des autres catégories du site.
 *
 * Les garde-fous en amont — registre des mots-clés, angle réservé à la famille,
 * ancrage dans la page — rendent la duplication improbable sans jamais la
 * constater. Celui-ci ne fait que constater, et c'est le seul qui puisse dire
 * si les autres ont tenu.
 *
 * La comparaison porte sur tout le projet, pas seulement sur la famille : une
 * catégorie ambre et une catégorie opale sans lien d'arborescence puisent dans
 * le même pool d'arguments autorisés et finissent par se ressembler. Le lien de
 * parenté sert à hiérarchiser le verdict, pas à restreindre la recherche.
 *
 * Elle ne franchit jamais la frontière de la langue : deux textes dans deux
 * langues n'ont aucun mot en commun, les comparer renverrait zéro à tous les
 * coups et noierait les vrais doublons.
 */
export async function compareWithSiblings(
  supabase: AppSupabaseClient,
  args: {
    categoryId: string;
    projectId: string;
    categoryName: string;
    externalId: number | null;
    parentExternalId: number | null;
    locale: string;
    text: string;
  },
): Promise<SimilarityReport | null> {
  const [all, versions] = await Promise.all([
    localizedCategories(supabase, args.projectId, args.locale),
    latestVersions(supabase, args.projectId, args.locale),
  ]);

  const voisins: Neighbour[] = [];

  for (const row of all) {
    if (row.id === args.categoryId) continue;
    const other = versions.get(row.id)?.plain;
    if (!other) continue;

    const lien =
      args.externalId !== null && row.parent_external_id === args.externalId
        ? "fille"
        : row.external_id !== null && row.external_id === args.parentExternalId
          ? "mère"
          : args.parentExternalId !== null &&
              row.parent_external_id === args.parentExternalId
            ? "sœur"
            : "projet";

    const { score, phrases } = compare(args.text, args.categoryName, other, row.name);
    voisins.push({ categoryId: row.id, name: row.name, lien, score, phrases });
  }

  return voisins.length > 0 ? buildReport(voisins) : null;
}

/**
 * Rend, note, contrôle et archive une version.
 *
 * Le contrôle des règles métier porte sur les deux livrables réunis : un
 * interdit dans la description courte compte autant que dans la longue.
 */
export async function persistOptimization(
  supabase: AppSupabaseClient,
  args: {
    categoryId: string;
    categoryName: string;
    projectId: string;
    externalId: number | null;
    parentExternalId: number | null;
    locale: string;
    keyword: string;
    market: Market;
    content: CategoryContent;
    userId: string;
    groundedInPage: boolean;
    /** Longueur visée, pour juger l'écart plutôt que de le découvrir. */
    targetLength?: number | null;
    steps?: PipelineStep[];
  },
): Promise<{
  score: number;
  compliance: ComplianceReport;
  similarity: SimilarityReport | null;
  longueur: number;
  error: string | null;
}> {
  const { content } = args;

  const shortHtml = renderShortDescriptionHtml(content);
  const shortText = renderShortDescriptionText(content);
  const longHtml = renderCategoryHtml(content);
  const longText = renderCategoryText(content);

  const { checks, score } = audit(
    {
      title: content.title,
      metaDescription: content.metaDescription,
      h1: content.h1,
      content: longText,
    },
    args.keyword,
  );

  // Le contrôle métier est écrit pour le français : sur une autre langue il
  // resterait aveugle aux tournures interdites et signalerait des faux positifs.
  // On ne l'applique donc que là où il sait lire, et on le dit.
  const compliance =
    args.locale === DEFAULT_LOCALE
      ? checkCompliance(`${shortText}\n\n${longText}`, {
          market: args.market,
          categoryName: args.categoryName,
        })
      : { issues: [], passed: 0 };

  const similarity = await compareWithSiblings(supabase, {
    categoryId: args.categoryId,
    projectId: args.projectId,
    categoryName: args.categoryName,
    externalId: args.externalId,
    parentExternalId: args.parentExternalId,
    locale: args.locale,
    text: `${shortText}\n\n${longText}`,
  });

  const { error } = await supabase.from("optimizations").insert({
    category_id: args.categoryId,
    locale: args.locale,
    title: content.title,
    meta_description: content.metaDescription,
    h1: content.h1,
    short_description: shortHtml,
    content: longHtml,
    score,
    engine: GENERATION_MODEL,
    editorial_angle: content.editorialAngle,
    payload: {
      checks,
      structured: content,
      plain: longText,
      shortPlain: shortText,
      compliance,
      similarity,
      locale: args.locale,
      targetLength: args.targetLength ?? null,
      longueur: longText.length,
      complianceChecked: args.locale === DEFAULT_LOCALE,
      ...(args.steps ? { steps: args.steps } : {}),
      // Une version rédigée sans relevé de page ne peut pas être jugée comme une
      // autre : les matières et références qu'elle cite ne sont pas vérifiées
      // contre le catalogue.
      groundedInPage: args.groundedInPage,
    },
    created_by: args.userId,
  });

  return {
    score,
    compliance,
    similarity,
    longueur: longText.length,
    error: error?.message ?? null,
  };
}

/**
 * Écarte les propositions qui appartiennent déjà à une autre page.
 *
 * Le prompt interdit au modèle de proposer un mot-clé attribué ailleurs, mais
 * une consigne n'est pas une garantie : il a proposé « colliers pierres
 * naturelles en gros » comme secondaire à la catégorie mère, alors que c'est le
 * mot-clé principal de sa fille. Optimiser la mère dessus, c'est exactement la
 * cannibalisation qu'on cherche à éviter — et elle est d'autant plus nocive
 * qu'elle oppose deux pages du même site.
 *
 * Le filtre est donc appliqué en dur après coup, sur une forme normalisée
 * (accents et apostrophes neutralisés) pour qu'une variante d'écriture ne passe
 * pas au travers.
 */
export function rejectTakenKeywords(
  proposed: string[],
  reserved: string[],
): { kept: string[]; rejected: string[] } {
  const taken = new Set(reserved.map(keywordKey));
  const kept: string[] = [];
  const rejected: string[] = [];

  for (const value of proposed) {
    if (taken.has(keywordKey(value))) rejected.push(value);
    else kept.push(value);
  }
  return { kept, rejected };
}

/** Une phrase sur la ressemblance avec les autres textes du site. */
export function similaritySummary(report: SimilarityReport | null): string {
  if (!report) return "";
  const pire = report.voisins[0];
  if (report.verdict === "distinct") {
    return ` Ressemblance : ${report.pire}% au plus fort, le texte se tient à distance des autres.`;
  }
  return (
    ` Ressemblance : ${report.pire}% avec « ${pire?.name ?? "?"} »` +
    (report.verdict === "trop proche"
      ? " — trop proche, à réécrire."
      : " — à surveiller.")
  );
}

/** Une phrase sur l'état du contrôle métier, à coller au message de retour. */
export function complianceSummary(report: ComplianceReport): string {
  const errors = report.issues.filter((issue) => issue.severity === "erreur").length;
  const warnings = report.issues.length - errors;

  if (errors === 0 && warnings === 0) return " Règles métier : aucun écart détecté.";
  if (errors === 0) {
    return ` Règles métier : ${warnings} point(s) à vérifier à l'œil.`;
  }
  return ` Règles métier : ${errors} interdit(s) à corriger avant publication${
    warnings > 0 ? `, ${warnings} point(s) à vérifier` : ""
  }.`;
}

/** Une phrase sur l'écart à la longueur visée, quand elle est connue. */
export function lengthSummary(longueur: number, target: number | null): string {
  if (!target) return ` Longueur : ${longueur.toLocaleString("fr-FR")} caractères.`;

  const ecart = Math.round(((longueur - target) / target) * 100);
  if (Math.abs(ecart) <= 15) {
    return ` Longueur : ${longueur.toLocaleString("fr-FR")} caractères, dans la cible (${target.toLocaleString("fr-FR")}).`;
  }
  return (
    ` Longueur : ${longueur.toLocaleString("fr-FR")} caractères pour ${target.toLocaleString("fr-FR")} visés` +
    ` — ${ecart > 0 ? "plus long" : "plus court"} de ${Math.abs(ecart)} %.`
  );
}
