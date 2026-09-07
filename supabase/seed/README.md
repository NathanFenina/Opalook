# Reprise des données sur un projet neuf

Ces fichiers rejouent le contenu de la base : les deux projets avec leurs règles
métier, et leurs 366 catégories avec l'arborescence, les descriptions déjà en
ligne, les mots-clés et leurs volumes.

Ils remplacent l'approche par `../export.sql` quand le copier-coller depuis
l'éditeur SQL tronque le résultat : le presse-papier du navigateur ne suit pas
sur une cellule de 600 Ko. Ici chaque fichier tient en quelques dizaines de
kilo-octets et se copie depuis un éditeur de texte, où rien ne se perd.

## Ordre d'exécution

Sur le projet cible, dans le SQL Editor, un fichier à la fois :

1. `00_projets.sql` — d'abord, les catégories s'y rattachent
2. `opalook_01` à `opalook_04`
3. `lmdla_01` à `lmdla_04`

Prérequis : avoir joué `../schema.sql`, et s'être connecté une fois à l'app pour
que le compte existe dans `auth.users`. Le premier fichier s'arrête avec un
message explicite si ce n'est pas le cas.

Chaque fichier est rejouable : un conflit met la ligne à jour, il ne la duplique
pas. Relancer deux fois le même fichier ne casse rien.

## Ce qui n'est pas repris

Les données Search Console. Elles se réimportent en un clic depuis la page
projet, formulaire « Importer les données Search Console », avec le même export
qu'à l'origine — inutile de les figer dans un fichier qui vieillira.

Le relevé de page et l'analyse SERP non plus : l'outil les refait à chaque
traitement complet. Ni les optimisations, pour repartir d'une base de versions
propre plutôt que de traîner des textes écrits sous d'anciennes règles.

## Régénération

Ces fichiers sont produits à partir des exports catalogue PrestaShop et des
documents de règles métier. Si le catalogue change, c'est le formulaire
« Importer le catalogue » de l'app qu'il faut utiliser, pas ces fichiers : ils
n'ont d'intérêt que pour amorcer une base vide.
