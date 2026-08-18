import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { extractFromUrl, ExtractionError } from "@/lib/extract";

/**
 * Teste l'extraction sur une URL arbitraire et renvoie le résultat brut.
 * Réservé aux utilisateurs connectés — sert à valider les sélecteurs sur un
 * nouveau thème avant de brancher une catégorie dessus.
 *
 * Usage : /api/extract?url=https://exemple.com/ma-categorie
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const target = request.nextUrl.searchParams.get("url");
  if (!target) {
    return NextResponse.json(
      { error: "Paramètre `url` manquant. Exemple : /api/extract?url=https://…" },
      { status: 400 },
    );
  }

  try {
    const extraction = await extractFromUrl(target);
    return NextResponse.json(extraction, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ExtractionError) {
      return NextResponse.json(
        { error: error.message, kind: error.kind },
        { status: 422 },
      );
    }
    return NextResponse.json(
      { error: (error as Error).message, kind: "unknown" },
      { status: 500 },
    );
  }
}
