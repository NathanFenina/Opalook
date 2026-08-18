"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { importFromUrl, type ImportState } from "../../actions";
import { buttonClass } from "@/components/ui";

const INITIAL: ImportState = { status: "idle", message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass}>
      {pending ? "Récupération…" : "Importer depuis l'URL"}
    </button>
  );
}

export function ImportForm({ categoryId }: { categoryId: string }) {
  const [state, formAction] = useActionState(importFromUrl, INITIAL);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="category_id" value={categoryId} />
      <SubmitButton />

      {state.status !== "idle" && (
        <div
          role="status"
          className={`space-y-1 rounded-lg px-3 py-2 text-sm ${
            state.status === "error"
              ? "bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-300"
              : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
          }`}
        >
          <p>{state.message}</p>
          {state.diagnostics && state.diagnostics.length > 0 && (
            <ul className="text-xs opacity-80">
              {state.diagnostics.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
