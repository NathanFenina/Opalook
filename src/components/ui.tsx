import type { ReactNode } from "react";

import type { Check } from "@/lib/moulinette";
import type { CategoryStatus } from "@/lib/database.types";

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
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      {title && (
        <header className="mb-4 space-y-1">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
          )}
        </header>
      )}
      {children}
    </section>
  );
}

export function ScoreBadge({ score, label }: { score: number; label?: string }) {
  const tone =
    score >= 80
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      : score >= 50
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
        : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";

  return (
    <span
      className={`inline-flex items-baseline gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}
    >
      {label && <span className="font-normal opacity-75">{label}</span>}
      {score}/100
    </span>
  );
}

const STATUS_LABELS: Record<CategoryStatus, string> = {
  todo: "À traiter",
  in_progress: "En cours",
  optimized: "Optimisée",
  published: "Publiée",
};

export function StatusPill({ status }: { status: CategoryStatus }) {
  const tone: Record<CategoryStatus, string> = {
    todo: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
    optimized:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    published:
      "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  };

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

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
            <span className="text-slate-500 dark:text-slate-400">{check.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

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
    <label className="block space-y-1.5">
      <span className="block text-xs font-medium text-slate-600 dark:text-slate-400">
        {label}
      </span>
      {children}
      {hint && <span className="block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:focus:border-slate-400";

export const buttonClass =
  "rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200";

export const secondaryButtonClass =
  "rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
      {children}
    </p>
  );
}
