import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, Field, buttonClass, inputClass } from "@/components/ui";
import { StatusSelect } from "@/components/status-select";
import { createCategory, saveProjectBrief } from "../../actions";
import {
  ImportCategoriesForm,
  ImportGscForm,
  ImportSemrushForm,
} from "./import-forms";

type PageMetrics = { clicks: number; impressions: number; position: number; opportunity: number };

function Cell({
  value,
  tone,
}: {
  value: number | string | null | undefined;
  tone?: string;
}) {
  const display =
    value === null || value === undefined || value === ""
      ? "—"
      : typeof value === "number"
        ? value.toLocaleString("fr-FR")
        : value;
  return (
    <td className={`px-3 py-2 text-right tabular-nums ${tone ?? "text-slate-600 dark:text-slate-400"}`}>
      {display}
    </td>
  );
}

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
    .select(
      "id, name, url, status, target_keyword, gsc_data, keyword_volume, keyword_difficulty",
    )
    .eq("project_id", id);

  if (error) throw new Error(`Lecture des catégories impossible : ${error.message}`);

  // Trié par potentiel : on commence par ce qui rapporte, pas par ordre d'ajout.
  const ranked = [...(categories ?? [])]
    .map((category) => {
      const gsc = (category.gsc_data ?? {}) as { pageMetrics?: PageMetrics };
      return { ...category, metrics: gsc.pageMetrics };
    })
    .sort((a, b) => (b.metrics?.opportunity ?? -1) - (a.metrics?.opportunity ?? -1));

  const totals = ranked.reduce(
    (acc, category) => ({
      impressions: acc.impressions + (category.metrics?.impressions ?? 0),
      clicks: acc.clicks + (category.metrics?.clicks ?? 0),
      done: acc.done + (category.status === "published" ? 1 : 0),
    }),
    { impressions: 0, clicks: 0, done: 0 },
  );

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
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {project.domain ?? "domaine non renseigné"} · {ranked.length} catégories ·{" "}
          {totals.impressions.toLocaleString("fr-FR")} impressions ·{" "}
          {totals.clicks.toLocaleString("fr-FR")} clics · {totals.done} terminée
          {totals.done > 1 ? "s" : ""}
        </p>
      </div>

      {ranked.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[52rem] border-collapse bg-white text-sm dark:bg-slate-900">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="px-3 py-2 text-left font-medium">Catégorie</th>
                <th className="px-3 py-2 text-left font-medium">Mot-clé principal</th>
                <th className="px-3 py-2 text-left font-medium">Statut</th>
                <th className="px-3 py-2 text-right font-medium">Impr.</th>
                <th className="px-3 py-2 text-right font-medium">Clics</th>
                <th className="px-3 py-2 text-right font-medium">Pos.</th>
                <th className="px-3 py-2 text-right font-medium">Volume</th>
                <th className="px-3 py-2 text-right font-medium">KD</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((category) => {
                const quickWin =
                  category.metrics &&
                  category.metrics.position >= 8 &&
                  category.metrics.position <= 20;
                return (
                  <tr
                    key={category.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                  >
                    <td className="max-w-xs px-3 py-2">
                      <Link
                        href={`/categories/${category.id}`}
                        className="block truncate font-medium underline-offset-4 hover:underline"
                      >
                        {category.name}
                      </Link>
                      <span className="block truncate text-xs text-slate-400">
                        {category.url.replace(/^https?:\/\/[^/]+/, "")}
                      </span>
                    </td>
                    <td className="max-w-[14rem] px-3 py-2">
                      <span className="block truncate text-slate-600 dark:text-slate-400">
                        {category.target_keyword ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <StatusSelect
                        categoryId={category.id}
                        projectId={project.id}
                        status={category.status}
                      />
                    </td>
                    <Cell value={category.metrics?.impressions} />
                    <Cell value={category.metrics?.clicks} />
                    <Cell
                      value={category.metrics?.position.toFixed(1)}
                      tone={
                        quickWin ? "font-medium text-amber-700 dark:text-amber-400" : undefined
                      }
                    />
                    <Cell value={category.keyword_volume} />
                    <Cell value={category.keyword_difficulty} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>
          Aucune catégorie suivie. Importe les URL ci-dessous ou dépose un export Search Console.
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
        description="Rapproche les métriques de chaque URL et signale les cannibalisations existantes."
      >
        <ImportGscForm projectId={project.id} />
      </Card>

      <Card
        title="Importer volumes et difficulté (Semrush)"
        description="Rapproche chaque mot-clé principal de son volume, sa difficulté et son intention."
      >
        <ImportSemrushForm projectId={project.id} />
      </Card>

      <Card title="Ajouter une catégorie à l'unité">
        <form action={createCategory} className="space-y-4">
          <input type="hidden" name="project_id" value={project.id} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Nom de la catégorie">
              <input name="name" required placeholder="Chaussures de running" className={inputClass} />
            </Field>
            <Field label="URL">
              <input name="url" required placeholder="https://…" className={inputClass} />
            </Field>
            <Field label="Mot-clé cible">
              <input name="target_keyword" placeholder="chaussures de running" className={inputClass} />
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
