"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { fetchSerpAction, type SerpState } from "../../actions";
import { Button } from "@/components/ui/button";

const INITIAL: SerpState = { status: "idle", message: "" };

function SubmitButton({ hasData }: { hasData: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Relevé du classement…" : hasData ? "Relancer l'analyse SERP" : "Analyser la SERP"}
    </Button>
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
              ? "bg-destructive/10 text-destructive"
              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
