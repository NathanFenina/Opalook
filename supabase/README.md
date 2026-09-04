# Base de données

## Les fichiers

| Fichier | Rôle |
| --- | --- |
| `schema.sql` | Tout le schéma : types, tables, index, triggers, RLS. Rejouable sur un projet vierge comme sur un projet en place. |
| `export.sql` | Ne modifie rien. Lit la base courante et fabrique le script d'insertion des données, à coller ailleurs. |

Le schéma vivait jusqu'ici uniquement dans l'historique de migrations du projet
Supabase. Pratique tant qu'on ne travaille que sur celui-là, inutilisable dès
qu'il faut monter la base ailleurs. D'où ces deux fichiers.

## Déplacer l'app vers un autre projet Supabase

Le cas courant : le client fournit son propre projet et l'app doit y basculer.

**1. Monter le schéma.** Sur le projet cible, SQL Editor → coller `schema.sql`
→ Run. Il crée tout et ne détruit rien s'il est rejoué.

**2. Récupérer les clés.** Project Settings → API : l'URL du projet et la clé
`publishable`. Cette clé est publique par conception — elle part dans le
navigateur, c'est la RLS qui protège les données.

**3. Basculer l'app.** Dans Vercel, `NEXT_PUBLIC_SUPABASE_URL` et
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, sur Production et Preview, puis
redéployer. Vercel ne lit les variables qu'au build : sans redéploiement, rien
ne change.

**4. Créer le compte.** Se connecter une fois à l'app par lien magique. C'est ce
qui crée la ligne dans `auth.users` à laquelle les projets seront rattachés.
Sans cette étape, l'import de l'étape 5 s'arrête avec un message explicite.

**5. Reprendre les données.** Sur le projet **source**, exécuter `export.sql`,
copier la colonne `script`. Sur le projet **cible**, coller ce script → Run.

**6. Vérifier.** Ouvrir `/api/health` dans l'app : il indique l'environnement,
le commit déployé et l'état des variables — leur présence, leur longueur et leur
préfixe, jamais leur valeur.

## Ce que l'export ne reprend pas, volontairement

Le relevé de page (`source_data`), l'analyse SERP (`serp_data`) et les
optimisations. Les deux premiers sont des instantanés que l'outil refait à
chaque traitement complet ; les reprendre alourdirait le script de plusieurs
mégaoctets pour des données périmées dès le lendemain.

Les optimisations se régénèrent aussi, et repartir d'une base de versions propre
évite de traîner des textes rédigés sous d'anciennes règles métier — ceux-là
passeraient le contrôle sans jamais avoir été écrits contre les bonnes
consignes.

Sont repris : les projets avec leurs règles métier et leur brief, et les
catégories avec leur arborescence, leurs mots-clés, leur champ sémantique
validé, les descriptions déjà en ligne et les données Search Console.
