import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * État de la configuration serveur.
 *
 * Ne renvoie jamais la valeur d'un secret, seulement s'il est présent, sa
 * longueur et son préfixe. C'est ce qu'il faut pour distinguer les trois causes
 * habituelles d'un « clé absente » : variable jamais ajoutée, ajoutée à un seul
 * environnement, ou ajoutée après le dernier déploiement — les variables
 * d'environnement Vercel ne sont lues qu'au build.
 */
export const dynamic = "force-dynamic";

function describe(name: string) {
  const value = process.env[name];
  if (!value) return { name, present: false };
  return {
    name,
    present: true,
    length: value.length,
    prefix: `${value.slice(0, 7)}…`,
  };
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  return NextResponse.json(
    {
      environnement: process.env.VERCEL_ENV ?? "local",
      deploiement: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      branche: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      variables: [
        describe("ANTHROPIC_API_KEY"),
        describe("DATAFORSEO_LOGIN"),
        describe("DATAFORSEO_PASSWORD"),
        describe("EXTRACT_BYPASS_HEADER"),
        describe("EXTRACT_BYPASS_TOKEN"),
        describe("NEXT_PUBLIC_SUPABASE_URL"),
        describe("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
      ],
      // Noms seuls, jamais les valeurs. Rend visible une variable saisie sous un
      // nom approchant — faute de frappe, tiret au lieu du souligné, espace
      // final — qui autrement resterait introuvable.
      nomsApprochants: Object.keys(process.env)
        .filter((key) => /anthropic|claude|dataforseo|bypass/i.test(key))
        .sort(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
