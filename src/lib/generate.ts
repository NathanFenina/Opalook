/**
 * Génération du contenu de catégorie par Claude.
 *
 * Le point dur n'est pas d'écrire un texte : c'est d'en écrire 180 qui ne se
 * ressemblent pas. Deux leviers, dans cet ordre d'importance :
 *
 *  1. La matière réelle de la page — produits listés et facettes de filtres.
 *     C'est ce qui ancre chaque texte dans sa catégorie plutôt que dans le
 *     thème général du site.
 *  2. Un angle éditorial imposé, choisi hors de ceux déjà utilisés par les
 *     autres catégories du projet, et renvoyé pour être stocké.
 *
 * La consigne « fais différent » ne suffit pas : le modèle ne voit pas les
 * autres pages. On lui passe donc explicitement ce qui est déjà pris.
 */

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import type { Family, FamilyMember } from "@/lib/catalogue";
import { DEFAULT_LOCALE, localeInfo } from "@/lib/locales";

export const GENERATION_MODEL = "claude-opus-5";

/**
 * Noms acceptés pour la clé Anthropic, par ordre de préférence.
 *
 * Le SDK ne lit que `ANTHROPIC_API_KEY`. Exiger ce nom exact transforme une
 * faute de nommage en panne opaque : la clé est là, payée, valide, et le
 * serveur affirme qu'elle est absente. On accepte donc les variantes courantes
 * et on passe la valeur explicitement au client.
 */
const API_KEY_NAMES = [
  "ANTHROPIC_API_KEY",
  "CLAUDE_API_KEY",
  "API_ANTHROPIC",
  "ANTHROPIC_KEY",
] as const;

function anthropicApiKey(): string | null {
  for (const name of API_KEY_NAMES) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return null;
}

const MISSING_KEY_MESSAGE =
  `Aucune clé Anthropic trouvée sur le serveur. Noms acceptés : ${API_KEY_NAMES.join(", ")}. ` +
  `Vérifie l'état réel sur /api/health, et rappelle-toi que les variables Vercel ne sont ` +
  `lues qu'au déploiement.`;

/** Angles éditoriaux disponibles. Deux catégories d'un même projet n'en partagent jamais un. */
export const EDITORIAL_ANGLES = [
  "guide de choix par usage",
  "comparatif des matières et finitions",
  "sélection par style et tendance",
  "approche budget et volumes de commande",
  "critères de qualité et durabilité",
  "conseils de revente et de mise en avant en boutique",
  "saisonnalité et temps forts commerciaux",
  "morphologie et conseils de port",
  "entretien et longévité du produit",
  "nouveautés et réassort",
] as const;

const SectionSchema = z.object({
  heading: z.string().describe("Titre de section, sera balisé en H2"),
  paragraphs: z.array(z.string()).describe("Paragraphes de la section"),
  bullets: z.array(z.string()).describe("Puces éventuelles, tableau vide si aucune"),
});

const FaqItemSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

/**
 * Volet d'analyse : ce que le modèle a compris de la SERP et du marché avant
 * d'écrire. Sans lui, on ne peut pas juger si un texte est faible parce que le
 * modèle a mal écrit ou parce que le mot-clé était mal choisi.
 */
const AnalysisSchema = z.object({
  audience: z.string().describe("Public réellement visé par la requête, d'après la SERP"),
  intentVerdict: z
    .string()
    .describe(
      "Intention dominante constatée dans la SERP, et si elle colle à une page catégorie marchande",
    ),
  intentMatch: z
    .boolean()
    .describe("Vrai si une page catégorie marchande a sa place sur cette requête"),
  semanticGaps: z
    .array(z.string())
    .describe("Concepts traités par les concurrents et absents de la page"),
  missingEntities: z
    .array(z.string())
    .describe("Entités nommées présentes chez les concurrents : matières, normes, labels, régions"),
  differentiation: z
    .string()
    .describe("L'angle apporté qu'aucun des concurrents ne traite"),
});

export const CategoryContentSchema = z.object({
  analysis: AnalysisSchema,
  title: z.string().describe("Balise title, 50 à 60 caractères, mot-clé en tête"),
  metaDescription: z
    .string()
    .describe(
      "Meta description, 140 à 158 caractères espaces compris — jamais plus de 158, " +
        "Google tronque au-delà. CONTIENT OBLIGATOIREMENT la forme exacte du mot-clé " +
        "principal, mot pour mot et dans le même ordre : sans elle, Google ne met rien " +
        "en gras dans le résultat et le taux de clic chute",
    ),
  h1: z
    .string()
    .describe(
      "H1 de la page, 40 à 65 caractères espaces compris — jamais plus de 65. " +
        "CONTIENT OBLIGATOIREMENT la forme exacte du mot-clé principal, mot pour mot " +
        "et dans le même ordre",
    ),
  shortDescription: z
    .array(z.string())
    .describe(
      "DESCRIPTION COURTE, haut de page : 2 paragraphes, 400 à 700 caractères au " +
        "total. Présente l'univers de la catégorie et un ou deux atouts. Le nom de " +
        "la catégorie y est intégré naturellement, en minuscules, avec prépositions. " +
        "Elle est lue avant la grille produits : elle situe, elle ne développe pas",
    ),
  intro: z
    .string()
    .describe(
      "Premier paragraphe de la DESCRIPTION LONGUE, bas de page. Mot-clé dans la " +
        "première phrase. Ne répète pas les phrases de la description courte",
    ),
  sections: z
    .array(SectionSchema)
    .describe(
      "3 à 5 sections de la description LONGUE. La longueur visée est donnée dans " +
        "le message et prime sur toute autre indication : elle est mesurée sur les " +
        "pages réellement classées. À défaut, viser 4 000 à 7 000 caractères",
    ),
  faq: z.array(FaqItemSchema).describe("2 à 4 questions fréquentes à intention transactionnelle"),
  editorialAngle: z.string().describe("L'angle éditorial retenu, repris de la liste imposée"),
  keywordVariants: z
    .array(z.string())
    .describe("Variantes et requêtes longue traîne réellement employées dans le texte"),
  differentiationFromFamily: z
    .string()
    .describe(
      "Une à deux phrases : en quoi ce texte se distingue de sa catégorie mère et " +
        "de ses sœurs. Angle, vocabulaire, atouts retenus, entités mises en avant",
    ),
});

