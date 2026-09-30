"use server";

/**
 * Le travail d'une catégorie DANS UNE LANGUE.
 *
 * Tout ce que le client a demandé après la première démonstration se ramène à
 * une même idée : une catégorie n'est pas une page, c'est autant de pages qu'il y
 * a de langues, et chacune se travaille en deux temps.
 *
 *  - Phase 1 : le mot-clé, les balises, le segment d'URL. Court, relu vite,
 *    relançable sans frais. On le valide avant d'engager la rédaction.
 *  - Phase 2 : les deux descriptions, écrites POUR les balises validées, à la
 *    longueur que le top 10 de Google impose sur ce mot-clé, dans cette langue.
 *
 * Et une boucle : quand un texte est refusé, la raison est consignée et repasse
 * dans le prompt de la version suivante. Sur cent quatre-vingts catégories,
 * c'est la seule correction qui s'amortit.
 */

import { revalidatePath } from "next/cache";
import type { User } from "@supabase/supabase-js";

import {
  fetchKeywordMetrics,
  fetchSerp,
  SerpError,
  type SerpAnalysis,
} from "@/lib/dataforseo";
import { extractFromUrl, ExtractionError } from "@/lib/extract";
import {
  generateCategoryContent,
  generateMetadata,
  proposeKeywordCandidates,
  repairCategoryContent,
  GenerationError,
  GENERATION_MODEL,
  type CategoryContent,
} from "@/lib/generate";
import { describeDefects, defectsSummary, findDefects, pickBest } from "@/lib/repair";
import type { Market } from "@/lib/compliance";
import { DEFAULT_LOCALE, localeInfo, localeLabel } from "@/lib/locales";
import {
  complianceSummary,
  lengthSummary,
  loadProjectContext,
  persistOptimization,
  similaritySummary,
  type PipelineStep,
} from "@/lib/optimization";
import { keywordKey } from "@/lib/semrush";
import { requireUser, optionalText, text, type AppSupabaseClient } from "@/lib/session";
import type { Database } from "@/lib/database.types";
import { linkRewriteFromUrl, toLinkRewrite } from "@/lib/slug";
import { measureTargetLength, type TargetLength } from "@/lib/target-length";

/* ============================================================ lecture ==== */

type ProjectRow = {
  id: string;
  name: string;
  domain: string | null;
  notes: string | null;
  business_rules: string | null;
  market: string | null;
};

type GscQuery = { query: string; impressions: number; position: number; clicks?: number };

type LocaleRow = {
  category_id: string;
  locale: string;
  project_id: string;
  name: string;
  url: string | null;
  link_rewrite: string | null;
  target_keyword: string | null;
  keyword_volume: number | null;
  keyword_difficulty: number | null;
  secondary_keywords: string[] | null;
  fan_queries: string[] | null;
  brief: string | null;
  catalog_short_description: string | null;
  catalog_long_description: string | null;
  title: string | null;
  meta_description: string | null;
  h1: string | null;
  metadata_approved: boolean | null;
  target_length: number | null;
  target_length_source: unknown;
  gsc_data: unknown;
  serp_data: unknown;
  status: string;
  published_at: string | null;
};

const LOCALE_TABLE_HINT =
  "La table des langues est absente : joue " +
  "`supabase/migrations/2026-09-22_multilingue_et_suivi.sql` dans le SQL Editor, " +
  "puis `2026-09-22b_numerotation_par_langue.sql` dans une seconde exécution, " +
  "puis réimporte le catalogue. Les deux fichiers ne peuvent pas être joués " +
  "ensemble : l'éditeur Supabase réécrit les scripts contenant un `create table`, " +
  "ce qui casse les corps de fonction.";

/**
 * La ligne de travail d'une catégorie dans une langue, créée au besoin.
 *
 * Le catalogue ne publie pas toutes les catégories dans toutes les langues, et
 * on peut vouloir commencer une langue avant de réimporter le fichier. Plutôt
 * que d'exiger un import préalable, on crée la ligne à partir de ce qu'on sait :
 * le nom et l'URL de la catégorie. C'est un point de départ, pas une invention —
 * rien d'éditorial n'est fabriqué.
 */
async function loadOrCreateLocaleRow(
  supabase: AppSupabaseClient,
  category: { id: string; project_id: string; name: string; url: string },
  locale: string,
): Promise<{ row: LocaleRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from("category_locales")
    .select("*")
    .eq("category_id", category.id)
    .eq("locale", locale)
    .maybeSingle();

  if (error) {
    return {
      row: null,
      error: error.message.includes("category_locales")
        ? LOCALE_TABLE_HINT
        : `Lecture de la langue impossible : ${error.message}`,
    };
  }
  if (data) return { row: data as LocaleRow, error: null };

  const { data: created, error: insertError } = await supabase
    .from("category_locales")
    .insert({
      category_id: category.id,
      locale,
      project_id: category.project_id,
      name: category.name,
      url: locale === DEFAULT_LOCALE ? category.url : null,
    })
    .select("*")
    .single();

  if (insertError) {
    return {
      row: null,
      error: insertError.message.includes("category_locales")
        ? LOCALE_TABLE_HINT
        : `Création de la langue impossible : ${insertError.message}`,
    };
  }

  return { row: created as LocaleRow, error: null };
}

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

type LoadedContext = {
  supabase: AppSupabaseClient;
  user: User;
  category: CategoryRow;
  project: ProjectRow | null;
  locale: string;
  row: LocaleRow;
};

/**
 * Catégorie, projet et ligne de langue en une passe.
 *
 * Le type de retour est écrit à la main plutôt que déduit : sur une union où une
 * branche porte le client Supabase entier, l'inférence rend `erreur` comme
 * peut-être absent et le rétrécissement par `in` ne tient plus. Une union
 * explicite garde l'appelant obligé de traiter l'échec.
 */
async function loadContext(
  formData: FormData,
): Promise<{ erreur: string; ctx?: undefined } | { erreur?: undefined; ctx: LoadedContext }> {
  const { supabase, user } = await requireUser();

  const categoryId = text(formData, "category_id");
  const locale = text(formData, "locale") || DEFAULT_LOCALE;
  if (!categoryId) return { erreur: "Catégorie manquante." };

  const { data: category, error } = await supabase
    .from("categories")
    .select("*, projects(id, name, domain, notes, business_rules, market)")
    .eq("id", categoryId)
    .single();

  if (error || !category) {
    return { erreur: `Catégorie introuvable : ${error?.message ?? ""}` };
  }

  const { row, error: localeError } = await loadOrCreateLocaleRow(
    supabase,
    category,
    locale,
  );
  if (!row) return { erreur: localeError ?? "Langue introuvable." };

  return {
    ctx: {
      supabase,
      user,
      category: category as CategoryRow,
      project: (category as { projects?: ProjectRow | null }).projects ?? null,
      locale,
      row,
    },
  };
}

