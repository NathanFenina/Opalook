/**
 * Analyse de SERP via DataForSEO.
 *
 * On interroge le SERP Google organique en direct pour un mot-clé, et on ne
 * garde que ce qui sert à écrire : qui occupe le haut du classement, avec quel
 * angle de title et de description. Ce sont ces intentions concurrentes que la
 * rédaction doit égaler ou contourner.
 *
 * Chaque appel est facturé. On demande donc la profondeur minimale utile et on
 * archive le résultat en base plutôt que de réinterroger.
 */

const SERP_ENDPOINT = "https://api.dataforseo.com/v3/serp/google/organic/live/advanced";
const INSTANT_PAGES_ENDPOINT = "https://api.dataforseo.com/v3/on_page/instant_pages";
const RAW_HTML_ENDPOINT = "https://api.dataforseo.com/v3/on_page/raw_html";

/** Codes Google : 2250 = France, 'fr' = français. */
export const FRANCE_LOCATION_CODE = 2250;
export const FRENCH_LANGUAGE_CODE = "fr";

export type SerpResult = {
  rank: number;
  title: string;
  description: string;
  url: string;
  domain: string;
};

export type SerpAnalysis = {
  keyword: string;
  fetchedAt: string;
  results: SerpResult[];
  /** Position du domaine du client dans ce classement, si présent. */
  ownRank: number | null;
};

export class SerpError extends Error {
  constructor(
    message: string,
    readonly kind: "no_credentials" | "api" | "empty",
  ) {
    super(message);
    this.name = "SerpError";
  }
}

type DfsItem = {
  type?: string;
  rank_absolute?: number;
  rank_group?: number;
  title?: string;
  description?: string;
  url?: string;
  domain?: string;
};

type DfsResponse = {
  status_code?: number;
  status_message?: string;
  tasks?: {
    status_code?: number;
    status_message?: string;
    result?: { items?: DfsItem[] }[];
  }[];
};

function credentials(): string {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;

  if (!login || !password) {
    throw new SerpError(
      "DATAFORSEO_LOGIN et DATAFORSEO_PASSWORD absents. Ajoute-les dans les variables " +
        "d'environnement Vercel (Production et Preview), puis redéploie.",
      "no_credentials",
    );
  }

  return Buffer.from(`${login}:${password}`).toString("base64");
}

/**
 * Interroge le SERP pour un mot-clé.
 *
 * @param ownDomain domaine du client, pour repérer sa propre position
 * @param depth nombre de résultats demandés — au-delà de 10, DataForSEO facture davantage
 */
export async function fetchSerp(
  keyword: string,
  ownDomain: string | null,
  depth = 10,
): Promise<SerpAnalysis> {
  const auth = credentials();

  let response: Response;
  try {
    response = await fetch(SERP_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          keyword,
          location_code: FRANCE_LOCATION_CODE,
          language_code: FRENCH_LANGUAGE_CODE,
          depth,
          device: "desktop",
        },
      ]),
      cache: "no-store",
    });
  } catch (error) {
    throw new SerpError(`DataForSEO injoignable : ${(error as Error).message}`, "api");
  }

  if (response.status === 401) {
    throw new SerpError("Identifiants DataForSEO refusés (401).", "no_credentials");
  }
  if (!response.ok) {
    throw new SerpError(`DataForSEO a répondu ${response.status}.`, "api");
  }

  const payload = (await response.json()) as DfsResponse;

  // DataForSEO renvoie 200 même sur erreur applicative : le vrai statut est
  // dans le corps, au niveau de la réponse puis de la tâche.
  if (payload.status_code && payload.status_code !== 20000) {
    throw new SerpError(
      `DataForSEO : ${payload.status_message ?? `code ${payload.status_code}`}`,
      "api",
    );
  }

  const task = payload.tasks?.[0];
  if (task?.status_code && task.status_code !== 20000) {
    throw new SerpError(
      `DataForSEO : ${task.status_message ?? `code ${task.status_code}`}`,
      "api",
    );
  }

  const items = task?.result?.[0]?.items ?? [];
  const results: SerpResult[] = items
    .filter((item) => item.type === "organic" && item.url)
    .map((item) => ({
      rank: item.rank_group ?? item.rank_absolute ?? 0,
      title: item.title ?? "",
      description: item.description ?? "",
      url: item.url ?? "",
      domain: item.domain ?? "",
    }))
    .sort((a, b) => a.rank - b.rank);

  if (results.length === 0) {
    throw new SerpError(
      `Aucun résultat organique renvoyé pour « ${keyword} ».`,
      "empty",
    );
  }

  const normalizedOwn = ownDomain?.replace(/^www\./, "").toLowerCase() ?? null;
  const own = normalizedOwn
    ? results.find((result) => result.domain.replace(/^www\./, "").toLowerCase() === normalizedOwn)
    : undefined;

  return {
    keyword,
    fetchedAt: new Date().toISOString(),
    results,
    ownRank: own?.rank ?? null,
  };
}