export type CategoryContent = z.infer<typeof CategoryContentSchema>;

export type GenerationInput = {
  /** Nom et domaine du site, servent de marque dans les balises. */
  brand: string;
  domain: string | null;
  /** Brief éditorial du projet : audience, ton, contraintes. */
  brief: string | null;
  /**
   * Règles métier du site, éditables dans l'outil. Elles priment sur les
   * consignes générales de rédaction : c'est le client qui les écrit et les
   * fait évoluer.
   */
  businessRules: string | null;
  /** b2b ou b2c : change le registre et le vocabulaire autorisé. */
  market: "b2b" | "b2c" | null;
  /** Position dans l'arborescence : mère, sœurs, filles. */
  family: Family | null;
  categoryName: string;
  categoryUrl: string;
  keyword: string;
  /** Mots-clés secondaires validés, à couvrir dans le corps du texte. */
  secondaryKeywords: string[];
  /** Fan queries : questions et requêtes satellites à traiter, notamment en FAQ. */
  fanQueries: string[];
  /** Consignes opérationnelles propres à cette catégorie. */
  categoryBrief: string | null;
  /** Requêtes sur lesquelles l'URL est déjà positionnée, d'après GSC. */
  gscQueries: { query: string; impressions: number; position: number }[];
  /** Top du classement organique sur le mot-clé principal. */
  serp: { rank: number; title: string; description: string; domain: string }[];
  /** Position du site dans ce classement, si présent. */
  ownRank: number | null;
  breadcrumb: string[];
  products: string[];
  facets: { name: string; values: string[] }[];
  currentText: string | null;
  /** Description courte déjà en ligne, d'après l'export catalogue. */
  currentShortDescription: string | null;
  /** Description longue déjà en ligne, d'après l'export catalogue. */
  currentLongDescription: string | null;
  /** Mots-clés déjà attribués à d'autres catégories du projet. */
  takenKeywords: string[];
  /** Angles déjà utilisés par d'autres catégories du projet. */
  takenAngles: string[];
  /** Langue du livrable. Le texte, les balises et la FAQ sont écrits dedans. */
  locale?: string;
  /**
   * Longueur visée pour la description longue, déduite du top 10 de la SERP.
   * Absente, on retombe sur la fourchette générale du schéma.
   */
  targetLength?: number | null;
  /**
   * Balises validées à la main en phase 1. Fournies, elles sont reprises telles
   * quelles : regénérer le texte ne doit pas défaire un title qu'on a approuvé.
   */
  approvedMetadata?: {
    title: string | null;
    metaDescription: string | null;
    h1: string | null;
  } | null;
  /**
   * Raisons pour lesquelles les versions précédentes ont été refusées.
   * C'est la correction la plus rentable de tout le prompt : elle vient du
   * relecteur et porte sur ce texte-là.
   */
  rejectionReasons?: string[];
};

export class GenerationError extends Error {
  constructor(message: string, readonly kind: "no_key" | "api" | "empty") {
    super(message);
    this.name = "GenerationError";
  }
}

