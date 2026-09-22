import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { computeDepth, computePriority } from "@/lib/priority";
import { DEFAULT_LOCALE, localeLabel, sortLocales } from "@/lib/locales";
import { Card, EmptyState, Field } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusSelect } from "@/components/status-select";
import { createCategory, saveProjectBrief } from "../../actions";
import {
  BusinessRulesForm,
  ImportCatalogueForm,
  ImportCategoriesForm,
  ImportGscForm,
  ImportSemrushForm,
  MembersForm,
} from "./import-forms";

type PageMetrics = { clicks: number; impressions: number; position: number; opportunity: number };

const STATUS_LABELS: Record<string, string> = {
  todo: "À faire",
  in_progress: "En cours",
  optimized: "Rédigé",
  published: "Publié",
};

type LocaleRow = {
  category_id: string;
  locale: string;
  name: string;
  target_keyword: string | null;
  keyword_volume: number | null;
  keyword_difficulty: number | null;
  target_length: number | null;
  metadata_approved: boolean | null;
  status: string;
  published_at: string | null;
};

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
    <TableCell className={`text-right tabular-nums ${tone ?? "text-muted-foreground"}`}>
      {display}
    </TableCell>
  );
}

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { id } = await params;
  const { lang } = await searchParams;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, domain, notes, business_rules, market, owner_id")
    .eq("id", id)
    .maybeSingle();

  if (!project) notFound();

  // La gestion des accès n'est montrée qu'au propriétaire : un invité, même
  // éditeur, n'a pas à décider qui d'autre entre. La RLS l'interdit déjà côté
  // base ; ne pas afficher le bloc évite de lui proposer un bouton qui échoue.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = user?.id === project.owner_id;

  const { data: members } = isOwner
    ? await supabase
        .from("project_members")
        .select("email, role")
        .eq("project_id", id)
        .order("email")
    : { data: null };

  const { data: categories, error } = await supabase
    .from("categories")
    .select(
      "id, name, url, status, target_keyword, gsc_data, keyword_volume, keyword_difficulty, external_id, parent_external_id, products_count",
    )
    .eq("project_id", id);

  if (error) throw new Error(`Lecture des catégories impossible : ${error.message}`);

  /* --- les langues ------------------------------------------------------- */

  const { data: localeData, error: localeError } = await supabase
    .from("category_locales")
    .select(
      "category_id, locale, name, target_keyword, keyword_volume, keyword_difficulty, target_length, metadata_approved, status, published_at",
    )
    .eq("project_id", id);

  const localeRows = (localeData ?? []) as unknown as LocaleRow[];
  const availableLocales = sortLocales([
    ...new Set(localeRows.map((row) => row.locale)),
  ]);
  const locale =
    lang && availableLocales.includes(lang)
      ? lang
      : (availableLocales[0] ?? DEFAULT_LOCALE);

  const byCategory = new Map(
    localeRows.filter((row) => row.locale === locale).map((row) => [row.category_id, row]),
  );

  /* --- l'ordre de passage ------------------------------------------------ */
  //
  // Les catégories ne se traitent pas dans l'ordre du catalogue : une URL en
  // onzième position sur une requête à volume vaut dix catégories de fond de
  // rayon. La raison du rang est affichée avec lui, pour qu'il se discute.

  const parents = new Map(
    (categories ?? [])
      .filter((category) => category.external_id !== null)
      .map((category) => [category.external_id as number, category.parent_external_id]),
  );

  const ranked = [...(categories ?? [])]
    .map((category) => {
      const gsc = (category.gsc_data ?? {}) as { pageMetrics?: PageMetrics };
      const metrics = gsc.pageMetrics;
      const localized = byCategory.get(category.id);

      return {
        ...category,
        metrics,
        localized,
        priority: computePriority({
          depth: computeDepth(category.external_id, category.parent_external_id, parents),
          impressions: metrics?.impressions ?? null,
          position: metrics?.position ?? null,
          productsCount: category.products_count,
        }),
      };
    })
    .sort((a, b) => b.priority.score - a.priority.score);

  const totals = ranked.reduce(
    (acc, category) => ({
      impressions: acc.impressions + (category.metrics?.impressions ?? 0),
      clicks: acc.clicks + (category.metrics?.clicks ?? 0),
      done: acc.done + ((category.localized?.status ?? category.status) === "published" ? 1 : 0),
    }),
    { impressions: 0, clicks: 0, done: 0 },
  );

  /* --- avancement par langue -------------------------------------------- */

  const avancement = availableLocales.map((code) => {
    const rows = localeRows.filter((row) => row.locale === code);
    return {
      locale: code,
      total: rows.length,
      avecMotCle: rows.filter((row) => row.target_keyword).length,
      balisesValidees: rows.filter((row) => row.metadata_approved).length,
      redigees: rows.filter((row) => row.status === "optimized" || row.status === "published")
        .length,
      publiees: rows.filter((row) => row.status === "published").length,
    };
  });

  /* --- ce qui revient dans les refus ------------------------------------ */
  //
  // Une raison de refus corrigée dans les règles métier profite aux cent
  // quatre-vingts catégories suivantes. Encore faut-il les lire ensemble.

  const { data: refus } = await supabase
    .from("optimizations")
    .select(
      "id, category_id, locale, version, rejection_reason, rejected_at, categories!inner(project_id, name)",
    )
    .eq("categories.project_id", id)
    .not("rejection_reason", "is", null)
    .order("rejected_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <Link
          href="/dashboard"
          className="text-xs text-muted-foreground underline-offset-4 hover:underline dark:text-muted-foreground/70"
        >
          ← Tous les projets
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">{project.name}</h1>
        <p className="text-sm text-muted-foreground">
          {project.domain ?? "domaine non renseigné"} · {ranked.length} catégories ·{" "}
          {totals.impressions.toLocaleString("fr-FR")} impressions ·{" "}
          {totals.clicks.toLocaleString("fr-FR")} clics · {totals.done} publiée
          {totals.done > 1 ? "s" : ""}
        </p>
      </div>

      {localeError && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-3 text-sm text-amber-700 dark:text-amber-400">
          <span className="font-medium">Le multilingue n&apos;est pas encore actif en base.</span>{" "}
          Joue <code>supabase/migrations/2026-09-22_multilingue_et_suivi.sql</code> dans le SQL
          Editor de Supabase, puis <code>2026-09-22b_numerotation_par_langue.sql</code> dans
          une seconde exécution, puis réimporte le catalogue ci-dessous : c&apos;est
          l&apos;import qui crée les lignes des dix langues. ({localeError.message})
        </p>
      )}

      {avancement.length > 0 && (
        <Card
          title="Avancement par langue"
          description="Le travail est propre à chaque langue : un mot-clé, des balises et un texte par marché. Une langue à zéro n'est pas en retard, elle n'est pas commencée."
        >
          <div className="overflow-x-auto">
            <Table className="min-w-[40rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Langue</TableHead>
                  <TableHead className="text-right">Catégories</TableHead>
                  <TableHead className="text-right">Mot-clé</TableHead>
                  <TableHead className="text-right">Balises validées</TableHead>
                  <TableHead className="text-right">Rédigées</TableHead>
                  <TableHead className="text-right">Publiées</TableHead>
                  <TableHead className="text-right">Export</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {avancement.map((ligne) => (
                  <TableRow key={ligne.locale}>
                    <TableCell>
                      <Link
                        href={`/projects/${project.id}?lang=${ligne.locale}`}
                        className={`underline-offset-4 hover:underline ${
                          ligne.locale === locale ? "font-medium" : ""
                        }`}
                      >
                        {localeLabel(ligne.locale)}
                      </Link>
                    </TableCell>
                    <Cell value={ligne.total} />
                    <Cell value={ligne.avecMotCle} />
                    <Cell value={ligne.balisesValidees} />
                    <Cell value={ligne.redigees} />
                    <Cell
                      value={ligne.publiees}
                      tone={
                        ligne.publiees > 0
                          ? "font-medium text-emerald-700 dark:text-emerald-400"
                          : undefined
                      }
                    />
                    <TableCell className="text-right">
                      <a
                        href={`/api/projects/${project.id}/export?locale=${ligne.locale}`}
                        className="text-xs underline-offset-4 hover:underline"
                      >
                        CSV
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={`/api/projects/${project.id}/export?locale=all`}
              className="text-sm underline-offset-4 hover:underline"
            >
              Exporter toutes les langues
            </a>
            <span className="text-muted-foreground/50">·</span>
            <a
              href={`/api/projects/${project.id}/export?locale=all&publishable=1`}
              className="text-sm underline-offset-4 hover:underline"
            >
              Uniquement ce qui est publiable
            </a>
          </div>
          <p className="mt-2 text-xs text-muted-foreground/80">
            Point-virgule et UTF-8 avec BOM, pour qu&apos;Excel français l&apos;ouvre en
            colonnes. Le HTML des deux descriptions est conservé tel quel : c&apos;est ce
            que PrestaShop attend.
          </p>
        </Card>
      )}

      {ranked.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Ordre de passage {availableLocales.length > 0 ? `· langue affichée : ${localeLabel(locale)}` : ""}
            {" — "}gain rapide d&apos;abord, puis arborescence, puis volume de demande.
          </p>
          <div className="bg-card overflow-x-auto rounded-xl border">
            <Table className="min-w-[62rem]">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">Ordre</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Mot-clé principal</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Impr.</TableHead>
                  <TableHead className="text-right">Clics</TableHead>
                  <TableHead className="text-right">Pos.</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">KD</TableHead>
                  <TableHead className="text-right">Cible</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranked.map((category, index) => {
                  const quickWin =
                    category.metrics &&
                    category.metrics.position >= 11 &&
                    category.metrics.position <= 20;
                  const localized = category.localized;
                  return (
                    <TableRow key={category.id}>
                      <TableCell className="text-right align-top text-muted-foreground tabular-nums">
                        {index + 1}
                        <span className="block text-xs text-muted-foreground/60">
                          {category.priority.score}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <Link
                          href={`/categories/${category.id}?lang=${locale}`}
                          className="block truncate font-medium underline-offset-4 hover:underline"
                        >
                          {localized?.name ?? category.name}
                        </Link>
                        <span className="text-muted-foreground/70 block truncate text-xs">
                          {category.priority.raison}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[14rem]">
                        <span className="text-muted-foreground block truncate">
                          {localized?.target_keyword ??
                            (locale === DEFAULT_LOCALE ? category.target_keyword : null) ??
                            "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {localized ? (
                          <span className="text-sm text-muted-foreground">
                            {STATUS_LABELS[localized.status] ?? localized.status}
                            {localized.published_at && (
                              <span className="block text-xs text-muted-foreground/70">
                                {new Date(localized.published_at).toLocaleDateString("fr-FR")}
                              </span>
                            )}
                          </span>
                        ) : (
                          <StatusSelect
                            categoryId={category.id}
                            projectId={project.id}
                            status={category.status}
                          />
                        )}
                      </TableCell>
                      <Cell value={category.metrics?.impressions} />
                      <Cell value={category.metrics?.clicks} />
                      <Cell
                        value={category.metrics?.position.toFixed(1)}
                        tone={
                          quickWin ? "font-medium text-amber-700 dark:text-amber-400" : undefined
                        }
                      />
                      <Cell value={localized?.keyword_volume ?? category.keyword_volume} />
                      <Cell
                        value={localized?.keyword_difficulty ?? category.keyword_difficulty}
                      />
                      <Cell value={localized?.target_length} />
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <EmptyState>
          Aucune catégorie suivie. Importe les URL ci-dessous ou dépose un export Search Console.
        </EmptyState>
      )}

      {refus && refus.length > 0 && (
        <Card
          title="Textes refusés — ce qui revient"
          description="Chaque raison est repassée au modèle sur sa propre catégorie. Celles qui reviennent plusieurs fois n'ont rien à faire ici : elles doivent remonter dans les règles métier du site, où elles profiteront aux autres catégories."
        >
          <ul className="space-y-3 text-sm">
            {refus.map((entry) => {
              const categorie = entry.categories as unknown as { name: string } | null;
              return (
                <li key={entry.id} className="space-y-0.5">
                  <p>
                    <Link
                      href={`/categories/${entry.category_id}?lang=${entry.locale}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {categorie?.name ?? "catégorie"}
                    </Link>
                    <span className="text-muted-foreground">
                      {" "}
                      · {localeLabel(entry.locale as string)} · v{entry.version}
                      {entry.rejected_at
                        ? ` · ${new Date(entry.rejected_at as string).toLocaleDateString("fr-FR")}`
                        : ""}
                    </span>
                  </p>
                  <p className="text-muted-foreground">{entry.rejection_reason}</p>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {isOwner && (
        <Card
          title="Accès au projet"
          description="Qui peut ouvrir ce projet, en plus de toi. L'invitation porte sur une adresse e-mail : elle fonctionne même si la personne n'a jamais ouvert l'outil."
        >
          <MembersForm projectId={project.id} members={members ?? []} />
        </Card>
      )}

      <Card
        title="Règles métier du site"
        description="Le cadre que chaque texte doit respecter. Modifiable ici : ces règles évoluent, et elles sont injectées telles quelles à chaque génération. Un contrôle automatique signale ensuite les écarts détectables."
      >
        <BusinessRulesForm projectId={project.id} rules={project.business_rules} />
      </Card>

      <Card
        title="Brief éditorial"
        description="Complément court aux règles métier : contexte, priorités du moment, arguments à pousser. Le brief oriente, les règles contraignent."
      >
        <form action={saveProjectBrief} className="space-y-4">
          <input type="hidden" name="project_id" value={project.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Domaine">
              <Input
                name="domain"
                defaultValue={project.domain ?? ""}
                placeholder="client-x.fr"
              />
            </Field>
            <Field
              label="Marché"
              hint="Détermine le registre et les mots interdits contrôlés automatiquement."
            >
              <select
                name="market"
                defaultValue={project.market ?? ""}
                className="border-input bg-transparent dark:bg-input/30 h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">Non précisé</option>
                <option value="b2b">B2B — revendeurs professionnels</option>
                <option value="b2c">B2C — client final</option>
              </select>
            </Field>
          </div>
          <Field
            label="Brief"
            hint="Ex. : prioriser les catégories à fort volume, insister ce trimestre sur les nouveautés."
          >
            <Textarea
              name="notes"
              rows={5}
              defaultValue={project.notes ?? ""}
            />
          </Field>
          <Button type="submit">
            Enregistrer le brief
          </Button>
        </form>
      </Card>

      <Card
        title="Importer le catalogue PrestaShop"
        description="Liste faisant autorité des catégories, avec l'arborescence et les descriptions déjà en ligne, dans toutes les langues du fichier. C'est la seule source qui donne la mère et les sœurs de chaque catégorie — celles dont il faut se démarquer."
      >
        <ImportCatalogueForm projectId={project.id} />
      </Card>

      <Card
        title="Importer les URL de catégories"
        description="À la main, quand il n'y a pas d'export catalogue. Réimporter la même liste ne crée pas de doublons."
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
              <Input name="name" required placeholder="Chaussures de running" />
            </Field>
            <Field label="URL">
              <Input name="url" required placeholder="https://…" />
            </Field>
            <Field label="Mot-clé cible">
              <Input name="target_keyword" placeholder="chaussures de running" />
            </Field>
          </div>
          <Button type="submit">
            Ajouter
          </Button>
        </form>
      </Card>
    </div>
  );
}
