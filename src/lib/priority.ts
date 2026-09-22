/**
 * Ordre de passage des catégories.
 *
 * On ne traite pas cent quatre-vingts catégories d'un bloc : il faut un ordre,
 * et il ne peut pas être celui du catalogue. Trois critères le déterminent,
 * dans cet ordre d'importance.
 *
 * Le gain rapide d'abord. Une URL entre la onzième et la vingtième place est
 * déjà jugée pertinente par Google : elle manque de peu la première page, et un
 * texte réécrit l'y fait souvent basculer. C'est le meilleur rapport entre
 * l'effort et le trafic gagné, et de loin.
 *
 * L'arborescence ensuite. Une catégorie mère se rédige avant ses filles :
 * c'est elle qui fixe l'angle dont les autres devront se démarquer, et l'ordre
 * inverse obligerait à la réécrire une fois les filles publiées.
 *
 * Le volume de demande enfin, mesuré en impressions. Il départage ce que les
 * deux premiers critères laissent à égalité.
 */

export type PriorityInput = {
  /** Profondeur dans l'arborescence : 0 pour une racine. */
  depth: number;
  impressions: number | null;
  position: number | null;
  productsCount: number | null;
};

export type Priority = {
  /** 0 à 100. Plus c'est haut, plus la catégorie passe tôt. */
  score: number;
  /** Ce qui explique le rang, en une phrase, pour que l'ordre soit discutable. */
  raison: string;
};

/** Fenêtre où un texte réécrit fait le plus de différence. */
const GAIN_RAPIDE_MIN = 11;
const GAIN_RAPIDE_MAX = 20;

export function computePriority(input: PriorityInput): Priority {
  const raisons: string[] = [];
  let score = 0;

  const { position, impressions, depth, productsCount } = input;

  if (
    position !== null &&
    position >= GAIN_RAPIDE_MIN &&
    position <= GAIN_RAPIDE_MAX
  ) {
    score += 50;
    raisons.push(`position ${position.toFixed(1)}, à portée de la première page`);
  } else if (position !== null && position < GAIN_RAPIDE_MIN) {
    // Déjà en première page : réécrire rapporte moins qu'ailleurs, sans être
    // inutile — une position 8 peut encore progresser.
    score += 15;
    raisons.push(`déjà en position ${position.toFixed(1)}`);
  } else if (position !== null) {
    score += 5;
    raisons.push(`position ${position.toFixed(1)}, loin du compte`);
  }

  // Une racine passe avant ses filles : elle fixe l'angle dont elles devront
  // se démarquer.
  const profondeur = Math.max(0, 3 - depth) * 10;
  score += profondeur;
  if (depth === 0) raisons.push("catégorie de premier niveau");

  // Le logarithme évite qu'une seule page à très fort volume écrase tout le
  // classement : on veut départager, pas hiérarchiser sur ce seul critère.
  if (impressions && impressions > 0) {
    score += Math.min(20, Math.round(Math.log10(impressions + 1) * 6));
    raisons.push(`${impressions.toLocaleString("fr-FR")} impressions`);
  }

  // Une catégorie à trois produits ne mérite pas le même effort qu'une à mille,
  // quel que soit son potentiel théorique.
  if (productsCount !== null && productsCount < 5) {
    score -= 15;
    raisons.push(`seulement ${productsCount} produits`);
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    raison: raisons.join(" · ") || "aucune donnée pour trancher",
  };
}

/** Profondeur d'une catégorie, en remontant les parents. */
export function computeDepth(
  externalId: number | null,
  parentExternalId: number | null,
  parents: Map<number, number | null>,
): number {
  if (externalId === null) return 0;
  let depth = 0;
  let current = parentExternalId;
  const vus = new Set<number>([externalId]);

  while (current !== null && !vus.has(current)) {
    vus.add(current);
    depth += 1;
    current = parents.get(current) ?? null;
    if (depth > 10) break; // garde-fou contre une arborescence corrompue
  }
  return depth;
}