/** Les mots-clés réservés par les autres pages, dans cette langue. */
async function reservedKeywords(
  supabase: AppSupabaseClient,
  projectId: string,
  locale: string,
  exceptCategoryId: string,
): Promise<string[]> {
  // Pour le français, `categories` reste la copie de travail que lisent les
  // écrans existants ; pour les autres langues, il n'y a que `category_locales`.
  if (locale === DEFAULT_LOCALE) {
    const { data } = await supabase
      .from("categories")
      .select("target_keyword")
      .eq("project_id", projectId)
      .neq("id", exceptCategoryId)
      .not("target_keyword", "is", null);
    return (data ?? [])
      .map((row) => row.target_keyword as string | null)
      .filter((value): value is string => Boolean(value));
  }

  const { data } = await supabase
    .from("category_locales")
    .select("target_keyword")
    .eq("project_id", projectId)
    .eq("locale", locale)
    .neq("category_id", exceptCategoryId)
    .not("target_keyword", "is", null);

  return (data ?? [])
    .map((row) => row.target_keyword as string | null)
    .filter((value): value is string => Boolean(value));
}

function gscQueriesOf(row: LocaleRow, category: { gsc_data: unknown }): GscQuery[] {
  const own = (row.gsc_data ?? {}) as { queries?: GscQuery[] };
  if (own.queries && own.queries.length > 0) return own.queries;

  // Search Console n'est importé que sur les URL françaises. Pour les autres
  // langues on n'a donc rien, et une donnée française appliquée à un marché
  // allemand serait pire que pas de donnée du tout.
  if (row.locale !== DEFAULT_LOCALE) return [];

  const shared = (category.gsc_data ?? {}) as { queries?: GscQuery[] };
  return shared.queries ?? [];
}

/* ================================== 1. proposer le mot-clé principal ===== */

export type KeywordCandidate = {
  keyword: string;
  why: string;
  source: string;
  reservation: string;
  /** Qui tape la requête, par rapport au marché du site : marché, hors marché, ambigu. */
  marketIntent: string;
  volume: number | null;
  difficulty: number | null;
  cpc: number | null;
  competition: number | null;
  /** Position actuelle de la page sur cette requête, d'après Search Console. */
  position: number | null;
  impressions: number | null;
  score: number;
  verdict: string;
};

export type KeywordProposalState = {
  status: "idle" | "ok" | "error";
  message: string;
  locale?: string;
  candidates?: KeywordCandidate[];
  avertissements?: string[];
};

/**
 * Note un candidat.
 *
 * Trois choses décident, dans cet ordre.
 *
 * La demande, en logarithme : entre 100 et 1 000 recherches il y a un monde,
 * entre 10 000 et 11 000 il n'y a rien. Une échelle linéaire ferait gagner
 * n'importe quel terme générique contre n'importe quel terme précis, alors que
 * le générique est souvent hors de portée.
 *
 * La position déjà acquise, qui est le vrai gisement : une page en onzième place
 * est déjà jugée pertinente par Google sur cette requête. Réécrire son texte la
 * fait souvent basculer en première page. Aucun mot-clé neuf n'offre ce
 * rendement.
 *
 * La difficulté, en retrait : elle tempère, elle ne tranche pas. Un mot-clé
 * difficile sur lequel on est déjà onzième reste meilleur qu'un mot-clé facile
 * où l'on part de rien.
 */
function scoreCandidate(input: {
  volume: number | null;
  difficulty: number | null;
  position: number | null;
  marketIntent?: string;
  market?: Market;
}): { score: number; verdict: string } {
  const raisons: string[] = [];
  let score = 0;

  // Le public d'abord, avant même le volume.
  //
  // C'est l'arbitrage qui décide si le site attire des acheteurs ou des
  // curieux. Sur un site de gros, « collier ambre » a du volume et « grossiste
  // bijoux ambre » n'en a presque pas — mais le premier amène des particuliers
  // qui n'achèteront pas, et, quand le même groupe tient un site grand public,
  // met les deux pages en concurrence sur la même requête. Le retrait est assez
  // lourd pour qu'aucun volume ne le rattrape à lui seul, sans être éliminatoire :
  // une requête grand public reste visible dans la liste, avec sa raison.
  const horsMarche = input.marketIntent?.toLowerCase().includes("hors");
  const ambigu = input.marketIntent?.toLowerCase().includes("ambig");

  if (input.market && horsMarche) {
    score -= 45;
    raisons.push(
      input.market === "b2b"
        ? "requête de particulier sur un site de gros"
        : "requête de professionnel sur un site grand public",
    );
  } else if (input.market && ambigu) {
    score -= 10;
    raisons.push("public ambigu");
  } else if (input.market) {
    // Et une prime, sans quoi une requête parfaitement ciblée mais que les
    // outils mesurent à zéro finirait derrière une requête grand public qu'on
    // vient pourtant d'écarter. Punir l'erreur ne suffit pas, il faut aussi
    // reconnaître le bon choix.
    score += 15;
    raisons.push(
      input.market === "b2b" ? "requête de revendeur" : "requête de client final",
    );
  }

  if (input.volume !== null && input.volume > 0) {
    score += Math.min(60, Math.round(Math.log10(input.volume + 1) * 20));
    raisons.push(`${input.volume.toLocaleString("fr-FR")} recherches/mois`);
  } else if (input.volume === 0) {
    // Les outils mesurent mal les requêtes professionnelles rares. Un zéro sur
    // une requête du bon public ne vaut pas condamnation : on ne récompense
    // pas, on ne punit pas non plus.
    raisons.push(
      input.market && !horsMarche
        ? "aucune recherche mesurée, ce qui est courant sur les requêtes professionnelles"
        : "aucune recherche mesurée",
    );
  } else {
    raisons.push("volume inconnu");
  }

  if (input.position !== null) {
    if (input.position >= 11 && input.position <= 20) {
      score += 30;
      raisons.push(`position ${input.position.toFixed(1)} — gain rapide`);
    } else if (input.position <= 10) {
      score += 15;
      raisons.push(`déjà position ${input.position.toFixed(1)}`);
    } else {
      score += 5;
      raisons.push(`position ${input.position.toFixed(1)}`);
    }
  }

  if (input.difficulty !== null) {
    score -= Math.round(input.difficulty / 4);
    raisons.push(`difficulté ${input.difficulty}`);
  }

  return { score: Math.max(0, score), verdict: raisons.join(" · ") };
}

/**
 * Construit et classe la liste des candidats.
 *
 * Extrait de l'action parce que deux usages en ont besoin : la proposition à
 * l'écran, où l'on choisit, et le traitement en série sur dix langues, où l'on
 * ne peut pas choisir dix fois. Le classement est le même dans les deux cas —
 * ce serait malhonnête que le mot-clé retenu automatiquement ne soit pas celui
 * que l'écran aurait recommandé.
 */
