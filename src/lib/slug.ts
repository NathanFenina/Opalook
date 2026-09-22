/**
 * Segment d'URL PrestaShop.
 *
 * Le modèle propose une formulation, mais un segment d'URL ne se propose pas en
 * texte libre : un accent, une majuscule ou une apostrophe passée à travers
 * donnerait une URL cassée ou dédoublée. On normalise donc systématiquement ce
 * qui sort de la génération comme ce qui est saisi à la main.
 *
 * Une URL se change une fois. Après, elle demande une redirection — c'est pour
 * ça que la phase des liens se valide avant d'écrire les textes, et pas après.
 */

/**
 * Mots vides français et anglais : ils allongent l'URL sans rien y apporter.
 *
 * Les lettres seules y figurent parce que l'élision en produit : « bijoux
 * d'ambre » devient « bijoux d ambre » à la normalisation, et un segment
 * « bijoux-d-ambre » n'apporte rien de plus que « bijoux-ambre ».
 */
const STOP_WORDS = new Set([
  "le", "la", "les", "un", "une", "des", "du", "de", "au", "aux",
  "et", "ou", "a", "the", "and", "or", "of", "for",
  "d", "l", "n", "s", "j", "c", "m", "t", "qu",
]);

export function toLinkRewrite(value: string, keepStopWords = false): string {
  const base = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // Les liaisons élidées deviennent une coupure de mot, pas un collage :
    // « bijoux d'ambre » donne « bijoux-ambre », pas « bijoux-dambre ».
    .replace(/['’]/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!base) return "";

  const words = base.split("-").filter(Boolean);
  const kept = keepStopWords ? words : words.filter((word) => !STOP_WORDS.has(word));

  // Retirer tous les mots vides d'une expression qui n'en contient que ça
  // laisserait un segment vide : dans ce cas on garde la forme complète.
  return (kept.length > 0 ? kept : words).join("-").slice(0, 120);
}

/** Le segment tel qu'il est aujourd'hui dans une URL de catégorie. */
export function linkRewriteFromUrl(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    const last = parts.at(-1);
    if (!last) return null;
    // PrestaShop écrit /12-bijoux-ambre : l'identifiant en tête n'est pas le
    // segment éditorial, et le remplacer casserait la page.
    return last.replace(/\.html?$/i, "").replace(/^\d+-/, "") || null;
  } catch {
    return null;
  }
}
