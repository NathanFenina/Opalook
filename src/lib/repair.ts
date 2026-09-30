/**
 * Ce qui cloche dans un texte rendu, dit assez précisément pour être corrigé.
 *
 * Le barème sait dire qu'un contrôle est rouge. Il ne sait pas dire quoi faire.
 * Entre les deux il manque une traduction : « mot-clé absent de la meta
 * description » doit devenir « réécris la meta description en y plaçant la forme
 * exacte "grossiste bijoux", sans dépasser 158 caractères ». C'est cette
 * traduction qui permet à la machine de se corriger elle-même au lieu
 * d'attendre qu'on relise cent quatre-vingts pages à la main.
 *
 * Le périmètre est volontairement étroit : on ne répare que ce qui se mesure.
 * Un texte plat, creux ou hors sujet ne relève pas d'ici — ça se refuse à la
 * main, avec une raison, et la raison repart dans le prompt.
 */

import { audit, LIMITS, type Check } from "@/lib/moulinette";
import { renderCategoryText } from "@/lib/render";
import type { CategoryContent } from "@/lib/generate";

export type Defect = {
  /** Identifiant du contrôle, aligné sur ceux du barème. */
  id: string;
  /** Ce qui est constaté, à l'indicatif. */
  constat: string;
  /** Ce qu'il faut faire, à l'impératif, assez précis pour être exécuté. */
  consigne: string;
  /** Un rouge se corrige, un orange se discute. */
  gravite: "rouge" | "orange";
};

/** Marge tolérée autour de la longueur visée avant de parler d'écart. */
const TOLERANCE = 0.15;

/**
 * Les défauts mécaniques d'une version, classés par gravité.
 *
 * `targetLength` est la médiane du top 10 quand elle a été mesurée. Sans elle on
 * s'en tient aux bornes générales du barème, qui sont larges à dessein : viser
 * une valeur fixe sur toutes les requêtes n'a pas de sens.
 */
export function findDefects(
  content: CategoryContent,
  keyword: string,
  targetLength: number | null,
): Defect[] {
  const longText = renderCategoryText(content);
  const { checks } = audit(
    {
      title: content.title,
      metaDescription: content.metaDescription,
      h1: content.h1,
      content: longText,
    },
    keyword,
  );

  const byId = new Map(checks.map((check) => [check.id, check]));
  const defects: Defect[] = [];

  const push = (
    check: Check | undefined,
    consigne: string,
    quand: (check: Check) => boolean = (c) => c.status !== "ok",
  ) => {
    if (!check || !quand(check)) return;
    defects.push({
      id: check.id,
      constat: `${check.label} — ${check.detail}`,
      consigne,
      gravite: check.status === "fail" ? "rouge" : "orange",
    });
  };

  push(
    byId.get("title-keyword"),
    `Réécris le title en ouvrant sur la forme exacte « ${keyword} », mot pour mot ` +
      `et dans cet ordre. Reste entre ${LIMITS.title.min} et ${LIMITS.title.max} caractères.`,
  );
  push(
    byId.get("title-length"),
    `Ajuste le title à ${LIMITS.title.min}–${LIMITS.title.max} caractères sans perdre le mot-clé.`,
  );
  push(
    byId.get("meta-keyword"),
    `Réécris la meta description en y plaçant la forme exacte « ${keyword} », mot ` +
      `pour mot. Une meta sans le mot-clé perd la mise en gras dans les résultats ` +
      `de Google, donc du clic. Vise ${LIMITS.metaDescription.min}–158 caractères : ` +
      `au-delà de 158 Google tronque, et ${LIMITS.metaDescription.max} est le plafond ` +
      `au-dessus duquel le contrôle passe à l'orange.`,
  );
  push(
    byId.get("meta-length"),
    `Ajuste la meta description à ${LIMITS.metaDescription.min}–${LIMITS.metaDescription.max} ` +
      `caractères en gardant le mot-clé et une raison concrète de cliquer.`,
  );
  push(
    byId.get("h1-keyword"),
    `Réécris le H1 pour qu'il contienne la forme exacte « ${keyword} ». Il se lit ` +
      `comme un nom de rayon, pas comme un titre d'article.`,
  );
  push(
    byId.get("h1-length"),
    `Ajuste le H1 à ${LIMITS.h1.min}–${LIMITS.h1.max} caractères.`,
  );
  push(
    byId.get("content-density"),
    `Place la forme exacte « ${keyword} » entre 4 et 8 fois dans le corps du texte, ` +
      `intertitres compris, là où elle reste naturelle. Les variantes viennent en plus, ` +
      `pas à la place.`,
  );
  push(
    byId.get("content-structure"),
    `Structure la description longue en sections avec des intertitres.`,
  );

  /* --- la longueur visée, que le barème ne connaît pas ------------------- */

  if (targetLength && targetLength > 0) {
    const ecart = (longText.length - targetLength) / targetLength;
    if (Math.abs(ecart) > TOLERANCE) {
      const pourcent = Math.round(Math.abs(ecart) * 100);
      const trop = ecart > 0;
      defects.push({
        id: "target-length",
        constat:
          `Longueur — ${longText.length.toLocaleString("fr-FR")} caractères pour ` +
          `${targetLength.toLocaleString("fr-FR")} visés, ${trop ? "plus long" : "plus court"} ` +
          `de ${pourcent} %.`,
        consigne: trop
          ? `Ramène la description longue à environ ${targetLength.toLocaleString("fr-FR")} ` +
            `caractères. Ne coupe pas au hasard : supprime les redites et les passages ` +
            `qui n'aident pas à choisir, garde les sections qui portent une information ` +
            `que les concurrents n'ont pas.`
          : `Étoffe la description longue jusqu'à environ ${targetLength.toLocaleString("fr-FR")} ` +
            `caractères, en couvrant ce que traitent les premiers du classement et ` +
            `qui manque ici. N'ajoute pas de remplissage.`,
        // Un écart de longueur n'est pas une faute, c'est un écart à une cible
        // mesurée. Il se corrige, il ne condamne pas la version.
        gravite: "orange",
      });
    }
  }

  return defects;
}