async function rankCandidates(
  ctx: LoadedContext,
): Promise<{ candidates: KeywordCandidate[]; avertissements: string[]; erreur?: string }> {
  const { supabase, category, project, locale, row } = ctx;
  const avertissements: string[] = [];

  const reserved = await reservedKeywords(
    supabase,
    category.project_id,
    locale,
    category.id,
  );

  const source = (category.source_data ?? {}) as {
    products?: string[];
    facets?: { name: string; values: string[] }[];
  };
  const gscQueries = gscQueriesOf(row, category);

  const { takenKeywords, family } = await loadProjectContext(
    supabase,
    category,
    locale,
  );

  let proposed;
  try {
    proposed = await proposeKeywordCandidates({
      brand: project?.name ?? "",
      brief: project?.notes ?? null,
      businessRules: project?.business_rules ?? null,
      market: (project?.market ?? null) as Market,
      locale,
      categoryName: row.name || category.name,
      categoryUrl: row.url ?? category.url,
      family,
      products: source.products ?? [],
      facets: source.facets ?? [],
      gscQueries,
      currentKeyword: row.target_keyword ?? category.target_keyword ?? null,
      takenKeywords: [...new Set([...reserved, ...takenKeywords])],
    });
  } catch (error) {
    const message = error instanceof GenerationError ? error.message : (error as Error).message;
    return { candidates: [], avertissements, erreur: message };
  }

  /* --- la demande constatée entre dans la liste, elle ne s'y ajoute pas --- */
  //
  // Une requête sur laquelle la page est déjà onzième vaut mieux que n'importe
  // quelle déduction : elle mérite d'être comparée aux propositions du modèle,
  // pas rangée à part.

  const byKeyword = new Map<string, KeywordCandidate>();
  const push = (candidate: Omit<KeywordCandidate, "score" | "verdict">) => {
    const key = keywordKey(candidate.keyword);
    if (!key || byKeyword.has(key)) return;
    byKeyword.set(key, { ...candidate, score: 0, verdict: "" });
  };

  for (const candidate of proposed.candidates) {
    const seen = gscQueries.find(
      (query) => keywordKey(query.query) === keywordKey(candidate.keyword),
    );
    push({
      keyword: candidate.keyword.trim().toLowerCase(),
      why: candidate.why,
      source: candidate.source,
      reservation: candidate.reservation,
      marketIntent: candidate.marketIntent,
      volume: null,
      difficulty: null,
      cpc: null,
      competition: null,
      position: seen?.position ?? null,
      impressions: seen?.impressions ?? null,
    });
  }

  for (const query of [...gscQueries]
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 12)) {
    push({
      keyword: query.query.trim().toLowerCase(),
      why: "Requête déjà remontée par Search Console sur cette URL.",
      source: "Search Console",
      reservation: "aucun",
      // Search Console dit qu'on reçoit des impressions, pas qui les envoie.
      marketIntent: "ambigu",
      volume: null,
      difficulty: null,
      cpc: null,
      competition: null,
      position: query.position,
      impressions: query.impressions,
    });
  }

  const current = (row.target_keyword ?? category.target_keyword ?? "").trim();
  if (current) {
    push({
      keyword: current.toLowerCase(),
      why: "Mot-clé actuellement retenu, pour comparaison.",
      source: "actuel",
      reservation: "aucun",
      marketIntent: "ambigu",
      volume: null,
      difficulty: null,
      cpc: null,
      competition: null,
      position: null,
      impressions: null,
    });
  }

  /* --- ce qui appartient à une autre page sort de la liste ------------- */

  const takenKeys = new Set(reserved.map(keywordKey));
  const ecartes: string[] = [];
  for (const [key, candidate] of [...byKeyword]) {
    if (takenKeys.has(key)) {
      byKeyword.delete(key);
      ecartes.push(candidate.keyword);
    }
  }
  if (ecartes.length > 0) {
    avertissements.push(
      `${ecartes.length} proposition(s) écartée(s), déjà ciblée(s) par une autre page : ` +
        `${ecartes.slice(0, 6).join(", ")}.`,
    );
  }

  const candidates = [...byKeyword.values()];
  if (candidates.length === 0) {
    return {
      candidates: [],
      avertissements,
      erreur: "Aucun candidat exploitable : tout ce qui a été proposé est déjà attribué ailleurs.",
    };
  }

  /* --- la mesure ------------------------------------------------------- */

  try {
    const { metrics, problemes } = await fetchKeywordMetrics(
      candidates.map((candidate) => candidate.keyword),
      locale,
    );
    avertissements.push(...problemes);

    for (const candidate of candidates) {
      const measured = metrics.get(candidate.keyword.toLowerCase());
      if (!measured) continue;
      candidate.volume = measured.volume;
      candidate.difficulty = measured.difficulty;
      candidate.cpc = measured.cpc;
      candidate.competition = measured.competition;
    }
  } catch (error) {
    const message = error instanceof SerpError ? error.message : (error as Error).message;
    avertissements.push(
      `Volumes non mesurés : ${message} Le classement ci-dessous ne repose donc que ` +
        `sur les positions Search Console et le raisonnement du modèle.`,
    );
  }

  const market = (project?.market ?? null) as Market;
  for (const candidate of candidates) {
    const { score, verdict } = scoreCandidate({ ...candidate, market });
    candidate.score = score;
    candidate.verdict = verdict;
  }
  candidates.sort((a, b) => b.score - a.score);

  return { candidates, avertissements: avertissements.filter(Boolean) };
}

/**
 * Propose le mot-clé principal à partir des données, et non du flair.
 *
 * Trois sources se rejoignent : ce que Search Console dit que la page reçoit
 * déjà, ce que le modèle déduit du catalogue, et ce que le nom de la catégorie
 * suggère. Les volumes sont ensuite mesurés pour de vrai sur le marché de la
 * langue — un seul appel DataForSEO pour toute la liste, parce que la
 * facturation est à la tâche et qu'il serait absurde de mesurer un candidat à la
 * fois.
 *
 * Rien n'est appliqué : la proposition se lit, puis se choisit d'un clic.
 */
export async function proposeKeyword(
  _prev: KeywordProposalState,
  formData: FormData,
): Promise<KeywordProposalState> {
  const loaded = await loadContext(formData);
  if (loaded.erreur !== undefined) return { status: "error", message: loaded.erreur };
  const ctx = loaded.ctx;

  const { candidates, avertissements, erreur } = await rankCandidates(ctx);
  if (erreur) return { status: "error", message: erreur, locale: ctx.locale };

  const marche = localeInfo(ctx.locale);

  return {
    status: "ok",
    message:
      `${candidates.length} candidats classés pour le marché ${marche.country} ` +
      `(${marche.label}).` +
      (marche.known
        ? ""
        : " Attention : cette langue n'est pas au registre, les volumes ont été " +
          "mesurés en France par défaut.") +
      " Rien n'est enregistré avant ton clic.",
    locale: ctx.locale,
    candidates: candidates.slice(0, 20),
    avertissements,
  };
}

