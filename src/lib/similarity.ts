/**
 * Mesure de ressemblance entre deux textes de catégorie.
 *
 * Le reste de l'outil rend la duplication improbable : un mot-clé ne peut
 * cibler qu'une page, l'angle éditorial est retiré du tirage pour la famille,
 * chaque texte est ancré dans les produits et les filtres de sa propre page.
 * Aucun de ces garde-fous ne la *détecte*. Sur cent cinquante catégories qui
 * puisent dans une douzaine d'arguments autorisés, l'écart se creuse lentement
 * et ne se voit qu'à la fin, quand tout est écrit.
 *
 * D'où ce module, qui ne prévient rien et constate tout.
 *
 * La méthode est volontairement classique : on découpe chaque texte en suites
 * de mots consécutifs — des empreintes — et on compare les ensembles obtenus.
 * Deux textes qui traitent le même sujet avec des phrases différentes partagent
 * du vocabulaire mais peu d'empreintes ; deux textes recopiés l'un sur l'autre
 * en partagent beaucoup. C'est ce que mesure l'indice de Jaccard.
 *
 * Pas de modèle d'embeddings : il faudrait un appel réseau par comparaison, et
 * le verdict serait un nombre qu'on ne saurait pas justifier. Ici on peut
 * toujours montrer les phrases fautives, et c'est ce qui rend le constat
 * actionnable.
 */

/** Longueur des empreintes, en mots. */
const SHINGLE = 5;

/** Longueur minimale d'une phrase commune qu'on juge digne d'être montrée. */
const PHRASE_MIN = 8;

/**
 * Réduit un texte à ses mots significatifs.
 *
 * Accents et ponctuation sautent pour qu'une variante d'écriture ne fasse pas
 * passer deux phrases identiques pour différentes.
 */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Retire du texte les mots du nom de la catégorie.
 *
 * C'est le test que le client formule lui-même : enlever le nom, et regarder si
 * les deux textes restent distincts. Garder le nom gonflerait artificiellement
 * l'écart entre deux textes par ailleurs interchangeables — puisque c'est
 * précisément le seul endroit où ils diffèrent à coup sûr.
 */
function withoutName(list: string[], name: string): string[] {
  const noise = new Set(words(name));
  return list.filter((word) => !noise.has(word));
}

function shingles(list: string[]): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + SHINGLE <= list.length; i++) {
    out.add(list.slice(i, i + SHINGLE).join(" "));
  }
  return out;
}

export type Comparison = {
  /** 0 à 100. Part d'empreintes communes aux deux textes. */
  score: number;
  /** Les passages réellement partagés, du plus long au plus court. */
  phrases: string[];
};

/**
 * Compare deux textes et renvoie leur ressemblance.
 *
 * `name` et `otherName` servent à neutraliser les noms de catégorie avant
 * comparaison, pour que la mesure porte sur le propos et non sur l'étiquette.
 */
export function compare(
  text: string,
  name: string,
  other: string,
  otherName: string,
): Comparison {
  const a = withoutName(words(text), `${name} ${otherName}`);
  const b = withoutName(words(other), `${name} ${otherName}`);

  const sa = shingles(a);
  const sb = shingles(b);
  if (sa.size === 0 || sb.size === 0) return { score: 0, phrases: [] };

  let commun = 0;
  for (const s of sa) if (sb.has(s)) commun += 1;

  const score = Math.round((commun / (sa.size + sb.size - commun)) * 100);

  return { score, phrases: sharedPhrases(a, sb) };
}

/**
 * Reconstitue les passages communs, et non la liste des empreintes.
 *
 * Une empreinte de cinq mots ne parle à personne. En recollant les empreintes
 * consécutives qui figurent toutes des deux côtés, on retrouve la phrase
 * entière — celle qu'un relecteur reconnaîtra pour l'avoir déjà lue ailleurs.
 */
function sharedPhrases(a: string[], sb: Set<string>): string[] {
  const phrases: string[] = [];
  let start = -1;

  for (let i = 0; i + SHINGLE <= a.length; i++) {
    const present = sb.has(a.slice(i, i + SHINGLE).join(" "));
    if (present && start === -1) start = i;
    if (!present && start !== -1) {
      const phrase = a.slice(start, i + SHINGLE - 1);
      if (phrase.length >= PHRASE_MIN) phrases.push(phrase.join(" "));
      start = -1;
    }
  }
  if (start !== -1) {
    const phrase = a.slice(start);
    if (phrase.length >= PHRASE_MIN) phrases.push(phrase.join(" "));
  }

  return phrases.sort((x, y) => y.length - x.length).slice(0, 5);
}

export type Neighbour = {
  categoryId: string;
  name: string;
  /** `mere`, `soeur`, `fille` ou `projet` — d'où vient le voisin. */
  lien: string;
  score: number;
  phrases: string[];
};

export type SimilarityReport = {
  /** Le voisin le plus ressemblant, tous liens confondus. */
  pire: number;
  /** Le pire score parmi la seule famille, qui est le risque réel. */
  pireFamille: number;
  voisins: Neighbour[];
  verdict: "distinct" | "surveiller" | "trop proche";
};

/**
 * Deux seuils, calés sur ce que produit un texte honnête.
 *
 * Des catégories sœurs partagent forcément une part de formulation : même
 * marque, même pool d'arguments, mêmes contraintes de ton. En dessous de 15 %
 * c'est le bruit attendu. Au-delà de 30 %, l'expérience montre qu'on retrouve
 * des paragraphes entiers recopiés — et les phrases communes le prouvent.
 */
const SEUIL_SURVEILLANCE = 15;
const SEUIL_ALERTE = 30;

export function buildReport(voisins: Neighbour[]): SimilarityReport {
  const tries = [...voisins].sort((a, b) => b.score - a.score);
  const pire = tries[0]?.score ?? 0;
  const pireFamille =
    tries.find((v) => v.lien !== "projet")?.score ?? 0;

  return {
    pire,
    pireFamille,
    voisins: tries.slice(0, 5),
    verdict:
      pire >= SEUIL_ALERTE
        ? "trop proche"
        : pire >= SEUIL_SURVEILLANCE
          ? "surveiller"
          : "distinct",
  };
}