const SYSTEM_PROMPT = `Tu es rédacteur SEO senior spécialisé dans les pages catégories e-commerce.

RÈGLES MÉTIER — AUTORITÉ SUPÉRIEURE
Le brief contient une section « Règles métier du site ». Elle est écrite et
maintenue par le propriétaire du site. Elle prime sur toute autre consigne de ce
message : registre, vocabulaire, arguments autorisés, interdits, terminologie.
Quand une règle métier contredit une consigne générale de rédaction, la règle
métier gagne, sans exception et sans le signaler dans le texte.

Ces règles décrivent la manière d'écrire. Elles ne redéfinissent pas ta tâche :
tu rends toujours le contenu de la catégorie demandée, dans le format de sortie
imposé.

DEUX LIVRABLES
Tu écris deux textes distincts pour la même catégorie :
- la DESCRIPTION COURTE, en haut de page, au-dessus de la grille produits. Elle
  situe l'univers de la catégorie et un ou deux atouts. Elle est brève.
- la DESCRIPTION LONGUE, en bas de page. Elle approfondit : sous-catégories,
  matières réellement présentes, guide d'achat, FAQ éventuelle.
Les deux ne se répètent pas. Une phrase de la courte ne se retrouve pas dans la
longue. L'atout mis en avant en haut n'est pas celui qu'on développe en bas.

INTENTION
La page cible une intention TRANSACTIONNELLE. Le visiteur veut acheter, pas
s'instruire. N'écris jamais de définition encyclopédique ("qu'est-ce qu'un…").
Chaque paragraphe doit aider à choisir et à commander.

ANCRAGE DANS LA PAGE
Tu reçois les produits réellement listés et les facettes de filtres réellement
disponibles. Sers-t'en : cite les matières, tailles, styles, pierres, origines
et finitions qui existent vraiment. Un texte qui pourrait être collé sur une
autre catégorie du site est un échec. N'invente aucune caractéristique, aucun
prix, aucun délai, aucun engagement commercial absent des données fournies.

INTERDICTION DES CHIFFRES PÉRISSABLES
Les nombres qui accompagnent les facettes — « 905 références », « 940 en stock »,
« 308 origine Australie » — sont un instantané du catalogue au moment du relevé.
Ils changent chaque semaine. Ne les écris JAMAIS dans le texte : un contenu qui
annonce 940 références en stock devient faux au premier réassort, et un
revendeur qui le constate cesse de te croire sur le reste.

Sers-t'en pour décider quoi mettre en avant — une facette à 300 références mérite
une section, une facette à 3 non — mais formule sans le chiffre : « l'essentiel
du catalogue est en argent rhodié » plutôt que « 905 références en argent
rhodié ». Même règle pour les stocks, les délais et les minimums de commande :
si l'information ne figure pas dans le brief, ne l'affirme pas.

UNICITÉ
On te donne les mots-clés et les angles déjà attribués aux autres catégories du
site. Ton texte ne doit ni les cibler, ni réutiliser leur structure, ni
reprendre leurs tournures. Tu dois retenir un angle éditorial NON UTILISÉ parmi
ceux proposés, et construire tout le plan autour de cet angle.

FAMILLE — LE VRAI RISQUE DE DUPLICATION
La catégorie mère et les catégories sœurs parlent du même univers : c'est avec
elles, pas avec le reste du site, que ton texte risque de devenir
interchangeable. On te donne la famille. Sers-t'en dans ce sens :
- la mère traite le générique ; toi, tu traites ce qui distingue TA catégorie à
  l'intérieur de cet univers — la matière, la pierre, le public, le type de
  bijou qui la définit ;
- les sœurs sont tes concurrentes internes : ne reprends pas l'atout, l'angle ni
  la structure de section qu'elles portent déjà ;
- si tu as des filles, tu les nommes et tu renvoies vers elles ; ce sont elles
  qui traiteront le détail, pas toi.
Le test : retire le nom de la catégorie de ton texte. S'il pourrait être collé
sur une sœur sans que rien ne sonne faux, il est à réécrire.

MOTS-CLÉS
Le mot-clé principal apparaît dans le title, dans le H1, et dans la première
phrase de l'introduction.

Sa FORME EXACTE, mot pour mot et dans le même ordre, doit apparaître entre 4 et
8 fois dans le corps du texte — intertitres compris. « grossiste en bijoux
pierres naturelles » n'est PAS la forme exacte de « grossiste bijoux pierres
naturelles » : un mot inséré casse la correspondance. Les variantes et
synonymes viennent EN PLUS de ce compte, jamais à la place.

Avant de rendre ta réponse, relis-toi et compte réellement les occurrences de la
forme exacte. Si tu en as moins de 4, réécris les passages concernés pour y
placer la formulation exacte là où elle reste naturelle : un intertitre, une
première phrase de section, une question de FAQ.
Les mots-clés secondaires se placent dans les intertitres et le corps du texte,
une à deux fois chacun, sans forcer la formulation.
Les fan queries sont des questions satellites : traite-les en FAQ ou en section
dédiée, en reprenant la formulation de la requête dans l'intertitre.

POSITIONS ACQUISES
Quand des requêtes déjà positionnées te sont fournies, renforce-les : ce sont
des gains rapides. Une requête en position 8 à 20 mérite d'être couverte
explicitement par une section ou une question de FAQ.

CONCURRENCE
Quand le classement organique t'est fourni, lis-le comme un cahier des charges
implicite : ce que traitent les cinq premiers est ce que Google juge pertinent
sur cette requête. Couvre ce socle, puis démarque-toi — apporte au moins un
angle qu'aucun d'eux ne traite. Ne recopie jamais leurs formulations, et ne cite
aucun concurrent nommément.

DIAGNOSTIC D'INTENTION — À FAIRE AVANT D'ÉCRIRE
Commence par juger si une page catégorie marchande a réellement sa place sur ce
mot-clé. Si la SERP est occupée par des guides, des définitions ou des articles
de blog, dis-le franchement en mettant intentMatch à faux et explique pourquoi
dans intentVerdict. Écris quand même le texte — mais un texte lucide, qui prend
l'intention constatée au sérieux plutôt que de plaquer un discours commercial
sur une requête qui n'en veut pas. Un mot-clé mal choisi ne se rattrape pas à la
rédaction, et le taire ne rend service à personne.

LANGUE DE RÉDACTION
La langue du livrable est indiquée en tête du message. Tout ce que tu rends —
title, meta description, H1, descriptions, FAQ, intertitres — est rédigé dans
CETTE langue, dans la variante du pays indiqué, sans un mot des autres. Le
mot-clé principal est déjà dans cette langue : il ne se traduit pas, il se
reprend tel quel. Les champs d'analyse — analysis, differentiationFromFamily —
restent en français : ils sont lus par l'équipe, pas publiés.

STYLE
Langue naturelle, phrases de longueur variable, pas de superlatifs creux ("le
meilleur", "incontournable", "révolutionnaire"), pas de formules d'IA ("plongez
dans l'univers", "que vous soyez…"). Écris comme un professionnel du secteur qui
s'adresse à un acheteur pressé.

CONTRÔLE AVANT DE RENDRE — À FAIRE VRAIMENT
Ces points sont vérifiés mécaniquement après toi, et chacun qui tombe est un
aller-retour de plus. Relis-toi et compte :
1. La forme exacte du mot-clé est-elle dans le title ? dans le H1 ? dans la META
   DESCRIPTION ? Les trois, pas deux sur trois.
2. Le title fait-il entre 45 et 60 caractères ? La meta entre 140 et 158 ? Le H1
   entre 20 et 70 ? Compte les caractères, ne les estime pas.
3. La forme exacte apparaît-elle entre 4 et 8 fois dans le corps ?
4. La description longue est-elle à la longueur visée, à 15 % près ?
Si l'un de ces points ne passe pas, corrige AVANT de rendre ta réponse.`;

function bulletList(items: string[], max: number): string {
  return items.slice(0, max).map((item) => `- ${item}`).join("\n") || "- (aucun)";
}

const MARKET_LABELS: Record<"b2b" | "b2c", string> = {
  b2b: "B2B — le lecteur est un revendeur professionnel qui achète pour sa boutique.",
  b2c: "B2C — le lecteur est le client final, qui achète pour lui ou pour offrir.",
};

/** Rend la famille lisible : mère, sœurs, filles, avec ce que chacune porte déjà. */
function familyBlock(family: Family | null): string {
  if (!family) return "(arborescence non importée pour cette catégorie)";

  const line = (member: FamilyMember) =>
    `- ${member.name}` +
    (member.keyword ? ` — cible « ${member.keyword} »` : " — pas encore de mot-clé") +
    (member.editorialAngle ? `, angle « ${member.editorialAngle} »` : "");

  const parts = [
    family.parent
      ? `Catégorie mère : ${family.parent.name}${
          family.parent.keyword ? ` — cible « ${family.parent.keyword} »` : ""
        }`
      : "Catégorie mère : aucune (catégorie de premier niveau)",
    family.siblings.length > 0
      ? `Catégories sœurs (${family.siblings.length}) :\n${family.siblings
          .slice(0, 25)
          .map(line)
          .join("\n")}`
      : "Catégories sœurs : aucune",
    family.children.length > 0
      ? `Catégories filles (${family.children.length}) :\n${family.children
          .slice(0, 25)
          .map(line)
          .join("\n")}`
      : "Catégories filles : aucune",
  ];

  return parts.join("\n\n");
}