/**
 * Retient un mot-clé principal pour une langue.
 *
 * Le volume et la difficulté mesurés sont enregistrés avec lui : c'est ce qui
 * rend le choix relisible dans six mois, quand plus personne ne se souviendra
 * pourquoi celui-là.
 */
export async function applyKeyword(formData: FormData) {
  const loaded = await loadContext(formData);
  if (loaded.erreur !== undefined) throw new Error(loaded.erreur);
  const ctx = loaded.ctx;

  const { supabase, category, locale } = ctx;
  const keyword = text(formData, "keyword");
  if (!keyword) return;

  const toNumber = (key: string): number | null => {
    const raw = text(formData, key);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const fields = {
    target_keyword: keyword,
    keyword_volume: toNumber("volume"),
    keyword_difficulty: toNumber("difficulty"),
    keyword_data_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("category_locales")
    .update(fields)
    .eq("category_id", category.id)
    .eq("locale", locale);

  if (error) {
    throw new Error(
      error.code === "23505"
        ? `« ${keyword} » est déjà le mot-clé principal d'une autre catégorie en ` +
          `${localeLabel(locale)}. Un mot-clé ne cible qu'une seule page, sinon les ` +
          `deux se cannibalisent.`
        : `Enregistrement impossible : ${error.message}`,
    );
  }

  // Le français reste la copie que lisent les écrans et les traitements
  // existants : ne l'écrire qu'ici les laisserait sur l'ancienne valeur.
  if (locale === DEFAULT_LOCALE) {
    const { error: mirrorError } = await supabase
      .from("categories")
      .update(fields)
      .eq("id", category.id);

    if (mirrorError && mirrorError.code === "23505") {
      throw new Error(
        `« ${keyword} » est déjà attribué à une autre catégorie du projet.`,
      );
    }
  }

  revalidatePath(`/categories/${category.id}`);
  revalidatePath(`/projects/${category.project_id}`);
}

/**
 * Retient automatiquement le meilleur candidat, pour le traitement en série.
 *
 * Choisir à la main est la bonne façon de faire sur une langue. Sur dix, c'est
 * dix arbitrages sur des marchés qu'on ne connaît pas, et le classement est
 * précisément là pour ça. Le mot-clé retenu est celui que l'écran aurait
 * recommandé en tête — pas un autre.
 *
 * Un mot-clé déjà renseigné n'est jamais remplacé : le traitement en série ne
 * doit pas défaire un choix humain, et il doit pouvoir être relancé sans coût.
 */
export async function bulkPickKeyword(
  _prev: KeywordProposalState,
  formData: FormData,
): Promise<KeywordProposalState> {
  const loaded = await loadContext(formData);
  if (loaded.erreur !== undefined) return { status: "error", message: loaded.erreur };
  const ctx = loaded.ctx;

  const { supabase, category, locale, row } = ctx;

  if (row.target_keyword) {
    return {
      status: "ok",
      message: `Mot-clé déjà retenu : « ${row.target_keyword} ». Inchangé.`,
      locale,
    };
  }

  const { candidates, avertissements, erreur } = await rankCandidates(ctx);
  if (erreur) return { status: "error", message: erreur, locale };

  const meilleur = candidates[0];
  if (!meilleur) {
    return { status: "error", message: "Aucun candidat exploitable.", locale };
  }

  const fields = {
    target_keyword: meilleur.keyword,
    keyword_volume: meilleur.volume,
    keyword_difficulty: meilleur.difficulty,
    keyword_data_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("category_locales")
    .update(fields)
    .eq("category_id", category.id)
    .eq("locale", locale);

  if (error) {
    return {
      status: "error",
      message:
        error.code === "23505"
          ? `« ${meilleur.keyword} » est déjà pris par une autre catégorie en ${localeLabel(locale)}.`
          : `Enregistrement impossible : ${error.message}`,
      locale,
    };
  }

  if (locale === DEFAULT_LOCALE) {
    await supabase.from("categories").update(fields).eq("id", category.id);
  }

  revalidatePath(`/categories/${category.id}`);

  return {
    status: "ok",
    message:
      `« ${meilleur.keyword} » retenu` +
      (meilleur.volume !== null ? ` — ${meilleur.volume.toLocaleString("fr-FR")} recherches/mois` : "") +
      (meilleur.difficulty !== null ? `, difficulté ${meilleur.difficulty}` : "") +
      `. ${meilleur.verdict}`,
    locale,
    candidates: candidates.slice(0, 5),
    avertissements,
  };
}

/* ============================ 2. phase 1 : balises et segment d'URL ====== */

export type MetadataState = {
  status: "idle" | "ok" | "error";
  message: string;
  locale?: string;
  proposal?: {
    title: string;
    metaDescription: string;
    h1: string;
    linkRewrite: string;
    rationale: string;
  };
};

/**
 * Première phase : les balises et l'URL, sans le texte.
 *
 * C'est l'ordre que le client a demandé, et il a raison sur le fond : un mauvais
 * cadrage se voit en dix secondes sur un title, et en dix minutes sur sept mille
 * caractères. Cette étape coûte une fraction de la rédaction complète, donc on
 * peut la relancer jusqu'à ce qu'elle tombe juste — puis figer.
 */
export async function runMetadataPhase(
  _prev: MetadataState,
  formData: FormData,
): Promise<MetadataState> {
  const loaded = await loadContext(formData);
  if (loaded.erreur !== undefined) return { status: "error", message: loaded.erreur };
  const ctx = loaded.ctx;

  const { supabase, category, project, locale, row } = ctx;

  const keyword = (row.target_keyword ?? "").trim();
  if (!keyword) {
    return {
      status: "error",
      message:
        `Pas de mot-clé principal en ${localeLabel(locale)}. Utilise d'abord le bouton ` +
        `de proposition : c'est lui qui cadre le title, le H1 et l'URL.`,
      locale,
    };
  }

  const { family } = await loadProjectContext(supabase, category, locale);

  const serp = (row.serp_data ?? category.serp_data ?? {}) as Partial<SerpAnalysis>;

  // Les titles des autres catégories : c'est là que la duplication se voit le
  // plus vite, et un title dupliqué coûte plus cher qu'un paragraphe dupliqué.
  const { data: others } = await supabase
    .from("category_locales")
    .select("title")
    .eq("project_id", category.project_id)
    .eq("locale", locale)
    .neq("category_id", category.id)
    .not("title", "is", null);

  let proposal;
  try {
    proposal = await generateMetadata({
      brand: project?.name ?? "",
      domain: project?.domain ?? null,
      brief: project?.notes ?? null,
      businessRules: project?.business_rules ?? null,
      market: (project?.market ?? null) as Market,
      locale,
      categoryName: row.name || category.name,
      categoryUrl: row.url ?? category.url,
      currentLinkRewrite:
        row.link_rewrite ?? linkRewriteFromUrl(row.url ?? category.url),
      keyword,
      family,
      serp: serp.results ?? [],
      gscQueries: gscQueriesOf(row, category),
      currentTitle: category.source_title,
      currentMetaDescription: category.source_meta_description,
      currentH1: category.source_h1,
      takenTitles: (others ?? [])
        .map((other) => other.title as string | null)
        .filter((value): value is string => Boolean(value)),
    });
  } catch (error) {
    const message = error instanceof GenerationError ? error.message : (error as Error).message;
    return { status: "error", message, locale };
  }

  const linkRewrite = toLinkRewrite(proposal.linkRewrite);

  // On enregistre la proposition mais on ne l'approuve pas : l'approbation est
  // un geste humain, et c'est elle qui rend les balises intouchables par la
  // rédaction.
  const { error } = await supabase
    .from("category_locales")
    .update({
      title: proposal.title,
      meta_description: proposal.metaDescription,
      h1: proposal.h1,
      link_rewrite: linkRewrite || null,
      metadata_generated_at: new Date().toISOString(),
      metadata_engine: GENERATION_MODEL,
      metadata_approved: false,
    })
    .eq("category_id", category.id)
    .eq("locale", locale);

  if (error) {
    return { status: "error", message: `Enregistrement impossible : ${error.message}`, locale };
  }

  revalidatePath(`/categories/${category.id}`);

  const trop = proposal.metaDescription.length > 158;

  return {
    status: "ok",
    message:
      `Balises proposées en ${localeLabel(locale)} : title ${proposal.title.length} car., ` +
      `meta ${proposal.metaDescription.length} car., H1 ${proposal.h1.length} car.` +
      (trop ? " La meta dépasse 158 caractères : Google la tronquera, à raccourcir." : "") +
      " Relis, corrige, puis valide — la rédaction reprendra ces balises telles quelles.",
    locale,
    proposal: { ...proposal, linkRewrite },
  };
}

/**
 * Enregistre les balises et le segment d'URL, corrigés à la main.
 *
 * C'est exactement la demande « pouvoir retravailler les liens sans regénérer
 * les descriptions » : cette action ne touche à aucun texte, et peut être
 * rejouée autant de fois qu'on veut sur une catégorie déjà rédigée.
 */
export async function saveMetadata(formData: FormData) {
  const loaded = await loadContext(formData);
  if (loaded.erreur !== undefined) throw new Error(loaded.erreur);
  const ctx = loaded.ctx;

  const { supabase, category, locale } = ctx;

  const linkRewrite = toLinkRewrite(text(formData, "link_rewrite"));

  const { error } = await supabase
    .from("category_locales")
    .update({
      title: optionalText(formData, "title"),
      meta_description: optionalText(formData, "meta_description"),
      h1: optionalText(formData, "h1"),
      link_rewrite: linkRewrite || null,
      metadata_approved: formData.get("approved") !== null,
    })
    .eq("category_id", category.id)
    .eq("locale", locale);

  if (error) throw new Error(`Enregistrement impossible : ${error.message}`);

  revalidatePath(`/categories/${category.id}`);
  revalidatePath(`/projects/${category.project_id}`);
}

/* ================================== 5. longueur cible depuis la SERP ===== */

export type TargetLengthState = {
  status: "idle" | "ok" | "error";
  message: string;
  locale?: string;
  mesure?: TargetLength;
};

/**
 * Déduit la longueur à viser du top 10 réel, et l'enregistre sur la catégorie.
 *
 * Le relevé de SERP est refait au passage : mesurer la longueur des pages d'un
 * classement vieux de trois semaines reviendrait à viser la concurrence d'avant.
 */
export async function measureTargetLengthAction(
  _prev: TargetLengthState,
  formData: FormData,
): Promise<TargetLengthState> {
  const loaded = await loadContext(formData);
  if (loaded.erreur !== undefined) return { status: "error", message: loaded.erreur };
  const ctx = loaded.ctx;

  const { supabase, category, project, locale, row } = ctx;

  const keyword = (row.target_keyword ?? "").trim();
  if (!keyword) {
    return {
      status: "error",
      message: `Pas de mot-clé principal en ${localeLabel(locale)} : rien à mesurer.`,
      locale,
    };
  }

  let analysis: SerpAnalysis;
  try {
    analysis = await fetchSerp(keyword, project?.domain ?? null, locale, 10);
  } catch (error) {
    const message = error instanceof SerpError ? error.message : (error as Error).message;
    return {
      status: "error",
      message: `Classement non relevé : ${message} Sans le top 10, la longueur cible n'a pas de référence.`,
      locale,
    };
  }

  const mesure = await measureTargetLength(analysis.results, 10);

  if (mesure.mesurees < 3) {
    // Une médiane sur deux pages n'est pas une médiane. On enregistre le relevé
    // pour qu'il soit consultable, mais pas la cible.
    await supabase
      .from("category_locales")
      .update({
        serp_data: analysis,
        serp_fetched_at: analysis.fetchedAt,
        target_length_source: mesure,
      })
      .eq("category_id", category.id)
      .eq("locale", locale);

    revalidatePath(`/categories/${category.id}`);

    return {
      status: "error",
      message:
        `Seulement ${mesure.mesurees} page(s) du top 10 ont pu être lues — ` +
        `trop peu pour en tirer une médiane. Aucune cible enregistrée. ` +
        `Détail des échecs ci-dessous.`,
      locale,
      mesure,
    };
  }

  const { error } = await supabase
    .from("category_locales")
    .update({
      target_length: mesure.target,
      target_length_source: mesure,
      serp_data: analysis,
      serp_fetched_at: analysis.fetchedAt,
    })
    .eq("category_id", category.id)
    .eq("locale", locale);

  if (error) {
    return { status: "error", message: `Enregistrement impossible : ${error.message}`, locale };
  }

  revalidatePath(`/categories/${category.id}`);

  return {
    status: "ok",
    message:
      `Cible : ${mesure.target?.toLocaleString("fr-FR")} caractères, médiane de ` +
      `${mesure.mesurees} pages du top 10 sur « ${keyword} » ` +
      `(de ${mesure.min?.toLocaleString("fr-FR")} à ${mesure.max?.toLocaleString("fr-FR")}). ` +
      `La rédaction s'y tiendra à ±15 %.`,
    locale,
    mesure,
  };
}

/* ============================ 2b. phase 2 : les deux descriptions ======== */

export type DescriptionState = {
  status: "idle" | "ok" | "error";
  message: string;
  locale?: string;
  steps?: PipelineStep[];
  score?: number;
};

/**
 * Deuxième phase : les deux descriptions, dans une langue donnée.
 *
 * Elle reprend tout ce que les phases précédentes ont établi — le mot-clé
 * mesuré, les balises validées, la longueur du top 10, et les raisons des refus
 * passés. C'est ce cumul qui fait la différence avec un simple « génère un
 * texte » : chaque élément a été décidé et relu séparément.
 */
export async function runDescriptionPhase(
  _prev: DescriptionState,
  formData: FormData,
): Promise<DescriptionState> {
  const loaded = await loadContext(formData);
  if (loaded.erreur !== undefined) return { status: "error", message: loaded.erreur };
  const ctx = loaded.ctx;

  const { supabase, user, category, project, locale, row } = ctx;
  const steps: PipelineStep[] = [];
  const market = (project?.market ?? null) as Market;

  const keyword = (row.target_keyword ?? "").trim();
  if (!keyword) {
    return {
      status: "error",
      message:
        `Pas de mot-clé principal en ${localeLabel(locale)}. La phase 1 se fait avant ` +
        `la phase 2 — c'est tout l'intérêt de les avoir séparées.`,
      locale,
    };
  }

  /* --- la page, dans SA langue ----------------------------------------- */
  //
  // Une catégorie allemande a sa propre URL, et donc ses propres intitulés de
  // produits et de filtres. Lire la page française pour écrire l'allemande
  // ferait citer des matières sous leur nom français.

  let source = (category.source_data ?? {}) as {
    products?: string[];
    facets?: { name: string; values: string[] }[];
    breadcrumb?: string[];
  };
  let currentText = category.source_content;

  const pageUrl = row.url ?? category.url;
  const samePage = pageUrl === category.url;

  if (!samePage) {
    try {
      const extraction = await extractFromUrl(pageUrl);
      source = {
        products: extraction.products,
        facets: extraction.facets,
        breadcrumb: extraction.breadcrumb,
      };
      currentText = extraction.seoText;
      steps.push({
        label: `Relevé de la page ${localeLabel(locale)}`,
        status: "ok",
        detail: `${extraction.products.length} produits, ${extraction.facets.length} facettes`,
      });
    } catch (error) {
      const message =
        error instanceof ExtractionError ? error.message : (error as Error).message;
      steps.push({
        label: `Relevé de la page ${localeLabel(locale)}`,
        status: "skipped",
        detail:
          `${message} On repart du relevé français : la composition du catalogue est ` +
          `la même, mais les intitulés seront en français — à vérifier dans le texte rendu.`,
      });
    }
  }

  /* --- ce qui est déjà pris -------------------------------------------- */

  const { takenKeywords, takenAngles, family } = await loadProjectContext(
    supabase,
    category,
    locale,
  );

  /* --- les refus précédents -------------------------------------------- */

  const { data: refus } = await supabase
    .from("optimizations")
    .select("rejection_reason, version")
    .eq("category_id", category.id)
    .eq("locale", locale)
    .not("rejection_reason", "is", null)
    .order("version", { ascending: false })
    .limit(5);

  const rejectionReasons = (refus ?? [])
    .map((entry) => entry.rejection_reason as string | null)
    .filter((value): value is string => Boolean(value));

  if (rejectionReasons.length > 0) {
    steps.push({
      label: "Reprise des refus",
      status: "ok",
      detail: `${rejectionReasons.length} raison(s) de refus repassée(s) au modèle`,
    });
  }

  /* --- les balises validées -------------------------------------------- */

  // Les balises validées à la main priment toujours. Le traitement en série
  // vient d'en produire sans qu'on ait pu les relire : il demande explicitement
  // à les réutiliser, sinon la rédaction en inventerait d'autres et les deux
  // jeux divergeraient sur la même page.
  const forceMetadata = formData.get("use_metadata") !== null;
  const hasMetadata = Boolean(row.title || row.meta_description || row.h1);
  const approved =
    (row.metadata_approved || forceMetadata) && hasMetadata
      ? { title: row.title, metaDescription: row.meta_description, h1: row.h1 }
      : null;

  steps.push({
    label: "Balises",
    status: approved ? "ok" : "skipped",
    detail: approved
      ? row.metadata_approved
        ? "Reprises telles quelles : elles ont été validées en phase 1."
        : "Reprises de la phase 1, mais PAS encore validées à la main — à relire avant publication."
      : "Non validées : le modèle en proposera de nouvelles avec le texte.",
  });

  const sujets =
    (row.target_length_source as { sujets?: { titre: string; pages: number }[] } | null)
      ?.sujets ?? [];

  steps.push({
    label: "Longueur cible",
    status: row.target_length ? "ok" : "skipped",
    detail: row.target_length
      ? `${row.target_length.toLocaleString("fr-FR")} caractères, d'après le top 10`
      : "Non mesurée : fourchette générale de 4 000 à 7 000 caractères.",
  });

  steps.push({
    label: "Socle de sujets",
    status: sujets.length > 0 ? "ok" : "skipped",
    detail:
      sujets.length > 0
        ? `${sujets.length} sujet(s) relevé(s) chez les concurrents, passés à la rédaction`
        : "Aucun sujet relevé : mesure la longueur cible pour les obtenir.",
  });

  /* --- rédaction -------------------------------------------------------- */

  const serp = (row.serp_data ?? category.serp_data ?? {}) as Partial<SerpAnalysis>;

  // Les mots-clés secondaires français se saisissent encore dans l'ancien
  // formulaire, qui écrit sur `categories`. Les lire uniquement dans la ligne de
  // langue les perdrait sans rien dire — on retombe donc sur la source
  // historique quand la ligne est vide, et seulement pour le français.
  const frenchFallback = locale === DEFAULT_LOCALE;
  const secondaryKeywords =
    row.secondary_keywords && row.secondary_keywords.length > 0
      ? row.secondary_keywords
      : frenchFallback
        ? (category.secondary_keywords ?? [])
        : [];
  const fanQueries =
    row.fan_queries && row.fan_queries.length > 0
      ? row.fan_queries
      : frenchFallback
        ? (category.fan_queries ?? [])
        : [];

  let content: CategoryContent;
  try {
    content = await generateCategoryContent({
      brand: project?.name ?? "",
      domain: project?.domain ?? null,
      brief: project?.notes ?? null,
      businessRules: project?.business_rules ?? null,
      market,
      family,
      categoryName: row.name || category.name,
      categoryUrl: pageUrl,
      keyword,
      secondaryKeywords,
      fanQueries,
      categoryBrief: row.brief ?? (frenchFallback ? category.brief : null),
      gscQueries: gscQueriesOf(row, category).slice(0, 25),
      serp: serp.results ?? [],
      ownRank: serp.ownRank ?? null,
      breadcrumb: source.breadcrumb ?? [],
      products: source.products ?? [],
      facets: source.facets ?? [],
      currentText,
      currentShortDescription: row.catalog_short_description,
      currentLongDescription: row.catalog_long_description,
      takenKeywords,
      takenAngles,
      locale,
      targetLength: row.target_length,
      competitorTopics:
        (row.target_length_source as { sujets?: { titre: string; pages: number }[] } | null)
          ?.sujets ?? [],
      approvedMetadata: approved,
      rejectionReasons,
    });
  } catch (error) {
    const message = error instanceof GenerationError ? error.message : (error as Error).message;
    steps.push({ label: "Rédaction", status: "error", detail: message });
    return { status: "error", message, locale, steps };
  }

  // Une balise approuvée l'est : si le modèle a malgré tout réécrit le title, on
  // remet le validé. Le contraire ferait de l'approbation une suggestion.
  if (approved) {
    if (approved.title) content.title = approved.title;
    if (approved.metaDescription) content.metaDescription = approved.metaDescription;
    if (approved.h1) content.h1 = approved.h1;
  }

  steps.push({
    label: "Rédaction",
    status: "ok",
    detail: `Angle « ${content.editorialAngle} » · deux descriptions en ${localeLabel(locale)}`,
  });

  /* --- correction automatique des écarts mesurés ------------------------ */
  //
  // Le barème est déterministe : à la seconde où le texte est rendu, on sait
  // déjà quels contrôles sont au rouge. Livrer sans corriger reviendrait à
  // demander une relecture humaine sur cent quatre-vingts pages pour des écarts
  // que la machine sait constater elle-même.

  const avant = findDefects(content, keyword, row.target_length);
  let apres = avant;

  if (avant.length > 0) {
    try {
      const corrected = await repairCategoryContent({
        content,
        keyword,
        locale,
        defects: describeDefects(avant),
        targetLength: row.target_length,
        businessRules: project?.business_rules ?? null,
      });

      // Les balises approuvées restent intouchables, même par la correction.
      if (approved) {
        if (approved.title) corrected.title = approved.title;
        if (approved.metaDescription) corrected.metaDescription = approved.metaDescription;
        if (approved.h1) corrected.h1 = approved.h1;
      }

      const best = pickBest(
        { content, defects: avant },
        { content: corrected, defects: findDefects(corrected, keyword, row.target_length) },
      );
      content = best.content;
      apres = best.defects;

      steps.push({
        label: "Correction automatique",
        status: apres.length === 0 ? "ok" : "skipped",
        detail:
          `${avant.length} écart(s) constaté(s), version ${best.retenue} retenue` +
          (apres.length > 0
            ? ` · reste : ${apres.map((defect) => defect.constat).join(" · ")}`
            : " · tout au vert"),
      });
    } catch (error) {
      const message = error instanceof GenerationError ? error.message : (error as Error).message;
      steps.push({
        label: "Correction automatique",
        status: "error",
        detail: `${message} La version est conservée telle quelle, avec ses ${avant.length} écart(s).`,
      });
    }
  } else {
    steps.push({
      label: "Correction automatique",
      status: "ok",
      detail: "Aucun écart à corriger, tout est au vert dès la première passe.",
    });
  }

  const {
    score,
    compliance,
    similarity,
    longueur,
    error: insertError,
  } = await persistOptimization(supabase, {
    categoryId: category.id,
    categoryName: row.name || category.name,
    projectId: category.project_id,
    externalId: category.external_id,
    parentExternalId: category.parent_external_id,
    locale,
    keyword,
    market,
    content,
    userId: user.id,
    groundedInPage: (source.products?.length ?? 0) > 0,
    targetLength: row.target_length,
    source: "phases",
    steps,
  });

  if (insertError) {
    return { status: "error", message: `Enregistrement impossible : ${insertError}`, locale, steps };
  }

  await supabase
    .from("category_locales")
    .update({ status: "optimized" })
    .eq("category_id", category.id)
    .eq("locale", locale);

  if (locale === DEFAULT_LOCALE) {
    await supabase.from("categories").update({ status: "optimized" }).eq("id", category.id);
  }

  revalidatePath(`/categories/${category.id}`);
  revalidatePath(`/projects/${category.project_id}`);

  return {
    status: "ok",
    message:
      `Texte généré en ${localeLabel(locale)}, score ${score}/100.` +
      lengthSummary(longueur, row.target_length) +
      defectsSummary(avant, apres) +
      (locale === DEFAULT_LOCALE
        ? complianceSummary(compliance)
        : " Règles métier : contrôle automatique réservé au français, à relire à l'œil.") +
      similaritySummary(similarity),
    locale,
    steps,
    score,
  };
}

/**
 * Corrige la dernière version sur ses écarts mesurés, sans tout réécrire.
 *
 * « Un contenu à 77/100, qu'est-ce qui lui manque et comment le relancer ? » —
 * la liste des contrôles répond à la première moitié depuis le début, celle-ci
 * répond à la seconde. Elle ne relance pas une rédaction complète : elle reprend
 * le texte existant et ne touche qu'aux points au rouge, ce qui préserve l'angle
 * et les arguments qu'on avait jugés bons.
 *
 * Le résultat est archivé en nouvelle version, jamais en écrasement : on doit
 * pouvoir comparer, et revenir en arrière si la correction a fait pire.
 */
export async function repairLatestVersion(
  _prev: DescriptionState,
  formData: FormData,
): Promise<DescriptionState> {
  const loaded = await loadContext(formData);
  if (loaded.erreur !== undefined) return { status: "error", message: loaded.erreur };
  const ctx = loaded.ctx;

  const { supabase, user, category, project, locale, row } = ctx;
  const steps: PipelineStep[] = [];

  const keyword = (row.target_keyword ?? "").trim();
  if (!keyword) {
    return { status: "error", message: "Pas de mot-clé principal : rien à mesurer.", locale };
  }

  const { data: latest } = await supabase
    .from("optimizations")
    .select("id, version, payload")
    .eq("category_id", category.id)
    .eq("locale", locale)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const structured = (latest?.payload as { structured?: CategoryContent } | null)?.structured;
  if (!structured) {
    return {
      status: "error",
      message:
        "Aucune version à corriger dans cette langue. Les versions antérieures à la " +
        "refonte n'ont pas conservé leur structure détaillée : pour celles-là, il faut " +
        "relancer une rédaction complète.",
      locale,
    };
  }

  const avant = findDefects(structured, keyword, row.target_length);
  if (avant.length === 0) {
    return {
      status: "ok",
      message: `La version ${latest?.version} n'a aucun écart mesurable. Ce qui lui manque pour monter relève du fond, pas du barème — c'est le refus motivé qui sert à ça.`,
      locale,
    };
  }

  let corrected: CategoryContent;
  try {
    corrected = await repairCategoryContent({
      content: structured,
      keyword,
      locale,
      defects: describeDefects(avant),
      targetLength: row.target_length,
      businessRules: project?.business_rules ?? null,
    });
  } catch (error) {
    const message = error instanceof GenerationError ? error.message : (error as Error).message;
    return { status: "error", message, locale };
  }

  if (row.metadata_approved) {
    if (row.title) corrected.title = row.title;
    if (row.meta_description) corrected.metaDescription = row.meta_description;
    if (row.h1) corrected.h1 = row.h1;
  }

  const best = pickBest(
    { content: structured, defects: avant },
    { content: corrected, defects: findDefects(corrected, keyword, row.target_length) },
  );

  if (best.retenue === "originale") {
    return {
      status: "error",
      message:
        `La correction a produit un texte moins conforme que l'original (${best.defects.length} ` +
        `écart(s) contre ${avant.length}). Rien n'a été enregistré. Relance, ou refuse la ` +
        `version avec une raison précise — c'est plus efficace qu'une correction mécanique ` +
        `quand le problème est ailleurs.`,
      locale,
    };
  }

  steps.push({
    label: "Correction",
    status: "ok",
    detail: avant.map((defect) => defect.constat).join(" · "),
  });

  const {
    score,
    similarity,
    longueur,
    error: insertError,
  } = await persistOptimization(supabase, {
    categoryId: category.id,
    categoryName: row.name || category.name,
    projectId: category.project_id,
    externalId: category.external_id,
    parentExternalId: category.parent_external_id,
    locale,
    keyword,
    market: (project?.market ?? null) as Market,
    content: best.content,
    userId: user.id,
    groundedInPage:
      ((category.source_data as { products?: string[] } | null)?.products?.length ?? 0) > 0,
    targetLength: row.target_length,
    source: "correction",
    steps,
  });

  if (insertError) {
    return { status: "error", message: `Enregistrement impossible : ${insertError}`, locale, steps };
  }

  revalidatePath(`/categories/${category.id}`);

  return {
    status: "ok",
    message:
      `Version corrigée à partir de la v${latest?.version}, score ${score}/100.` +
      lengthSummary(longueur, row.target_length) +
      defectsSummary(avant, best.defects) +
      similaritySummary(similarity),
    locale,
    steps,
    score,
  };
}

/* ================================== 8. boucle de correction ============== */

export type RejectState = {
  status: "idle" | "ok" | "error";
  message: string;
};

/**
 * Consigne le refus d'une version, et pourquoi.
 *
 * C'est la demande la plus rentable des huit, et la moins spectaculaire. Une
 * correction faite à la main dans le texte sert une catégorie ; la raison de
 * cette correction, écrite ici, revient dans le prompt de toutes les versions
 * suivantes de cette catégorie — et se relit en bloc à l'échelle du projet pour
 * décider quoi remonter dans les règles métier.
 *
 * Le texte refusé n'est pas supprimé. Une version est un fait daté : on ne
 * réécrit pas l'histoire, on lui attache un verdict.
 */
export async function rejectOptimization(
  _prev: RejectState,
  formData: FormData,
): Promise<RejectState> {
  const { supabase, user } = await requireUser();

  const optimizationId = text(formData, "optimization_id");
  const categoryId = text(formData, "category_id");
  const reason = text(formData, "reason");

  if (!optimizationId || !categoryId) {
    return { status: "error", message: "Version manquante." };
  }
  if (reason.length < 10) {
    return {
      status: "error",
      message:
        "Écris la raison du refus — au moins une phrase. « Pas bon » ne se " +
        "réinjecte pas dans un prompt, et c'est tout l'objet de ce champ.",
    };
  }

  const { error } = await supabase
    .from("optimizations")
    .update({
      rejection_reason: reason,
      rejected_at: new Date().toISOString(),
      rejected_by: user.id,
    })
    .eq("id", optimizationId);

  if (error) {
    return {
      status: "error",
      message: error.message.includes("rejection_reason")
        ? LOCALE_TABLE_HINT
        : `Enregistrement du refus impossible : ${error.message}`,
    };
  }

  const locale = text(formData, "locale") || DEFAULT_LOCALE;

  // La catégorie repasse en cours : elle n'est plus « optimisée », puisque la
  // dernière version est refusée.
  await supabase
    .from("category_locales")
    .update({ status: "in_progress" })
    .eq("category_id", categoryId)
    .eq("locale", locale);

  if (locale === DEFAULT_LOCALE) {
    await supabase.from("categories").update({ status: "in_progress" }).eq("id", categoryId);
  }

  revalidatePath(`/categories/${categoryId}`);

  return {
    status: "ok",
    message:
      "Refus consigné. Il sera repassé au modèle à la prochaine rédaction de cette " +
      "catégorie. S'il vaut pour tout le site, remonte-le dans les règles métier du " +
      "projet — c'est là qu'il profitera aux 180 autres.",
  };
}

/* ================================== 7. statut et mise en ligne =========== */

const STATUSES = ["todo", "in_progress", "optimized", "published"] as const;
type Status = (typeof STATUSES)[number];

/**
 * Change le statut d'une catégorie dans une langue, et date sa mise en ligne.
 *
 * La date de publication n'est pas décorative : sans elle, on ne sait pas à
 * partir de quand comparer les positions, et donc pas si la réécriture a servi à
 * quelque chose. Elle est posée automatiquement au passage en « publié », et
 * effacée si l'on revient en arrière — une date de publication sur une page non
 * publiée serait un mensonge dans l'export.
 */
export async function setLocaleStatus(formData: FormData) {
  const { supabase } = await requireUser();

  const categoryId = text(formData, "category_id");
  const locale = text(formData, "locale") || DEFAULT_LOCALE;
  const status = text(formData, "status") as Status;

  if (!categoryId || !STATUSES.includes(status)) return;

  const { data: existing } = await supabase
    .from("category_locales")
    .select("published_at")
    .eq("category_id", categoryId)
    .eq("locale", locale)
    .maybeSingle();

  const published_at =
    status === "published"
      ? // On ne réécrit pas une date déjà posée : la première mise en ligne est le
        // repère de mesure, pas la dernière modification de statut.
        ((existing?.published_at as string | null) ?? new Date().toISOString())
      : null;

  const { error } = await supabase
    .from("category_locales")
    .update({ status, published_at })
    .eq("category_id", categoryId)
    .eq("locale", locale);

  if (error) throw new Error(`Changement de statut impossible : ${error.message}`);

  if (locale === DEFAULT_LOCALE) {
    await supabase.from("categories").update({ status }).eq("id", categoryId);
  }

  revalidatePath(`/categories/${categoryId}`);
  const projectId = text(formData, "project_id");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}
