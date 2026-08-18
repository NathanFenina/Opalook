"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { optimize } from "@/lib/moulinette";

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

  if (error) throw new Error(`Enregistrement impossible : ${error.message}`);

  revalidatePath(`/categories/${categoryId}`);
}

/** Passe la catégorie à la moulinette et archive le résultat en nouvelle version. */
export async function runMoulinette(formData: FormData) {
  const { supabase, user } = await requireUser();

  const categoryId = text(formData, "category_id");
  if (!categoryId) return;

  const { data: category, error: readError } = await supabase
    .from("categories")
    .select("*, projects(name, domain)")
    .eq("id", categoryId)
    .single();

  if (readError || !category) {
    throw new Error(`Catégorie introuvable : ${readError?.message ?? categoryId}`);
  }

  const project = category.projects as { name: string; domain: string | null } | null;

  const result = optimize({
    name: category.name,
    url: category.url,
    targetKeyword: category.target_keyword,
    sourceTitle: category.source_title,
    sourceMetaDescription: category.source_meta_description,
    sourceH1: category.source_h1,
    sourceContent: category.source_content,
    brand: project?.name ?? null,
  });

  const { error: insertError } = await supabase.from("optimizations").insert({
    category_id: categoryId,
    title: result.title,
    meta_description: result.metaDescription,
    h1: result.h1,
    content: result.content,
    score: result.score,
    engine: result.engine,
    payload: { checks: result.checks },
    created_by: user.id,
  });

  if (insertError) {
    throw new Error(`Enregistrement de l'optimisation impossible : ${insertError.message}`);
  }

  await supabase
    .from("categories")
    .update({ status: "optimized" })
    .eq("id", categoryId);

  revalidatePath(`/categories/${categoryId}`);
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
