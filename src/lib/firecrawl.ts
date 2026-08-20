/**
 * Récupération d'une page via Firecrawl.
 *
 * Premier repli quand le site refuse nos requêtes serveur. Firecrawl est fait
 * pour ça : rendu navigateur, rotation de proxies, contournement des
 * protections anti-robot. On demande le HTML brut plutôt que le markdown, parce
 * que nos sélecteurs travaillent sur la structure — produits et facettes se
 * repèrent à leurs classes, pas à leur mise en forme.
 *
 * `onlyMainContent` est désactivé pour la même raison : la colonne de filtres
 * est un aside, et serait retirée par le nettoyage automatique.
 */

const ENDPOINT = "https://api.firecrawl.dev/v2/scrape";

export class FirecrawlError extends Error {
  constructor(
    message: string,
    readonly kind: "no_credentials" | "api" | "blocked" | "empty",
  ) {
    super(message);
    this.name = "FirecrawlError";
  }
}

type ScrapeResponse = {
  success?: boolean;
  error?: string;
  data?: {
    rawHtml?: string;
    html?: string;
    metadata?: {
      url?: string;
      statusCode?: number;
      error?: string | null;
      title?: string;
    };
  };
};

export function hasFirecrawlCredentials(): boolean {
  return Boolean(process.env.FIRECRAWL_API_KEY);
}

export async function fetchPageHtml(url: string): Promise<string> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new FirecrawlError(
      "FIRECRAWL_API_KEY absente. Ajoute-la dans les variables d'environnement Vercel.",
      "no_credentials",
    );
  }

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["rawHtml"],
        onlyMainContent: false,
        blockAds: true,
        // « enhanced » sort par des proxies résidentiels : plus lent et plus
        // cher, mais c'est précisément ce qu'il faut face à Cloudflare.
        proxy: "enhanced",
        waitFor: 2000,
        timeout: 90000,
        location: { country: "FR", languages: ["fr-FR"] },
      }),
      cache: "no-store",
    });
  } catch (error) {
    throw new FirecrawlError(`Firecrawl injoignable : ${(error as Error).message}`, "api");
  }

  if (response.status === 401 || response.status === 403) {
    throw new FirecrawlError(`Clé Firecrawl refusée (${response.status}).`, "no_credentials");
  }
  if (response.status === 402) {
    throw new FirecrawlError("Crédits Firecrawl épuisés.", "api");
  }
  if (response.status === 429) {
    throw new FirecrawlError("Limite de débit Firecrawl atteinte.", "api");
  }

  let payload: ScrapeResponse;
  try {
    payload = (await response.json()) as ScrapeResponse;
  } catch {
    throw new FirecrawlError(`Firecrawl a répondu ${response.status} sans JSON.`, "api");
  }

  const meta = payload.data?.metadata;

  // Le statut renvoyé par Firecrawl porte sur *sa* requête ; celui de la page
  // visée est dans les métadonnées. Un 403 là veut dire que la protection
  // résiste aussi à leurs proxies.
  if (meta?.statusCode && meta.statusCode >= 400) {
    throw new FirecrawlError(
      `Firecrawl a reçu ${meta.statusCode} sur ${url}${
        meta.error ? ` : ${meta.error}` : ""
      }.`,
      "blocked",
    );
  }

  if (payload.success === false || meta?.error) {
    throw new FirecrawlError(
      `Firecrawl : ${payload.error ?? meta?.error ?? "échec sans détail"}.`,
      "api",
    );
  }

  const html = payload.data?.rawHtml ?? payload.data?.html;
  if (!html) {
    throw new FirecrawlError(`Firecrawl n'a renvoyé aucun HTML pour ${url}.`, "empty");
  }

  return html;
}
