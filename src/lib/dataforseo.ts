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

import { DEFAULT_LOCALE, localeInfo } from "@/lib/locales";

const SERP_ENDPOINT = "https://api.dataforseo.com/v3/serp/google/organic/live/advanced";
const INSTANT_PAGES_ENDPOINT = "https://api.dataforseo.com/v3/on_page/instant_pages";
const RAW_HTML_ENDPOINT = "https://api.dataforseo.com/v3/on_page/raw_html";
const USER_DATA_ENDPOINT = "https://api.dataforseo.com/v3/appendix/user_data";
const SEARCH_VOLUME_ENDPOINT =
  "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live";
const DIFFICULTY_ENDPOINT =
  "https://api.dataforseo.com/v3/dataforseo_labs/google/bulk_keyword_difficulty/live";

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

/* ----------------------------------------- vérification des identifiants -- */

export type AccountCheck =
  | { ok: true; login: string | null; solde: number | null; devise: string | null }
  | { ok: false; raison: string };

type UserDataResponse = {
  status_code?: number;
  status_message?: string;
  tasks?: {
    status_code?: number;
    status_message?: string;
    result?: {
      login?: string;
      money?: { balance?: number };
      price?: unknown;
    }[];
  }[];
};

/**
 * Interroge le compte DataForSEO pour savoir si les identifiants sont les bons.
 *
 * « Est-ce qu'on a le bon identifiant et le bon mot de passe ? » est une
 * question à laquelle personne ne peut répondre en regardant des variables
 * d'environnement : elles peuvent être présentes, bien orthographiées, et
 * appartenir à un autre compte. Seul le fournisseur sait. Cet appel est gratuit
 * chez eux, il renvoie le login et le solde — de quoi reconnaître le compte et
 * voir s'il lui reste de quoi travailler.
 *
 * Renvoie un verdict plutôt que de lever : c'est un diagnostic, l'échec est une
 * réponse valable.
 */
export async function checkAccount(): Promise<AccountCheck> {
  let auth: string;
  try {
    auth = credentials();
  } catch (error) {
    return { ok: false, raison: (error as Error).message };
  }

  let response: Response;
  try {
    response = await fetch(USER_DATA_ENDPOINT, {
      method: "GET",
      headers: { Authorization: `Basic ${auth}` },
      cache: "no-store",
    });
  } catch (error) {
    return { ok: false, raison: `DataForSEO injoignable : ${(error as Error).message}` };
  }

  if (response.status === 401) {
    return {
      ok: false,
      raison:
        "Identifiants refusés (401). Ce ne sont pas les bons, ou le jeton base64 " +
        "n'encode pas « login:mot_de_passe ».",
    };
  }

  let payload: UserDataResponse;
  try {
    payload = (await response.json()) as UserDataResponse;
  } catch {
    return { ok: false, raison: `DataForSEO a répondu ${response.status} sans JSON.` };
  }

  if (payload.status_code !== 20000) {
    return {
      ok: false,
      raison: `DataForSEO : ${payload.status_code} ${payload.status_message ?? ""}`.trim(),
    };
  }

  const result = payload.tasks?.[0]?.result?.[0];
  return {
    ok: true,
    login: result?.login ?? null,
    solde: result?.money?.balance ?? null,
    devise: "USD",
  };
}

/**
 * Jeton d'authentification DataForSEO.
 *
 * L'API attend `Authorization: Basic <base64(login:password)>`. DataForSEO
 * affiche cette chaîne déjà encodée dans son tableau de bord, et c'est souvent
 * elle qu'on reçoit plutôt que le couple identifiant / mot de passe. On accepte
 * donc les deux : le jeton pré-encodé s'il est fourni, sinon l'encodage du
 * couple. Refuser le jeton obligerait à le décoder à la main pour le
 * ré-encoder à l'identique — une manipulation inutile sur un secret.
 */
function credentials(): string {
  const token = process.env.DATAFORSEO_BASE64?.trim();
  if (token) return token;

  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;

  if (!login || !password) {
    throw new SerpError(
      "Identifiants DataForSEO absents. Ajoute soit DATAFORSEO_BASE64 (le jeton encodé " +
        "affiché par DataForSEO), soit DATAFORSEO_LOGIN et DATAFORSEO_PASSWORD, dans les " +
        "variables d'environnement Vercel (Production et Preview), puis redéploie.",
      "no_credentials",
    );
  }

  return Buffer.from(`${login}:${password}`).toString("base64");
}

