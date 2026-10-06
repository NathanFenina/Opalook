/**
 * Les langues du site, et ce qu'il faut savoir de chacune pour travailler.
 *
 * Une langue n'est pas qu'une étiquette d'affichage. Interroger un volume de
 * recherche ou une SERP demande deux codes distincts : le pays où l'on mesure la
 * demande, et la langue dans laquelle on la mesure. « allemand » ne suffit pas —
 * le volume de « Bernsteinkette » n'est pas le même en Allemagne, en Autriche et
 * en Suisse.
 *
 * Le pays retenu ici est le premier marché de chaque langue. C'est une décision
 * commerciale, pas une évidence technique : elle est donc rassemblée à un seul
 * endroit, modifiable sans toucher au reste.
 */

export type LocaleInfo = {
  /** Code langue tel qu'il apparaît dans les colonnes du catalogue PrestaShop. */
  code: string;
  label: string;
  /** Code pays Google (identifiant de critère) pour les mesures de demande. */
  locationCode: number;
  /** Code langue Google. */
  languageCode: string;
  /** Pays retenu, affiché pour que le choix soit discutable. */
  country: string;
};

/**
 * Langues connues. Une langue absente d'ici reste utilisable — elle héritera
 * d'un repli — mais ses volumes seront mesurés sur un marché par défaut, ce qui
 * se voit à l'écran.
 */
export const LOCALES: LocaleInfo[] = [
  { code: "fr", label: "Français", locationCode: 2250, languageCode: "fr", country: "France" },
  { code: "en", label: "Anglais", locationCode: 2826, languageCode: "en", country: "Royaume-Uni" },
  { code: "de", label: "Allemand", locationCode: 2276, languageCode: "de", country: "Allemagne" },
  { code: "es", label: "Espagnol", locationCode: 2724, languageCode: "es", country: "Espagne" },
  { code: "it", label: "Italien", locationCode: 2380, languageCode: "it", country: "Italie" },
  { code: "nl", label: "Néerlandais", locationCode: 2528, languageCode: "nl", country: "Pays-Bas" },
  { code: "pt", label: "Portugais", locationCode: 2620, languageCode: "pt", country: "Portugal" },
  { code: "pl", label: "Polonais", locationCode: 2616, languageCode: "pl", country: "Pologne" },
  { code: "sv", label: "Suédois", locationCode: 2752, languageCode: "sv", country: "Suède" },
  { code: "da", label: "Danois", locationCode: 2208, languageCode: "da", country: "Danemark" },
  { code: "fi", label: "Finnois", locationCode: 2246, languageCode: "fi", country: "Finlande" },
  { code: "no", label: "Norvégien", locationCode: 2578, languageCode: "no", country: "Norvège" },
  { code: "cs", label: "Tchèque", locationCode: 2203, languageCode: "cs", country: "Tchéquie" },
  { code: "el", label: "Grec", locationCode: 2300, languageCode: "el", country: "Grèce" },
  { code: "ro", label: "Roumain", locationCode: 2642, languageCode: "ro", country: "Roumanie" },
  { code: "hu", label: "Hongrois", locationCode: 2348, languageCode: "hu", country: "Hongrie" },
  { code: "ru", label: "Russe", locationCode: 2643, languageCode: "ru", country: "Russie" },
  { code: "tr", label: "Turc", locationCode: 2792, languageCode: "tr", country: "Turquie" },
  { code: "ko", label: "Coréen", locationCode: 2410, languageCode: "ko", country: "Corée du Sud" },
  { code: "ja", label: "Japonais", locationCode: 2392, languageCode: "ja", country: "Japon" },
  { code: "zh", label: "Chinois", locationCode: 2156, languageCode: "zh", country: "Chine" },
];

/** Langue de référence : celle dans laquelle tout a été fait jusqu'ici. */
export const DEFAULT_LOCALE = "fr";

const BY_CODE = new Map(LOCALES.map((locale) => [locale.code, locale]));

/**
 * Ce qu'on sait d'une langue.
 *
 * Pour une langue inconnue on renvoie un repli mesuré en France plutôt que de
 * lever : l'outil doit continuer à fonctionner sur un catalogue qui publie dans
 * une langue qu'on n'avait pas prévue. Le drapeau `known` permet de le dire à
 * l'écran au lieu de le taire.
 */
export function localeInfo(code: string): LocaleInfo & { known: boolean } {
  const found = BY_CODE.get(code);
  if (found) return { ...found, known: true };

  return {
    code,
    label: code.toUpperCase(),
    locationCode: 2250,
    languageCode: code,
    country: "France (par défaut)",
    known: false,
  };
}

/** Nom lisible d'une langue, pour un tableau ou un message. */
export function localeLabel(code: string): string {
  return localeInfo(code).label;
}

/** Les langues connues d'abord, dans l'ordre du registre, puis le reste. */
export function sortLocales(codes: string[]): string[] {
  const rank = new Map(LOCALES.map((locale, index) => [locale.code, index]));
  return [...codes].sort(
    (a, b) => (rank.get(a) ?? 999) - (rank.get(b) ?? 999) || a.localeCompare(b),
  );
}
