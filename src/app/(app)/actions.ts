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
      target_keyword: optionalText(formData, "target_keyword"),
      source_title: optionalText(formData, "source_title"),
      source_meta_description: optionalText(formData, "source_meta_description"),
      source_h1: optionalText(formData, "source_h1"),
      source_content: optionalText(formData, "source_content"),
    })
    .eq("id", categoryId);

  if (error) {
    throw new Error(
      error.code === "23505"
        ? "Ce mot-clé est déjà attribué à une autre catégorie du projet. " +
          "Un mot-clé principal ne peut cibler qu'une seule page, sinon les deux se cannibalisent."
        : `Enregistrement impossible : ${error.message}`,
    );
  }

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

  let content;
  try {
    content = await generateCategoryContent({
      brand: project?.name ?? "",
      domain: project?.domain ?? null,
      brief: project?.notes ?? null,
      categoryName: category.name,
      categoryUrl: category.url,
      keyword,
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
