"use client";

import { useRef, useTransition } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setCategoryStatus } from "@/app/(app)/actions";
import { cn } from "@/lib/utils";
import type { CategoryStatus } from "@/lib/database.types";

const OPTIONS: { value: CategoryStatus; label: string }[] = [
  { value: "todo", label: "À traiter" },
  { value: "in_progress", label: "En cours" },
  { value: "optimized", label: "Optimisée" },
  { value: "published", label: "Terminé" },
];

/** Une couleur par état, pour repérer l'avancement d'un coup d'œil sur 107 lignes. */
const TONES: Record<CategoryStatus, string> = {
  todo: "text-muted-foreground",
  in_progress: "text-blue-600 dark:text-blue-400",
  optimized: "text-emerald-600 dark:text-emerald-400",
  published: "text-violet-600 dark:text-violet-400",
};

/** Statut modifiable à la main, enregistré dès le changement. */
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
  const [pending, startTransition] = useTransition();

  return (
    <form action={setCategoryStatus} ref={formRef}>
      <input type="hidden" name="category_id" value={categoryId} />
      <input type="hidden" name="project_id" value={projectId} />
      <Select
        name="status"
        defaultValue={status}
        onValueChange={() => startTransition(() => formRef.current?.requestSubmit())}
      >
        <SelectTrigger
          size="sm"
          disabled={pending}
          className={cn("w-[8.5rem] font-medium", TONES[status])}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </form>
  );
}
