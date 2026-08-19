"use client";

import { useRef } from "react";

import { setCategoryStatus } from "@/app/(app)/actions";
import type { CategoryStatus } from "@/lib/database.types";

const OPTIONS: { value: CategoryStatus; label: string }[] = [
  { value: "todo", label: "À traiter" },
  { value: "in_progress", label: "En cours" },
  { value: "optimized", label: "Optimisée" },
  { value: "published", label: "Terminé" },
];

const TONES: Record<CategoryStatus, string> = {
  todo: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  optimized: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  published: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
};

/** Statut modifiable à la main, enregistré au changement. */
export function StatusSelect({
  categoryId,
  projectId,
  status,
}: {
  categoryId: string;
  projectId: string;
  status: CategoryStatus;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form action={setCategoryStatus} ref={formRef}>
      <input type="hidden" name="category_id" value={categoryId} />
      <input type="hidden" name="project_id" value={projectId} />
      <select
        name="status"
        defaultValue={status}
        onChange={() => formRef.current?.requestSubmit()}
        onClick={(event) => event.stopPropagation()}
        className={`cursor-pointer rounded-full border-0 px-2.5 py-1 text-xs font-medium outline-none ${TONES[status]}`}
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </form>
  );
}
