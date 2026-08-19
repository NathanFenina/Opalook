import type { ReactNode } from "react";

/** Bandeau de chiffres clés. Une valeur absente s'affiche en tiret, pas en zéro. */
export function MetricRow({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-5 dark:border-slate-800 dark:bg-slate-800">
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
      ? "text-amber-700 dark:text-amber-400"
      : tone === "good"
        ? "text-emerald-700 dark:text-emerald-400"
        : "";

  return (
    <div className="bg-white px-4 py-3 dark:bg-slate-900">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className={`mt-0.5 text-lg font-semibold tabular-nums ${toneClass}`}>{display}</dd>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
