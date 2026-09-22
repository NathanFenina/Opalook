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

- **`projects`** — un site e-commerce client (nom, domaine, marché B2B/B2C,
  règles métier éditables).
- **`categories`** — ce qui ne dépend pas de la langue : identifiant PrestaShop,
  arborescence (`parent_external_id`), nombre de produits, et le relevé de la
  page (`source_title`, `source_data`, `gsc_data`, …).
- **`category_locales`** — une ligne par langue publiée : nom, URL, segment
  d'URL, mot-clé et son volume, balises, longueur cible, statut, **date de mise
  en ligne**. Un mot-clé ne se traduit pas, et un texte non plus : tout ce qui
  varie d'un marché à l'autre vit ici.
- **`optimizations`** — un passage de rédaction, versionné par trigger et **par
  langue** (`v1` allemand n'a rien à voir avec `v3` français) : sortie générée,
  `score`, `engine`, l'audit dans `payload.checks`, et la raison du refus le cas
  échéant.
- **`project_members`** — les comptes invités sur un projet, par adresse e-mail
  (l'invitation fonctionne avant que le compte existe).

> ⚠ **Migration à jouer.** `supabase/migrations/2026-09-22_multilingue_et_suivi.sql`
> crée `category_locales`, la langue sur `optimizations` et les colonnes de refus.
> Tant qu'elle n'est pas jouée dans le SQL Editor, le multilingue, la longueur
> cible, la date de publication et la boucle de refus sont inactifs — l'outil le
> signale à l'écran et continue de fonctionner en français. Le fichier est
> rejouable sans casse et ne supprime aucune colonne existante.

RLS activée sur les trois tables : chaque utilisateur ne voit que ses propres
projets. Pour basculer en mode « toute l'équipe voit tout », remplacer les
clauses `owner_id = auth.uid()` par `auth.role() = 'authenticated'` dans une
nouvelle migration.

## Comment on travaille une catégorie

Une catégorie n'est pas une page : c'est autant de pages qu'il y a de langues, et
chacune se travaille **en deux phases**. La séparation n'est pas cosmétique — un
mauvais cadrage se voit en dix secondes sur un title, et en dix minutes sur sept
mille caractères.

**Phase 1 — ce qui se décide avant d'écrire** (`src/app/(app)/locale-actions.ts`)

1. **Mot-clé principal proposé à partir des données.** Trois sources se
   rejoignent : les requêtes déjà remontées par Search Console sur cette URL, ce
   que le modèle déduit du catalogue relevé, et le mot-clé actuel. Les volumes et
   la difficulté sont ensuite mesurés pour de vrai sur le marché de la langue, en
   un seul appel DataForSEO (la facturation est à la tâche, pas au mot-clé). Le
   classement privilégie les positions 11 à 20 : la page y est déjà jugée
   pertinente, un texte réécrit la fait souvent basculer en première page. Rien
   n'est retenu sans clic.
2. **Balises et segment d'URL.** Générés, corrigeables à la main, puis
   *validés*. Une fois validées, la rédaction les recopie au lieu d'en inventer
   d'autres — c'est ce qui permet de retoucher une URL sans regénérer le texte,
   et de relancer un texte sans perdre un title approuvé.
3. **Longueur à viser.** Médiane des textes réellement classés dans le top 10 sur
   ce mot-clé, dans cette langue (`src/lib/target-length.ts`). On ne compte que
   les paragraphes et les intertitres : une grille de cent produits pèse plus
   lourd que n'importe quelle prose, et le total ne dirait plus rien.

**Phase 2 — les deux descriptions**

Écrites pour les balises validées, à la longueur mesurée, en reprenant les
raisons des refus précédents. Puis contrôlées : règles métier
(`src/lib/compliance.ts`, français uniquement — les tournures interdites sont
françaises), ressemblance avec les autres textes du projet dans la même langue
(`src/lib/similarity.ts`), et score sur le même barème que la version en ligne
(`src/lib/moulinette.ts`).

**Boucle de correction.** Un texte refusé garde son *pourquoi*. Cette raison
repasse dans le prompt des rédactions suivantes de la même catégorie, et toutes
les raisons se relisent en bloc sur la page projet : celles qui reviennent
doivent remonter dans les règles métier du site, où elles profitent aux cent
quatre-vingts autres catégories.

**Ordre de passage.** Les catégories ne se traitent pas dans l'ordre du
catalogue (`src/lib/priority.ts`) : gain rapide d'abord (position 11–20), puis
l'arborescence (une mère fixe l'angle dont ses filles devront se démarquer, donc
elle passe avant), puis le volume de demande pour départager.

**Export.** `/api/projects/<id>/export?locale=<xx|all>` rend un CSV
point-virgule + BOM UTF-8 — ce qu'Excel français ouvre en colonnes — avec les
balises, le segment d'URL, les deux descriptions en HTML tel que PrestaShop
l'attend, le statut et la date de mise en ligne. `&publishable=1` ne garde que
ce qui a un texte non refusé.

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
