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
        "Google tronque au-delà",
    ),
  h1: z
    .string()
    .describe(
      "H1 de la page, 40 à 65 caractères espaces compris — jamais plus de 65, " +
        "contient le mot-clé principal",
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
      "3 à 5 sections de la description LONGUE. Corps visé entre 4 000 et 7 000 " +
        "caractères : assez pour couvrir le sujet, pas au point de noyer la page",
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

STYLE
Français naturel, phrases de longueur variable, pas de superlatifs creux ("le
meilleur", "incontournable", "révolutionnaire"), pas de formules d'IA ("plongez
dans l'univers", "que vous soyez…"). Écris comme un professionnel du secteur qui
s'adresse à un acheteur pressé.`;

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

  return `# Site
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
