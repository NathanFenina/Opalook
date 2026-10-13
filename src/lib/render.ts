/**
 * Rendu du contenu généré en HTML collable dans le champ « description » de
 * PrestaShop. Volontairement pauvre en balises : PrestaShop nettoie l'HTML
 * exotique, et le thème gère déjà la typographie.
 *
 * Tout ce qui sort d'ici est publié. Rien n'y est donc écrit en dur dans une
 * langue : un seul mot oublié — « Questions fréquentes » en tête de la FAQ
 * turque — et la page entière perd sa crédibilité.
 */

import type { CategoryContent } from "@/lib/generate";

/**
 * Intertitre de la FAQ, à défaut de celui rendu par le modèle.
 *
 * Les versions écrites avant que le champ existe n'en ont pas. Ce repli couvre
 * les langues du catalogue, et retombe sur le français pour une langue qu'on
 * n'a pas prévue — un intertitre dans la mauvaise langue reste préférable à un
 * titre vide au-dessus d'une liste de questions.
 */
const FAQ_HEADINGS: Record<string, string> = {
  fr: "Questions fréquentes",
  en: "Frequently asked questions",
  de: "Häufige Fragen",
  es: "Preguntas frecuentes",
  it: "Domande frequenti",
  nl: "Veelgestelde vragen",
  pt: "Perguntas frequentes",
  ro: "Întrebări frecvente",
  tr: "Sıkça sorulan sorular",
  ko: "자주 묻는 질문",
};

/** L'intertitre de la FAQ : celui du modèle d'abord, le repli ensuite. */
function faqHeading(content: CategoryContent, locale?: string): string {
  const rendu = (content as { faqHeading?: string }).faqHeading?.trim();
  if (rendu) return rendu;
  return FAQ_HEADINGS[locale ?? "fr"] ?? FAQ_HEADINGS.fr;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * HTML prêt à coller dans le champ « description » de PrestaShop.
 *
 * Le H1 en est volontairement exclu : PrestaShop en génère déjà un à partir du
 * nom de la catégorie. L'inclure ici produirait deux H1 sur la même page. Le H1
 * proposé se reporte donc sur le nom de la catégorie, pas dans ce bloc.
 */
export function renderCategoryHtml(
  content: CategoryContent,
  options: { includeH1?: boolean; locale?: string } = {},
): string {
  const parts: string[] = [];

  if (options.includeH1) parts.push(`<h1>${escapeHtml(content.h1)}</h1>`);
  parts.push(`<p>${escapeHtml(content.intro)}</p>`);

  for (const section of content.sections) {
    parts.push(`<h2>${escapeHtml(section.heading)}</h2>`);
    for (const paragraph of section.paragraphs) {
      parts.push(`<p>${escapeHtml(paragraph)}</p>`);
    }
    if (section.bullets.length > 0) {
      const items = section.bullets
        .map((bullet) => `  <li>${escapeHtml(bullet)}</li>`)
        .join("\n");
      parts.push(`<ul>\n${items}\n</ul>`);
    }
  }

  if (content.faq.length > 0) {
    parts.push(`<h2>${escapeHtml(faqHeading(content, options.locale))}</h2>`);
    for (const item of content.faq) {
      parts.push(`<h3>${escapeHtml(item.question)}</h3>`);
      parts.push(`<p>${escapeHtml(item.answer)}</p>`);
    }
  }

  return parts.join("\n");
}

/**
 * Description COURTE, en HTML, pour le haut de la page catégorie.
 *
 * PrestaShop la place au-dessus de la grille produits, dans un champ distinct
 * de la description longue : les deux se collent séparément.
 */
export function renderShortDescriptionHtml(content: CategoryContent): string {
  return content.shortDescription
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("\n");
}

/** Description courte en texte brut, pour le contrôle des règles métier. */
export function renderShortDescriptionText(content: CategoryContent): string {
  return content.shortDescription.join("\n\n");
}

/**
 * Version texte, pour le scoring et le calcul de similarité.
 *
 * Les intertitres gardent leur marqueur `##` : sans lui, le contrôle de
 * structure du barème ne les voit pas et conclut à tort que le texte n'est pas
 * structuré, alors que le HTML rendu contient bien des H2.
 */
export function renderCategoryText(content: CategoryContent, locale?: string): string {
  const parts: string[] = [content.intro];

  for (const section of content.sections) {
    parts.push(`## ${section.heading}`, ...section.paragraphs, ...section.bullets);
  }
  if (content.faq.length > 0) {
    parts.push(`## ${faqHeading(content, locale)}`);
    for (const item of content.faq) {
      parts.push(`### ${item.question}`, item.answer);
    }
  }

  return parts.join("\n\n");
}
