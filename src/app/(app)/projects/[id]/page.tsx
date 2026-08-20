import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
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
    <TableCell className={`text-right tabular-nums ${tone ?? "text-muted-foreground"}`}>
      {display}
    </TableCell>
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
          className="text-xs text-muted-foreground underline-offset-4 hover:underline dark:text-muted-foreground/70"
        >
          ← Tous les projets
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">{project.name}</h1>
        <p className="text-sm text-muted-foreground">
          {project.domain ?? "domaine non renseigné"} · {ranked.length} catégories ·{" "}
          {totals.impressions.toLocaleString("fr-FR")} impressions ·{" "}
          {totals.clicks.toLocaleString("fr-FR")} clics · {totals.done} terminée
          {totals.done > 1 ? "s" : ""}
        </p>
      </div>

      {ranked.length > 0 ? (
        <div className="bg-card overflow-x-auto rounded-xl border">
          <Table className="min-w-[54rem]">
            <TableHeader>
              <TableRow>
                <TableHead>Catégorie</TableHead>
                <TableHead>Mot-clé principal</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Impr.</TableHead>
                <TableHead className="text-right">Clics</TableHead>
                <TableHead className="text-right">Pos.</TableHead>
                <TableHead className="text-right">Volume</TableHead>
                <TableHead className="text-right">KD</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranked.map((category) => {
                const quickWin =
                  category.metrics &&
                  category.metrics.position >= 8 &&
                  category.metrics.position <= 20;
                return (
                  <TableRow key={category.id}>
                    <TableCell className="max-w-xs">
                      <Link
                        href={`/categories/${category.id}`}
                        className="block truncate font-medium underline-offset-4 hover:underline"
                      >
                        {category.name}
                      </Link>
                      <span className="text-muted-foreground/70 block truncate text-xs">
                        {category.url.replace(/^https?:\/\/[^/]+/, "")}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[14rem]">
                      <span className="text-muted-foreground block truncate">
                        {category.target_keyword ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusSelect
                        categoryId={category.id}
                        projectId={project.id}
                        status={category.status}
                      />
                    </TableCell>
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
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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
            <Input
              name="domain"
              defaultValue={project.domain ?? ""}
              placeholder="client-x.fr"
            />
          </Field>
          <Field
            label="Brief"
            hint="Ex. : grossiste B2B, s'adresse à des revendeurs professionnels, insister sur les quantités minimales et les marges."
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
