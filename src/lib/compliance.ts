/**
 * Contrôle automatique des règles métier sur le texte produit.
 *
 * Les règles du client sont passées au modèle, et le modèle les suit la plupart
 * du temps. « La plupart du temps » ne suffit pas sur 366 catégories : personne
 * ne relira 366 textes ligne à ligne pour vérifier qu'aucun ne dit « plaqué or »
 * ou « pierre d'ambre ». Ce module fait ce contrôle en clair, après coup, et le
 * résultat s'affiche à côté du texte.
 *
 * Il ne remplace pas la relecture humaine : il attrape ce qui est mécaniquement
 * détectable — un mot interdit, un disclaimer manquant, un chiffre périssable —
 * et laisse le reste au jugement.
 */

export type Market = "b2b" | "b2c" | null;

export type ComplianceIssue = {
  /** `erreur` : interdit non négociable. `avertissement` : à vérifier à l'œil. */
  severity: "erreur" | "avertissement";
  rule: string;
  detail: string;
  /** Extrait fautif, pour retrouver le passage sans relire le texte entier. */
  excerpt: string;
};

export type ComplianceReport = {
  issues: ComplianceIssue[];
  /** Nombre de contrôles passés sans rien trouver. */
  passed: number;
};

type Check = {
  rule: string;
  detail: string;
  severity: "erreur" | "avertissement";
  pattern: RegExp;
  /** Ne s'applique qu'à ce marché ; absent = les deux. */
  market?: "b2b" | "b2c";
};

/**
 * Motif encadré par des frontières de mot qui tiennent avec les accents.
 *
 * `\b` s'appuie sur `\w`, qui ne connaît que l'ASCII : dans « bébé », le é final
 * n'est pas un caractère de mot, donc `\bbébé\b` ne trouve jamais rien. Le piège
 * est silencieux — la règle a l'air en place et ne se déclenche jamais — et il
 * touche précisément les catégories bébé, les plus sensibles du catalogue. On
 * encadre donc par des assertions Unicode explicites.
 */
