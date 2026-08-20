"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { importFromUrl, type ImportState } from "../../actions";
import { Button } from "@/components/ui/button";

const INITIAL: ImportState = { status: "idle", message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Récupération…" : "Importer depuis l'URL"}
    </Button>
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
              ? "bg-destructive/10 text-destructive"
              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
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
