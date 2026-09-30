import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { auditSource, type Check } from "@/lib/moulinette";
import { buildFamily } from "@/lib/catalogue";
import type { ComplianceReport } from "@/lib/compliance";
import type { SimilarityReport } from "@/lib/similarity";
import { DEFAULT_LOCALE, localeInfo, localeLabel, sortLocales } from "@/lib/locales";
import { linkRewriteFromUrl } from "@/lib/slug";
import type { TargetLength } from "@/lib/target-length";
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
import { KeywordProposal, MetadataForm, TargetLengthForm } from "./phase1-forms";
import {
  DescriptionForm,
  LocaleStatusSelect,
  RejectForm,
  RepairForm,
} from "./phase2-forms";
import { AllLocalesRunner, type LocaleEtat } from "./all-locales";
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

/** Ce que porte une catégorie dans une langue donnée. */
type LocaleRow = {
  locale: string;
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
  metadata_generated_at: string | null;
  target_length: number | null;
  target_length_source: unknown;
  status: string;
  published_at: string | null;
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

/**
 * Ressemblance du texte avec ceux des autres catégories.
 *
 * Le score seul ne sert à rien : « 34 % » ne dit pas quoi réécrire. Les
 * passages communs, eux, se lisent et se corrigent. C'est pour ça qu'ils sont
 * montrés en entier plutôt que résumés.
 */
function SimilarityPanel({ report }: { report: SimilarityReport }) {
  const ton =
    report.verdict === "trop proche"
      ? "bg-destructive/10"
      : report.verdict === "surveiller"
        ? "bg-amber-500/10"
        : "bg-emerald-500/10";

  const titre =
    report.verdict === "trop proche"
      ? `Trop proche d'un autre texte du site — ${report.pire} % de passages communs`
      : report.verdict === "surveiller"
        ? `À surveiller — ${report.pire} % de passages communs`
        : `Texte distinct — ${report.pire} % au plus fort`;

  return (
    <div className={`space-y-3 rounded-lg px-3 py-3 text-sm ${ton}`}>
      <p className="font-medium">{titre}</p>

      {report.verdict === "distinct" ? (
        <p className="text-muted-foreground">
          Comparé à toutes les autres catégories du projet dans cette langue, nom de
          catégorie neutralisé. Rien qui ressemble à du contenu recyclé.
        </p>
      ) : (
        <ul className="space-y-3">
          {report.voisins
            .filter((voisin) => voisin.score > 0)
            .map((voisin) => (
              <li key={voisin.categoryId} className="space-y-1">
                <p>
                  <Link
                    href={`/categories/${voisin.categoryId}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {voisin.name}
                  </Link>
                  <span className="text-muted-foreground"> · {voisin.lien} · {voisin.score} %</span>
                </p>
                {voisin.phrases.map((phrase) => (
                  <p
                    key={phrase}
                    className="text-muted-foreground/80 border-l-2 border-current/20 pl-2 text-xs italic"
                  >
                    {phrase}
                  </p>
                ))}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
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

/**
 * Les langues de la catégorie, et où en est chacune.
 *
 * L'état d'avancement est montré sur l'onglet lui-même. Sur dix langues, savoir
 * laquelle attend quoi sans avoir à cliquer dix fois est la moitié du confort.
 */
function LocaleTabs({
  categoryId,
  locales,
  current,
}: {
  categoryId: string;
  locales: LocaleRow[];
  current: string;
}) {
  const STATUS_MARK: Record<string, string> = {
    todo: "○",
    in_progress: "◐",
    optimized: "●",
    published: "✓",
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {locales.map((row) => {
        const actif = row.locale === current;
        return (
          <Link
            key={row.locale}
            href={`/categories/${categoryId}?lang=${row.locale}`}
            className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
              actif
                ? "border-foreground/30 bg-muted font-medium"
                : "border-transparent text-muted-foreground hover:bg-muted/60"
            }`}
          >
            <span aria-hidden className="mr-1.5">
              {STATUS_MARK[row.status] ?? "○"}
            </span>
            {localeLabel(row.locale)}
            {!row.target_keyword && (
              <span className="ml-1.5 text-amber-700 dark:text-amber-400" title="pas de mot-clé">
                !
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { id } = await params;
  const { lang } = await searchParams;
  const supabase = await createClient();

  const { data: category } = await supabase
    .from("categories")
    .select("*, projects(id, name)")
    .eq("id", id)
    .maybeSingle();

  if (!category) notFound();

  const project = category.projects as { id: string; name: string } | null;

  /* --- les langues ------------------------------------------------------- */
  //
  // La table des langues peut ne pas encore exister : la migration se joue à la
  // main dans Supabase. Son absence ne doit pas rendre la page inaccessible, elle
  // doit se voir et se lire. On dégrade donc sur le français seul.

  const { data: localeData, error: localeError } = await supabase
    .from("category_locales")
    .select("*")
    .eq("category_id", id);

  const localeRows = (localeData ?? []) as unknown as LocaleRow[];
  const ordered = sortLocales(localeRows.map((row) => row.locale)).map(
    (code) => localeRows.find((row) => row.locale === code)!,
  );

  const locale =
    lang && ordered.some((row) => row.locale === lang) ? lang : DEFAULT_LOCALE;
  const localeRow = ordered.find((row) => row.locale === locale) ?? null;
  const marche = localeInfo(locale);

  // Le mot-clé et les mots-clés secondaires de la langue courante, avec repli sur
  // les colonnes françaises de `categories` — c'est là qu'ils vivaient avant.
  const keyword =
    localeRow?.target_keyword ??
    (locale === DEFAULT_LOCALE ? category.target_keyword : null);

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

  /* --- les versions de CETTE langue -------------------------------------- */

  const { data: localeOptimizations, error: optimizationsError } = await supabase
    .from("optimizations")
    .select("*")
    .eq("category_id", id)
    .eq("locale", locale)
    .order("version", { ascending: false });

  // Avant la migration, `optimizations.locale` n'existe pas : on relit sans le
  // filtre plutôt que de faire tomber la page sur une colonne manquante.
  const { data: fallbackOptimizations } = optimizationsError
    ? await supabase
        .from("optimizations")
        .select("*")
        .eq("category_id", id)
        .order("version", { ascending: false })
    : { data: null };

  const optimizations = localeOptimizations ?? fallbackOptimizations ?? [];
  const latest = optimizations[0];

  // La dernière version de CHAQUE langue, pour la vue d'ensemble. Une requête de
  // plus, mais c'est elle qui rend le multilingue lisible d'un coup d'œil au
  // lieu d'obliger à cliquer sur dix onglets.
  const { data: toutesVersions } = await supabase
    .from("optimizations")
    .select("id, locale, version, score, payload, created_at, rejection_reason")
    .eq("category_id", id)
    .order("version", { ascending: false });

  type Version = NonNullable<typeof toutesVersions>[number];
  const derniereParLangue = new Map<string, Version>();
  for (const version of toutesVersions ?? []) {
    const code = (version.locale as string) ?? DEFAULT_LOCALE;
    if (!derniereParLangue.has(code)) derniereParLangue.set(code, version);
  }

  const etats: LocaleEtat[] = ordered.map((row) => ({
    locale: row.locale,
    aMotCle: Boolean(row.target_keyword),
    aLongueur: Boolean(row.target_length),
    aVersion: derniereParLangue.has(row.locale),
  }));

  const payload = (latest?.payload ?? {}) as {
    groundedInPage?: boolean;
    compliance?: ComplianceReport;
    similarity?: SimilarityReport | null;
    complianceChecked?: boolean;
    longueur?: number;
    targetLength?: number | null;
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
  const similarity = payload.similarity;

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
        targetKeyword: keyword,
        sourceTitle: category.source_title,
        sourceMetaDescription: category.source_meta_description,
        sourceH1: category.source_h1,
        sourceContent: category.source_content,
      })
    : null;

  const mesure = (localeRow?.target_length_source ?? null) as TargetLength | null;
  const displayName = localeRow?.name || category.name;
  const displayUrl = localeRow?.url ?? category.url;

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
          <h1 className="text-xl font-semibold tracking-tight">{displayName}</h1>
          {project && localeRow ? (
            <LocaleStatusSelect
              categoryId={category.id}
              projectId={project.id}
              locale={locale}
              status={localeRow.status}
              publishedAt={localeRow.published_at}
            />
          ) : (
            project && (
              <StatusSelect
                categoryId={category.id}
                projectId={project.id}
                status={category.status}
              />
            )
          )}
        </div>
        <a
          href={displayUrl}
          target="_blank"
          rel="noreferrer"
          className="block text-sm break-all text-muted-foreground underline-offset-4 hover:underline dark:text-muted-foreground/70"
        >
          {displayUrl}
        </a>

        {ordered.length > 1 && (
          <div className="pt-2">
            <LocaleTabs categoryId={category.id} locales={ordered} current={locale} />
          </div>
        )}
      </div>

      {localeError && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-3 text-sm text-amber-700 dark:text-amber-400">
          <span className="font-medium">Le multilingue n&apos;est pas encore actif en base.</span>{" "}
          Joue <code>supabase/migrations/2026-09-22_multilingue_et_suivi.sql</code> dans le
          SQL Editor de Supabase, puis <code>2026-09-22b_numerotation_par_langue.sql</code>
          dans une seconde exécution : la table des langues, la longueur cible, la date
          de publication et la boucle de refus en dépendent. En attendant, la page
          fonctionne en français comme avant. ({localeError.message})
        </p>
      )}

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
        <Metric
          label="Volume / mois"
          value={localeRow?.keyword_volume ?? category.keyword_volume}
        />
        <Metric
          label="Difficulté SEO"
          value={localeRow?.keyword_difficulty ?? category.keyword_difficulty}
          hint={category.keyword_intent ?? undefined}
        />
      </MetricRow>

      {ordered.length > 1 && (
        <Card
          title="Toutes les langues en une commande"
          description="Chaque langue reçoit son propre mot-clé mesuré sur son marché, ses propres balises et son propre texte. Rien n'est traduit : un mot-clé allemand n'est pas la traduction du français, il n'a ni le même volume ni la même concurrence."
        >
          <AllLocalesRunner categoryId={category.id} etats={etats} />
        </Card>
      )}

      {ordered.length > 1 && (
        <Card
          title="Vue d'ensemble des langues"
          description="Où en est chaque marché, sur une seule ligne. Clique une langue pour l'ouvrir."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Langue</th>
                  <th className="px-3 py-2 text-left font-medium">Mot-clé</th>
                  <th className="px-3 py-2 text-right font-medium">Volume</th>
                  <th className="px-3 py-2 text-right font-medium">Cible</th>
                  <th className="px-3 py-2 text-right font-medium">Obtenu</th>
                  <th className="px-3 py-2 text-right font-medium">Score</th>
                  <th className="px-3 py-2 text-left font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((row) => {
                  const version = derniereParLangue.get(row.locale);
                  const meta = (version?.payload ?? {}) as { longueur?: number };
                  const actif = row.locale === locale;
                  return (
                    <tr
                      key={row.locale}
                      className={`border-t ${actif ? "bg-muted/40" : ""}`}
                    >
                      <td className="px-3 py-2">
                        <Link
                          href={`/categories/${category.id}?lang=${row.locale}`}
                          className={`underline-offset-4 hover:underline ${
                            actif ? "font-medium" : ""
                          }`}
                        >
                          {localeLabel(row.locale)}
                        </Link>
                      </td>
                      <td className="max-w-[16rem] px-3 py-2">
                        <span className="block truncate text-muted-foreground">
                          {row.target_keyword ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {row.keyword_volume?.toLocaleString("fr-FR") ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {row.target_length?.toLocaleString("fr-FR") ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {meta.longueur?.toLocaleString("fr-FR") ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {version?.score != null ? (
                          <ScoreBadge score={version.score} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {version?.rejection_reason ? (
                          <span className="text-destructive">refusée</span>
                        ) : (
                          {
                            todo: "À faire",
                            in_progress: "En cours",
                            optimized: "Rédigé",
                            published: "Publié",
                          }[row.status] ?? row.status
                        )}
                        {row.published_at && (
                          <span className="block text-xs text-muted-foreground/70">
                            {new Date(row.published_at).toLocaleDateString("fr-FR")}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ------------------------------------------------- phase 1 ------- */}

      <Card
        title={`Phase 1 · Mot-clé principal — ${marche.label}`}
        description={`Proposé à partir des données : requêtes déjà remontées par Search Console, catalogue de la page, puis volumes et difficulté mesurés sur le marché ${marche.country}. Rien n'est retenu sans clic.`}
      >
        <div className="space-y-4">
          <p className="text-sm">
            <span className="text-muted-foreground">Retenu actuellement : </span>
            <span className="font-medium">{keyword || "aucun"}</span>
          </p>
          <KeywordProposal
            categoryId={category.id}
            locale={locale}
            currentKeyword={keyword}
          />
        </div>
      </Card>

      <Card
        title="Phase 1 · Balises et segment d'URL"
        description="Se décident avant le texte, et se retravaillent après sans le regénérer. Une fois validées, la rédaction les reprend à l'identique."
      >
        <MetadataForm
          categoryId={category.id}
          locale={locale}
          initial={{
            title: localeRow?.title ?? "",
            metaDescription: localeRow?.meta_description ?? "",
            h1: localeRow?.h1 ?? "",
            linkRewrite: localeRow?.link_rewrite ?? linkRewriteFromUrl(displayUrl) ?? "",
            approved: Boolean(localeRow?.metadata_approved),
            generatedAt: localeRow?.metadata_generated_at ?? null,
          }}
        />
      </Card>

      <Card
        title="Phase 1 · Longueur à viser"
        description="Médiane des textes réellement classés dans le top 10 sur ce mot-clé, dans cette langue. Ni valeur fixe ni improvisation."
      >
        <TargetLengthForm
          categoryId={category.id}
          locale={locale}
          current={localeRow?.target_length ?? null}
          measuredAt={mesure?.measuredAt ?? null}
        />
      </Card>

      {/* ------------------------------------------------- phase 2 ------- */}

      <Card
        title={`Phase 2 · Rédaction — ${marche.label}`}
        description="Les deux descriptions, écrites pour les balises validées, à la longueur du top 10, en reprenant les raisons des refus précédents."
      >
        <DescriptionForm
          categoryId={category.id}
          locale={locale}
          hasKeyword={Boolean(keyword)}
          metadataApproved={Boolean(localeRow?.metadata_approved)}
          targetLength={localeRow?.target_length ?? null}
          hasVersion={Boolean(latest)}
        />
      </Card>

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

      {(localeRow?.catalog_short_description ||
        localeRow?.catalog_long_description ||
        category.catalog_short_description ||
        category.catalog_long_description) && (
        <Card
          title={`Descriptions actuellement en ligne — ${marche.label}`}
          description="Telles qu'exportées de PrestaShop. C'est ce que les deux livrables remplacent."
        >
          <div className="space-y-4">
            <Output
              label="Courte — haut de page"
              value={
                localeRow?.catalog_short_description ?? category.catalog_short_description
              }
            />
            <Output
              label="Longue — bas de page"
              value={
                localeRow?.catalog_long_description ?? category.catalog_long_description
              }
            />
          </div>
        </Card>
      )}

      <details className="space-y-8">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground select-none hover:text-slate-900 dark:text-muted-foreground/70 dark:hover:text-slate-100">
          Traitement en un clic et étapes détaillées, en français
        </summary>
        <div className="mt-4 space-y-8">
          <Card
            title="Traitement complet"
            description="Relève la page, analyse la concurrence, déduit le champ sémantique et rédige — en une fois, en français. Utile pour aller vite ; les deux phases ci-dessus donnent plus de contrôle."
          >
            <PipelineForm
              categoryId={category.id}
              initialBrief={category.brief ?? ""}
              hasVersion={Boolean(latest)}
            />
          </Card>

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
            title="Mots-clés secondaires et brief"
            description="Complète la phase 1 : le mot-clé principal se choisit ci-dessus, les secondaires et les fan queries se saisissent ici."
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
            title="Rédaction seule"
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
          title={`Version optimisée v${latest.version} — ${marche.label}`}
          description={`${latest.engine ?? "moteur inconnu"}${
            latest.editorial_angle ? ` · angle : ${latest.editorial_angle}` : ""
          } · ${new Date(latest.created_at).toLocaleString("fr-FR")}`}
        >
          <div className="space-y-4">
            {latest.rejection_reason && (
              <p className="rounded-lg bg-destructive/10 px-3 py-3 text-sm text-destructive">
                <span className="font-medium">Version refusée.</span>{" "}
                {latest.rejection_reason}
              </p>
            )}
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
            {payload.longueur !== undefined && (
              <p className="text-xs text-muted-foreground">
                Longueur obtenue : {payload.longueur.toLocaleString("fr-FR")} caractères
                {payload.targetLength
                  ? ` pour ${payload.targetLength.toLocaleString("fr-FR")} visés`
                  : " (aucune cible mesurée)"}
                .
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
            {compliance && payload.complianceChecked !== false && (
              <CompliancePanel report={compliance} />
            )}
            {payload.complianceChecked === false && (
              <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                Contrôle automatique des règles métier réservé au français : les
                tournures interdites sont détectées sur des expressions françaises. Ce
                texte est à relire à l&apos;œil.
              </p>
            )}
            {similarity && <SimilarityPanel report={similarity} />}
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
            <div className="border-t border-border space-y-4 pt-4 ">
              <ChecksList checks={checksFromPayload(latest.payload)} />
              <RepairForm
                categoryId={category.id}
                locale={locale}
                version={latest.version}
              />
            </div>
            <div className="border-t border-border pt-4">
              <RejectForm
                optimizationId={latest.id}
                categoryId={category.id}
                locale={locale}
                version={latest.version}
                existingReason={latest.rejection_reason ?? null}
                rejectedAt={latest.rejected_at ?? null}
              />
            </div>
          </div>
        </Card>
      ) : (
        <EmptyState>
          Pas encore de version optimisée en {marche.label}. Fais la phase 1, puis lance la
          rédaction.
        </EmptyState>
      )}

      {optimizations.length > 0 && (
        <Card
          title={`Toutes les versions en ${marche.label} (${optimizations.length})`}
          description="Chaque rédaction est archivée, jamais écrasée. L'origine indique quel bouton l'a produite : le traitement en un clic, les deux phases, ou une passe de correction."
        >
          <ul className="space-y-2 text-sm">
            {optimizations.map((optimization) => {
              const meta = (optimization.payload ?? {}) as {
                source?: string;
                longueur?: number;
              };
              const courante = optimization.id === latest?.id;
              return (
                <li
                  key={optimization.id}
                  className={`flex flex-wrap items-center gap-3 rounded-lg px-2 py-1.5 ${
                    courante ? "bg-muted" : ""
                  }`}
                >
                  <span className="font-medium">v{optimization.version}</span>
                  {courante && (
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      affichée ci-dessus
                    </span>
                  )}
                  {optimization.score != null && <ScoreBadge score={optimization.score} />}
                  <span className="text-xs text-muted-foreground">
                    {meta.source ?? "origine inconnue"}
                  </span>
                  {meta.longueur !== undefined && (
                    <span className="text-xs text-muted-foreground/70 tabular-nums">
                      {meta.longueur.toLocaleString("fr-FR")} car.
                    </span>
                  )}
                  {optimization.editorial_angle && (
                    <span className="text-xs text-muted-foreground">
                      {optimization.editorial_angle}
                    </span>
                  )}
                  {optimization.rejection_reason && (
                    <span className="text-xs font-medium text-destructive">refusée</span>
                  )}
                  <span className="text-xs text-muted-foreground/70">
                    {new Date(optimization.created_at).toLocaleString("fr-FR")}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {before && (
        <Card
          title="Audit de la version en ligne"
          description="Le même barème appliqué au texte actuellement publié, pour mesurer l'écart."
        >
          <ChecksList checks={before.checks} />
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
