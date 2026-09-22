/**
 * Export CSV du travail d'un projet.
 *
 * C'est la sortie du tunnel. Tout ce que l'outil produit — balises, segment
 * d'URL, descriptions courte et longue, statut, date de mise en ligne — finit
 * recopié dans PrestaShop, et personne ne fera cent quatre-vingts
 * copier-coller par langue depuis un écran.
 *
 * Deux décisions de forme, dictées par l'usage réel et pas par la pureté :
 *
 *  - point-virgule et BOM UTF-8, parce que le fichier sera ouvert dans Excel
 *    français, où un CSV séparé par virgules atterrit dans une seule colonne et
 *    où l'absence de BOM transforme les accents en mojibake ;
 *  - HTML conservé pour les deux descriptions, parce que c'est ce que le champ
 *    PrestaShop attend, et que le retirer obligerait à le remettre à la main.
 *
 * L'accès passe par la session : la RLS ne renverra que les projets que le compte
 * connecté peut lire, propriétaire comme invité.
 */

import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { localeLabel, sortLocales } from "@/lib/locales";
import { computeDepth, computePriority } from "@/lib/priority";

/** Une cellule CSV : guillemets doublés, tout le reste conservé tel quel. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  // Les retours à la ligne des descriptions HTML sont légitimes : on les garde
  // en protégeant la cellule, comme le prévoit la RFC 4180.
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.join(";"), ...rows.map((row) => row.map(cell).join(";"))];
  // Le BOM est ce qui décide Excel à lire en UTF-8.
  return `\ufeff${lines.join("\r\n")}\r\n`;
}

type Similarity = { pire?: number; verdict?: string };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const wanted = url.searchParams.get("locale");
  const onlyPublishable = url.searchParams.get("publishable") === "1";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, domain")
    .eq("id", id)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }
  if (!project) {
    return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  }

  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("id, name, url, external_id, parent_external_id, products_count, gsc_data")
    .eq("project_id", id);

  if (categoriesError) {
    return NextResponse.json({ error: categoriesError.message }, { status: 500 });
  }

  let localesQuery = supabase
    .from("category_locales")
    .select("*")
    .eq("project_id", id);
  if (wanted && wanted !== "all") localesQuery = localesQuery.eq("locale", wanted);

  const { data: localeRows, error: localesError } = await localesQuery;

  if (localesError) {
    return NextResponse.json(
      {
        error:
          `${localesError.message} — si la table des langues est absente, joue la ` +
          `migration 2026-09-22_multilingue_et_suivi.sql avant d'exporter.`,
      },
      { status: 500 },
    );
  }

  const { data: optimizations, error: optimizationsError } = await supabase
    .from("optimizations")
    .select(
      "category_id, locale, version, score, title, meta_description, h1, short_description, content, editorial_angle, rejection_reason, payload, created_at, categories!inner(project_id)",
    )
    .eq("categories.project_id", id)
    .order("version", { ascending: false });

  if (optimizationsError) {
    return NextResponse.json({ error: optimizationsError.message }, { status: 500 });
  }

  // La dernière version par couple (catégorie, langue) : c'est celle qu'on
  // publie. L'historique reste en base, il n'a rien à faire dans un export
  // destiné à être recopié.
  const latest = new Map<string, (typeof optimizations)[number]>();
  for (const row of optimizations ?? []) {
    const key = `${row.category_id}|${row.locale}`;
    if (!latest.has(key)) latest.set(key, row);
  }

  const byId = new Map((categories ?? []).map((category) => [category.id, category]));
  const parents = new Map(
    (categories ?? [])
      .filter((category) => category.external_id !== null)
      .map((category) => [category.external_id as number, category.parent_external_id]),
  );

  const headers = [
    "id_category",
    "langue",
    "priorite",
    "raison_priorite",
    "nom",
    "url",
    "link_rewrite",
    "mot_cle_principal",
    "volume_mensuel",
    "difficulte",
    "mots_cles_secondaires",
    "longueur_cible",
    "longueur_obtenue",
    "title",
    "meta_description",
    "h1",
    "description_courte_html",
    "description_longue_html",
    "angle_editorial",
    "score",
    "version",
    "ressemblance_max",
    "verdict_ressemblance",
    "regles_metier_ecarts",
    "raison_refus",
    "statut",
    "date_publication",
  ];

  const rows: unknown[][] = [];

  for (const row of localeRows ?? []) {
    const category = byId.get(row.category_id as string);
    if (!category) continue;

    const optimization = latest.get(`${row.category_id}|${row.locale}`);

    // « Publiable » veut dire : un texte existe et n'a pas été refusé. C'est le
    // filtre qu'on veut avant de coller dans PrestaShop.
    if (onlyPublishable && (!optimization || optimization.rejection_reason)) continue;

    const payload = (optimization?.payload ?? {}) as {
      similarity?: Similarity | null;
      longueur?: number;
      compliance?: { issues?: { severity: string; rule: string }[] };
    };

    const metrics = (category.gsc_data ?? {}) as {
      pageMetrics?: { impressions: number; position: number };
    };

    const priority = computePriority({
      depth: computeDepth(category.external_id, category.parent_external_id, parents),
      impressions: metrics.pageMetrics?.impressions ?? null,
      position: metrics.pageMetrics?.position ?? null,
      productsCount: category.products_count,
    });

    const ecarts = (payload.compliance?.issues ?? [])
      .filter((issue) => issue.severity === "erreur")
      .map((issue) => issue.rule)
      .join(" | ");

    rows.push([
      category.external_id,
      localeLabel(row.locale as string),
      priority.score,
      priority.raison,
      row.name,
      row.url,
      row.link_rewrite,
      row.target_keyword,
      row.keyword_volume,
      row.keyword_difficulty,
      (row.secondary_keywords as string[] | null)?.join(" | ") ?? "",
      row.target_length,
      payload.longueur ?? "",
      // Les balises validées à la main priment sur celles de la version : c'est
      // ce qu'on a approuvé qui doit partir en production.
      row.title ?? optimization?.title ?? "",
      row.meta_description ?? optimization?.meta_description ?? "",
      row.h1 ?? optimization?.h1 ?? "",
      optimization?.short_description ?? "",
      optimization?.content ?? "",
      optimization?.editorial_angle ?? "",
      optimization?.score ?? "",
      optimization?.version ?? "",
      payload.similarity?.pire ?? "",
      payload.similarity?.verdict ?? "",
      ecarts,
      optimization?.rejection_reason ?? "",
      row.status,
      row.published_at ? String(row.published_at).slice(0, 10) : "",
    ]);
  }

  // Par priorité décroissante, puis par langue : le fichier se lit dans l'ordre
  // où le travail doit se faire.
  const rankOfLocale = new Map(
    sortLocales([...new Set((localeRows ?? []).map((row) => row.locale as string))]).map(
      (locale, index) => [localeLabel(locale), index],
    ),
  );
  rows.sort(
    (a, b) =>
      Number(b[2]) - Number(a[2]) ||
      (rankOfLocale.get(String(a[1])) ?? 99) - (rankOfLocale.get(String(b[1])) ?? 99),
  );

  const slug =
    (project.name as string).normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "projet";
  const jour = new Date().toISOString().slice(0, 10);
  const suffixe = wanted && wanted !== "all" ? `-${wanted}` : "-toutes-langues";

  return new NextResponse(toCsv(headers, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="opalook-${slug}${suffixe}-${jour}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
