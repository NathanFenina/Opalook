import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { auditSource, type Check } from "@/lib/moulinette";
import { buildFamily } from "@/lib/catalogue";
import type { ComplianceReport } from "@/lib/compliance";
import {
  Card,
  ChecksList,
  EmptyState,
  ScoreBadge,
  Metric,
  MetricRow,
} from "@/components/app-ui";
import { StatusSelect } from "@/components/status-select";
import { deleteCategory } from "../../actions";
import { ImportForm } from "./import-form";
import { GenerateForm } from "./generate-form";
import { PipelineForm } from "./pipeline-form";
import { CopyButton } from "./copy-button";
import { KeywordsForm, type GscQuery } from "./keywords-form";
import { SerpForm } from "./serp-form";
import { Button } from "@/components/ui/button";

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
      <p className="text-xs font-medium text-muted-foreground">
        {label}
        {value && <span className="ml-2 font-normal text-muted-foreground/70">{value.length} car.</span>}
      </p>
      <p className="rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap ">
        {value || "—"}
      </p>
    </div>
  );
}

/** Un livrable HTML, avec son bouton de copie. */
function HtmlOutput({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">
          {label}
          {value && (
            <span className="ml-2 font-normal text-muted-foreground/70">
              {value.length} car.
            </span>
          )}
        </p>
        {value && <CopyButton value={value} />}
      </div>
      <pre className="max-h-96 overflow-auto rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ">
        {value || "—"}
      </pre>
    </div>
  );
}

/**
 * Résultat du contrôle automatique des règles métier.
 *
 * Le modèle applique les règles, ce module vérifie. Sur des centaines de
 * catégories, c'est le seul moyen d'attraper un « plaqué or » ou un disclaimer
 * manquant sans tout relire.
 */
