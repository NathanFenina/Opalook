import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import {
  Card,
  EmptyState,
  Field,
  buttonClass,
  inputClass,
} from "@/components/ui";
import { createProject } from "../actions";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, domain, created_at, categories(count)")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Lecture des projets impossible : ${error.message}`);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Projets</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Un projet = un site e-commerce dont on optimise les pages catégories.
        </p>
      </div>

      {projects && projects.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {projects.map((project) => {
            const count = project.categories?.[0]?.count ?? 0;
            return (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-600"
                >
                  <p className="font-medium">{project.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {project.domain ?? "domaine non renseigné"} · {count}{" "}
                    {count > 1 ? "catégories" : "catégorie"}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState>Aucun projet pour l&apos;instant. Crée le premier ci-dessous.</EmptyState>
      )}

      <Card
        title="Nouveau projet"
        description="Le nom sert aussi de marque dans les balises générées."
      >
        <form action={createProject} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Nom">
            <input name="name" required placeholder="Client X" className={inputClass} />
          </Field>
          <Field label="Domaine">
            <input name="domain" placeholder="client-x.fr" className={inputClass} />
          </Field>
          <button type="submit" className={buttonClass}>
            Créer
          </button>
        </form>
      </Card>
    </div>
  );
}
