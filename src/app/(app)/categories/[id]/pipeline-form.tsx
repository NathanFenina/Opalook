"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { runPipeline, type PipelineState } from "../../actions";
import { Field } from "@/components/app-ui";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const INITIAL: PipelineState = { status: "idle", message: "" };

const ICONS = { ok: "🟢", skipped: "🟠", error: "🔴" } as const;

function SubmitButton({ hasVersion }: { hasVersion: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full py-3 sm:w-auto">
      {pending
        ? "En cours — relevé, SERP, mots-clés, rédaction…"
        : hasVersion
          ? "Relancer le traitement complet"
          : "Lancer le traitement complet"}
    </Button>
  );
}

/**
 * Un seul bouton pour toute la chaîne : relève la page, analyse la SERP, déduit
 * le champ sémantique, puis rédige. Le rapport d'étapes indique ce qui a
 * réellement abouti — une étape en échec n'arrête pas la suite, mais on ne
 * laisse pas croire qu'elle a fonctionné.
 */
export function PipelineForm({
  categoryId,
  initialBrief,
  hasVersion,
}: {
  categoryId: string;
  initialBrief: string;
  hasVersion: boolean;
}) {
  const [state, formAction] = useActionState(runPipeline, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="category_id" value={categoryId} />

      <Field
        label="Directives pour cette page"
        hint="Pris en compte tel quel dans la rédaction : arguments à mettre en avant, contraintes, ce qu'il ne faut pas dire."
      >
        <Textarea
          name="brief"
          rows={4}
          defaultValue={initialBrief}
          placeholder="Ex. : insister sur les quantités minimales de commande, mentionner l'expédition sous 48 h, ne pas annoncer de prix."
        />
      </Field>

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

      {state.steps && state.steps.length > 0 && (
        <ul className="space-y-2 rounded-lg border border-border p-3 ">
          {state.steps.map((step) => (
            <li key={step.label} className="flex gap-2.5 text-sm">
              <span aria-hidden className="leading-5">
                {ICONS[step.status]}
              </span>
              <span>
                <span className="font-medium">{step.label}</span>{" "}
                <span className="text-muted-foreground">{step.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