/* ------------------------------------------- récupération d'une page ----- */

/** Le compte DataForSEO est-il configuré ? Sert à décider d'un repli. */
export function hasDataForSeoCredentials(): boolean {
  return Boolean(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD);
}

type InstantPagesResponse = {
  status_code?: number;
  status_message?: string;
  tasks?: {
    id?: string;
    status_code?: number;
    status_message?: string;
    result?: { items?: { status_code?: number }[] }[];
  }[];
};

type RawHtmlResponse = {
  status_code?: number;
  status_message?: string;
  tasks?: {
    status_code?: number;
    status_message?: string;
    result?: { items?: { html?: string }[] }[];
  }[];
};

async function post<T>(endpoint: string, body: unknown, auth: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    throw new SerpError(`DataForSEO injoignable : ${(error as Error).message}`, "api");
  }

  if (response.status === 401) {
    throw new SerpError("Identifiants DataForSEO refusés (401).", "no_credentials");
  }
  if (!response.ok) {
    throw new SerpError(`DataForSEO a répondu ${response.status}.`, "api");
  }

  return (await response.json()) as T;
}

/**
 * Récupère le HTML d'une page en passant par l'infrastructure DataForSEO.
 *
 * Sert de repli quand le site refuse nos requêtes serveur : leurs crawleurs
 * sortent depuis leurs propres IP, avec un rendu navigateur, ce qui franchit
 * les protections anti-robot que nous ne franchissons pas. Le HTML obtenu est
 * ensuite analysé par nos propres sélecteurs — on ne change que la façon
 * d'obtenir la page, pas la façon de la lire.
 *
 * En deux temps, comme l'impose l'API : un premier appel demande la page en
 * conservant le HTML brut, un second va le chercher par l'identifiant de tâche.
 */
export async function fetchPageHtml(url: string): Promise<string> {
  const auth = credentials();

  const crawl = await post<InstantPagesResponse>(
    INSTANT_PAGES_ENDPOINT,
    [
      {
        url,
        store_raw_html: true,
        enable_browser_rendering: true,
        load_resources: true,
        browser_preset: "desktop",
        accept_language: "fr-FR",
      },
    ],
    auth,
  );

  if (crawl.status_code && crawl.status_code !== 20000) {
    throw new SerpError(
      `DataForSEO : ${crawl.status_message ?? `code ${crawl.status_code}`}`,
      "api",
    );
  }

  const task = crawl.tasks?.[0];
  if (task?.status_code && task.status_code !== 20000) {
    throw new SerpError(
      `DataForSEO : ${task.status_message ?? `code ${task.status_code}`}`,
      "api",
    );
  }

  const taskId = task?.id;
  if (!taskId) {
    throw new SerpError("DataForSEO n'a pas renvoyé d'identifiant de tâche.", "empty");
  }

  const raw = await post<RawHtmlResponse>(RAW_HTML_ENDPOINT, [{ id: taskId, url }], auth);

  if (raw.status_code && raw.status_code !== 20000) {
    throw new SerpError(
      `DataForSEO : ${raw.status_message ?? `code ${raw.status_code}`}`,
      "api",
    );
  }

  const html = raw.tasks?.[0]?.result?.[0]?.items?.[0]?.html;
  if (!html) {
    throw new SerpError(
      `DataForSEO n'a pas renvoyé le HTML de ${url}. La page est peut-être inaccessible depuis leurs crawleurs aussi.`,
      "empty",
    );
  }

  return html;
}
