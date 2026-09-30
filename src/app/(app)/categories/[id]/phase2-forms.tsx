"use client";

/**
 * Phase 2 : les textes, et ce qu'on en fait ensuite.
 *
 * La rédaction, le refus motivé, le passage en ligne. Les trois se tiennent :
 * un texte refusé laisse une raison, cette raison revient dans la rédaction
 * suivante, et seule une version acceptée finit publiée avec sa date.
 */

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  rejectOptimization,
  repairLatestVersion,
  runDescriptionPhase,
  setLocaleStatus,
  type DescriptionState,
  type RejectState,
} from "../../locale-actions";
import { Field } from "@/components/app-ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

function Submit({
  label,
  pendingLabel,
  variant,
}: {
  label: string;
  pendingLabel: string;
  variant?: "outline";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

const DESCRIPTION_INITIAL: DescriptionState = { status: "idle", message: "" };
const REJECT_INITIAL: RejectState = { status: "idle", message: "" };

const STEP_TONE: Record<string, string> = {
  ok: "text-emerald-700 dark:text-emerald-400",
  skipped: "text-amber-700 dark:text-amber-400",
  error: "text-destructive",
};

/**
 * Lance la rédaction des deux descriptions pour une langue.
 *
 * Les prérequis sont affichés avant le bouton, pas après l'échec : voir qu'il
 * manque un mot-clé coûte un coup d'œil, l'apprendre par un message d'erreur
 * coûte un aller-retour.
 */
export function DescriptionForm({
  categoryId,
  locale,
  hasKeyword,
  metadataApproved,
  targetLength,
  hasVersion,
}: {
  categoryId: string;
  locale: string;
  hasKeyword: boolean;
  metadataApproved: boolean;
  targetLength: number | null;
  hasVersion: boolean;
}) {
  const [state, action] = useActionState(runDescriptionPhase, DESCRIPTION_INITIAL);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="category_id" value={categoryId} />
      <input type="hidden" name="locale" value={locale} />

      <ul className="space-y-1 text-xs">
        <li className={hasKeyword ? STEP_TONE.ok : STEP_TONE.error}>
          {hasKeyword ? "✓" : "✗"} Mot-clé principal
          {hasKeyword ? "" : " — indispensable, la rédaction n'ira pas plus loin"}
        </li>
        <li className={metadataApproved ? STEP_TONE.ok : STEP_TONE.skipped}>
          {metadataApproved ? "✓" : "○"} Balises validées
          {metadataApproved ? "" : " — non validées, le modèle en proposera avec le texte"}
        </li>
        <li className={targetLength ? STEP_TONE.ok : STEP_TONE.skipped}>
          {targetLength ? "✓" : "○"} Longueur cible
          {targetLength
            ? ` — ${targetLength.toLocaleString("fr-FR")} caractères`
            : " — non mesurée, fourchette générale"}
        </li>
      </ul>

      <Submit
        label={hasVersion ? "Regénérer les descriptions" : "Rédiger les descriptions"}
        pendingLabel="Rédaction en cours, compter deux à trois minutes…"
      />

      {state.status !== "idle" && (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-sm ${
            state.status === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-slate-700 dark:text-slate-300"
          }`}
        >
          {state.message}
        </p>
      )}

      {state.steps && state.steps.length > 0 && (
        <ul className="space-y-1 text-xs">
          {state.steps.map((step, index) => (
            <li key={`${step.label}-${index}`}>
              <span className={`font-medium ${STEP_TONE[step.status]}`}>{step.label}</span>
              <span className="text-muted-foreground"> — {step.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

/**
 * Corrige la version affichée sur ses seuls points mesurés.
 *
 * C'est la réponse au « 77/100, qu'est-ce qui lui manque ? » : les points au
 * rouge sont juste au-dessus, ce bouton les reprend. Il ne relance pas une
 * rédaction complète — l'angle et les arguments sont conservés, seuls les
 * écarts mesurés bougent — et le résultat arrive en nouvelle version, donc
 * comparable à celle d'avant.
 */
export function RepairForm({
  categoryId,
  locale,
  version,
}: {
  categoryId: string;
  locale: string;
  version: number;
}) {
  const [state, action] = useActionState(repairLatestVersion, DESCRIPTION_INITIAL);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="category_id" value={categoryId} />
      <input type="hidden" name="locale" value={locale} />

      <div className="flex flex-wrap items-center gap-3">
        <Submit
          label={`Corriger les points rouges de la v${version}`}
          pendingLabel="Correction en cours…"
          variant="outline"
        />
        <span className="text-xs text-muted-foreground">
          Reprend le texte existant, ne touche qu&apos;aux écarts mesurés, et archive une
          nouvelle version.
        </span>
      </div>

      {state.status !== "idle" && (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-sm ${
            state.status === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-slate-700 dark:text-slate-300"
          }`}
        >
          {state.message}
        </p>
      )}

      {state.steps && state.steps.length > 0 && (
        <ul className="space-y-1 text-xs">
          {state.steps.map((step, index) => (
            <li key={`${step.label}-${index}`}>
              <span className={`font-medium ${STEP_TONE[step.status]}`}>{step.label}</span>
              <span className="text-muted-foreground"> — {step.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

/**
 * Refuse une version en disant pourquoi.
 *
 * Le champ est obligatoire et un minimum long, volontairement. « Pas bon » ne se
 * réinjecte pas dans un prompt : ce qu'on écrit ici est exactement ce que le
 * modèle relira avant la prochaine tentative, et ce qu'on relira soi-même pour
 * décider ce qui doit remonter dans les règles métier du site.
 */
export function RejectForm({
  optimizationId,
  categoryId,
  locale,
  version,
  existingReason,
  rejectedAt,
}: {
  optimizationId: string;
  categoryId: string;
  locale: string;
  version: number;
  existingReason: string | null;
  rejectedAt: string | null;
}) {
  const [state, action] = useActionState(rejectOptimization, REJECT_INITIAL);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="optimization_id" value={optimizationId} />
      <input type="hidden" name="category_id" value={categoryId} />
      <input type="hidden" name="locale" value={locale} />

      {rejectedAt && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Version {version} refusée le {new Date(rejectedAt).toLocaleString("fr-FR")}.
          Cette raison est repassée au modèle à chaque nouvelle rédaction.
        </p>
      )}

      <Field
        label={rejectedAt ? "Raison du refus — modifiable" : "Refuser cette version"}
        hint="Ce qui ne va pas, concrètement. Le texte reste archivé : refuser ne supprime rien."
      >
        <Textarea
          name="reason"
          rows={3}
          defaultValue={existingReason ?? ""}
          placeholder="Ex. : le texte parle de certificats de pierre alors que le catalogue n'en fournit pas, et la section entretien répète celle de la catégorie mère."
        />
      </Field>

      <Submit
        label={rejectedAt ? "Mettre à jour la raison" : "Consigner le refus"}
        pendingLabel="Enregistrement…"
        variant="outline"
      />

      {state.status !== "idle" && (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-sm ${
            state.status === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-slate-700 dark:text-slate-300"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}

const STATUS_LABELS: Record<string, string> = {
  todo: "À faire",
  in_progress: "En cours",
  optimized: "Rédigé",
  published: "Publié",
};

/**
 * Statut d'une catégorie DANS une langue, avec sa date de mise en ligne.
 *
 * Le statut est par langue parce que le travail l'est : une catégorie peut être
 * publiée en français et pas commencée en polonais. Un statut unique obligerait à
 * choisir lequel des dix mentir.
 */
export function LocaleStatusSelect({
  categoryId,
  projectId,
  locale,
  status,
  publishedAt,
}: {
  categoryId: string;
  projectId: string;
  locale: string;
  status: string;
  publishedAt: string | null;
}) {
  return (
    <form action={setLocaleStatus} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="category_id" value={categoryId} />
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="locale" value={locale} />
      <select
        name="status"
        defaultValue={status}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="border-input h-8 rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
      >
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {publishedAt && (
        <span className="text-xs text-muted-foreground">
          en ligne depuis le {new Date(publishedAt).toLocaleDateString("fr-FR")}
        </span>
      )}
      <noscript>
        <Button variant="outline" size="sm" type="submit">
          Appliquer
        </Button>
      </noscript>
    </form>
  );
}