/** Les défauts mis en liste, tels qu'ils partent au modèle. */
export function describeDefects(defects: Defect[]): string {
  return defects
    .map((defect, index) => `${index + 1}. ${defect.constat}\n   → ${defect.consigne}`)
    .join("\n");
}

/**
 * Une phrase de bilan, pour le message de retour à l'écran.
 *
 * On compare les écarts eux-mêmes, pas leur nombre. Une soustraction dirait
 * « un écart corrigé » là où la correction en a réparé deux et introduit un
 * troisième — et c'est précisément ce troisième qu'il faut signaler, puisque
 * c'est le seul dont personne ne se doute.
 */
export function defectsSummary(avant: Defect[], apres: Defect[]): string {
  if (avant.length === 0) return " Contrôles : tout au vert dès la première passe.";

  const avantIds = new Set(avant.map((defect) => defect.id));
  const apresIds = new Set(apres.map((defect) => defect.id));

  const corriges = [...avantIds].filter((id) => !apresIds.has(id));
  const restants = [...apresIds].filter((id) => avantIds.has(id));
  const nouveaux = [...apresIds].filter((id) => !avantIds.has(id));

  if (apres.length === 0) {
    return ` Contrôles : ${avant.length} écart(s) détecté(s) et corrigé(s) automatiquement, tout est au vert.`;
  }

  return (
    ` Contrôles : ${corriges.length} écart(s) corrigé(s) automatiquement` +
    (restants.length > 0 ? `, ${restants.length} non résolu(s) (${restants.join(", ")})` : "") +
    (nouveaux.length > 0
      ? `, ${nouveaux.length} apparu(s) pendant la correction (${nouveaux.join(", ")})`
      : "") +
    "."
  );
}

/**
 * Laquelle des deux versions garder.
 *
 * La correction peut échouer, et rendre pire que l'original — un modèle à qui
 * l'on demande de raccourcir peut sabrer une section utile et perdre le mot-clé
 * au passage. On ne fait donc pas confiance à la seconde passe par principe :
 * on compte les défauts restants, les rouges d'abord, et on garde la meilleure.
 * À égalité on garde l'originale, parce qu'elle a été écrite d'un seul geste.
 */
export function pickBest<T>(
  original: { content: T; defects: Defect[] },
  repaired: { content: T; defects: Defect[] },
): { content: T; defects: Defect[]; retenue: "originale" | "corrigée" } {
  const poids = (defects: Defect[]) =>
    defects.filter((defect) => defect.gravite === "rouge").length * 10 + defects.length;

  return poids(repaired.defects) < poids(original.defects)
    ? { ...repaired, retenue: "corrigée" }
    : { ...original, retenue: "originale" };
}