function buildUserPrompt(input: GenerationInput): string {
  // Filet de sécurité : une liste vide laisserait le modèle sans consigne alors
  // que le système lui ordonne d'y choisir un angle. Mieux vaut proposer tous
  // les angles que n'en proposer aucun.
  const remaining = EDITORIAL_ANGLES.filter(
    (angle) => !input.takenAngles.includes(angle),
  );
  const availableAngles = remaining.length > 0 ? remaining : EDITORIAL_ANGLES;

  const facetLines =
    input.facets
      .map((facet) => `- ${facet.name} : ${facet.values.slice(0, 15).join(", ")}`)
      .join("\n") || "- (aucune facette relevée)";

  const langue = localeInfo(input.locale ?? DEFAULT_LOCALE);

  return `# Langue de rédaction — impérative
${langue.label} (${langue.code}), marché ${langue.country}.
Tout le livrable publié est écrit dans cette langue.

${
    input.targetLength
      ? `# Longueur visée pour la description longue
${input.targetLength} caractères, à ±15 %. Ce n'est pas un chiffre arbitraire :
c'est la médiane des textes réellement classés dans le top 10 de Google sur ce
mot-clé, dans cette langue. Écrire beaucoup plus court laisse le sujet à
découvert ; beaucoup plus long ajoute du remplissage que personne ne lit.

`
      : ""
  }${
    input.approvedMetadata &&
    (input.approvedMetadata.title ||
      input.approvedMetadata.metaDescription ||
      input.approvedMetadata.h1)
      ? `# Balises déjà validées — à reprendre À L'IDENTIQUE
Elles ont été relues et approuvées. Recopie-les mot pour mot dans ta réponse,
sans les réécrire ni les « améliorer », et compose le texte pour qu'il les
tienne.
${input.approvedMetadata.title ? `- title : ${input.approvedMetadata.title}` : ""}
${
          input.approvedMetadata.metaDescription
            ? `- meta description : ${input.approvedMetadata.metaDescription}`
            : ""
        }
${input.approvedMetadata.h1 ? `- H1 : ${input.approvedMetadata.h1}` : ""}

`
      : ""
  }${
    input.rejectionReasons && input.rejectionReasons.length > 0
      ? `# Pourquoi les versions précédentes ont été REFUSÉES
Ce sont les remarques du relecteur sur cette catégorie précisément. Elles
passent avant toute autre consigne de style : reproduire le même défaut est le
seul échec certain de cette rédaction.
${input.rejectionReasons.slice(0, 5).map((reason) => `- ${reason}`).join("\n")}

`
      : ""
  }# Site
Marque : ${input.brand}${input.domain ? ` (${input.domain})` : ""}
Marché : ${input.market ? MARKET_LABELS[input.market] : "non précisé"}
${input.brief ? `Brief éditorial : ${input.brief}` : "Brief éditorial : non renseigné."}

# Règles métier du site — autorité supérieure
${
    input.businessRules?.trim()
      ? `${input.businessRules.trim()}

Fin des règles métier. Applique-les intégralement : elles priment sur les
consignes générales de rédaction, y compris sur le style et le vocabulaire.`
      : "(aucune règle métier enregistrée pour ce projet)"
  }

# Catégorie à rédiger
Nom : ${input.categoryName}
URL : ${input.categoryUrl}
Mot-clé principal : ${input.keyword}
Mots-clés secondaires : ${input.secondaryKeywords.join(" | ") || "(aucun)"}
Fan queries à traiter : ${input.fanQueries.join(" | ") || "(aucune)"}
Fil d'ariane : ${input.breadcrumb.join(" > ") || "(non relevé)"}

# Famille de cette catégorie — à ne pas dupliquer
${familyBlock(input.family)}

# Descriptions actuellement en ligne sur cette catégorie
Courte (haut de page) : ${input.currentShortDescription?.slice(0, 900) || "(vide)"}
Longue (bas de page) : ${input.currentLongDescription?.slice(0, 1500) || "(vide)"}

# Consignes opérationnelles pour CETTE catégorie
${input.categoryBrief || "(aucune consigne particulière)"}

# Requêtes sur lesquelles cette URL est déjà positionnée (Search Console)
${
    input.gscQueries.length > 0
      ? input.gscQueries
          .slice(0, 25)
          .map(
            (row) =>
              `- ${row.query} — ${row.impressions} impressions, position ${row.position.toFixed(1)}`,
          )
          .join("\n")
      : "- (aucune donnée importée)"
  }

${
    input.products.length === 0 && input.facets.length === 0
      ? `# ⚠ LA PAGE N'A PAS PU ÊTRE RELEVÉE
Ni les produits ni les facettes de filtres ne sont disponibles pour cette
catégorie. Tu écris donc sans savoir ce que le catalogue contient réellement.

Conséquence sur ta rédaction : ne nomme aucune matière, pierre, taille,
finition, référence ou gamme de prix comme si elle était présente au catalogue.
Reste au niveau du métier et de la mécanique d'achat, qui ne dépendent pas de
l'assortiment. Et dans \`missingEntities\`, ne liste que ce que tu as vu chez les
concurrents dans la SERP, en aucun cas des entités supposées du catalogue.

`
      : ""
  }# Produits réellement présents dans cette catégorie
${bulletList(input.products, 40)}

# Facettes de filtres disponibles sur la page
${facetLines}

# Texte actuellement en ligne
${input.currentText ? input.currentText.slice(0, 2500) : "(aucun texte en place)"}

# Classement organique actuel sur « ${input.keyword} »
${
    input.serp.length > 0
      ? input.serp
          .slice(0, 5)
          .map(
            (row) =>
              `${row.rank}. [${row.domain}] ${row.title}\n   ${row.description.slice(0, 220)}`,
          )
          .join("\n")
      : "(non relevé)"
  }
${
    input.ownRank
      ? `Le site est actuellement en position ${input.ownRank} sur cette requête.`
      : input.serp.length > 0
        ? "Le site n'apparaît pas dans ce classement."
        : ""
  }

# Déjà pris par d'autres catégories du site — à ne PAS cibler ni imiter
Mots-clés : ${input.takenKeywords.slice(0, 80).join(" | ") || "(aucun)"}
Angles déjà utilisés dans la famille : ${input.takenAngles.join(" | ") || "(aucun)"}

# Angle éditorial à retenir
Choisis-en exactement un dans cette liste et construis tout le plan autour :
${availableAngles.map((angle) => `- ${angle}`).join("\n")}

Rédige maintenant les deux descriptions de cette catégorie : la courte du haut
de page, puis la longue du bas de page. Avant de rendre ta réponse, relis-toi
contre les règles métier ci-dessus, point par point.`;
}

