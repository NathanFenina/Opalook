# Opalook

Moulinette d'optimisation des pages **catégories e-commerce**. On y déclare un
projet (= un site client), on y liste les pages catégories à travailler, on colle
le contenu actuel, et la moulinette produit une version optimisée (title, meta
description, H1, texte de catégorie) accompagnée d'un audit scoré — avec
historisation de chaque passage.

## Stack

| Brique | Choix |
| --- | --- |
| Front / back | Next.js 16 (App Router, Server Actions, TypeScript) |
| Style | Tailwind CSS v4 |
| Base de données + auth | Supabase (Postgres + Auth, RLS activée) |
| Hébergement | Vercel |

## Structure

```
src/
  app/
    (app)/                    # espace connecté
      actions.ts              # Server Actions (CRUD + lancement moulinette)
      dashboard/              # liste des projets
      projects/[id]/          # catégories d'un projet
      categories/[id]/        # source, audit, versions optimisées
    auth/callback/            # échange du lien magique contre une session
    auth/signout/
    login/
  components/ui.tsx           # primitives d'UI partagées
  lib/
    moulinette.ts             # ⬅ cœur métier : génération + audit + score
    env.ts                    # variables d'env validées
    database.types.ts         # types du schéma Supabase
    supabase/{client,server,proxy}.ts
  proxy.ts                    # refresh de session + protection des routes
supabase/migrations/          # schéma versionné
```

## Modèle de données

- **`projects`** — un site e-commerce client (nom, domaine, locale).
- **`categories`** — une page catégorie à traiter : URL, mot-clé cible, statut,
  et le contenu source relevé sur le site (`source_title`, `source_h1`, …).
- **`optimizations`** — un passage de moulinette, versionné automatiquement par
  trigger (`v1`, `v2`, …) : sortie générée, `score`, `engine` et l'audit complet
  dans `payload.checks`.

RLS activée sur les trois tables : chaque utilisateur ne voit que ses propres
projets. Pour basculer en mode « toute l'équipe voit tout », remplacer les
clauses `owner_id = auth.uid()` par `auth.role() = 'authenticated'` dans une
nouvelle migration.

## La moulinette

Tout est dans `src/lib/moulinette.ts`, volontairement **pur** (aucune I/O) donc
testable et remplaçable :

- `optimize(input)` — génère title / meta / H1 / texte + audit + score.
- `auditSource(input)` — score la version d'origine, pour afficher le gain.
- `audit(parts, keyword)` — le scoring seul, réutilisable.

La v0 (`engine: "rules-v0"`) est **déterministe, à base de règles** : longueurs
cibles, présence et densité du mot-clé, structure Hn. Le champ `engine` en base
est là pour qu'on puisse ajouter un moteur LLM à côté sans migration ni
réécriture des appelants — l'historique restera lisible et comparable.

## Démarrer en local

```bash
npm install
cp .env.example .env.local   # puis renseigner la clé publishable Supabase
npm run dev
```

Variables d'environnement (voir `.env.example`) :

| Variable | Rôle |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | clé publishable (`sb_publishable_…`) |
| `NEXT_PUBLIC_SITE_URL` | origine publique, pour le lien magique. À laisser vide sur Vercel : déduite automatiquement. |

## Configuration Supabase (à faire une fois, dans le dashboard)

L'authentification se fait par **lien magique**. Il faut autoriser les URL de
redirection dans _Authentication → URL Configuration_ :

- **Site URL** : l'URL de production Vercel.
- **Redirect URLs** : `http://localhost:3000/auth/callback` et
  `https://<domaine-vercel>/auth/callback` (ajouter aussi
  `https://<projet>-*.vercel.app/auth/callback` pour couvrir les previews).

Sans ça, le lien reçu par mail renverra vers `localhost` ou sera rejeté.

## Déploiement Vercel

1. Importer le dépôt `NathanFenina/Opalook` dans Vercel (framework Next.js
   détecté automatiquement, aucune config à ajouter).
2. Renseigner `NEXT_PUBLIC_SUPABASE_URL` et
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` dans _Settings → Environment
   Variables_ (les trois environnements).
3. Déployer, puis reporter l'URL obtenue dans la configuration Supabase ci-dessus.

## Migrations

Le schéma est versionné dans `supabase/migrations/`. Pour la suite :

```bash
npx supabase link --project-ref pjxvstskgzvsyzkbxxug
npx supabase db push
```

Régénérer les types après un changement de schéma :

```bash
npx supabase gen types typescript --project-id pjxvstskgzvsyzkbxxug > src/lib/database.types.ts
```

## Vérifications

```bash
npm run lint
npm run build
```
