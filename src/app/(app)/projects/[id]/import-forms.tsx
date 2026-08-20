"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  importCategories,
  importGscData,
  importSemrushData,
  type BulkImportState,
  type GscImportState,
  type SemrushImportState,
} from "../../actions";
import { Field } from "@/components/app-ui";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

function Feedback({ status, message }: { status: string; message: string }) {
  if (status === "idle") return null;
  return (
    <p
      role="status"
      className={`rounded-lg px-3 py-2 text-sm ${
        status === "error"
          ? "bg-destructive/10 text-destructive"
          : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      }`}
    >
      {message}
    </p>
  );
}

const BULK_INITIAL: BulkImportState = { status: "idle", message: "" };

export function ImportCategoriesForm({ projectId }: { projectId: string }) {
  const [state, formAction] = useActionState(importCategories, BULK_INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="project_id" value={projectId} />
      <Field
        label="URL des catégories"
        hint="Une par ligne. Ajoute un nom après une barre verticale si tu veux le forcer : URL | Nom de la catégorie."
      >
        <Textarea
          name="urls"
          rows={8}
          required
          placeholder={"https://opalook.eu/fr/13-grossiste-bijoux-revendeur-professionnel\nhttps://opalook.eu/fr/25-bracelets | Bracelets"}
          className="font-mono text-xs"
        />
      </Field>
      <Submit label="Importer les URL" pendingLabel="Import…" />
      <Feedback status={state.status} message={state.message} />
    </form>
  );
}

const GSC_INITIAL: GscImportState = { status: "idle", message: "" };

export function ImportGscForm({ projectId }: { projectId: string }) {
  const [state, formAction] = useActionState(importGscData, GSC_INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="project_id" value={projectId} />
      <Field
        label="Fichier CSV"
        hint="L'export doit croiser page ET requête sur la même ligne — un export Looker Studio « URL Impression » avec les dimensions Landing Page + Query fait l'affaire."
      >
        <Input
          type="file"
          name="file"
          accept=".csv,text/csv,text/plain"
          className="file:mr-3 file:rounded file:border-0 file:bg-slate-200 file:px-3 file:py-1 file:text-xs dark:file:bg-slate-800 dark:file:text-slate-200"
        />
      </Field>
      <Field label="…ou colle le contenu CSV">
        <Textarea name="csv" rows={4} className="font-mono text-xs" />
      </Field>

      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          name="create_missing"
          defaultChecked
          className="mt-0.5 size-4 rounded border-input"
        />
        <span>
          Créer les catégories détectées dans l&apos;export
          <span className="block text-xs text-muted-foreground">
            Reconnaît les URL de catégories PrestaShop (/fr/13-mon-slug) et écarte fiches
            produits, pages CMS et URL à facettes. Évite d&apos;avoir à établir la liste ailleurs.
          </span>
        </span>
      </label>
      <Submit label="Importer les données GSC" pendingLabel="Analyse…" />
      <Feedback status={state.status} message={state.message} />

      {state.cannibalization && state.cannibalization.length > 0 && (
        <div className="space-y-2 rounded-lg bg-amber-500/10 px-3 py-3 text-sm dark:bg-amber-950/40">
          <p className="font-medium text-amber-700 dark:text-amber-400">
            Cannibalisation détectée — plusieurs URL sur la même requête
          </p>
          <ul className="space-y-2 text-xs text-amber-700 dark:text-amber-400">
            {state.cannibalization.map((conflict) => (
              <li key={conflict.query}>
                <span className="font-medium">« {conflict.query} »</span>
                <ul className="mt-0.5 ml-3 space-y-0.5 opacity-90">
                  {conflict.pages.map((page) => (
                    <li key={page} className="break-all">
                      {page}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}

const SEMRUSH_INITIAL: SemrushImportState = { status: "idle", message: "" };

export function ImportSemrushForm({ projectId }: { projectId: string }) {
  const [state, formAction] = useActionState(importSemrushData, SEMRUSH_INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="project_id" value={projectId} />
      <Field
        label="Fichier CSV"
        hint="Export Semrush (Keyword Overview, Bulk Analysis ou Keyword Magic). Colonnes reconnues : Keyword, Volume, Keyword Difficulty, CPC, Intent — en anglais comme en français, dans n'importe quel ordre."
      >
        <Input
          type="file"
          name="file"
          accept=".csv,text/csv,text/plain"
          className="file:mr-3 file:rounded file:border-0 file:bg-slate-200 file:px-3 file:py-1 file:text-xs dark:file:bg-slate-800 dark:file:text-slate-200"
        />
      </Field>
      <Field label="…ou colle le contenu CSV">
        <Textarea name="csv" rows={4} className="font-mono text-xs" />
      </Field>
      <Submit label="Importer volumes et difficulté" pendingLabel="Import…" />
      <Feedback status={state.status} message={state.message} />

      {state.unmatched && state.unmatched.length > 0 && (
        <div className="space-y-1 rounded-lg bg-amber-50 px-3 py-2 text-xs dark:bg-amber-950/40">
          <p className="font-medium text-amber-700 dark:text-amber-400">
            Mots-clés du fichier sans catégorie correspondante
          </p>
          <p className="text-amber-700/80 dark:text-amber-400/80">
            {state.unmatched.join(" · ")}
          </p>
        </div>
      )}
    </form>
  );
}