/**
 * Interroge le SERP pour un mot-clé.
 *
 * @param ownDomain domaine du client, pour repérer sa propre position
 * @param locale langue du mot-clé : elle détermine le pays ET la langue de mesure
 * @param depth nombre de résultats demandés — au-delà de 10, DataForSEO facture davantage
 */
export async function fetchSerp(
  keyword: string,
  ownDomain: string | null,
  locale: string = DEFAULT_LOCALE,
  depth = 10,
): Promise<SerpAnalysis> {
  const auth = credentials();
  const marche = localeInfo(locale);

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
          location_code: marche.locationCode,
          language_code: marche.languageCode,
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

/* ---------------------------------------- volumes et difficulté ---------- */

export type KeywordMetrics = {
  keyword: string;
  volume: number | null;
  /** 0 à 100, d'après DataForSEO Labs. Mesure la difficulté organique. */
  difficulty: number | null;
  cpc: number | null;
  /** Concurrence publicitaire, 0 à 100. Indice indirect d'intention marchande. */
  competition: number | null;
};

type VolumeResponse = {
  status_code?: number;
  status_message?: string;
  tasks?: {
    status_code?: number;
    status_message?: string;
    result?: {
      keyword?: string;
      search_volume?: number | null;
      cpc?: number | null;
      competition_index?: number | null;
    }[];
  }[];
};

type DifficultyResponse = {
  status_code?: number;
  status_message?: string;
  tasks?: {
    status_code?: number;
    status_message?: string;
    result?: {
      items?: { keyword?: string; keyword_difficulty?: number | null }[];
    }[];
  }[];
};

/** Normalise un mot-clé pour rapprocher la réponse de la demande. */
function metricKey(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Volume mensuel, coût par clic et concurrence publicitaire d'une liste de
 * mots-clés, mesurés dans le pays de la langue demandée.
 *
 * Un seul appel pour toute la liste : DataForSEO facture à la tâche, pas au
 * mot-clé, donc interroger vingt candidats coûte le même prix qu'un seul. C'est
 * ce qui rend une vraie comparaison abordable — sans ça, on choisirait le
 * mot-clé principal au jugé.
 *
 * Renvoie une map plutôt qu'une liste : l'API ne garantit ni l'ordre ni la
 * présence de tous les mots-clés demandés, et un mot-clé sans donnée doit rester
 * distinguable d'un mot-clé à volume nul.
 */
export async function fetchKeywordVolumes(
  keywords: string[],
  locale: string = DEFAULT_LOCALE,
): Promise<Map<string, KeywordMetrics>> {
  const out = new Map<string, KeywordMetrics>();

  const unique = [...new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean))];
  if (unique.length === 0) return out;

  const auth = credentials();
  const marche = localeInfo(locale);

  const payload = await post<VolumeResponse>(
    SEARCH_VOLUME_ENDPOINT,
    [
      {
        // L'API plafonne à 1 000 mots-clés par tâche ; on n'en propose jamais
        // autant, mais le découpage manquant se paierait en erreur muette.
        keywords: unique.slice(0, 1000),
        location_code: marche.locationCode,
        language_code: marche.languageCode,
        search_partners: false,
      },
    ],
    auth,
  );

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

  for (const item of task?.result ?? []) {
    if (!item.keyword) continue;
    out.set(metricKey(item.keyword), {
      keyword: item.keyword,
      volume: item.search_volume ?? null,
      difficulty: null,
      cpc: item.cpc ?? null,
      competition: item.competition_index ?? null,
    });
  }

  return out;
}

/**
 * Difficulté organique d'une liste de mots-clés.
 *
 * Elle vient d'un autre produit que les volumes — DataForSEO Labs, pas Google
 * Ads — donc d'un second appel. On le sépare pour que l'échec de l'un ne prive
 * pas de l'autre : un volume sans difficulté reste exploitable, l'inverse aussi.
 */