function word(source: string, flags = "i"): RegExp {
  return new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${source})(?![\\p{L}\\p{N}])`,
    `${flags}u`,
  );
}

/** Suite de lettres, accents compris — remplace `\\w*` qui s'arrête au premier é. */
const L = "\\p{L}*";

/** Plages Unicode des émojis courants. */
const EMOJI =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F000}-\u{1F0FF}]/u;

const CHECKS: Check[] = [
  {
    rule: "Tiret cadratin interdit",
    detail: "Ponctuation simple imposée. Remplace par une virgule, un deux-points ou un point.",
    severity: "erreur",
    pattern: /—/,
  },
  {
    rule: "Émoji interdit",
    detail: "Aucun émoji dans un texte de catégorie.",
    severity: "erreur",
    pattern: EMOJI,
  },
  {
    rule: "Guillemets interdits dans le texte",
    detail: "Le nom de catégorie s'intègre en minuscules avec des prépositions, sans guillemets.",
    severity: "erreur",
    pattern: /[«»""]|"[^"]{2,60}"/,
  },
  {
    rule: "L'ambre n'est pas une pierre",
    detail: "L'ambre est une résine fossile. Écris « bijou en ambre », jamais « pierre d'ambre ».",
    severity: "erreur",
    pattern: /pierres?\s+d['’]ambre/i,
  },
  {
    rule: "« plaqué or » interdit",
    detail:
      "L'argent doré est de l'argent 925 doré à 0,5 micron d'or. Le placage est un autre " +
      "procédé : la confusion est interdite.",
    severity: "erreur",
    pattern: /plaqu[ée]s?\s+or/i,
  },
  {
    rule: "Superlatif creux",
    detail: "Remplace par un fait concret : matière, certificat, délai, garantie.",
    severity: "erreur",
    pattern: word(
      `in[ée]gal[ée]${L}|exceptionnel${L}|le meilleur|la meilleure|incontournable${L}|` +
        `r[ée]volutionnaire${L}|sans[- ]pareil|nec plus ultra`,
    ),
  },
  {
    rule: "Formule d'IA",
    detail: "Tournure passe-partout : réécris avec le vocabulaire du métier.",
    severity: "avertissement",
    pattern: word("plongez dans|que vous soyez|dans un monde o[uù]|il est important de noter"),
  },
  {
    rule: "Chiffre de catalogue périssable",
    detail:
      "Un nombre de références ou de pièces en stock devient faux au premier réassort. " +
      "Formule sans le chiffre.",
    severity: "erreur",
    pattern: word(
      "\\d{2,}\\s*(?:références?|pièces?|modèles?|articles?|bijoux)|\\d{2,}\\s+en stock",
    ),
  },
  {
    rule: "Showroom ou adresse",
    detail: "Jamais dans un texte de catégorie : information non vérifiée.",
    severity: "erreur",
    pattern: word("showroom"),
  },

  /* ------------------------------------------------------------ B2B ----- */
  {
    rule: "Le mot « artisanat » est interdit (Opalook)",
    detail: "Écris « fabrication » ou « savoir-faire ».",
    severity: "erreur",
    market: "b2b",
    pattern: word("artisanat"),
  },
  {
    rule: "« reconnu » interdit pour une pierre ou une vertu",
    detail: "Écris « réputé ».",
    severity: "avertissement",
    market: "b2b",
    pattern: word("reconnue?s?"),
  },
  {
    rule: "Registre client final sur un site B2B",
    detail:
      "On s'adresse au revendeur : « pour votre boutique », « votre réassort », " +
      "« votre clientèle ».",
    severity: "erreur",
    market: "b2b",
    pattern: word("offrez-vous|votre bijou|faites-vous plaisir|pour vous faire plaisir"),
  },
  {
    rule: "« pro » employé seul",
    detail: "Écris « grossiste », « revendeur », « partenaire » ou « professionnel ».",
    severity: "avertissement",
    market: "b2b",
    pattern: word("pros?"),
  },
  {
    rule: "Dropshipping",
    detail: "Canal refusé : jamais évoqué.",
    severity: "erreur",
    market: "b2b",
    pattern: word("dropshipping"),
  },

  /* ------------------------------------------------------------ B2C ----- */
  {
    rule: "Vocabulaire B2B sur un site grand public",
    detail:
      "Les requêtes professionnelles appartiennent au site B2B. Registre client final ici.",
    severity: "erreur",
    market: "b2c",
    pattern: word(
      `grossistes?|en gros|revendeu(?:r|rs|se|ses)|prix pros?|tarifs? pros?|par lots?`,
    ),
  },
  {
    rule: "« luxe », « haut de gamme », « pierres précieuses »",
    detail:
      "Écris « bijoux ornés de pierres naturelles », « qualité maîtrisée », « design raffiné ».",
    severity: "erreur",
    market: "b2c",
    pattern: word("luxe|haut de gamme|pierres? pr[ée]cieuses?"),
  },
  {
    rule: "Pas de bijoux en or sur ce site",
    detail: "L'or 18 carats n'existe que sur le site B2B.",
    severity: "erreur",
    market: "b2c",
    pattern: word("or\\s+(?:18\\s*carats?|750)"),
  },
];

/** Le texte parle-t-il de vertus, de bienfaits ou de lithothérapie ? */
const LITHO = word(
  `lithoth[ée]rapie|vertus?|bienfaits?|apaisant${L}|[ée]nergie${L}\\s+(?:de la|du|des)\\s+pierre`,
);

/** Formulation qui vaut disclaimer. */
const DISCLAIMER =
  /(pas\s+scientifiquement\s+prouv|non\s+prouv|croyances?\s+traditionnelles?|ne\s+sont\s+pas\s+[ée]tabli|aucune\s+preuve\s+scientifique)/i;

/** Vocabulaire imposé quand on évoque la lithothérapie. */
const HEDGED = /(potentiels?\s+bienfaits?|r[ée]put[ée]e?s?\s+pour)/i;

/** Catégorie destinée aux bébés ou aux enfants. */
const BABY = word(`b[ée]b[ée]s?|nourrisson${L}|nouveau-n[ée]s?`);
const CHILD = word(`enfants?|gar[çc]on${L}|fillettes?`);

const SAFETY = /surveillance\s+d['’]un\s+adulte|sous\s+surveillance|jamais\s+pendant\s+le\s+sommeil/i;

const MEDICAL = word(
  `pouss[ée]es?\\s+dentaires?|soulage${L}|gu[ée]ri${L}|rem[èe]de${L}|` +
    `dispositif\\s+m[ée]dical|calme\\s+les\\s+douleurs`,
);

function excerptAround(text: string, match: RegExpMatchArray): string {
  const at = match.index ?? 0;
  const start = Math.max(0, at - 45);
  const end = Math.min(text.length, at + match[0].length + 45);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).replace(/\s+/g, " ").trim()}${
    end < text.length ? "…" : ""
  }`;
}

