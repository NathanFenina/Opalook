-- Projets et règles métier
-- Généré pour la reprise de la base sur un autre projet Supabase.
-- Prérequis : avoir joué schema.sql, et s'être connecté une fois à l'app pour
-- que le compte existe dans auth.users.
-- Rejouable : les conflits mettent à jour, ils ne dupliquent pas.

do $seed$
begin
  if not exists (select 1 from auth.users) then
    raise exception 'Aucun compte dans auth.users : connecte-toi une fois a l''app avant de jouer ce script.';
  end if;
end
$seed$;

insert into public.projects (id, owner_id, name, domain, locale, market, business_rules)
values ('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, (select id from auth.users order by created_at limit 1), 'Opalook', 'opalook.eu', 'fr-FR', 'b2b', '# Règles métier — descriptions de catégories opalook.eu

v1.7 — 2026-08-24, validé par Nathan Nouail.
Document de référence pour la rédaction des deux descriptions de catégorie (courte + longue).
Autoportant : tout ce qu''il faut savoir est ici.

## 1. Qui parle, à qui

- **Qui** : Opalook, grossiste européen et mondial de bijoux (ambre, opale, pierres naturelles, argent, doré, or). Entreprise familiale franco-polonaise, 180 ans d''expertise. Livraison dans toute l''UE et le monde entier. Le texte dit « nous ».
- **À qui** : exclusivement des professionnels revendeurs (bijouteries, boutiques, e-commerçants). Jamais au client final, jamais à l''achat à l''unité.
- **Ton** : professionnel, technique, sobre. Vouvoiement. Pas d''émotionnel, pas de lyrisme.
- **Angle** : l''univers de la catégorie et ce qu''il apporte au revendeur (réassort, marge, rotation). Pas « offrez-vous ce bijou ».

## 2. Règle d''or : la page réelle est la source de vérité

Chaque texte est généré à partir de ce qui est réellement présent sur la page de SA catégorie, scrapée en direct, URL par URL. Une matière, pierre, type de bijou, couleur, origine ou public absent des filtres de la page n''existe pas : interdiction de le mentionner.

Exemple : l''acier inoxydable n''est pas au catalogue Opalook. Si un texte parle de bijoux en acier, il est faux — rien sur la page ne le justifie.

L''inverse est permis, et même utile : une matière absente des filtres peut être nommée en négatif comme argument de différenciation (« nous ne proposons pas d''acier : nos bijoux sont en argent 925, doré ou or… »), à condition d''enchaîner sur ce que la page propose réellement, et de ne le faire que pour une matière que le lecteur s''attendrait à trouver.

Le catalogue évolue en permanence : le texte se fonde sur les filtres du jour du scrap, jamais sur une connaissance générale des bijoux ni sur un état passé du site.

Les origines des pierres figurent dans les filtres (ambre de la mer Baltique, opale d''Australie) : c''est là que le texte les prend, jamais de mémoire.

Interdiction d''inventer : matière, pierre, dimension, certification, origine, prix, délai. Un fait absent de la page scrapée et de ce document ne s''écrit pas.

## 3. Ce qu''on a le droit de mettre en avant (pool fermé)

Seuls ces arguments peuvent être mis en avant. Le choix, le dosage et la rotation d''une catégorie à l''autre relèvent de l''outil : répéter les mêmes atouts sur environ 150 catégories crée du contenu quasi dupliqué.

**Tier 1 — prioritaires**
- Grossiste européen et mondial : livraison dans toute l''UE et le monde entier
- Sans minimum d''achat
- Prix professionnels après inscription
- Certificat d''authenticité avec chaque bijou
- Garantie 1 an et SAV
- Bijoux personnalisés sur production (fabrication sur devis)
- Packaging personnalisé sur production

**Tier 2**
- Plus de 3000 références en stock, expédition sous 24 à 48 h
- Normes UE et REACH, bijoux poinçonnés
- Paiement différé 30 jours et en 3 ou 4 fois (Klarna)
- Fabrication européenne franco-polonaise

Précisions :
- « 180 ans d''expertise » est un signal de marque : à doser, pas dans chaque texte.
- « Fabrication européenne » porte uniquement sur la fabrication. Ne JAMAIS affirmer que les pierres sont d''origine UE : leur origine réelle est celle des filtres.
- « Pierres 100 % naturelles » : autorisé quand la page de la catégorie le confirme.

## 4. Interdits (non négociables)

| Interdit | À la place |
| --- | --- |
| S''adresser au particulier (« offrez-vous », « votre bijou ») | « pour votre boutique », « votre réassort », « votre clientèle » |
| « pro » tout seul | « grossiste », « revendeur », « partenaire », « professionnel » |
| Superlatifs (inégalé, exceptionnel, le meilleur) | Faits concrets : stock, délai, certificat |
| Le mot « artisanat » | « fabrication », « savoir-faire » |
| « reconnu » pour une pierre ou une vertu | « réputé » |
| Guillemets dans le texte ; nom de catégorie en Majuscules | Nom en minuscules, intégré avec des prépositions |
| Émoji, tiret cadratin | Ponctuation simple |
| Dropshipping | Jamais évoqué : canal refusé |
| Showroom, adresse logistique | Rien : non vérifié |

**Lithothérapie (règle stricte)** : les bienfaits ne sont JAMAIS affirmés. Vocabulaire imposé : « potentiels bienfaits », « réputé pour ». Chaque texte qui évoque la lithothérapie contient un disclaimer explicite, par exemple : ces propriétés relèvent de croyances traditionnelles et ne sont pas scientifiquement prouvées. Pour les produits bébé et enfant, le disclaimer est obligatoire et renforcé.

**Bijoux bébé et enfant (catégories très sensibles)** : mêmes règles qu''en B2C même si le texte s''adresse au revendeur. Aucun bienfait n''est JAMAIS affirmé (poussées dentaires, apaisement…). Le disclaimer « non prouvé » est obligatoire et renforcé. Ne jamais présenter le bijou comme un dispositif médical, un remède ou une solution aux poussées dentaires. Chaque texte de catégorie bébé ou enfant contient un rappel de sécurité : port sous la surveillance d''un adulte, jamais pendant le sommeil ni sans surveillance. Le revendeur doit pouvoir relayer une information exacte à sa clientèle.

**Sécurité produit bébé (faits validés, conformes aux normes exigées)** — les bijoux bébé sont distincts des bijoux enfant. Les textes des catégories bébé PEUVENT et DOIVENT mettre en avant ces faits, tels quels et sans rien y ajouter :
- les colliers bébé ont un fermoir à clip qui se détache sous tension pour éviter tout risque de strangulation ;
- les bracelets bébé ont une attache à vis, sans risque particulier ;
- chaque perle est nouée individuellement, collier comme bracelet, de sorte que les billes ne s''éparpillent pas si le bijou venait à se rompre.

Argument fort pour le revendeur : des bijoux bébé conformes aux normes exigées, qu''il peut vendre en confiance. Ces attaches ne concernent que les bijoux bébé : ne pas les affirmer sur les catégories enfant.

**Référentiel matières** (comment les nommer quand la page les confirme) : « argent 925 rhodié » ; « argent doré » = argent 925 doré à 0,5 micron d''or, JAMAIS « plaqué or » (autre procédé, la confusion est interdite) ; « or 18 carats » (750) ; et les bijoux tout ambre, bracelets et colliers entièrement en ambre. Tous les bijoux sont poinçonnés et conformes aux normes : fait affirmable dans tout texte.

**Terminologie matières** : l''ambre n''est pas une pierre, c''est une résine fossile. Ne jamais écrire « pierre d''ambre » ni classer l''ambre parmi les pierres naturelles : ce sont deux univers distincts du catalogue (bijoux en ambre / bijoux en pierres naturelles). On vend des bijoux, pas des pierres : « bijou en opale » et non « opale » ; « bijoux en ambre et en argent pour homme » et non « bijoux ambre argent homme » — les intitulés bruts se réécrivent avec des prépositions. « opale d''Australie », pas « opale australienne ». Respecter le genre grammatical de la pierre : le grenat, la turquoise ; forme neutre si inconnu.

## 5. SEO — ce que la catégorie doit porter

Le vocabulaire de gros vit sur la page catégorie : « grossiste », « en gros », « fournisseur », « lot », « compte revendeur » s''écrivent ici, les fiches produit ne les portent pas. La catégorie cible l''intention « bijoux ambre en gros », « grossiste bijoux ambre ».

Le nom de la catégorie s''intègre plusieurs fois, de façon fluide et naturelle, avec des prépositions.

Texte prêt à l''emploi : pas de titre « Description : », pas de remarque finale, pas de méta-discours. Si une FAQ est incluse : question en titre, réponse autoportante qui commence par la réponse.

**Interdiction du contenu dupliqué entre catégories** : chaque texte doit se différencier de sa catégorie mère et de ses catégories sœurs — angle, vocabulaire, atouts choisis. Deux textes interchangeables où seul le nom de la catégorie change sont un échec. Le fichier catalogue fournit l''arborescence complète (id_parent) : l''outil doit connaître la famille de chaque catégorie — mère, sœurs, filles — au moment de rédiger, et s''en servir pour différencier.

## 6. Les deux livrables par catégorie

**Description COURTE (haut de page)**
- Rôle : présenter l''univers de la catégorie et ses atouts.
- Contrainte métier : nom de catégorie intégré naturellement.

**Description LONGUE (bas de page)**
- Rôle : approfondir — sous-catégories, matières présentes sur la page, guide revendeur, FAQ éventuelle.
- Contrainte métier : ne lister que ce que la page scrapée confirme.

Longueurs, structure HTML et format relèvent de l''expertise de l''outil. Les contraintes ci-dessus et les règles des sections 1 à 5 sont les seules limites métier.

## 7. Entrée de l''outil

- Liste des catégories : fichier `catalogue_opalook.csv`, catégories actives uniquement, 10 langues — id, nom, URL, description et informations complémentaires existantes par langue.
- Données produit : scrapées en direct sur chaque URL — nom affiché, fil d''Ariane, filtres de la page (types de bijoux, matières, pierres, couleurs, origines, publics), contenu existant.

Toute entité produit citée dans le texte doit exister sur la page scrapée (section 2). Les faits d''entreprise — atouts, chiffres — viennent exclusivement de la section 3 de ce document.

## 8. Multilingue

10 langues actives : fr, en, de, es, it, ro, nl, pt, ko, tr — les colonnes du fichier catalogue. Le texte se rédige dans la langue cible, ce n''est pas une traduction littérale du français. Toutes les règles de ce document s''appliquent dans chaque langue. Le nom de catégorie intégré est celui de la langue cible, colonne `name_xx`.')
on conflict (id) do update set
  name = excluded.name, domain = excluded.domain, market = excluded.market,
  business_rules = excluded.business_rules, updated_at = now();

insert into public.projects (id, owner_id, name, domain, locale, market, business_rules)
values ('dd5cc453-308b-4b24-822d-ef70e77b4438'::uuid, (select id from auth.users order by created_at limit 1), 'La Maison de l''Ambre', 'lamaisondelambre.com', 'fr-FR', 'b2c', '# Règles métier — descriptions de catégories lamaisondelambre.com

v1.7 — 2026-08-24, validé par Nathan Nouail.
Document de référence pour la rédaction des deux descriptions de catégorie (courte + longue).
Autoportant : tout ce qu''il faut savoir est ici.

## 1. Qui parle, à qui

- **Qui** : La Maison de l''Ambre, bijouterie en ligne spécialisée en bijoux en ambre, argent, doré et pierres naturelles. Maison spécialisée depuis 1973. Le texte dit « nous ».
- **À qui** : la cliente finale, cœur de cible femmes de 35 à 65 ans. Achat plaisir et cadeau. Vouvoiement. Jamais de vocabulaire professionnel ou B2B.
- **Ton** : chaleureux, émotionnel, accessible premium, mais jamais pompeux ni verbeux. Clair, précis, concis. On évoque la beauté naturelle, le porté, l''histoire, sans emphase creuse ni promesses.
- **Valeurs** : authenticité, beauté naturelle, tradition de la Baltique.

## 2. Règle d''or : la page réelle est la source de vérité

Chaque texte est généré à partir de ce qui est réellement présent sur la page de SA catégorie, scrapée en direct, URL par URL. Une matière, pierre, type de bijou, couleur, origine ou public absent des filtres de la page n''existe pas : interdiction de le mentionner.

Exemple : si l''acier inoxydable n''apparaît pas dans les filtres, aucun texte ne parle d''acier — rien sur la page ne le justifie.

L''inverse est permis, et même utile : une matière absente des filtres peut être nommée en négatif comme argument de différenciation (« pas d''acier ici : nos bijoux sont en argent 925 massif, ornés de pierres naturelles… »), à condition d''enchaîner sur ce que la page propose réellement, et de ne le faire que pour une matière que la cliente s''attendrait à trouver.

Le catalogue évolue en permanence : le texte se fonde sur les filtres du jour du scrap, jamais sur une connaissance générale des bijoux ni sur un état passé du site.

Les origines des pierres figurent dans les filtres (ambre de la mer Baltique) : c''est là que le texte les prend, jamais de mémoire.

Interdiction d''inventer : matière, pierre, dimension, certification, origine, prix, délai. Un fait absent de la page scrapée et de ce document ne s''écrit pas.

## 3. Ce qu''on a le droit de mettre en avant (pool fermé)

Seuls ces arguments peuvent être mis en avant, tous vérifiés sur le site. Le choix, le dosage et la rotation d''une catégorie à l''autre relèvent de l''outil : répéter les mêmes atouts partout crée du contenu quasi dupliqué.

**Tier 1 — prioritaires**
- Certificat d''authenticité avec chaque bijou
- Argent 925 massif, pierres 100 % naturelles, jamais de synthétique
- Livraison offerte en France dès 50 €
- Plus de 1300 avis clients
- 30 jours pour changer d''avis, retour ou échange
- Savoir-faire artisanal

**Tier 2**
- Paiement en 3 fois dès 50 € ; paiement sécurisé (CB, PayPal, Apple Pay, Klarna)
- Livraison internationale
- Maison spécialisée depuis 1973
- Normes UE et REACH ; bijoux poinçonnés ; hypoallergéniques

Précisions :
- L''ambre véritable de la mer Baltique : autorisé quand la page de la catégorie le confirme.
- Ne jamais affirmer que les pierres sont d''origine européenne : leur origine réelle est celle des filtres.
- Adresse, showroom, coordonnées : jamais dans un texte de catégorie.

## 4. Interdits (non négociables)

| Interdit | À la place |
| --- | --- |
| Vocabulaire B2B (grossiste, en gros, revendeur, prix pro, lot) | Registre client final : « votre bijou », « offrir », « porter » |
| Superlatifs creux (inégalé, le meilleur, exceptionnel) | Faits concrets — argent 925, certificat, 30 jours — et évocation sensorielle sobre |
| Promesses invérifiables (bienfaits santé, « qualité inégalée ») | Description du produit réel |
| « luxe », « haut de gamme », « pierres précieuses » | « bijoux ornés de pierres naturelles », « qualité maîtrisée », « design raffiné » |
| Guillemets dans le texte ; nom de catégorie en Majuscules | Nom en minuscules, intégré avec des prépositions |
| Émoji, tiret cadratin | Ponctuation simple |

**Lithothérapie (règle stricte)** : les bienfaits ne sont JAMAIS affirmés. Vocabulaire imposé : « potentiels bienfaits », « réputé pour ». Chaque texte qui évoque la lithothérapie contient un disclaimer explicite, par exemple : ces propriétés relèvent de croyances traditionnelles et ne sont pas scientifiquement prouvées. Pour les produits bébé et enfant, le disclaimer est obligatoire et renforcé.

**Bijoux bébé et enfant (catégories très sensibles)** : aucun bienfait n''est JAMAIS affirmé (poussées dentaires, apaisement…). Le disclaimer « non prouvé » est obligatoire et renforcé. Ne jamais présenter le bijou comme un dispositif médical, un remède ou une solution aux poussées dentaires. Chaque texte de catégorie bébé ou enfant contient un rappel de sécurité : port sous la surveillance d''un adulte, jamais pendant le sommeil ni sans surveillance. On rassure par les faits — matières, normes, certificat — jamais par des promesses.

**Sécurité produit bébé (faits validés, conformes aux normes exigées)** — les bijoux bébé sont distincts des bijoux enfant. Les textes des catégories bébé PEUVENT et DOIVENT mettre en avant ces faits, tels quels et sans rien y ajouter :
- les colliers bébé ont un fermoir à clip qui se détache sous tension pour éviter tout risque de strangulation ;
- les bracelets bébé ont une attache à vis, sans risque particulier ;
- chaque perle est nouée individuellement, collier comme bracelet, de sorte que les billes ne s''éparpillent pas si le bijou venait à se rompre.

Ces attaches ne concernent que les bijoux bébé : ne pas les affirmer sur les catégories enfant.

**Référentiel matières** (comment les nommer quand la page les confirme) : « argent 925 rhodié » ; « argent doré » = argent 925 doré à 0,5 micron d''or, JAMAIS « plaqué or » (autre procédé, la confusion est interdite) ; et les bijoux tout ambre, bracelets et colliers entièrement en ambre. Pas de bijoux en or sur ce site : ne jamais mentionner l''or 18 carats ni l''or 750, il n''existe que sur le site B2B. Tous les bijoux sont poinçonnés et conformes aux normes : fait affirmable dans tout texte.

**Terminologie matières** : l''ambre n''est pas une pierre, c''est une résine fossile. Ne jamais écrire « pierre d''ambre » ni classer l''ambre parmi les pierres naturelles : ce sont deux univers distincts du catalogue (bijoux en ambre / bijoux en pierres naturelles). On vend des bijoux, pas des pierres : « bijou en ambre » et non « ambre » ; « collier en ambre pour femme » et non « collier ambre femme » — les intitulés bruts se réécrivent avec des prépositions. Respecter le genre grammatical de la pierre : le grenat, la turquoise ; forme neutre si inconnu.

## 5. SEO — ce que la catégorie doit porter

La catégorie cible l''intention d''achat grand public, transactionnelle ou commerciale, jamais purement informationnelle : « collier en ambre véritable », « bijoux en pierres naturelles pour femme ». Jamais les requêtes professionnelles, elles appartiennent au site B2B.

Le nom de la catégorie s''intègre plusieurs fois, de façon fluide et naturelle, avec des prépositions. Travailler le champ lexical sans suroptimisation : pas de bourrage de mots-clés, pas de répétitions inutiles.

**Cohérence stricte mot-clé / catégorie** : un mot-clé qui ne correspond pas à l''intention de la page n''y entre pas. Ne pas parler de pierres naturelles dans une catégorie argent générique. C''est le pendant SEO de la règle des filtres (section 2).

**Interdiction du contenu dupliqué entre catégories** : chaque texte doit se différencier de sa catégorie mère et de ses catégories sœurs — angle, vocabulaire, atouts choisis. Deux textes interchangeables où seul le nom de la catégorie change sont un échec. Le fichier catalogue fournit l''arborescence complète (id_parent) : l''outil doit connaître la famille de chaque catégorie — mère, sœurs, filles — au moment de rédiger, et s''en servir pour différencier.

Texte prêt à l''emploi : pas de titre « Description : », pas de remarque finale, pas de méta-discours. Si une FAQ est incluse : question en titre, réponse autoportante qui commence par la réponse.

## 6. Les deux livrables par catégorie

**Description COURTE (haut de page)**
- Rôle : présenter l''univers de la catégorie et ses atouts.
- Contrainte métier : nom de catégorie intégré naturellement.

**Description LONGUE (bas de page)**
- Rôle : approfondir — sous-catégories et matières présentes sur la page, contextes d''usage (offrir, porter au quotidien, événements), différenciation, FAQ éventuelle, conclusion douce invitant à explorer la catégorie.
- Contrainte métier : ne lister que ce que la page scrapée confirme.

Longueurs, structure HTML et format relèvent de l''expertise de l''outil. Les contraintes ci-dessus et les règles des sections 1 à 5 sont les seules limites métier.

## 7. Entrée de l''outil

- Liste des catégories : fichier `catalogue_lamaison_de_lambre.csv`, catégories actives uniquement, 5 langues — id, nom, URL, description et informations complémentaires existantes par langue.
- Données produit : scrapées en direct sur chaque URL — nom affiché, fil d''Ariane, filtres de la page (types de bijoux, matières, pierres, couleurs, origines, publics), contenu existant.

Toute entité produit citée dans le texte doit exister sur la page scrapée (section 2). Les faits d''entreprise — atouts, chiffres — viennent exclusivement de la section 3 de ce document.

## 8. Multilingue

5 langues actives : fr, en, es, de, it — les colonnes du fichier catalogue. Le texte se rédige dans la langue cible, ce n''est pas une traduction littérale du français. Toutes les règles de ce document s''appliquent dans chaque langue. Le nom de catégorie intégré est celui de la langue cible, colonne `name_xx`.')
on conflict (id) do update set
  name = excluded.name, domain = excluded.domain, market = excluded.market,
  business_rules = excluded.business_rules, updated_at = now();