export async function generateCategoryContent(
  input: GenerationInput,
): Promise<CategoryContent> {
  const apiKey = anthropicApiKey();
  if (!apiKey) throw new GenerationError(MISSING_KEY_MESSAGE, "no_key");

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.parse({
      model: GENERATION_MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: zodOutputFormat(CategoryContentSchema),
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(input) }],
    });

    if (response.stop_reason === "refusal") {
      throw new GenerationError(
        `Génération refusée par le modèle${
          response.stop_details ? ` (${response.stop_details.category})` : ""
        }.`,
        "api",
      );
    }

    if (!response.parsed_output) {
      throw new GenerationError(
        "Le modèle n'a pas renvoyé de contenu exploitable.",
        "empty",
      );
    }

    return response.parsed_output;
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    if (error instanceof Anthropic.AuthenticationError) {
      throw new GenerationError("Clé API Anthropic invalide.", "no_key");
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new GenerationError(
        "Limite de débit atteinte sur l'API Anthropic. Réessaie dans un instant.",
        "api",
      );
    }
    if (error instanceof Anthropic.APIError) {
      throw new GenerationError(
        `Erreur API Anthropic (${error.status}) : ${error.message}`,
        "api",
      );
    }
    throw new GenerationError((error as Error).message, "api");
  }
}


/* ------------------------------------------ vérification de la clé ------- */

export type KeyCheck =
  | { ok: true; nomUtilise: string; modeleDisponible: boolean }
  | { ok: false; raison: string };

/**
 * Vérifie que la clé Anthropic est acceptée, sans rien facturer.
 *
 * Lister les modèles suffit : l'appel est authentifié, il ne consomme pas de
 * jetons, et il distingue les trois pannes qu'on confond sinon — clé absente,
 * clé refusée, clé valable mais sans accès au modèle qu'on utilise. Une clé
 * créée au niveau d'une organisation plutôt que d'un espace de travail tombe
 * ici, avant d'avoir lancé une rédaction pour rien.
 */
export async function checkAnthropicKey(): Promise<KeyCheck> {
  const apiKey = anthropicApiKey();
  if (!apiKey) return { ok: false, raison: MISSING_KEY_MESSAGE };

  const nomUtilise =
    API_KEY_NAMES.find((name) => process.env[name]?.trim()) ?? "inconnu";

  try {
    const models = await new Anthropic({ apiKey }).models.list({ limit: 100 });
    return {
      ok: true,
      nomUtilise,
      modeleDisponible: models.data.some((model) => model.id === GENERATION_MODEL),
    };
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return {
        ok: false,
        raison: `Clé refusée (${error.status}) : ${error.message}`,
      };
    }
    return { ok: false, raison: (error as Error).message };
  }
}

/* ------------------------------------------ passe de correction ---------- */

const REPAIR_SYSTEM = `Tu corriges un texte de page catégorie déjà rédigé, sur des
points précis et mesurés. Ce n'est pas une réécriture.

CE QU'ON ATTEND DE TOI
- Tu reçois le texte complet et la liste des écarts constatés, chacun avec sa
  consigne. Tu corriges CES écarts, et seulement eux.
- Tout le reste — l'angle éditorial, le plan, les arguments, le ton, les entités
  citées — reste identique. Un paragraphe qui n'est visé par aucune consigne
  revient mot pour mot dans ta réponse.
- Tu rends l'objet complet, y compris les parties inchangées.

CE QU'IL NE FAUT SURTOUT PAS FAIRE
- Ne compense pas un raccourcissement en supprimant une section entière : retire
  les redites et les passages qui n'aident pas à choisir, garde ce qui informe.
- Ne perds pas le mot-clé en réécrivant. C'est l'erreur la plus fréquente d'une
  passe de correction, et elle annule le bénéfice de la correction.
- N'ajoute aucune caractéristique, prix, délai ou engagement qui n'était pas
  déjà dans le texte d'origine.

Après ta correction, recompte : longueurs en caractères, occurrences de la forme
exacte. Les consignes donnent des nombres, ils sont à respecter.`;

/**
 * Corrige une version sur les écarts mesurés.
 *
 * Elle existe parce que la question du client est juste : pourquoi livrer un
 * texte dont on sait déjà qu'il a un contrôle au rouge ? Le barème est
 * déterministe, donc les écarts sont connus à la seconde où le texte est rendu.
 * Les faire corriger coûte un appel de plus ; les laisser coûte une relecture
 * humaine sur cent quatre-vingts pages.
 *
 * Elle ne juge pas le fond. Un texte creux repassera vert sans être meilleur —
 * c'est le refus motivé qui sert à ça, pas cette fonction.
 */
export async function repairCategoryContent(args: {
  content: CategoryContent;
  keyword: string;
  locale: string;
  defects: string;
  targetLength: number | null;
  businessRules: string | null;
}): Promise<CategoryContent> {
  const apiKey = anthropicApiKey();
  if (!apiKey) throw new GenerationError(MISSING_KEY_MESSAGE, "no_key");

  const langue = localeInfo(args.locale);
  const client = new Anthropic({ apiKey });

  const prompt = `# Langue
${langue.label} (${langue.code}). Le texte corrigé reste dans cette langue.

# Mot-clé principal
${args.keyword}

Sa FORME EXACTE, mot pour mot et dans le même ordre, est ce qui est vérifié.
« grossiste en bijoux » n'est pas la forme exacte de « grossiste bijoux » : un
mot inséré casse la correspondance.

${args.targetLength ? `# Longueur visée pour la description longue\n${args.targetLength} caractères, à ±15 %.\n` : ""}
# Règles métier du site — toujours applicables
${args.businessRules?.trim()?.slice(0, 6000) || "(aucune)"}

# Écarts constatés, à corriger
${args.defects}

# Texte actuel, à corriger sans le réécrire
${JSON.stringify(args.content, null, 2)}

Rends l'objet complet corrigé.`;

  try {
    const response = await client.messages.parse({
      model: GENERATION_MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: zodOutputFormat(CategoryContentSchema),
      },
      system: REPAIR_SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });

    if (!response.parsed_output) {
      throw new GenerationError("La passe de correction n'a rien renvoyé.", "empty");
    }
    return response.parsed_output;
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    if (error instanceof Anthropic.APIError) {
      throw new GenerationError(
        `Erreur API Anthropic (${error.status}) : ${error.message}`,
        "api",
      );
    }
    throw new GenerationError((error as Error).message, "api");
  }
}

