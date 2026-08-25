"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/moulinette";
import {
  generateCategoryContent,
  suggestKeywords,
  GenerationError,
  GENERATION_MODEL,
  type CategoryContent,
  type KeywordSuggestion,
} from "@/lib/generate";
import {
  buildFamily,
  parseCatalogueCsv,
  CatalogueParseError,
  type Family,
} from "@/lib/catalogue";
import { checkCompliance, type ComplianceReport, type Market } from "@/lib/compliance";
import {
  renderCategoryHtml,
  renderCategoryText,
  renderShortDescriptionHtml,
  renderShortDescriptionText,
} from "@/lib/render";
import { extractFromUrl, ExtractionError } from "@/lib/extract";
import {
  parseGscCsv,
  groupByPage,
  findCannibalization,
  opportunityScore,
  looksLikeCategoryUrl,
  nameFromUrl,
  urlKey,
  GscParseError,
} from "@/lib/gsc";
import { parseSemrushCsv, keywordKey, SemrushParseError } from "@/lib/semrush";
import { fetchSerp, SerpError, type SerpAnalysis } from "@/lib/dataforseo";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optionalText(formData: FormData, key: string): string | null {
  return text(formData, key) || null;
}

export async function createProject(formData: FormData) {
  const { supabase, user } = await requireUser();

  const name = text(formData, "name");
  if (!name) return;

  const { data, error } = await supabase
    .from("projects")
    .insert({
      owner_id: user.id,
      name,
      domain: optionalText(formData, "domain"),
    })
    .select("id")
    .single();

  if (error) throw new Error(`Création du projet impossible : ${error.message}`);

  revalidatePath("/dashboard");
  redirect(`/projects/${data.id}`);
}

export async function createCategory(formData: FormData) {
  const { supabase } = await requireUser();

  const projectId = text(formData, "project_id");
  const name = text(formData, "name");
  const url = text(formData, "url");
  if (!projectId || !name || !url) return;

  const { error } = await supabase.from("categories").insert({
    project_id: projectId,
    name,
    url,
    target_keyword: optionalText(formData, "target_keyword"),
  });

  if (error) {
    throw new Error(
      error.code === "23505"
        ? "Cette URL est déjà suivie dans ce projet."
        : `Ajout de la catégorie impossible : ${error.message}`,
    );
  }

  revalidatePath(`/projects/${projectId}`);
}

export type GenerationState = {
  status: "idle" | "ok" | "error";
  message: string;
  score?: number;
};

