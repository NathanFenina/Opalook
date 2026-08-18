import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { auditSource, type Check } from "@/lib/moulinette";
import {
  Card,
  ChecksList,
  EmptyState,
  Field,
  ScoreBadge,
  StatusPill,
  buttonClass,
  inputClass,
  secondaryButtonClass,
} from "@/components/ui";
import { deleteCategory, saveCategorySource } from "../../actions";
import { ImportForm } from "./import-form";
import { GenerateForm } from "./generate-form";
import { CopyButton } from "./copy-button";

// La rédaction par Claude prend nettement plus que la durée par défaut d'une
// fonction Vercel : on demande explicitement la fenêtre maximale.
export const maxDuration = 300;

function checksFromPayload(payload: unknown): Check[] {
  if (payload && typeof payload === "object" && "checks" in payload) {
    const checks = (payload as { checks: unknown }).checks;
    if (Array.isArray(checks)) return checks as Check[];
  }
  return [];
}

type SourceData = {
  products?: string[];
  productCount?: number | null;
  facets?: { name: string; values: string[] }[];
  headings?: { level: number; text: string }[];
  breadcrumb?: string[];
};

function sourceData(payload: unknown): SourceData {
  return payload && typeof payload === "object" ? (payload as SourceData) : {};
}

function Output({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
        {value && (
          <span className="ml-2 font-normal text-slate-400">
            {value.length} car.
          </span>
        )}
      </p>
      <p className="whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950">
        {value || "—"}
      </p>
    </div>
  );
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: category } = await supabase
    .from("categories")
    .select("*, projects(id, name)")
    .eq("id", id)
    .maybeSingle();

  if (!category) notFound();

  const project = category.projects as { id: string; name: string } | null;
  const source = sourceData(category.source_data);

  const { data: optimizations, error } = await supabase
    .from("optimizations")
    .select("*")
    .eq("category_id", id)
    .order("version", { ascending: false });

  if (error) throw new Error(`Lecture des optimisations impossible : ${error.message}`);

  const latest = optimizations?.[0];
  const before = auditSource({
    name: category.name,
    url: category.url,
    targetKeyword: category.target_keyword,
    sourceTitle: category.source_title,
    sourceMetaDescription: category.source_meta_description,
    sourceH1: category.source_h1,
    sourceContent: category.source_content,
  });

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        {project && (
          <Link
            href={`/projects/${project.id}`}
            className="text-xs text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
          >
            ← {project.name}
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">{category.name}</h1>
          <StatusPill status={category.status} />
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">{category.url}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ScoreBadge score={before.score} label="avant" />
        {latest?.score != null && (
          <>
            <span aria-hidden className="text-slate-400">
              →
            </span>
            <ScoreBadge score={latest.score} label={`v${latest.version}`} />
          </>
        )}
        <GenerateForm categoryId={category.id} hasVersion={Boolean(latest)} />
      </div>

      <Card
        title="Récupération de la page"
        description="Va chercher les balises, le texte, les produits et les filtres directement sur l'URL."
      >
        <div className="space-y-3">
          <ImportForm categoryId={category.id} />
          {category.source_fetched_at && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Dernière récupération :{" "}
              {new Date(category.source_fetched_at).toLocaleString("fr-FR")}
            </p>
          )}
        </div>
      </Card>

      {Boolean(source.products?.length || source.facets?.length) && (
        <Card
          title="Matière première"
          description="Ce qui rendra le texte réellement spécifique à cette catégorie."
        >
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Produits{source.productCount ? ` (${source.productCount} au total)` : ""}
              </p>
              <ul className="space-y-1 text-sm">
                {(source.products ?? []).slice(0, 15).map((product) => (
                  <li key={product} className="truncate">
                    {product}
                  </li>
                ))}
                {(source.products?.length ?? 0) > 15 && (
                  <li className="text-xs text-slate-400">
                    + {(source.products?.length ?? 0) - 15} autres
                  </li>
                )}
              </ul>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Filtres
              </p>
              <ul className="space-y-2 text-sm">
                {(source.facets ?? []).map((facet) => (
                  <li key={facet.name}>
                    <span className="font-medium">{facet.name}</span>{" "}
                    <span className="text-slate-500 dark:text-slate-400">
                      {facet.values.slice(0, 8).join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <Card
        title="Contenu source"
        description="Ce qu'on a relevé sur la page actuelle du client. Sert d'entrée à la moulinette."
      >
        <form action={saveCategorySource} className="space-y-4">
          <input type="hidden" name="category_id" value={category.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mot-clé cible">
              <input
                name="target_keyword"
                defaultValue={category.target_keyword ?? ""}
                className={inputClass}
              />
            </Field>
            <Field label="H1 actuel">
              <input
                name="source_h1"
                defaultValue={category.source_h1 ?? ""}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Title actuel">
            <input
              name="source_title"
              defaultValue={category.source_title ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Meta description actuelle">
            <input
              name="source_meta_description"
              defaultValue={category.source_meta_description ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Texte de catégorie actuel" hint="HTML ou texte brut, peu importe.">
            <textarea
              name="source_content"
              rows={6}
              defaultValue={category.source_content ?? ""}
              className={inputClass}
            />
          </Field>
          <button type="submit" className={buttonClass}>
            Enregistrer
          </button>
        </form>
      </Card>

      <Card title="Audit de la version actuelle">
        <ChecksList checks={before.checks} />
      </Card>

      {latest ? (
        <Card
          title={`Version optimisée v${latest.version}`}
          description={`Moteur ${latest.engine ?? "inconnu"} · ${new Date(
            latest.created_at,
          ).toLocaleString("fr-FR")}`}
        >
          <div className="space-y-4">
            <Output label="Title" value={latest.title} />
            <Output label="Meta description" value={latest.meta_description} />
            <Output
              label="H1 — à reporter sur le nom de la catégorie"
              value={latest.h1}
            />
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  HTML pour le champ « description » (sans H1)
                  {latest.content && (
                    <span className="ml-2 font-normal text-slate-400">
                      {latest.content.length} car.
                    </span>
                  )}
                </p>
                {latest.content && <CopyButton value={latest.content} />}
              </div>
              <pre className="max-h-96 overflow-auto rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap dark:bg-slate-950">
                {latest.content || "—"}
              </pre>
            </div>
            <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
              <ChecksList checks={checksFromPayload(latest.payload)} />
            </div>
          </div>
        </Card>
      ) : (
        <EmptyState>
          Pas encore de version optimisée. Lance la moulinette pour en générer une.
        </EmptyState>
      )}

      {optimizations && optimizations.length > 1 && (
        <Card title="Historique">
          <ul className="space-y-2 text-sm">
            {optimizations.slice(1).map((optimization) => (
              <li key={optimization.id} className="flex items-center gap-3">
                <span className="font-medium">v{optimization.version}</span>
                {optimization.score != null && (
                  <ScoreBadge score={optimization.score} />
                )}
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {new Date(optimization.created_at).toLocaleString("fr-FR")}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <form action={deleteCategory}>
        <input type="hidden" name="category_id" value={category.id} />
        <input type="hidden" name="project_id" value={project?.id ?? ""} />
        <button type="submit" className={secondaryButtonClass}>
          Supprimer cette catégorie
        </button>
      </form>
    </div>
  );
}