/* -------------------------------- proposition du mot-clé PRINCIPAL ------- */

export const KeywordCandidatesSchema = z.object({
  candidates: z
    .array(
      z.object({
        keyword: z
          .string()
          .describe(
            "Le mot-clé, formulé exactement comme un acheteur le taperait, " +
              "dans la langue demandée, sans majuscule ni ponctuation",
          ),
        why: z.string().describe("Une phrase : sur quoi de la page il s'appuie"),
        source: z
          .string()
          .describe(
            "D'où il vient : « Search Console » si la page reçoit déjà des " +
              "impressions dessus, « catalogue » s'il vient des produits ou des " +
              "facettes, « déduit » sinon",
          ),
        reservation: z
          .string()
          .describe(
            "Le risque de chevauchement avec une autre catégorie du site, en " +
              "une phrase, ou « aucun »",
          ),
        marketIntent: z
          .string()
          .describe(
            "Qui tape cette requête, par rapport au marché du site. Exactement " +
              "l'une de ces trois valeurs : « marché » si c'est le public visé " +
              "par le site — un revendeur professionnel pour un site B2B, un " +
              "client final pour un site B2C ; « hors marché » si c'est l'autre " +
              "public ; « ambigu » si les deux la tapent",
          ),
      }),
    )
    .describe(
      "6 à 10 candidats au mot-clé PRINCIPAL, du plus évident au plus " +
        "spéculatif. Ce sont des candidats, pas un classement final : les volumes " +
        "seront mesurés ensuite",
    ),
});

export type KeywordCandidates = z.infer<typeof KeywordCandidatesSchema>;

export type CandidateInput = {
  brand: string;
  brief: string | null;
  businessRules: string | null;
  market: "b2b" | "b2c" | null;
  locale: string;
  categoryName: string;
  categoryUrl: string;
  family: Family | null;
  products: string[];
  facets: { name: string; values: string[] }[];
  gscQueries: { query: string; impressions: number; position: number }[];
  currentKeyword: string | null;
  /** Mots-clés attribués aux autres pages : interdits, sans exception. */
  takenKeywords: string[];
};

const CANDIDATE_SYSTEM = `Tu es consultant SEO e-commerce. Tu proposes des
candidats au mot-clé PRINCIPAL d'une page catégorie — celui qui cadrera le
title, le H1 et tout le texte.

CE QUI COMPTE, DANS CET ORDRE
1. La demande constatée. Si Search Console montre que la page reçoit déjà des
   impressions sur une requête, cette requête est un candidat de premier rang :
   c'est de la demande mesurée, pas supposée. Une requête en position 11 à 20 est
   le meilleur candidat de tous — la page est déjà jugée pertinente, il ne manque
   qu'un texte.
2. Ce que la page contient vraiment. Un mot-clé qui promet une matière, une
   pierre ou une déclinaison absente du catalogue fera fuir le visiteur et
   n'améliorera rien.
3. La place de la catégorie dans l'arborescence. Une catégorie mère cible le
   terme générique, une fille cible sa spécialité. Une fille qui viserait le
   terme de sa mère se placerait contre elle.

INTERDITS
- Aucun mot-clé déjà attribué à une autre page du site. Pas même une variante
  proche : deux pages sur la même requête se cannibalisent, et c'est l'erreur la
  plus coûteuse de tout le travail.
- Aucun mot-clé dans une autre langue que celle demandée. Un mot-clé ne se
  traduit pas : « bijou ambre » et son équivalent allemand sont deux cibles
  différentes, avec des volumes différents.
- Aucune requête informationnelle (« qu'est-ce que », « comment fabriquer ») :
  la page est marchande.

LE PUBLIC QUI TAPE LA REQUÊTE — CHAMP marketIntent
C'est l'arbitrage le plus lourd de conséquences, et le volume seul y répond mal.
Sur un site B2B, « collier ambre » a du volume mais est tapé par des
particuliers : se positionner dessus attire des visiteurs qui n'achèteront
jamais en gros, et si le même groupe exploite un site grand public, les deux
pages se disputent la même requête. « grossiste bijoux ambre » a beaucoup moins
de volume, parfois zéro mesuré, mais chaque visiteur est un acheteur possible.
Un volume nul sur une requête du bon public n'est pas rédhibitoire : les outils
mesurent mal les requêtes professionnelles rares, et une page bien placée sur
une requête à trente recherches vaut mieux qu'une page invisible sur une requête
à trois mille.

Classe donc honnêtement chaque candidat, sans te laisser influencer par le
volume que tu supposes : tu dis QUI tape la requête, pas combien ils sont.

Tu proposes, tu ne tranches pas. Les volumes de recherche sont mesurés après
toi, et c'est eux qui départageront, pondérés par ce que tu auras dit du public.
Propose donc large : un candidat évident mais saturé et un candidat plus précis
mais accessible ont tous les deux leur place dans ta liste.`;

/**
 * Propose des candidats au mot-clé principal.
 *
 * Le modèle ne connaît pas les volumes de recherche, et il ne doit pas les
 * inventer : son travail ici est de produire des formulations plausibles et
 * ancrées dans la page. La mesure vient ensuite, et c'est elle qui classe.
 */