/**
 * Passe le texte au crible des règles métier.
 *
 * `categoryName` sert à savoir si les règles renforcées bébé/enfant
 * s'appliquent : elles dépendent de la catégorie, pas seulement du texte.
 */
export function checkCompliance(
  text: string,
  options: { market: Market; categoryName?: string },
): ComplianceReport {
  const issues: ComplianceIssue[] = [];
  let passed = 0;

  // Opalook a une catégorie « Bijoux plaqué or » au catalogue : sur celle-là, le
  // terme est le nom du produit, pas la confusion que la règle interdit.
  const namesPlating = /plaqu[ée]s?\s+or/i.test(options.categoryName ?? "");

  for (const check of CHECKS) {
    if (check.market && check.market !== options.market) continue;
    if (namesPlating && check.rule.includes("plaqué or")) {
      passed += 1;
      continue;
    }

    const match = text.match(check.pattern);
    if (match) {
      issues.push({
        severity: check.severity,
        rule: check.rule,
        detail: check.detail,
        excerpt: excerptAround(text, match),
      });
    } else {
      passed += 1;
    }
  }

  /* --- lithothérapie : disclaimer et vocabulaire imposés ---------------- */

  const lithoMatch = text.match(LITHO);
  if (lithoMatch) {
    if (!DISCLAIMER.test(text)) {
      issues.push({
        severity: "erreur",
        rule: "Disclaimer lithothérapie manquant",
        detail:
          "Tout texte qui évoque des vertus ou des bienfaits doit porter une mention " +
          "explicite : ces propriétés relèvent de croyances traditionnelles et ne sont " +
          "pas scientifiquement prouvées.",
        excerpt: excerptAround(text, lithoMatch),
      });
    } else {
      passed += 1;
    }

    if (!HEDGED.test(text)) {
      issues.push({
        severity: "avertissement",
        rule: "Vocabulaire lithothérapie",
        detail: "Vocabulaire imposé : « potentiels bienfaits », « réputé pour ».",
        excerpt: excerptAround(text, lithoMatch),
      });
    } else {
      passed += 1;
    }
  } else {
    passed += 1;
  }

  /* --- bébé et enfant : règles renforcées ------------------------------- */

  const haystack = `${options.categoryName ?? ""} ${text}`;
  const isBaby = BABY.test(haystack);
  const isChild = isBaby || CHILD.test(options.categoryName ?? "");

  if (isChild) {
    if (!SAFETY.test(text)) {
      issues.push({
        severity: "erreur",
        rule: "Rappel de sécurité manquant (bébé/enfant)",
        detail:
          "Chaque texte de catégorie bébé ou enfant contient le rappel : port sous la " +
          "surveillance d'un adulte, jamais pendant le sommeil ni sans surveillance.",
        excerpt: options.categoryName ?? "",
      });
    } else {
      passed += 1;
    }

    const medical = text.match(MEDICAL);
    if (medical && !DISCLAIMER.test(text)) {
      issues.push({
        severity: "erreur",
        rule: "Promesse de santé sur un bijou bébé ou enfant",
        detail:
          "Aucun bienfait n'est jamais affirmé, et le bijou n'est jamais présenté comme " +
          "un remède ou un dispositif médical.",
        excerpt: excerptAround(text, medical),
      });
    } else {
      passed += 1;
    }
  }

  return { issues, passed };
}

/** Vrai s'il reste au moins un interdit non négociable. */
export function hasBlockingIssues(report: ComplianceReport): boolean {
  return report.issues.some((issue) => issue.severity === "erreur");
}
