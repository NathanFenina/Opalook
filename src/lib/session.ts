/**
 * Le compte connecté, ou la page de connexion.
 *
 * Chaque action serveur commence par là. Le sortir dans un module partagé évite
 * qu'une nouvelle action oublie la vérification : c'est le genre d'oubli qui ne
 * se voit pas en développement, où l'on est toujours connecté.
 */

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type AppSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export function optionalText(formData: FormData, key: string): string | null {
  return text(formData, key) || null;
}