function CompliancePanel({ report }: { report: ComplianceReport }) {
  const errors = report.issues.filter((issue) => issue.severity === "erreur");
  const warnings = report.issues.filter((issue) => issue.severity === "avertissement");

  if (report.issues.length === 0) {
    return (
      <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
        Règles métier : {report.passed} contrôles passés, aucun écart détecté.
      </p>
    );
  }

  return (
    <div
      className={`space-y-3 rounded-lg px-3 py-3 text-sm ${
        errors.length > 0 ? "bg-destructive/10" : "bg-amber-500/10"
      }`}
    >
      <p
        className={`font-medium ${
          errors.length > 0 ? "text-destructive" : "text-amber-700 dark:text-amber-400"
        }`}
      >
        {errors.length > 0
          ? `${errors.length} interdit(s) à corriger avant publication`
          : `${warnings.length} point(s) à vérifier`}
        {errors.length > 0 && warnings.length > 0 ? ` · ${warnings.length} à vérifier` : ""}
      </p>
      <ul className="space-y-2.5">
        {[...errors, ...warnings].map((issue, index) => (
          <li key={`${issue.rule}-${index}`} className="space-y-0.5">
            <p className="font-medium">
              {issue.severity === "erreur" ? "Interdit" : "À vérifier"} · {issue.rule}
            </p>
            <p className="text-muted-foreground">{issue.detail}</p>
            {issue.excerpt && (
              <p className="text-muted-foreground/80 text-xs italic">{issue.excerpt}</p>
            )}
          </li>
        ))}
      </ul>
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
  const serp = (category.serp_data ?? {}) as {
    results?: { rank: number; title: string; description: string; url: string; domain: string }[];
    ownRank?: number | null;
  };

  const { data: optimizations, error } = await supabase
    .from("optimizations")
    .select("*")
    .eq("category_id", id)
    .order("version", { ascending: false });

  if (error) throw new Error(`Lecture des optimisations impossible : ${error.message}`);

  const latest = optimizations?.[0];

  const payload = (latest?.payload ?? {}) as {
    groundedInPage?: boolean;
    compliance?: ComplianceReport;
    structured?: {
      differentiationFromFamily?: string;
      analysis?: {
        audience: string;
        intentVerdict: string;
        intentMatch: boolean;
        semanticGaps: string[];
        missingEntities: string[];
        differentiation: string;
      };
    };
  };
  const analysis = payload.structured?.analysis;
  const compliance = payload.compliance;

  // La famille : c'est d'elle qu'il faut se démarquer en premier, puisqu'elle
  // parle du même univers. On la lit à l'affichage pour que l'écart entre le
  // texte produit et celui des sœurs soit vérifiable à l'œil.
  const { data: relatives } = category.external_id
    ? await supabase
        .from("categories")
        .select("id, external_id, parent_external_id, name, url, target_keyword")
        .eq("project_id", category.project_id)
    : { data: null };

  const family = relatives ? buildFamily(category, relatives) : null;

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
            className="text-xs text-muted-foreground underline-offset-4 hover:underline dark:text-muted-foreground/70"
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
          className="block text-sm break-all text-muted-foreground underline-offset-4 hover:underline dark:text-muted-foreground/70"
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

      {family && (family.parent || family.siblings.length > 0 || family.children.length > 0) && (
        <Card
          title="Famille de la catégorie"
          description="La mère et les sœurs parlent du même univers : c'est d'elles que le texte doit se démarquer, pas du reste du site. Elles sont passées à la rédaction."
        >
          <div className="grid gap-6 text-sm sm:grid-cols-3">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Mère</p>
              {family.parent ? (
                <p>
                  {family.parent.name}
                  {family.parent.keyword && (
                    <span className="block text-xs text-muted-foreground">
                      {family.parent.keyword}
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-muted-foreground/70">Catégorie de premier niveau</p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Sœurs ({family.siblings.length})
              </p>
              <ul className="space-y-1">
                {family.siblings.slice(0, 12).map((sibling) => (
                  <li key={sibling.url} className="truncate">
                    {sibling.name}
                    {sibling.keyword && (
                      <span className="text-muted-foreground/70"> · {sibling.keyword}</span>
                    )}
                  </li>
                ))}
                {family.siblings.length > 12 && (
                  <li className="text-xs text-muted-foreground/70">
                    + {family.siblings.length - 12} autres
                  </li>
                )}
                {family.siblings.length === 0 && (
                  <li className="text-muted-foreground/70">Aucune</li>
                )}
              </ul>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Filles ({family.children.length})
              </p>
              <ul className="space-y-1">
                {family.children.slice(0, 12).map((child) => (
                  <li key={child.url} className="truncate">
                    {child.name}
                  </li>
                ))}
                {family.children.length > 12 && (
                  <li className="text-xs text-muted-foreground/70">
                    + {family.children.length - 12} autres
                  </li>
                )}
                {family.children.length === 0 && (
                  <li className="text-muted-foreground/70">Aucune</li>
                )}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {(category.catalog_short_description || category.catalog_long_description) && (
        <Card
          title="Descriptions actuellement en ligne"
          description="Telles qu'exportées de PrestaShop. C'est ce que les deux livrables remplacent."
        >
          <div className="space-y-4">
            <Output label="Courte — haut de page" value={category.catalog_short_description} />
            <Output label="Longue — bas de page" value={category.catalog_long_description} />
          </div>
        </Card>
      )}

      <Card
        title="Traitement complet"
        description="Relève la page, analyse la concurrence, déduit le champ sémantique et rédige — en une fois."
      >
        <PipelineForm
          categoryId={category.id}
          initialBrief={category.brief ?? ""}
          hasVersion={Boolean(latest)}
        />
      </Card>

      <details className="space-y-8">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground select-none hover:text-slate-900 dark:text-muted-foreground/70 dark:hover:text-slate-100">
          Étapes détaillées, à lancer séparément
        </summary>
        <div className="mt-4 space-y-8">
          <Card
            title="Données de la page"
            description="Va chercher les balises, le texte, les produits et les filtres directement sur l'URL."
          >
        <div className="space-y-3">
          <ImportForm categoryId={category.id} />
          {category.source_fetched_at && (
            <p className="text-xs text-muted-foreground">
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
              <p className="text-xs font-medium text-muted-foreground">
                Produits{source.productCount ? ` (${source.productCount} au total)` : ""}
              </p>
              <ul className="space-y-1 text-sm">
                {(source.products ?? []).slice(0, 15).map((product) => (
                  <li key={product} className="truncate">
                    {product}
                  </li>
                ))}
                {(source.products?.length ?? 0) > 15 && (
                  <li className="text-xs text-muted-foreground/70">
                    + {(source.products?.length ?? 0) - 15} autres
                  </li>
                )}
              </ul>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Filtres</p>
              <ul className="space-y-2 text-sm">
                {(source.facets ?? []).map((facet) => (
                  <li key={facet.name}>
                    <span className="font-medium">{facet.name}</span>{" "}
                    <span className="text-muted-foreground">
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
        title="Concurrence sur le mot-clé principal"
        description="Le classement organique relevé sur Google. Il sert de cahier des charges implicite à la rédaction : couvrir ce socle, puis s'en démarquer."
      >
        <div className="space-y-4">
          <SerpForm categoryId={category.id} hasData={Boolean(serp.results?.length)} />

          {serp.results && serp.results.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground">
                Relevé le{" "}
                {category.serp_fetched_at
                  ? new Date(category.serp_fetched_at).toLocaleString("fr-FR")
                  : "—"}
                {serp.ownRank
                  ? ` · le site est en position ${serp.ownRank}`
                  : " · le site n'apparaît pas dans ce classement"}
              </p>
              <ol className="space-y-3">
                {serp.results.slice(0, 5).map((result) => (
                  <li key={result.url} className="flex gap-3 text-sm">
                    <span className="w-5 shrink-0 text-right font-semibold tabular-nums text-muted-foreground/70">
                      {result.rank}
                    </span>
                    <span className="min-w-0">
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {result.title}
                      </a>
                      <span className="ml-2 text-xs text-muted-foreground/70">{result.domain}</span>
                      {result.description && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {result.description}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </Card>

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
              <span aria-hidden className="text-muted-foreground/70">
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
        </div>
      </details>

      {latest ? (
        <Card
          title={`Version optimisée v${latest.version}`}
          description={`${latest.engine ?? "moteur inconnu"}${
            latest.editorial_angle ? ` · angle : ${latest.editorial_angle}` : ""
          } · ${new Date(latest.created_at).toLocaleString("fr-FR")}`}
        >
          <div className="space-y-4">
            {payload.groundedInPage === false && (
              <p className="rounded-lg bg-amber-500/10 px-3 py-3 text-sm text-amber-700 dark:text-amber-400">
                <span className="font-medium">
                  Texte rédigé sans le relevé de la page.
                </span>{" "}
                Les produits et les facettes de filtres n&apos;ont pas pu être lus : aucune
                matière, référence ou gamme de prix citée ici n&apos;a été vérifiée contre le
                catalogue. Relance après avoir débloqué l&apos;accès à la page pour obtenir un
                texte réellement ancré.
              </p>
            )}
            {analysis && (
              <div
                className={`space-y-2 rounded-lg px-3 py-3 text-sm ${
                  analysis.intentMatch
                    ? "bg-muted"
                    : "bg-amber-500/10"
                }`}
              >
                <p className="font-medium">
                  {analysis.intentMatch
                    ? "Intention compatible avec une page catégorie"
                    : "Intention incompatible avec une page catégorie marchande"}
                </p>
                <p className="text-muted-foreground">{analysis.intentVerdict}</p>
                <p className="text-muted-foreground">
                  <span className="font-medium">Public visé : </span>
                  {analysis.audience}
                </p>
                {analysis.semanticGaps.length > 0 && (
                  <p className="text-muted-foreground">
                    <span className="font-medium">Manques comblés : </span>
                    {analysis.semanticGaps.join(" · ")}
                  </p>
                )}
                {analysis.missingEntities.length > 0 && (
                  <p className="text-muted-foreground">
                    <span className="font-medium">Entités intégrées : </span>
                    {analysis.missingEntities.join(" · ")}
                  </p>
                )}
                <p className="text-muted-foreground">
                  <span className="font-medium">Différenciation : </span>
                  {analysis.differentiation}
                </p>
              </div>
            )}
            {compliance && <CompliancePanel report={compliance} />}
            <Output label="Title" value={latest.title} />
            <Output label="Meta description" value={latest.meta_description} />
            <Output label="H1 — à reporter sur le nom de la catégorie" value={latest.h1} />
            {payload.structured?.differentiationFromFamily && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Écart revendiqué avec la mère et les sœurs
                </p>
                <p className="rounded-lg bg-muted px-3 py-2 text-sm">
                  {payload.structured.differentiationFromFamily}
                </p>
              </div>
            )}
            <HtmlOutput
              label="Description COURTE — haut de page"
              value={latest.short_description}
            />
            <HtmlOutput
              label="Description LONGUE — bas de page (sans H1)"
              value={latest.content}
            />
            <div className="border-t border-border pt-4 ">
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
                  <span className="text-xs text-muted-foreground">
                    {optimization.editorial_angle}
                  </span>
                )}
                <span className="text-xs text-muted-foreground/70">
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
        <Button variant="outline" size="sm" type="submit">
          Supprimer cette catégorie
        </Button>
      </form>
    </div>
  );
}
