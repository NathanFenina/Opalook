import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { auditSource, type Check } from "@/lib/moulinette";
import {
  Card,
  ChecksList,
  EmptyState,
  ScoreBadge,
  secondaryButtonClass,
} from "@/components/ui";
import { Metric, MetricRow } from "@/components/metrics";
import { StatusSelect } from "@/components/status-select";
import { deleteCategory } from "../../actions";
import { ImportForm } from "./import-form";
import { GenerateForm } from "./generate-form";
import { CopyButton } from "./copy-button";
import { KeywordsForm, type GscQuery } from "./keywords-form";

// La rédaction par Claude prend nettement plus que la durée par défaut d'une
// fonction Vercel : on demande explicitement la fenêtre maximale.
export const maxDuration = 300;

type SourceData = {
  products?: string[];
  productCount?: number | null;
  facets?: { name: string; values: string[] }[];
  breadcrumb?: string[];
};

function sourceData(payload: unknown): SourceData {
  return payload && typeof payload === "object" ? (payload as SourceData) : {};
}

function checksFromPayload(payload: unknown): Check[] {
  if (payload && typeof payload === "object" && "checks" in payload) {
    const checks = (payload as { checks: unknown }).checks;
    if (Array.isArray(checks)) return checks as Check[];
  }
  return [];
}

function Output({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
        {value && <span className="ml-2 font-normal text-slate-400">{value.length} car.</span>}
      </p>
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm whitespace-pre-wrap dark:bg-slate-950">
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
  const gsc = (category.gsc_data ?? {}) as {
    queries?: GscQuery[];
    pageMetrics?: { clicks: number; impressions: number; position: number };
  };
  const metrics = gsc.pageMetrics;

  const { data: optimizations, error } = await supabase
    .from("optimizations")
    .select("*")
    .eq("category_id", id)
    .order("version", { ascending: false });

  if (error) throw new Error(`Lecture des optimisations impossible : ${error.message}`);

  const latest = optimizations?.[0];

  // La page d'origine n'est notée que si on l'a effectivement relevée :
  // auditer un formulaire vide ne produirait que des feux rouges sans information.
  const hasSource = Boolean(
    category.source_title || category.source_h1 || category.source_content,
  );
  const before = hasSource
    ? auditSource({
        name: category.name,
        url: category.url,
        targetKeyword: category.target_keyword,
        sourceTitle: category.source_title,
        sourceMetaDescription: category.source_meta_description,
        sourceH1: category.source_h1,
        sourceContent: category.source_content,
      })
    : null;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
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
          {project && (
            <StatusSelect
              categoryId={category.id}
              projectId={project.id}
              status={category.status}
            />
          )}
        </div>
        <a
          href={category.url}
          target="_blank"
          rel="noreferrer"
          className="block text-sm break-all text-slate-600 underline-offset-4 hover:underline dark:text-slate-400"
        >
          {category.url}
        </a>
      </div>

      <MetricRow>
        <Metric label="Impressions" value={metrics?.impressions ?? null} />
        <Metric label="Clics" value={metrics?.clicks ?? null} />
        <Metric
          label="Position"
          value={metrics?.position ?? null}
          tone={
            metrics && metrics.position >= 8 && metrics.position <= 20 ? "warn" : undefined
          }
          hint={
            metrics && metrics.position >= 8 && metrics.position <= 20
              ? "gain rapide"
              : undefined
          }
        />
        <Metric label="Volume / mois" value={category.keyword_volume} />
        <Metric
          label="Difficulté SEO"
          value={category.keyword_difficulty}
          hint={category.keyword_intent ?? undefined}
        />
      </MetricRow>

      <Card
        title="Données de la page"
        description="Va chercher les balises, le texte, les produits et les filtres directement sur l'URL. C'est ce qui rend le texte spécifique à cette catégorie."
      >
        <div className="space-y-3">
          <ImportForm categoryId={category.id} />
          {category.source_fetched_at && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Dernière récupération : {new Date(category.source_fetched_at).toLocaleString("fr-FR")}
            </p>
          )}
        </div>
      </Card>

      {Boolean(source.products?.length || source.facets?.length) && (
        <Card
          title="Matière première relevée"
          description="Produits et filtres réellement présents. C'est ce qui nourrit la rédaction."
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
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Filtres</p>
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
        title="Mots-clés et brief"
        description="Ce bloc pilote entièrement la rédaction."
      >
        <KeywordsForm
          categoryId={category.id}
          initialKeyword={category.target_keyword ?? ""}
          initialSecondary={category.secondary_keywords ?? []}
          initialFanQueries={category.fan_queries ?? []}
          initialBrief={category.brief ?? ""}
          suggestions={gsc.queries ?? []}
        />
      </Card>

      <Card
        title="Rédaction"
        description="Génère le texte optimisé et le note sur le même barème que la version en ligne."
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {before && <ScoreBadge score={before.score} label="en ligne" />}
            {before && latest?.score != null && (
              <span aria-hidden className="text-slate-400">
                →
              </span>
            )}
            {latest?.score != null && (
              <ScoreBadge score={latest.score} label={`v${latest.version}`} />
            )}
          </div>
          <GenerateForm categoryId={category.id} hasVersion={Boolean(latest)} />
        </div>
      </Card>

      {latest ? (
        <Card
          title={`Version optimisée v${latest.version}`}
          description={`${latest.engine ?? "moteur inconnu"}${
            latest.editorial_angle ? ` · angle : ${latest.editorial_angle}` : ""
          } · ${new Date(latest.created_at).toLocaleString("fr-FR")}`}
        >
          <div className="space-y-4">
            <Output label="Title" value={latest.title} />
            <Output label="Meta description" value={latest.meta_description} />
            <Output label="H1 — à reporter sur le nom de la catégorie" value={latest.h1} />
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
        <EmptyState>Pas encore de version optimisée. Lance la rédaction pour en générer une.</EmptyState>
      )}

      {before && (
        <Card
          title="Audit de la version en ligne"
          description="Le même barème appliqué au texte actuellement publié, pour mesurer l'écart."
        >
          <ChecksList checks={before.checks} />
        </Card>
      )}

      {optimizations && optimizations.length > 1 && (
        <Card title="Historique">
          <ul className="space-y-2 text-sm">
            {optimizations.slice(1).map((optimization) => (
              <li key={optimization.id} className="flex flex-wrap items-center gap-3">
                <span className="font-medium">v{optimization.version}</span>
                {optimization.score != null && <ScoreBadge score={optimization.score} />}
                {optimization.editorial_angle && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {optimization.editorial_angle}
                  </span>
                )}
                <span className="text-xs text-slate-400">
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
