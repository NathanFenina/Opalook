/**
 * Lire TOUTES les lignes, et pas les mille premières.
 *
 * PostgREST — la couche qui sert l'API de Supabase — plafonne toute réponse à
 * mille lignes. Sans en-tête de pagination, la requête ne renvoie pas d'erreur :
 * elle renvoie mille lignes et se tait. C'est le pire des comportements, parce
 * que le résultat a l'air juste.
 *
 * Le symptôme observé : un catalogue de 188 catégories en dix langues fait
 * 1 880 lignes, l'écran en affichait 1 000 réparties au hasard entre les
 * langues — « Français 116, Anglais 98, Allemand 98… ». Personne ne pouvait
 * deviner que c'était un plafond technique plutôt qu'un catalogue incomplet.
 * L'export CSV avait le même défaut, en plus grave : il aurait livré un fichier
 * amputé sans rien signaler.
 *
 * Le `range` ne contourne pas le plafond — demander 0–4999 renvoie quand même
 * mille lignes. Il faut donc boucler, page par page, jusqu'à recevoir une page
 * incomplète.
 */

/** Taille d'une page. Égale au plafond de PostgREST, pour minimiser les allers-retours. */
const PAGE = 1000;

/** Garde-fou : au-delà, c'est une boucle qui ne se termine pas, pas un gros catalogue. */
const MAX_PAGES = 50;

type Page<T> = { data: T[] | null; error: { message: string } | null };

/**
 * Enchaîne les pages d'une requête jusqu'à les avoir toutes.
 *
 * @param query reçoit les bornes d'une page et doit appliquer `.range(from, to)`
 */
export async function fetchAllRows<T>(
  query: (from: number, to: number) => PromiseLike<Page<T>>,
): Promise<{ data: T[]; error: string | null }> {
  const rows: T[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE;
    const { data, error } = await query(from, from + PAGE - 1);

    if (error) return { data: rows, error: error.message };
    if (!data || data.length === 0) break;

    rows.push(...data);

    // Une page incomplète est la dernière. C'est le seul signal fiable : le
    // nombre total n'est pas renvoyé sans le demander explicitement.
    if (data.length < PAGE) break;
  }

  return { data: rows, error: null };
}
