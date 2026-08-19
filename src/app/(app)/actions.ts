"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/moulinette";
import {
  generateCategoryContent,
  GenerationError,
  GENERATION_MODEL,
} from "@/lib/generate";
import { renderCategoryHtml, renderCategoryText } from "@/lib/render";
import { extractFromUrl, ExtractionError } from "@/lib/extract";
import {
  parseGscCsv,
  groupByPage,
  findCannibalization,
  looksLikeCategoryUrl,
  nameFromUrl,
  urlKey,
  GscParseError,
} from "@/lib/gsc";

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

export async function saveCategorySource(formData: FormData) {
  const { supabase } = await requireUser();

  const categoryId = text(formData, "category_id");
  if (!categoryId) return;

  const { error } = await supabase
    .from("categories")
    .update({
      source_title: optionalText(formData, "source_title"),
      source_meta_description: optionalText(formData, "source_meta_description"),
      source_h1: optionalText(formData, "source_h1"),
      source_content: optionalText(formData, "source_content"),
    })
    .eq("id", categoryId);

  // Ce formulaire ne touche plus aucune colonne sous contrainte d'unicité :
  // le mot-clé se règle dans le bloc « Mots-clés et brief ».
  if (error) throw new Error(`Enregistrement impossible : ${error.message}`);

  revalidatePath(`/categories/${categoryId}`);
}

export type GenerationState = {
  status: "idle" | "ok" | "error";
  message: string;
  score?: number;
};

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
    .select("*, projects(id, name, domain, notes)")
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
  } | null;

  const keyword = (category.target_keyword ?? "").trim();
  if (!keyword) {
    return {
      status: "error",
      message:
        "Renseigne d'abord le mot-clé principal : c'est lui qui cadre tout le texte.",
    };
  }

  // Ce qui est déjà attribué ailleurs sur le même site.
  const { data: siblings } = await supabase
    .from("categories")
    .select("id, target_keyword, optimizations(editorial_angle, version)")
    .eq("project_id", category.project_id)
    .neq("id", categoryId);

  const takenKeywords: string[] = [];
  const takenAngles: string[] = [];
  for (const sibling of siblings ?? []) {
    if (sibling.target_keyword) takenKeywords.push(sibling.target_keyword);
    const latest = [...(sibling.optimizations ?? [])].sort(
      (a, b) => b.version - a.version,
    )[0];
    if (latest?.editorial_angle && !takenAngles.includes(latest.editorial_angle)) {
      takenAngles.push(latest.editorial_angle);
    }
  }

  const source = (category.source_data ?? {}) as {
    products?: string[];
    facets?: { name: string; values: string[] }[];
    breadcrumb?: string[];
  };

  const gsc = (category.gsc_data ?? {}) as {
    queries?: { query: string; impressions: number; position: number }[];
  };
  const gscQueries = gsc.queries ?? [];

  let content;
  try {
    content = await generateCategoryContent({
      brand: project?.name ?? "",
      domain: project?.domain ?? null,
      brief: project?.notes ?? null,
      categoryName: category.name,
      categoryUrl: category.url,
      keyword,
      secondaryKeywords: category.secondary_keywords ?? [],
      fanQueries: category.fan_queries ?? [],
      categoryBrief: category.brief,
      gscQueries: gscQueries.slice(0, 25),
      breadcrumb: source.breadcrumb ?? [],
      products: source.products ?? [],
      facets: source.facets ?? [],
      currentText: category.source_content,
      takenKeywords,
      takenAngles,
    });
  } catch (error) {
    if (error instanceof GenerationError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: (error as Error).message };
  }

  const html = renderCategoryHtml(content);
  const plain = renderCategoryText(content);
  const { checks, score } = audit(
    {
      title: content.title,
      metaDescription: content.metaDescription,
      h1: content.h1,
      content: plain,
    },
    keyword,
  );

  const { error: insertError } = await supabase.from("optimizations").insert({
    category_id: categoryId,
    title: content.title,
    meta_description: content.metaDescription,
    h1: content.h1,
    content: html,
    score,
    engine: GENERATION_MODEL,
    editorial_angle: content.editorialAngle,
    payload: { checks, structured: content, plain },
    created_by: user.id,
  });

  if (insertError) {
    return {
      status: "error",
      message: `Enregistrement de l'optimisation impossible : ${insertError.message}`,
    };
  }

  await supabase.from("categories").update({ status: "optimized" }).eq("id", categoryId);
  revalidatePath(`/categories/${categoryId}`);

  return {
    status: "ok",
    message: `Texte généré — angle retenu : « ${content.editorialAngle} ». Score ${score}/100.`,
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

  const { error } = await supabase
    .from("projects")
    .update({
      domain: optionalText(formData, "domain"),
      notes: optionalText(formData, "notes"),
    })
    .eq("id", projectId);

  if (error) throw new Error(`Enregistrement impossible : ${error.message}`);

  revalidatePath(`/projects/${projectId}`);
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

  let rows;
  try {
    rows = parseGscCsv(content);
  } catch (error) {
    if (error instanceof GscParseError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: (error as Error).message };
  }

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
    const queries = grouped.get(urlKey(category.url));
    if (!queries || queries.length === 0) continue;

    const { error: updateError } = await supabase
      .from("categories")
      .update({
        gsc_data: { queries: queries.slice(0, 100) },
        gsc_fetched_at: new Date().toISOString(),
      })
      .eq("id", category.id);

    if (!updateError) matched += 1;
  }

  // On ne signale que les conflits qui concernent au moins une catégorie suivie.
  const tracked = new Set(categories.map((category) => urlKey(category.url)));
  const cannibalization = findCannibalization(rows)
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