export async function fetchKeywordDifficulty(
  keywords: string[],
  locale: string = DEFAULT_LOCALE,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();

  const unique = [...new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean))];
  if (unique.length === 0) return out;

  const auth = credentials();
  const marche = localeInfo(locale);

  const payload = await post<DifficultyResponse>(
    DIFFICULTY_ENDPOINT,
    [
      {
        keywords: unique.slice(0, 1000),
        location_code: marche.locationCode,
        language_code: marche.languageCode,
      },
    ],
    auth,
  );

  if (payload.status_code && payload.status_code !== 20000) {
    throw new SerpError(
      `DataForSEO : ${payload.status_message ?? `code ${payload.status_code}`}`,
      "api",
    );
  }

  for (const item of payload.tasks?.[0]?.result?.[0]?.items ?? []) {
    if (!item.keyword || item.keyword_difficulty === null) continue;
    if (typeof item.keyword_difficulty === "number") {
      out.set(metricKey(item.keyword), item.keyword_difficulty);
    }
  }

  return out;
}

/**
 * Volumes et difficulté réunis, chacun tolérant l'échec de l'autre.
 *
 * Le second verdict dit ce qui a manqué : « pas de données » et « l'appel a
 * échoué » ne se soignent pas de la même façon, et les confondre ferait
 * conclure à tort qu'un mot-clé n'a pas de demande.
 */
export async function fetchKeywordMetrics(
  keywords: string[],
  locale: string = DEFAULT_LOCALE,
): Promise<{ metrics: Map<string, KeywordMetrics>; problemes: string[] }> {
  const problemes: string[] = [];

  const [volumes, difficulties] = await Promise.all([
    fetchKeywordVolumes(keywords, locale).catch((error: Error) => {
      problemes.push(`Volumes indisponibles : ${error.message}`);
      return new Map<string, KeywordMetrics>();
    }),
    fetchKeywordDifficulty(keywords, locale).catch((error: Error) => {
      problemes.push(`Difficulté indisponible : ${error.message}`);
      return new Map<string, number>();
    }),
  ]);

  const metrics = new Map(volumes);
  for (const [key, difficulty] of difficulties) {
    const existing = metrics.get(key);
    if (existing) existing.difficulty = difficulty;
    else {
      metrics.set(key, {
        keyword: key,
        volume: null,
        difficulty,
        cpc: null,
        competition: null,
      });
    }
  }

  return { metrics, problemes };
}

/* ------------------------------------------- récupération d'une page ----- */

/** Le compte DataForSEO est-il configuré ? Sert à décider d'un repli. */
export function hasDataForSeoCredentials(): boolean {
  return Boolean(
    process.env.DATAFORSEO_BASE64 ||
      (process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD),
  );
}

type InstantPagesResponse = {
  status_code?: number;
  status_message?: string;
  tasks?: {
    id?: string;
    status_code?: number;
    status_message?: string;
    result?: {
      crawl_status?: unknown;
      items?: {
        status_code?: number;
        url?: string;
        meta?: { title?: string };
      }[];
    }[];
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
        enable_javascript: true,
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

  // Statut HTTP obtenu par *leur* crawleur sur la page. C'est l'information
  // décisive : un 403 ici veut dire que la protection les bloque aussi, et donc
  // qu'aucun repli de ce type ne passera.
  const crawledItem = task?.result?.[0]?.items?.[0];
  const crawledStatus = crawledItem?.status_code;
  if (crawledStatus && crawledStatus >= 400) {
    throw new SerpError(
      `Le crawleur DataForSEO a lui aussi reçu ${crawledStatus} sur ${url}. ` +
        `La protection ne se contourne pas par un changement d'IP : il faut une ` +
        `autorisation explicite côté site, ou l'API PrestaShop.`,
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
    const rawTask = raw.tasks?.[0];
    const detail =
      rawTask?.status_message ??
      (crawledStatus ? `statut de crawl ${crawledStatus}` : "réponse vide");
    throw new SerpError(
      `DataForSEO a bien crawlé ${url}${
        crawledItem?.meta?.title ? ` (titre : « ${crawledItem.meta.title} »)` : ""
      } mais n'a pas restitué le HTML brut : ${detail}.`,
      "empty",
    );
  }

  return html;
}