/** Ce que le projet impose et ce que les autres catégories occupent déjà. */
type ProjectContext = {
  takenKeywords: string[];
  takenAngles: string[];
  family: Family | null;
};

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

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
async function loadProjectContext(
  supabase: SupabaseClient,
  category: {
    id: string;
    project_id: string;
    external_id: number | null;
    parent_external_id: number | null;
    name: string;
    url: string;
    target_keyword: string | null;
  },
): Promise<ProjectContext> {
  const { data: rows } = await supabase
    .from("categories")
    .select(
      "id, external_id, parent_external_id, name, url, target_keyword, optimizations(editorial_angle, version)",
    )
    .eq("project_id", category.project_id);

  const all = rows ?? [];
  const takenKeywords: string[] = [];
  const angles = new Map<string, string | null>();

  for (const row of all) {
    if (row.id === category.id) continue;
    if (row.target_keyword) takenKeywords.push(row.target_keyword);

    const latest = [...(row.optimizations ?? [])].sort((a, b) => b.version - a.version)[0];
    if (latest?.editorial_angle) angles.set(row.id, latest.editorial_angle);
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
 * Rend, note, contrôle et archive une version.
 *
 * Le contrôle des règles métier porte sur les deux livrables réunis : un
 * interdit dans la description courte compte autant que dans la longue.
 */
async function persistOptimization(
  supabase: SupabaseClient,
  args: {
    categoryId: string;
    categoryName: string;
    keyword: string;
    market: Market;
    content: CategoryContent;
    userId: string;
    groundedInPage: boolean;
    steps?: PipelineStep[];
  },
): Promise<{ score: number; compliance: ComplianceReport; error: string | null }> {
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

  const compliance = checkCompliance(`${shortText}\n\n${longText}`, {
    market: args.market,
    categoryName: args.categoryName,
  });

  const { error } = await supabase.from("optimizations").insert({
    category_id: args.categoryId,
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
      ...(args.steps ? { steps: args.steps } : {}),
      // Une version rédigée sans relevé de page ne peut pas être jugée comme une
      // autre : les matières et références qu'elle cite ne sont pas vérifiées
      // contre le catalogue.
      groundedInPage: args.groundedInPage,
    },
    created_by: args.userId,
  });

  return { score, compliance, error: error?.message ?? null };
}

/** Une phrase sur l'état du contrôle métier, à coller au message de retour. */
function complianceSummary(report: ComplianceReport): string {
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

/**
 * Passe la catégorie à la moulinette : génération par Claude, rendu HTML,
 * audit, puis archivage en nouvelle version.
 *
 * On collecte d'abord ce qui est déjà pris par les autres catégories du projet
 * — mots-clés et angles éditoriaux — et on le passe au modèle. Sans ça, il
 * écrirait 180 variantes du même texte : il ne voit pas les autres pages.
 */
export async function runMoulinette(
  _prev: GenerationState,
  formData: FormData,
): Promise<GenerationState> {
  const { supabase, user } = await requireUser();

  const categoryId = text(formData, "category_id");
  if (!categoryId) return { status: "error", message: "Catégorie manquante." };

  const { data: category, error: readError } = await supabase
    .from("categories")
    .select("*, projects(id, name, domain, notes, business_rules, market)")
    .eq("id", categoryId)
    .single();

  if (readError || !category) {
    return { status: "error", message: `Catégorie introuvable : ${readError?.message ?? ""}` };
  }

  const project = category.projects as {
    id: string;
    name: string;
    domain: string | null;
    notes: string | null;
    business_rules: string | null;
    market: string | null;
  } | null;

  const keyword = (category.target_keyword ?? "").trim();
  if (!keyword) {
    return {
      status: "error",
      message:
        "Renseigne d'abord le mot-clé principal : c'est lui qui cadre tout le texte.",
    };
  }

  const { takenKeywords, takenAngles, family } = await loadProjectContext(
    supabase,
    category,
  );

  const source = (category.source_data ?? {}) as {
    products?: string[];
    facets?: { name: string; values: string[] }[];
    breadcrumb?: string[];
  };

  const gsc = (category.gsc_data ?? {}) as {
    queries?: { query: string; impressions: number; position: number }[];
  };
  const gscQueries = gsc.queries ?? [];

  const serp = (category.serp_data ?? {}) as Partial<SerpAnalysis>;

  let content;
  try {
    content = await generateCategoryContent({
      brand: project?.name ?? "",
      domain: project?.domain ?? null,
      brief: project?.notes ?? null,
      businessRules: project?.business_rules ?? null,
      market: (project?.market ?? null) as Market,
      family,
      categoryName: category.name,
      categoryUrl: category.url,
      keyword,
      secondaryKeywords: category.secondary_keywords ?? [],
      fanQueries: category.fan_queries ?? [],
      categoryBrief: category.brief,
      gscQueries: gscQueries.slice(0, 25),
      serp: serp.results ?? [],
      ownRank: serp.ownRank ?? null,
      breadcrumb: source.breadcrumb ?? [],
      products: source.products ?? [],
      facets: source.facets ?? [],
      currentText: category.source_content,
      currentShortDescription: category.catalog_short_description,
      currentLongDescription: category.catalog_long_description,
      takenKeywords,
      takenAngles,
    });
  } catch (error) {
    if (error instanceof GenerationError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: (error as Error).message };
  }

  const { score, compliance, error: insertError } = await persistOptimization(supabase, {
    categoryId,
    categoryName: category.name,
    keyword,
    market: (project?.market ?? null) as Market,
    content,
    userId: user.id,
    groundedInPage: (source.products?.length ?? 0) > 0,
  });

  if (insertError) {
    return {
      status: "error",
      message: `Enregistrement de l'optimisation impossible : ${insertError}`,
    };
  }

  await supabase.from("categories").update({ status: "optimized" }).eq("id", categoryId);
  revalidatePath(`/categories/${categoryId}`);

  return {
    status: "ok",
    message:
      `Texte généré — angle retenu : « ${content.editorialAngle} ». Score ${score}/100.` +
      complianceSummary(compliance),
    score,
  };
}

export async function deleteCategory(formData: FormData) {
  const { supabase } = await requireUser();

  const categoryId = text(formData, "category_id");
  const projectId = text(formData, "project_id");
  if (!categoryId) return;

  const { error } = await supabase.from("categories").delete().eq("id", categoryId);
  if (error) throw new Error(`Suppression impossible : ${error.message}`);

  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

export type ImportState = {
  status: "idle" | "ok" | "error";
  message: string;
  diagnostics?: string[];
};

/**
 * Récupère la page catégorie en ligne et remplit le contenu source.
 * Renvoie un état plutôt que de lever : le message d'échec (pare-feu, 404,
 * sélecteur muet) est justement l'information utile à l'écran.
 */
export async function importFromUrl(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const { supabase } = await requireUser();

  const categoryId = text(formData, "category_id");
  if (!categoryId) {
    return { status: "error", message: "Catégorie manquante." };
  }

  const { data: category, error: readError } = await supabase
    .from("categories")
    .select("id, url")
    .eq("id", categoryId)
    .single();

  if (readError || !category) {
    return { status: "error", message: `Catégorie introuvable : ${readError?.message ?? ""}` };
  }

  let extraction;
  try {
    extraction = await extractFromUrl(category.url);
  } catch (error) {
    if (error instanceof ExtractionError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: (error as Error).message };
  }

  const { error: updateError } = await supabase
    .from("categories")
    .update({
      source_title: extraction.title,
      source_meta_description: extraction.metaDescription,
      source_h1: extraction.h1,
      source_content: extraction.seoText,
      source_data: {
        headings: extraction.headings,
        breadcrumb: extraction.breadcrumb,
        products: extraction.products,
        productCount: extraction.productCount,
        facets: extraction.facets,
        canonical: extraction.canonical,
        finalUrl: extraction.finalUrl,
        diagnostics: extraction.diagnostics,
      },
      source_fetched_at: new Date().toISOString(),
    })
    .eq("id", categoryId);

  if (updateError) {
    return { status: "error", message: `Enregistrement impossible : ${updateError.message}` };
  }

  revalidatePath(`/categories/${categoryId}`);

  const summary = [
    extraction.products.length > 0 ? `${extraction.products.length} produits` : "aucun produit",
    extraction.facets.length > 0 ? `${extraction.facets.length} facettes` : "aucune facette",
    extraction.seoText ? `${extraction.seoText.length} car. de texte` : "aucun texte SEO",
  ].join(" · ");

  return {
    status: "ok",
    message: `Page récupérée : ${summary}.`,
    diagnostics: extraction.diagnostics,
  };
}

export async function saveProjectBrief(formData: FormData) {
  const { supabase } = await requireUser();

  const projectId = text(formData, "project_id");
  if (!projectId) return;

  const market = text(formData, "market");

  const { error } = await supabase
    .from("projects")
    .update({
      domain: optionalText(formData, "domain"),
      notes: optionalText(formData, "notes"),
      market: market === "b2b" || market === "b2c" ? market : null,
    })
    .eq("id", projectId);

  if (error) throw new Error(`Enregistrement impossible : ${error.message}`);

  revalidatePath(`/projects/${projectId}`);
}

export type RulesState = {
  status: "idle" | "ok" | "error";
  message: string;
};

/**
 * Enregistre les règles métier du site.
 *
 * Le client a demandé explicitement qu'elles soient modifiables dans l'outil :
 * elles évoluent, et les figer dans le code obligerait à un déploiement à
 * chaque virgule. Elles sont injectées telles quelles dans le prompt.
 */
export async function saveBusinessRules(
  _prev: RulesState,
  formData: FormData,
): Promise<RulesState> {
  const { supabase } = await requireUser();

  const projectId = text(formData, "project_id");
  if (!projectId) return { status: "error", message: "Projet manquant." };

  const rules = String(formData.get("business_rules") ?? "").trim();

  const { error } = await supabase
    .from("projects")
    .update({ business_rules: rules || null })
    .eq("id", projectId);

  if (error) {
    return { status: "error", message: `Enregistrement impossible : ${error.message}` };
  }

  revalidatePath(`/projects/${projectId}`);

  return {
    status: "ok",
    message: rules
      ? `Règles métier enregistrées (${rules.length} caractères). Elles s'appliquent dès la prochaine génération.`
      : "Règles métier vidées. Les textes seront rédigés sans cadre métier.",
  };
}

/* ------------------------------------------- import du catalogue PrestaShop */

export type CatalogueImportState = {
  status: "idle" | "ok" | "error";
  message: string;
  skipped?: string[];
};

/**
 * Importe l'export de catalogue PrestaShop : la liste faisant autorité des
 * catégories, leur arborescence et les descriptions déjà en ligne.
 *
 * L'upsert porte sur l'URL, pas sur l'identifiant PrestaShop : une catégorie
 * déjà suivie — créée depuis un export Search Console, par exemple — est
 * complétée au lieu d'être dupliquée. Les mots-clés, briefs et optimisations
 * déjà saisis ne sont jamais écrasés.
 */
export async function importCatalogue(
  _prev: CatalogueImportState,
  formData: FormData,
): Promise<CatalogueImportState> {
  const { supabase } = await requireUser();

  const projectId = text(formData, "project_id");
  if (!projectId) return { status: "error", message: "Projet manquant." };

  const file = formData.get("file");
  let content = String(formData.get("csv") ?? "").trim();
  if (!content && file instanceof File && file.size > 0) content = await file.text();
  if (!content) {
    return { status: "error", message: "Dépose l'export catalogue ou colle son contenu." };
  }

  let parsed;
  try {
    parsed = parseCatalogueCsv(content, optionalText(formData, "locale") ?? undefined);
  } catch (error) {
    if (error instanceof CatalogueParseError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: (error as Error).message };
  }

  const { rows, locale, locales, skipped } = parsed;

  // Les noms ne remplacent pas ceux qu'on a pu corriger à la main ; le reste
  // vient du catalogue, qui fait autorité.
  const { error, count } = await supabase.from("categories").upsert(
    rows.map((row) => ({
      project_id: projectId,
      url: row.url,
      name: row.name,
      external_id: row.externalId,
      parent_external_id: row.parentExternalId,
      products_count: row.productsCount,
      catalog_short_description: row.shortDescription,
      catalog_long_description: row.longDescription,
    })),
    { onConflict: "project_id,url", count: "exact" },
  );

  if (error) {
    return { status: "error", message: `Import impossible : ${error.message}` };
  }

  revalidatePath(`/projects/${projectId}`);

  const withParent = rows.filter((row) => row.parentExternalId !== null).length;
  const withLong = rows.filter((row) => row.longDescription).length;

  return {
    status: "ok",
    message:
      `${rows.length} catégories importées en ${locale} (langues du fichier : ${locales.join(", ")}). ` +
      `${withParent} rattachées à une mère, ${withLong} avec une description longue déjà en ligne. ` +
      `${count ?? 0} lignes écrites.` +
      (skipped.length > 0 ? ` ${skipped.length} ligne(s) écartée(s).` : ""),
    skipped: skipped.slice(0, 15).map((item) => `Ligne ${item.line} : ${item.reason}`),
  };
}

/* ------------------------------------------------ import en masse des URL */

export type BulkImportState = {
  status: "idle" | "ok" | "error";
  message: string;
};

/**
 * Une URL de catégorie par ligne, avec un nom facultatif après `|`.
 *
 * Tolère qu'on colle directement des lignes de CSV (`URL,clics,impressions,…`) :
 * on isole la première URL de la ligne et on ignore le reste. Ça évite d'avoir à
 * nettoyer un export avant de s'en servir.
 */
function parseUrlList(raw: string): { url: string; name: string }[] {
  const out: { url: string; name: string }[] = [];

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const found = trimmed.match(/https?:\/\/[^\s,;|"'<>)\]]+/i);
    if (!found) continue;
    const url = found[0].replace(/[.,;]+$/, "");

    // Un nom n'est retenu que s'il est explicitement séparé par une barre verticale,
    // pour ne pas confondre avec les colonnes de métriques d'un CSV.
    const explicitName = trimmed.includes("|")
      ? trimmed.split("|").slice(1).join(" ").trim()
      : "";
    out.push({ url, name: explicitName || nameFromUrl(url) || url });
  }

  return out;
}

export async function importCategories(
  _prev: BulkImportState,
  formData: FormData,
): Promise<BulkImportState> {
  const { supabase } = await requireUser();

  const projectId = text(formData, "project_id");
  const raw = String(formData.get("urls") ?? "");
  if (!projectId) return { status: "error", message: "Projet manquant." };

  const parsed = parseUrlList(raw);
  if (parsed.length === 0) {
    return {
      status: "error",
      message: "Aucune URL valide détectée. Une URL complète par ligne (http/https).",
    };
  }

  // upsert plutôt qu'insert : réimporter la liste ne crée pas de doublons.
  const { error, count } = await supabase
    .from("categories")
    .upsert(
      parsed.map((item) => ({
        project_id: projectId,
        url: item.url,
        name: item.name,
      })),
      { onConflict: "project_id,url", ignoreDuplicates: true, count: "exact" },
    );

  if (error) {
    return { status: "error", message: `Import impossible : ${error.message}` };
  }

  revalidatePath(`/projects/${projectId}`);
  return {
    status: "ok",
    message: `${parsed.length} URL traitées, ${count ?? 0} catégorie(s) ajoutée(s). Les URL déjà présentes ont été ignorées.`,
  };
}

/* --------------------------------------------------------- import des GSC */

export type GscImportState = {
  status: "idle" | "ok" | "error";
  message: string;
  cannibalization?: { query: string; pages: string[] }[];
};

export async function importGscData(
  _prev: GscImportState,
  formData: FormData,
): Promise<GscImportState> {
  const { supabase } = await requireUser();

  const projectId = text(formData, "project_id");
  if (!projectId) return { status: "error", message: "Projet manquant." };

  const file = formData.get("file");
  const pasted = String(formData.get("csv") ?? "").trim();

  let content = pasted;
  if (!content && file instanceof File && file.size > 0) {
    content = await file.text();
  }
  if (!content) {
    return { status: "error", message: "Dépose un fichier CSV ou colle son contenu." };
  }

  let parsed;
  try {
    parsed = parseGscCsv(content);
  } catch (error) {
    if (error instanceof GscParseError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: (error as Error).message };
  }

  const { rows, hasQuery } = parsed;

  // L'export porte les URL du site : on en déduit les catégories plutôt que
  // d'exiger une liste établie ailleurs.
  let created = 0;
  if (formData.get("create_missing")) {
    const detected = new Map<string, string>();
    for (const row of rows) {
      if (looksLikeCategoryUrl(row.page)) detected.set(urlKey(row.page), row.page);
    }

    if (detected.size > 0) {
      const { error: insertError, count } = await supabase
        .from("categories")
        .upsert(
          [...detected.values()].map((url) => ({
            project_id: projectId,
            url,
            name: nameFromUrl(url) || url,
          })),
          { onConflict: "project_id,url", ignoreDuplicates: true, count: "exact" },
        );

      if (insertError) {
        return {
          status: "error",
          message: `Création des catégories détectées impossible : ${insertError.message}`,
        };
      }
      created = count ?? 0;
    }
  }

  const { data: categories, error: readError } = await supabase
    .from("categories")
    .select("id, url")
    .eq("project_id", projectId);

  if (readError) {
    return { status: "error", message: `Lecture des catégories impossible : ${readError.message}` };
  }
  if (!categories || categories.length === 0) {
    return {
      status: "error",
      message:
        "Aucune catégorie à rapprocher. Coche « créer les catégories détectées » " +
        "ou importe d'abord la liste des URL.",
    };
  }

  const grouped = groupByPage(rows);
  let matched = 0;

  for (const category of categories) {
    const pageRows = grouped.get(urlKey(category.url));
    if (!pageRows || pageRows.length === 0) continue;

    // Métriques de la page : la somme des requêtes en mode croisé, la ligne
    // elle-même quand l'export ne porte que les pages.
    const clicks = pageRows.reduce((sum, row) => sum + row.clicks, 0);
    const impressions = pageRows.reduce((sum, row) => sum + row.impressions, 0);
    const weightedPosition =
      impressions > 0
        ? pageRows.reduce((sum, row) => sum + row.position * row.impressions, 0) / impressions
        : (pageRows[0]?.position ?? 0);

    const { error: updateError } = await supabase
      .from("categories")
      .update({
        gsc_data: {
          pageMetrics: {
            clicks,
            impressions,
            position: Number(weightedPosition.toFixed(1)),
            opportunity: opportunityScore(impressions, weightedPosition),
          },
          queries: hasQuery ? pageRows.slice(0, 100) : [],
        },
        gsc_fetched_at: new Date().toISOString(),
      })
      .eq("id", category.id);

    if (!updateError) matched += 1;
  }

  // On ne signale que les conflits qui concernent au moins une catégorie suivie.
  // Sans dimension requête, la cannibalisation n'est pas détectable.
  const tracked = new Set(categories.map((category) => urlKey(category.url)));
  const cannibalization = (hasQuery ? findCannibalization(rows) : [])
    .filter((conflict) => conflict.pages.some((page) => tracked.has(urlKey(page.page))))
    .slice(0, 12)
    .map((conflict) => ({
      query: conflict.query,
      pages: conflict.pages.map(
        (page) => `${page.page} (${page.impressions} impr., pos. ${page.position.toFixed(1)})`,
      ),
    }));

  revalidatePath(`/projects/${projectId}`);

  return {
    status: "ok",
    message:
      `${rows.length} lignes lues, ${grouped.size} URL distinctes. ` +
      (created > 0 ? `${created} catégorie(s) créée(s) depuis l'export. ` : "") +
      `${matched} catégorie(s) sur ${categories.length} enrichie(s).` +
      (hasQuery
        ? ""
        : " L'export ne porte pas la dimension requête : les métriques par URL servent à prioriser, " +
          "mais le détail des mots-clés demandera un export croisant page et requête.") +
      (matched === 0
        ? " Aucune correspondance : vérifie que les URL de l'export sont bien celles des catégories."
        : ""),
    cannibalization,
  };
}

/* ------------------------------------------------ mots-clés et brief page */

export async function saveCategoryKeywords(formData: FormData) {
  const { supabase } = await requireUser();

  const categoryId = text(formData, "category_id");
  if (!categoryId) return;

  const list = (key: string): string[] =>
    String(formData.get(key) ?? "")
      .split(/[\n,;]+/)
      .map((value) => value.trim())
      .filter(Boolean);

  const { error } = await supabase
    .from("categories")
    .update({
      target_keyword: optionalText(formData, "target_keyword"),
      secondary_keywords: list("secondary_keywords"),
      fan_queries: list("fan_queries"),
      brief: optionalText(formData, "brief"),
    })
    .eq("id", categoryId);

  if (error) {
    throw new Error(
      error.code === "23505"
        ? "Ce mot-clé principal est déjà attribué à une autre catégorie du projet. " +
          "Un mot-clé ne peut cibler qu'une seule page, sinon les deux se cannibalisent."
        : `Enregistrement impossible : ${error.message}`,
    );
  }

  revalidatePath(`/categories/${categoryId}`);
}

/* ------------------------------------------------------------- statut ---- */

const STATUSES = ["todo", "in_progress", "optimized", "published"] as const;

export async function setCategoryStatus(formData: FormData) {
  const { supabase } = await requireUser();

  const categoryId = text(formData, "category_id");
  const status = text(formData, "status");
  if (!categoryId) return;
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) return;

  const { error } = await supabase
    .from("categories")
    .update({ status: status as (typeof STATUSES)[number] })
    .eq("id", categoryId);

  if (error) throw new Error(`Changement de statut impossible : ${error.message}`);

  revalidatePath(`/categories/${categoryId}`);
  const projectId = text(formData, "project_id");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

/* -------------------------------------------- suggestion IA de mots-clés -- */

export type SuggestionState = {
  status: "idle" | "ok" | "error";
  message: string;
  suggestion?: KeywordSuggestion;
};

export async function suggestKeywordsAction(
  _prev: SuggestionState,
  formData: FormData,
): Promise<SuggestionState> {
  const { supabase } = await requireUser();

  const categoryId = text(formData, "category_id");
  if (!categoryId) return { status: "error", message: "Catégorie manquante." };

  const { data: category, error: readError } = await supabase
    .from("categories")
    .select("*, projects(id, name, notes)")
    .eq("id", categoryId)
    .single();

  if (readError || !category) {
    return { status: "error", message: `Catégorie introuvable : ${readError?.message ?? ""}` };
  }

  const keyword = (category.target_keyword ?? "").trim();
  if (!keyword) {
    return { status: "error", message: "Renseigne d'abord le mot-clé principal." };
  }

  const project = category.projects as { id: string; name: string; notes: string | null } | null;
  const source = (category.source_data ?? {}) as {
    products?: string[];
    facets?: { name: string; values: string[] }[];
  };
  const gsc = (category.gsc_data ?? {}) as {
    queries?: { query: string; impressions: number; position: number }[];
  };

  const { data: siblings } = await supabase
    .from("categories")
    .select("target_keyword")
    .eq("project_id", category.project_id)
    .neq("id", categoryId);

  try {
    const suggestion = await suggestKeywords({
      brand: project?.name ?? "",
      brief: project?.notes ?? null,
      categoryName: category.name,
      keyword,
      products: source.products ?? [],
      facets: source.facets ?? [],
      gscQueries: gsc.queries ?? [],
      takenKeywords: (siblings ?? [])
        .map((s) => s.target_keyword)
        .filter((v): v is string => Boolean(v)),
    });

    const noPageData = (source.products?.length ?? 0) === 0;

    return {
      status: "ok",
      message: noPageData
        ? "Suggestions générées, mais sans les produits ni les facettes de la page : " +
          "récupère d'abord la page pour des propositions ancrées dans le catalogue réel."
        : "Suggestions générées à partir des produits et des filtres de la page.",
      suggestion,
    };
  } catch (error) {
    if (error instanceof GenerationError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: (error as Error).message };
  }
}

/* ------------------------------------------------- import Semrush -------- */

export type SemrushImportState = {
  status: "idle" | "ok" | "error";
  message: string;
  unmatched?: string[];
};

export async function importSemrushData(
  _prev: SemrushImportState,
  formData: FormData,
): Promise<SemrushImportState> {
  const { supabase } = await requireUser();

  const projectId = text(formData, "project_id");
  if (!projectId) return { status: "error", message: "Projet manquant." };

  const file = formData.get("file");
  const pasted = String(formData.get("csv") ?? "").trim();

  let content = pasted;
  if (!content && file instanceof File && file.size > 0) content = await file.text();
  if (!content) {
    return { status: "error", message: "Dépose un fichier CSV ou colle son contenu." };
  }

  let rows;
  try {
    rows = parseSemrushCsv(content);
  } catch (error) {
    if (error instanceof SemrushParseError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: (error as Error).message };
  }

  const { data: categories, error: readError } = await supabase
    .from("categories")
    .select("id, target_keyword")
    .eq("project_id", projectId)
    .not("target_keyword", "is", null);

  if (readError) {
    return { status: "error", message: `Lecture des catégories impossible : ${readError.message}` };
  }

  const byKeyword = new Map(rows.map((row) => [keywordKey(row.keyword), row]));
  let matched = 0;

  for (const category of categories ?? []) {
    const row = byKeyword.get(keywordKey(category.target_keyword ?? ""));
    if (!row) continue;

    const { error: updateError } = await supabase
      .from("categories")
      .update({
        keyword_volume: row.volume,
        keyword_difficulty: row.difficulty,
        keyword_cpc: row.cpc,
        keyword_intent: row.intent,
        keyword_data_at: new Date().toISOString(),
      })
      .eq("id", category.id);

    if (!updateError) matched += 1;
  }

  // Les mots-clés du fichier qui ne correspondent à aucune catégorie : presque
  // toujours un écart de formulation, utile à voir plutôt qu'à taire.
  const categoryKeys = new Set(
    (categories ?? []).map((category) => keywordKey(category.target_keyword ?? "")),
  );
  const unmatched = rows
    .filter((row) => !categoryKeys.has(keywordKey(row.keyword)))
    .map((row) => row.keyword)
    .slice(0, 20);

  revalidatePath(`/projects/${projectId}`);

  return {
    status: "ok",
    message:
      `${rows.length} mots-clés lus, ${matched} catégorie(s) sur ${categories?.length ?? 0} mise(s) à jour.` +
      (matched === 0
        ? " Aucune correspondance : les mots-clés du fichier ne sont pas ceux des catégories."
        : ""),
    unmatched,
  };
}

/* ---------------------------------------------------- analyse de SERP ---- */

export type SerpState = {
  status: "idle" | "ok" | "error";
  message: string;
};

/** Relève le classement organique du mot-clé principal et l'archive. */
export async function fetchSerpAction(
  _prev: SerpState,
  formData: FormData,
): Promise<SerpState> {
  const { supabase } = await requireUser();

  const categoryId = text(formData, "category_id");
  if (!categoryId) return { status: "error", message: "Catégorie manquante." };

  const { data: category, error: readError } = await supabase
    .from("categories")
    .select("id, target_keyword, projects(domain)")
    .eq("id", categoryId)
    .single();

  if (readError || !category) {
    return { status: "error", message: `Catégorie introuvable : ${readError?.message ?? ""}` };
  }

  const keyword = (category.target_keyword ?? "").trim();
  if (!keyword) {
    return { status: "error", message: "Renseigne d'abord le mot-clé principal." };
  }

  const project = category.projects as { domain: string | null } | null;

  let analysis;
  try {
    analysis = await fetchSerp(keyword, project?.domain ?? null);
  } catch (error) {
    if (error instanceof SerpError) return { status: "error", message: error.message };
    return { status: "error", message: (error as Error).message };
  }

  const { error: updateError } = await supabase
    .from("categories")
    .update({ serp_data: analysis, serp_fetched_at: analysis.fetchedAt })
    .eq("id", categoryId);

  if (updateError) {
    return { status: "error", message: `Enregistrement impossible : ${updateError.message}` };
  }

  revalidatePath(`/categories/${categoryId}`);

  return {
    status: "ok",
    message:
      `${analysis.results.length} résultats relevés. ` +
      (analysis.ownRank
        ? `Le site est en position ${analysis.ownRank} sur cette requête.`
        : "Le site n'apparaît pas dans ce classement."),
  };
}

/* ------------------------------------------------- pipeline complet ------ */

export type PipelineStep = {
  label: string;
  status: "ok" | "skipped" | "error";
  detail: string;
};

export type PipelineState = {
  status: "idle" | "ok" | "error";
  message: string;
  steps?: PipelineStep[];
};

/**
 * Chaîne complète en un clic : relève la page, analyse la concurrence, déduit
 * le champ sémantique, puis rédige.
 *
 * Chaque étape dégrade proprement : si Cloudflare bloque la page ou si
 * DataForSEO n'est pas configuré, on continue avec ce qu'on a et on le dit dans
 * le rapport d'étapes. Seule l'absence de mot-clé principal arrête tout, parce
 * que sans lui il n'y a rien à écrire.
 */
export async function runPipeline(
  _prev: PipelineState,
  formData: FormData,
): Promise<PipelineState> {
  const { supabase, user } = await requireUser();

  const categoryId = text(formData, "category_id");
  if (!categoryId) return { status: "error", message: "Catégorie manquante." };

  const directives = optionalText(formData, "brief");
  const steps: PipelineStep[] = [];

  const { data: category, error: readError } = await supabase
    .from("categories")
    .select("*, projects(id, name, domain, notes, business_rules, market)")
    .eq("id", categoryId)
    .single();

  if (readError || !category) {
    return { status: "error", message: `Catégorie introuvable : ${readError?.message ?? ""}` };
  }

  const project = category.projects as {
    id: string;
    name: string;
    domain: string | null;
    notes: string | null;
    business_rules: string | null;
    market: string | null;
  } | null;
  const market = (project?.market ?? null) as Market;

  const keyword = (category.target_keyword ?? "").trim();
  if (!keyword) {
    return {
      status: "error",
      message: "Renseigne d'abord le mot-clé principal : c'est lui qui cadre tout le reste.",
    };
  }

  // Les directives saisies dans le formulaire remplacent le brief enregistré.
  if (directives !== null && directives !== category.brief) {
    await supabase.from("categories").update({ brief: directives }).eq("id", categoryId);
  }
  const categoryBrief = directives ?? category.brief;

  /* --- 1. Relevé de la page ------------------------------------------- */

  let source = (category.source_data ?? {}) as {
    products?: string[];
    facets?: { name: string; values: string[] }[];
    breadcrumb?: string[];
  };
  let currentText = category.source_content;

  try {
    const extraction = await extractFromUrl(category.url);
    source = {
      products: extraction.products,
      facets: extraction.facets,
      breadcrumb: extraction.breadcrumb,
    };
    currentText = extraction.seoText;

    await supabase
      .from("categories")
      .update({
        source_title: extraction.title,
        source_meta_description: extraction.metaDescription,
        source_h1: extraction.h1,
        source_content: extraction.seoText,
        source_data: {
          ...source,
          productCount: extraction.productCount,
          canonical: extraction.canonical,
          diagnostics: extraction.diagnostics,
        },
        source_fetched_at: new Date().toISOString(),
      })
      .eq("id", categoryId);

    steps.push({
      label: "Relevé de la page",
      status: "ok",
      detail: `${extraction.products.length} produits, ${extraction.facets.length} facettes`,
    });
  } catch (error) {
    const message = error instanceof ExtractionError ? error.message : (error as Error).message;
    steps.push({
      label: "Relevé de la page",
      status: "error",
      detail: `${message} On continue sans les produits ni les filtres.`,
    });
  }

  /* --- 2. Analyse de la concurrence ------------------------------------ */

  let serp = (category.serp_data ?? {}) as Partial<SerpAnalysis>;

  try {
    const analysis = await fetchSerp(keyword, project?.domain ?? null);
    serp = analysis;
    await supabase
      .from("categories")
      .update({ serp_data: analysis, serp_fetched_at: analysis.fetchedAt })
      .eq("id", categoryId);

    steps.push({
      label: "Analyse de la SERP",
      status: "ok",
      detail: analysis.ownRank
        ? `${analysis.results.length} résultats · le site est en position ${analysis.ownRank}`
        : `${analysis.results.length} résultats · le site n'apparaît pas`,
    });
  } catch (error) {
    const message = error instanceof SerpError ? error.message : (error as Error).message;
    steps.push({
      label: "Analyse de la SERP",
      status: serp.results?.length ? "skipped" : "error",
      detail: serp.results?.length
        ? "Échec, mais un relevé précédent est réutilisé."
        : `${message} On rédige sans la concurrence.`,
    });
  }

  /* --- 3. Champ sémantique --------------------------------------------- */

  const gsc = (category.gsc_data ?? {}) as {
    queries?: { query: string; impressions: number; position: number }[];
  };
  const gscQueries = gsc.queries ?? [];

  const { takenKeywords, takenAngles, family } = await loadProjectContext(
    supabase,
    category,
  );

  let secondaryKeywords = category.secondary_keywords ?? [];
  let fanQueries = category.fan_queries ?? [];

  try {
    const suggestion = await suggestKeywords({
      brand: project?.name ?? "",
      brief: project?.notes ?? null,
      categoryName: category.name,
      keyword,
      products: source.products ?? [],
      facets: source.facets ?? [],
      gscQueries,
      takenKeywords,
    });

    // On complète sans écraser : ce que tu as validé à la main reste prioritaire.
    const merge = (existing: string[], proposed: string[]) => {
      const seen = new Set(existing.map((v) => v.toLowerCase()));
      return [...existing, ...proposed.filter((v) => !seen.has(v.toLowerCase()))];
    };

    secondaryKeywords = merge(
      secondaryKeywords,
      suggestion.secondaryKeywords.map((s) => s.keyword),
    );
    fanQueries = merge(fanQueries, suggestion.fanQueries.map((s) => s.query));

    await supabase
      .from("categories")
      .update({ secondary_keywords: secondaryKeywords, fan_queries: fanQueries })
      .eq("id", categoryId);

    steps.push({
      label: "Champ sémantique",
      status: "ok",
      detail: `${suggestion.secondaryKeywords.length} secondaires, ${suggestion.fanQueries.length} fan queries`,
    });
  } catch (error) {
    const message = error instanceof GenerationError ? error.message : (error as Error).message;
    steps.push({
      label: "Champ sémantique",
      status: "error",
      detail: `${message} On rédige avec les mots-clés déjà validés.`,
    });
  }

  /* --- 4. Rédaction ----------------------------------------------------- */

  let content;
  try {
    content = await generateCategoryContent({
      brand: project?.name ?? "",
      domain: project?.domain ?? null,
      brief: project?.notes ?? null,
      businessRules: project?.business_rules ?? null,
      market,
      family,
      categoryName: category.name,
      categoryUrl: category.url,
      keyword,
      secondaryKeywords,
      fanQueries,
      categoryBrief,
      gscQueries: gscQueries.slice(0, 25),
      serp: serp.results ?? [],
      ownRank: serp.ownRank ?? null,
      breadcrumb: source.breadcrumb ?? [],
      products: source.products ?? [],
      facets: source.facets ?? [],
      currentText,
      currentShortDescription: category.catalog_short_description,
      currentLongDescription: category.catalog_long_description,
      takenKeywords,
      takenAngles,
    });
  } catch (error) {
    const message = error instanceof GenerationError ? error.message : (error as Error).message;
    steps.push({ label: "Rédaction", status: "error", detail: message });
    return { status: "error", message, steps };
  }

  steps.push({
    label: "Rédaction",
    status: "ok",
    detail: `Angle « ${content.editorialAngle} » · deux descriptions produites`,
  });

  const { score, compliance, error: insertError } = await persistOptimization(supabase, {
    categoryId,
    categoryName: category.name,
    keyword,
    market,
    content,
    userId: user.id,
    groundedInPage: (source.products?.length ?? 0) > 0,
    steps,
  });

  if (insertError) {
    return { status: "error", message: `Enregistrement impossible : ${insertError}`, steps };
  }

  const errors = compliance.issues.filter((issue) => issue.severity === "erreur");
  steps.push({
    label: "Contrôle des règles métier",
    status: errors.length > 0 ? "error" : compliance.issues.length > 0 ? "skipped" : "ok",
    detail:
      errors.length > 0
        ? errors.map((issue) => issue.rule).join(" · ")
        : compliance.issues.length > 0
          ? compliance.issues.map((issue) => issue.rule).join(" · ")
          : `${compliance.passed} contrôles passés`,
  });

  await supabase.from("categories").update({ status: "optimized" }).eq("id", categoryId);
  revalidatePath(`/categories/${categoryId}`);

  const intentWarning = content.analysis.intentMatch
    ? ""
    : " Attention : la SERP de ce mot-clé n'appelle pas une page catégorie marchande — voir le diagnostic d'intention.";

  return {
    status: "ok",
    message:
      `Texte généré, score ${score}/100.${intentWarning}` + complianceSummary(compliance),
    steps,
  };
}
