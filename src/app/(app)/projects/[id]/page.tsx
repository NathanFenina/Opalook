import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  Card,
  EmptyState,
  Field,
  ScoreBadge,
  StatusPill,
  buttonClass,
  inputClass,
} from "@/components/ui";
import { createCategory, saveProjectBrief } from "../../actions";
import { ImportCategoriesForm, ImportGscForm } from "./import-forms";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, domain, notes")
    .eq("id", id)
    .maybeSingle();

  if (!project) notFound();

  const { data: categories, error } = await supabase
    .from("categories")
    .select("id, name, url, status, target_keyword, optimizations(score, version)")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Lecture des catégories impossible : ${error.message}`);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <Link
          href="/dashboard"
          className="text-xs text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
        >
          ← Tous les projets
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">{project.name}</h1>
        {project.domain && (
          <p className="text-sm text-slate-600 dark:text-slate-400">{project.domain}</p>
        )}
      </div>

      {categories && categories.length > 0 ? (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {categories.map((category) => {
            const latest = [...(category.optimizations ?? [])].sort(
              (a, b) => b.version - a.version,
            )[0];
            return (
              <li key={category.id}>
                <Link
                  href={`/categories/${category.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{category.name}</span>
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                      {category.target_keyword
                        ? `« ${category.target_keyword} » · `
                        : "sans mot-clé · "}
                      {category.url}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {latest?.score != null && <ScoreBadge score={latest.score} />}
                    <StatusPill status={category.status} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState>
          Aucune catégorie suivie. Ajoute la première URL à passer à la moulinette.
        </EmptyState>
      )}

      <Card
        title="Brief éditorial"
        description="Injecté tel quel dans le prompt de rédaction : audience, ton, contraintes, arguments à mettre en avant."
      >
        <form action={saveProjectBrief} className="space-y-4">
          <input type="hidden" name="project_id" value={project.id} />
          <Field label="Domaine">
            <input
              name="domain"
              defaultValue={project.domain ?? ""}
              placeholder="client-x.fr"
              className={inputClass}
            />
          </Field>
          <Field
            label="Brief"
            hint="Ex. : grossiste B2B, s'adresse à des revendeurs professionnels, insister sur les quantités minimales et les marges."
          >
            <textarea
              name="notes"
              rows={5}
              defaultValue={project.notes ?? ""}
              className={inputClass}
            />
          </Field>
          <button type="submit" className={buttonClass}>
            Enregistrer le brief
          </button>
        </form>
      </Card>

      <Card
        title="Importer les URL de catégories"
        description="Colle la liste complète en une fois. Réimporter la même liste ne crée pas de doublons."
      >
        <ImportCategoriesForm projectId={project.id} />
      </Card>

      <Card
        title="Importer les données Search Console"
        description="Rapproche les requêtes de chaque URL et signale les cannibalisations existantes."
      >
        <ImportGscForm projectId={project.id} />
      </Card>

      <Card title="Ajouter une catégorie à l'unité">
        <form action={createCategory} className="space-y-4">
          <input type="hidden" name="project_id" value={project.id} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Nom de la catégorie">
              <input
                name="name"
                required
                placeholder="Chaussures de running"
                className={inputClass}
              />
            </Field>
            <Field label="URL">
              <input
                name="url"
                required
                placeholder="/chaussures/running"
                className={inputClass}
              />
            </Field>
            <Field label="Mot-clé cible">
              <input
                name="target_keyword"
                placeholder="chaussures de running"
                className={inputClass}
              />
            </Field>
          </div>
          <button type="submit" className={buttonClass}>
            Ajouter
          </button>
        </form>
      </Card>
    </div>
  );
}
