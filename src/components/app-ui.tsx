/**
 * Composants propres au domaine, bâtis sur les primitives shadcn/ui.
 *
 * Tout ce qui est générique (bouton, champ, tableau, sélecteur) vient de
 * `@/components/ui`. Ici on ne garde que ce qui parle SEO : un score, un feu
 * tricolore de critère, un statut de catégorie, un chiffre clé.
 */

import type { ReactNode } from "react";

import {
  Card as ShadcnCard,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Check } from "@/lib/moulinette";
import type { CategoryStatus } from "@/lib/database.types";

/** Section de page avec titre et sous-titre facultatifs. */
export function Card({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <ShadcnCard>
      {title && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </ShadcnCard>
  );
}

/** Étiquette + champ + aide, dans une pile cohérente. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-muted-foreground text-xs font-medium">{label}</Label>
      {children}
      {hint && <p className="text-muted-foreground/80 text-xs">{hint}</p>}
    </div>
  );
}

/**
 * Score sur 100. Les seuils sont ceux du barème : en dessous de 50 le contenu
 * est à refaire, au-dessus de 80 il est publiable.
 */
export function ScoreBadge({ score, label }: { score: number; label?: string }) {
  const tone =
    score >= 80
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : score >= 50
        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400";

  return (
    <Badge variant="outline" className={cn("gap-1 tabular-nums", tone)}>
      {label && <span className="font-normal opacity-70">{label}</span>}
      {score}/100
    </Badge>
  );
}

const STATUS_LABELS: Record<CategoryStatus, string> = {
  todo: "À traiter",
  in_progress: "En cours",
  optimized: "Optimisée",
  published: "Terminé",
};

export function StatusPill({ status }: { status: CategoryStatus }) {
  return <Badge variant="secondary">{STATUS_LABELS[status]}</Badge>;
}

/** Feux tricolores du barème, un par critère. */
export function ChecksList({ checks }: { checks: Check[] }) {
  const icon = { ok: "🟢", warn: "🟠", fail: "🔴" } as const;

  return (
    <ul className="space-y-2">
      {checks.map((check) => (
        <li key={check.id} className="flex gap-2.5 text-sm">
          <span aria-hidden className="leading-5">
            {icon[check.status]}
          </span>
          <span>
            <span className="font-medium">{check.label}</span>{" "}
            <span className="text-muted-foreground">{check.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-10 text-center text-sm">
      {children}
    </p>
  );
}

/** Bandeau de chiffres clés. Une valeur absente s'affiche en tiret, pas en zéro. */
export function MetricRow({ children }: { children: ReactNode }) {
  return (
    <dl className="bg-border grid grid-cols-2 gap-px overflow-hidden rounded-xl border sm:grid-cols-5">
      {children}
    </dl>
  );
}

export function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number | string | null | undefined;
  hint?: string;
  tone?: "warn" | "good";
}) {
  const display =
    value === null || value === undefined || value === ""
      ? "—"
      : typeof value === "number"
        ? value.toLocaleString("fr-FR")
        : value;

  const toneClass =
    tone === "warn"
      ? "text-amber-600 dark:text-amber-400"
      : tone === "good"
        ? "text-emerald-600 dark:text-emerald-400"
        : "";

  return (
    <div className="bg-card px-4 py-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={cn("mt-0.5 text-lg font-semibold tabular-nums", toneClass)}>{display}</dd>
      {hint && <p className="text-muted-foreground/70 text-xs">{hint}</p>}
    </div>
  );
}

/**
 * Classes conservées pour les éléments encore en balisage brut. Elles pointent
 * vers les variantes shadcn : l'apparence reste cohérente même là où le
 * composant n'a pas encore été remplacé.
 */
export const buttonClass = cn(buttonVariants());
export const secondaryButtonClass = cn(buttonVariants({ variant: "outline", size: "sm" }));
export const inputClass =
  "border-input bg-transparent dark:bg-input/30 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex w-full min-w-0 rounded-md border px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] md:text-sm";
