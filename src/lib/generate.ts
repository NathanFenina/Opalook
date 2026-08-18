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

export const GENERATION_MODEL = "claude-opus-5";

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

export const CategoryContentSchema = z.object({
  title: z.string().describe("Balise title, 50 à 60 caractères, mot-clé en tête"),
  metaDescription: z.string().describe("Meta description, 140 à 160 caractères"),
  h1: z.string().describe("H1 de la page, contient le mot-clé principal"),
  intro: z
    .string()
    .describe("Paragraphe d'introduction sous le H1, mot-clé dans la première phrase"),
  sections: z.array(SectionSchema).describe("3 à 5 sections de contenu"),
  faq: z.array(FaqItemSchema).describe("2 à 4 questions fréquentes à intention transactionnelle"),
  editorialAngle: z.string().describe("L'angle éditorial retenu, repris de la liste imposée"),
  keywordVariants: z
    .array(z.string())
    .describe("Variantes et requêtes longue traîne réellement employées dans le texte"),
});

export type CategoryContent = z.infer<typeof CategoryContentSchema>;

export type GenerationInput = {
  /** Nom et domaine du site, servent de marque dans les balises. */
  brand: string;
  domain: string | null;
  /** Brief éditorial du projet : audience, ton, contraintes. */
  brief: string | null;
  categoryName: string;
  categoryUrl: string;
  keyword: string;
  breadcrumb: string[];
  products: string[];
  facets: { name: string; values: string[] }[];
  currentText: string | null;
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

INTENTION
La page cible une intention TRANSACTIONNELLE. Le visiteur veut acheter, pas
s'instruire. N'écris jamais de définition encyclopédique ("qu'est-ce qu'un…").
Chaque paragraphe doit aider à choisir et à commander.

ANCRAGE DANS LA PAGE
Tu reçois les produits réellement listés et les facettes de filtres réellement
disponibles. Sers-t'en : cite les matières, tailles, styles, gammes de prix qui
existent vraiment. Un texte qui pourrait être collé sur une autre catégorie du
site est un échec. N'invente aucune caractéristique, aucun prix, aucun délai,
aucun chiffre qui ne figure pas dans les données fournies.

UNICITÉ
On te donne les mots-clés et les angles déjà attribués aux autres catégories du
site. Ton texte ne doit ni les cibler, ni réutiliser leur structure, ni
reprendre leurs tournures. Tu dois retenir un angle éditorial NON UTILISÉ parmi
ceux proposés, et construire tout le plan autour de cet angle.

MOT-CLÉ
Le mot-clé principal apparaît dans le title, dans le H1, et dans la première
phrase de l'introduction. Ensuite, varie : synonymes et longue traîne. Vise 3 à
8 occurrences de la forme exacte sur l'ensemble du texte, jamais davantage.

STYLE
Français naturel, phrases de longueur variable, pas de superlatifs creux ("le
meilleur", "incontournable", "révolutionnaire"), pas de formules d'IA ("plongez
dans l'univers", "que vous soyez…"). Écris comme un professionnel du secteur qui
s'adresse à un acheteur pressé.`;

function bulletList(items: string[], max: number): string {
  return items.slice(0, max).map((item) => `- ${item}`).join("\n") || "- (aucun)";
}

function buildUserPrompt(input: GenerationInput): string {
  const availableAngles = EDITORIAL_ANGLES.filter(
    (angle) => !input.takenAngles.includes(angle),
  );

  const facetLines =
    input.facets
      .map((facet) => `- ${facet.name} : ${facet.values.slice(0, 15).join(", ")}`)
      .join("\n") || "- (aucune facette relevée)";

  return `# Site
Marque : ${input.brand}${input.domain ? ` (${input.domain})` : ""}
${input.brief ? `Brief éditorial : ${input.brief}` : "Brief éditorial : non renseigné."}

# Catégorie à rédiger
Nom : ${input.categoryName}
URL : ${input.categoryUrl}
Mot-clé principal : ${input.keyword}
Fil d'ariane : ${input.breadcrumb.join(" > ") || "(non relevé)"}

# Produits réellement présents dans cette catégorie
${bulletList(input.products, 40)}

# Facettes de filtres disponibles sur la page
${facetLines}

# Texte actuellement en ligne
${input.currentText ? input.currentText.slice(0, 2500) : "(aucun texte en place)"}

# Déjà pris par d'autres catégories du site — à ne PAS cibler ni imiter
Mots-clés : ${input.takenKeywords.slice(0, 60).join(" | ") || "(aucun)"}
Angles déjà utilisés : ${input.takenAngles.join(" | ") || "(aucun)"}

# Angle éditorial à retenir
Choisis-en exactement un dans cette liste et construis tout le plan autour :
${availableAngles.map((angle) => `- ${angle}`).join("\n")}

Rédige maintenant le contenu de la catégorie.`;
}

export async function generateCategoryContent(
  input: GenerationInput,
): Promise<CategoryContent> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new GenerationError(
      "ANTHROPIC_API_KEY absente. Ajoute-la dans les variables d'environnement Vercel (Production et Preview), puis redéploie.",
      "no_key",
    );
  }

  const client = new Anthropic();

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
