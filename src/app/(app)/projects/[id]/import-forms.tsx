"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  importCategories,
  importGscData,
  type BulkImportState,
  type GscImportState,
} from "../../actions";
import { buttonClass, inputClass, Field } from "@/components/ui";

function Submit({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass}>
      {pending ? pendingLabel : label}
    </button>
  );
}

function Feedback({ status, message }: { status: string; message: string }) {
  if (status === "idle") return null;
  return (
    <p
      role="status"
      className={`rounded-lg px-3 py-2 text-sm ${
        status === "error"
          ? "bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-300"
          : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
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
        <textarea
          name="urls"
          rows={8}
          required
          placeholder={"https://opalook.eu/fr/13-grossiste-bijoux-revendeur-professionnel\nhttps://opalook.eu/fr/25-bracelets | Bracelets"}
          className={`${inputClass} font-mono text-xs`}
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
        <input
          type="file"
          name="file"
          accept=".csv,text/csv,text/plain"
          className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-slate-200 file:px-3 file:py-1 file:text-xs dark:file:bg-slate-800 dark:file:text-slate-200`}
        />
      </Field>
      <Field label="…ou colle le contenu CSV">
        <textarea name="csv" rows={4} className={`${inputClass} font-mono text-xs`} />
      </Field>
      <Submit label="Importer les données GSC" pendingLabel="Analyse…" />
      <Feedback status={state.status} message={state.message} />

      {state.cannibalization && state.cannibalization.length > 0 && (
        <div className="space-y-2 rounded-lg bg-amber-50 px-3 py-3 text-sm dark:bg-amber-950/40">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            Cannibalisation détectée — plusieurs URL sur la même requête
          </p>
          <ul className="space-y-2 text-xs text-amber-900 dark:text-amber-200">
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
