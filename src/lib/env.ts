/**
 * Lecture des variables d'environnement.
 *
 * Les valeurs sont lues à l'appel, pas au chargement du module. La nuance a
 * l'air théorique et ne l'est pas : une constante calculée au sommet du fichier
 * est évaluée dès que le module est importé, donc pendant la phase de collecte
 * des pages de `next build`. Une variable absente faisait alors échouer le
 * build entier, avec une erreur qui désignait la route en cours de collecte
 * plutôt que la configuration fautive.
 *
 * En différant la lecture, une variable manquante devient ce qu'elle est : une
 * panne de configuration, visible à la requête, avec un message qui nomme la
 * variable. Le déploiement, lui, aboutit — et `/api/health` dit lesquelles
 * manquent.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. ` +
        `Ajoute-la dans Vercel (Production ET Preview) puis redéploie — ` +
        `les variables ne sont lues qu'au build. Voir .env.example.`,
    );
  }
  return value;
}

export function supabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL");
}

export function supabasePublishableKey(): string {
  return required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
}

/** Origine publique de l'app, pour construire les URL de redirection d'auth. */
export function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}
