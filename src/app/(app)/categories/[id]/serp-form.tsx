"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { fetchSerpAction, type SerpState } from "../../actions";
import { buttonClass } from "@/components/ui";

const INITIAL: SerpState = { status: "idle", message: "" };

function SubmitButton({ hasData }: { hasData: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass}>
      {pending ? "Relevé du classement…" : hasData ? "Relancer l'analyse SERP" : "Analyser la SERP"}
    </button>
  );
}

export function SerpForm({
  categoryId,
  hasData,
}: {
  categoryId: string;
  hasData: boolean;
}) {
  const [state, formAction] = useActionState(fetchSerpAction, INITIAL);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="category_id" value={categoryId} />
      <SubmitButton hasData={hasData} />

      {state.status !== "idle" && (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-sm ${
            state.status === "error"
              ? "bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-300"
              : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