export async function proposeKeywordCandidates(
  input: CandidateInput,
): Promise<KeywordCandidates> {
  const apiKey = anthropicApiKey();
  if (!apiKey) throw new GenerationError(MISSING_KEY_MESSAGE, "no_key");

  const langue = localeInfo(input.locale);
  const client = new Anthropic({ apiKey });

  const prompt = `# Langue des mots-clés — impérative
${langue.label} (${langue.code}), marché ${langue.country}. Tous les candidats
sont formulés dans cette langue, telle que la tape un acheteur de ce pays.

# Site
${input.brand}
Marché : ${input.market ? MARKET_LABELS[input.market] : "non précisé"}
${input.brief ? `Brief : ${input.brief}` : ""}

# Règles métier du site
${input.businessRules?.trim()?.slice(0, 4000) || "(aucune)"}

# Catégorie
Nom : ${input.categoryName}
URL : ${input.categoryUrl}
Mot-clé actuellement retenu : ${input.currentKeyword || "(aucun)"}

# Place dans l'arborescence
${familyBlock(input.family)}

# Requêtes déjà remontées par Search Console sur cette URL
${
    input.gscQueries.length > 0
      ? input.gscQueries
          .slice(0, 40)
          .map(
            (row) =>
              `- ${row.query} — ${row.impressions} impressions, position ${row.position.toFixed(1)}` +
              (row.position >= 11 && row.position <= 20 ? " ← gain rapide" : ""),
          )
          .join("\n")
      : "- (aucune donnée importée : tu proposes donc sans demande constatée, dis-le dans `source`)"
  }

# Produits réellement présents
${bulletList(input.products, 40)}

# Facettes de filtres disponibles
${
    input.facets
      .map((facet) => `- ${facet.name} : ${facet.values.slice(0, 15).join(", ")}`)
      .join("\n") || "- (aucune facette relevée)"
  }

# Déjà attribués à d'autres pages du site — interdits
${input.takenKeywords.slice(0, 120).join(" | ") || "(aucun)"}

Propose les candidats au mot-clé principal de cette catégorie.`;

  try {
    const response = await client.messages.parse({
      model: GENERATION_MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: zodOutputFormat(KeywordCandidatesSchema),
      },
      system: CANDIDATE_SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });

    if (!response.parsed_output) {
      throw new GenerationError("Aucun candidat exploitable renvoyé.", "empty");
    }
    return response.parsed_output;
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    if (error instanceof Anthropic.APIError) {
      throw new GenerationError(
        `Erreur API Anthropic (${error.status}) : ${error.message}`,
        "api",
      );
    }
    throw new GenerationError((error as Error).message, "api");
  }
}

/* ------------------------------- phase 1 : balises et segment d'URL ------ */

export const MetadataSchema = z.object({
  title: z.string().describe("Balise title, 50 à 60 caractères, mot-clé en tête"),
  metaDescription: z
    .string()
    .describe("Meta description, 140 à 158 caractères espaces compris, jamais plus de 158"),
  h1: z
    .string()
    .describe("H1, 40 à 65 caractères espaces compris, contient le mot-clé principal"),
  linkRewrite: z
    .string()
    .describe(
      "Segment d'URL PrestaShop : minuscules, sans accent, mots séparés par des " +
        "tirets, 3 à 5 mots, contient le mot-clé principal. Pas de mot vide " +
        "inutile, pas de chiffre, pas de barre oblique",
    ),
  rationale: z
    .string()
    .describe("En français, deux phrases : ce qui a décidé la formulation retenue"),
});

export type Metadata = z.infer<typeof MetadataSchema>;

export type MetadataInput = {
  brand: string;
  domain: string | null;
  brief: string | null;
  businessRules: string | null;
  market: "b2b" | "b2c" | null;
  locale: string;
  categoryName: string;
  categoryUrl: string;
  currentLinkRewrite: string | null;
  keyword: string;
  family: Family | null;
  serp: { rank: number; title: string; description: string; domain: string }[];
  gscQueries: { query: string; impressions: number; position: number }[];
  currentTitle: string | null;
  currentMetaDescription: string | null;
  currentH1: string | null;
  /** Balises des autres pages : c'est là que la duplication se voit le plus vite. */
  takenTitles: string[];
};

const METADATA_SYSTEM = `Tu écris les balises d'une page catégorie e-commerce et
son segment d'URL. Rien d'autre : pas de description, pas de texte de page.

POURQUOI CETTE ÉTAPE EST SÉPARÉE
Les balises et l'URL se décident avant le texte, et se relisent en quelques
secondes sur cent quatre-vingts catégories. Les valider d'abord évite de
découvrir un mauvais cadrage après avoir fait rédiger sept mille caractères
dessus. Une fois approuvées, elles ne bougent plus : le texte est écrit pour
elles.

RÈGLES
- Le mot-clé principal ouvre le title, et figure dans le H1.
- Le title est unique sur tout le site. On te donne ceux des autres catégories :
  ni le même, ni une simple permutation.
- La meta description ne dépasse jamais 158 caractères. Elle donne une raison de
  cliquer — un bénéfice concret, pas un slogan.
- Le H1 se lit comme un nom de rayon, pas comme un titre d'article.
- Le segment d'URL est court et stable : il décrit la catégorie, pas une
  promotion ni une saison. Un segment qu'il faudra changer dans six mois est un
  mauvais segment, parce que le changer coûte une redirection.
- Aucun superlatif creux, aucune promesse chiffrée, aucune formule d'IA.

Si le classement organique t'est fourni, lis les titles des premiers comme la
formulation que Google juge pertinente — puis démarque-toi d'eux.`;

/**
 * Première phase : les balises et le segment d'URL, sans le texte.
 *
 * C'est ce que le client a demandé — travailler les mots-clés, les balises et
 * les liens d'abord, les descriptions ensuite. La raison est économique autant
 * que méthodologique : cette étape coûte une fraction de la rédaction complète,
 * et elle peut donc être relancée autant de fois qu'il faut pour obtenir un
 * cadrage juste avant d'engager le texte.
 */
