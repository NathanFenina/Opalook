"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { runMoulinette, type GenerationState } from "../../actions";
import { Button } from "@/components/ui/button";

const INITIAL: GenerationState = { status: "idle", message: "" };

function SubmitButton({ hasVersion }: { hasVersion: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending
        ? "Rédaction en cours…"
        : hasVersion
          ? "Relancer la moulinette"
          : "Passer à la moulinette"}
    </Button>
  );
}

export function GenerateForm({
  categoryId,
  hasVersion,
}: {
  categoryId: string;
  hasVersion: boolean;
}) {
  const [state, formAction] = useActionState(runMoulinette, INITIAL);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="category_id" value={categoryId} />
      <SubmitButton hasVersion={hasVersion} />

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