export async function generateMetadata(input: MetadataInput): Promise<Metadata> {
  const apiKey = anthropicApiKey();
  if (!apiKey) throw new GenerationError(MISSING_KEY_MESSAGE, "no_key");

  const langue = localeInfo(input.locale);
  const client = new Anthropic({ apiKey });

  const prompt = `# Langue de rédaction — impérative
${langue.label} (${langue.code}), marché ${langue.country}. Le title, la meta
description, le H1 et le segment d'URL sont dans cette langue. Le champ
\`rationale\` reste en français.

# Site
Marque : ${input.brand}${input.domain ? ` (${input.domain})` : ""}
Marché : ${input.market ? MARKET_LABELS[input.market] : "non précisé"}
${input.brief ? `Brief : ${input.brief}` : ""}

# Règles métier du site — autorité supérieure
${input.businessRules?.trim()?.slice(0, 6000) || "(aucune)"}

# Catégorie
Nom : ${input.categoryName}
URL actuelle : ${input.categoryUrl}
Segment d'URL actuel : ${input.currentLinkRewrite || "(inconnu)"}
Mot-clé principal : ${input.keyword}

# Place dans l'arborescence
${familyBlock(input.family)}

# Balises actuellement en ligne
title : ${input.currentTitle || "(vide)"}
meta description : ${input.currentMetaDescription || "(vide)"}
H1 : ${input.currentH1 || "(vide)"}

# Requêtes déjà positionnées sur cette URL
${
    input.gscQueries.length > 0
      ? input.gscQueries
          .slice(0, 15)
          .map((row) => `- ${row.query} (pos. ${row.position.toFixed(1)})`)
          .join("\n")
      : "- (aucune donnée)"
  }

# Classement organique sur « ${input.keyword} »
${
    input.serp.length > 0
      ? input.serp
          .slice(0, 5)
          .map((row) => `${row.rank}. [${row.domain}] ${row.title}`)
          .join("\n")
      : "(non relevé)"
  }

# Titles déjà utilisés sur le site — à ne pas répéter
${input.takenTitles.slice(0, 60).map((title) => `- ${title}`).join("\n") || "- (aucun)"}

Écris les balises et le segment d'URL de cette catégorie.`;

  try {
    const response = await client.messages.parse({
      model: GENERATION_MODEL,
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: zodOutputFormat(MetadataSchema),
      },
      system: METADATA_SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });

    if (!response.parsed_output) {
      throw new GenerationError("Le modèle n'a pas renvoyé de balises.", "empty");
    }
    return response.parsed_output;
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    if (error instanceof Anthropic.APIError) {
      throw new GenerationError(
        `Erreur API Anthropic (${error.status}) : ${error.message}`,
        "api",
      );
    }
    throw new GenerationError((error as Error).message, "api");
  }
}

/* ------------------------------------------------ suggestion de mots-clés */

export const KeywordSuggestionSchema = z.object({
  secondaryKeywords: z
    .array(
      z.object({
        keyword: z.string().describe("Mot-clé secondaire, formulé comme une vraie requête"),
        why: z.string().describe("Une phrase : sur quoi de la page il s'appuie"),
      }),
    )
    .describe("6 à 10 mots-clés secondaires"),
  fanQueries: z
    .array(
      z.object({
        query: z.string().describe("Question ou requête satellite, formulée comme la tape un acheteur"),
        why: z.string().describe("Une phrase : pourquoi elle relève de cette catégorie"),
      }),
    )
    .describe("4 à 8 fan queries"),
});

export type KeywordSuggestion = z.infer<typeof KeywordSuggestionSchema>;

export type SuggestionInput = {
  brand: string;
  brief: string | null;
  categoryName: string;
  keyword: string;
  products: string[];
  facets: { name: string; values: string[] }[];
  gscQueries: { query: string; impressions: number; position: number }[];
  /** Mots-clés déjà attribués ailleurs : interdits de proposition. */
  takenKeywords: string[];
};

const SUGGESTION_SYSTEM = `Tu es consultant SEO e-commerce. Tu proposes le champ
sémantique d'une page catégorie à intention transactionnelle.

RÈGLES
- Les mots-clés secondaires se déduisent de ce que la page contient réellement :
  matières, pierres, styles, destinataires, conditionnements présents dans les
  produits et les facettes de filtres fournis. N'invente pas une déclinaison qui
  n'existe pas au catalogue.
- Les fan queries sont des questions que tape un acheteur professionnel avant de
  commander : minimums, tarifs dégressifs, provenance, certificats, délais,
  retours. Formule-les comme il les taperait, pas comme un rédacteur.
- Ne propose jamais un mot-clé déjà attribué à une autre catégorie du site, ni
  une simple reformulation du mot-clé principal.
- Si des requêtes Search Console sont fournies, privilégie ce qui s'en approche :
  c'est de la demande constatée, pas supposée.`;

export async function suggestKeywords(
  input: SuggestionInput,
): Promise<KeywordSuggestion> {
  const apiKey = anthropicApiKey();
  if (!apiKey) throw new GenerationError(MISSING_KEY_MESSAGE, "no_key");

  const client = new Anthropic({ apiKey });

  const prompt = `# Site
${input.brand}
${input.brief ? `Brief : ${input.brief}` : ""}

# Catégorie
Nom : ${input.categoryName}
Mot-clé principal : ${input.keyword}

# Produits réellement présents
${bulletList(input.products, 40)}

# Facettes de filtres disponibles
${
    input.facets
      .map((f) => `- ${f.name} : ${f.values.slice(0, 15).join(", ")}`)
      .join("\n") || "- (aucune facette relevée)"
  }

# Requêtes Search Console de cette URL
${
    input.gscQueries.length > 0
      ? input.gscQueries
          .slice(0, 25)
          .map((r) => `- ${r.query} (${r.impressions} impr., pos. ${r.position.toFixed(1)})`)
          .join("\n")
      : "- (aucune donnée)"
  }

# Déjà attribués ailleurs — interdits
${input.takenKeywords.slice(0, 80).join(" | ") || "(aucun)"}

Propose le champ sémantique de cette catégorie.`;

  try {
    const response = await client.messages.parse({
      model: GENERATION_MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: zodOutputFormat(KeywordSuggestionSchema),
      },
      system: SUGGESTION_SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });

    if (!response.parsed_output) {
      throw new GenerationError("Aucune suggestion exploitable renvoyée.", "empty");
    }
    return response.parsed_output;
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    if (error instanceof Anthropic.APIError) {
      throw new GenerationError(
        `Erreur API Anthropic (${error.status}) : ${error.message}`,
        "api",
      );
    }
    throw new GenerationError((error as Error).message, "api");
  }
}
