-- Opalook — catégories 47 à 92 sur 182
-- Généré pour la reprise de la base sur un autre projet Supabase.
-- Prérequis : avoir joué schema.sql, et s'être connecté une fois à l'app pour
-- que le compte existe dans auth.users.
-- Rejouable : les conflits mettent à jour, ils ne dupliquent pas.

insert into public.categories (
  project_id, url, name, external_id, parent_external_id, products_count,
  catalog_short_description, catalog_long_description,
  target_keyword, keyword_volume, keyword_difficulty, keyword_intent, keyword_data_at
) values
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/57-bijoux-amazonite', 'Bijoux amazonite', 57, 12, 14, 'Bienvenue chez Opalook, votre partenaire expert pour les bijoux en amazonite. Dans notre catégorie dédiée aux bijoux en amazonite, vous trouverez des pièces uniques et authentiques, reflétant 180 ans de tradition joaillière. En tant que grossiste de bijoux en pierre naturelle, notre objectif est de vous offrir la meilleure qualité à des prix compétitifs. Avec plus de 2000 bijoux disponibles en stock, nous garantissons une expédition sous 24H/48H et fournissons un certificat d’authenticité pour chaque bijou. Explorez notre collection de bijoux en amazonite et faites découvrir à vos clients le charme intemporel de cette pierre naturelle exceptionnelle. Opalook, c''est l''assurance de qualité, de disponibilité et de confiance pour tous vos besoins en bijoux amazonite.', null, 'bijoux amazonite', 390, 11, 'Informational', now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/58-bijoux-agate', 'Bijoux agate', 58, 12, 65, 'Chez Opalook, votre grossiste expert en bijoux avec pierre naturelle, nous sommes fiers de vous présenter notre collection exclusive de bijoux en agate. Plongez dans l''univers unique des bijoux agate, connus pour leur beauté intemporelle et leurs propriétés naturelles exceptionnelles. Avec plus de 2000 bijoux en stock, une qualité incomparable, et des prix compétitifs, nous vous offrons une solution clé en main pour vos besoins de réassort rapide. Nos bijoux agate, fabriqués avec passion et 180 ans d''expertise, sauront séduire vos clients finaux. Profitez d''une expédition sous 24h/48h et de certificats d’authenticité pour chaque pièce, garantissant l''origine et la qualité de nos créations. Opalook, c''est la garantie d''une offre de bijoux en agate qui enrichira votre catalogue et fidélisera votre clientèle.', null, 'bijoux agate', 140, 18, 'Informational', now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/59-bijoux-amethyste', 'Bijoux améthyste', 59, 12, 162, 'Chez Opalook, nous partageons avec vous notre passion et notre expertise de 180 ans à travers notre collection de bijoux en améthyste. Spécialement sélectionnés pour les professionnels et les revendeurs, nos bijoux en améthyste incarnent la qualité et l''authenticité incomparables que vous attendez. En tant que grossiste de bijoux en pierre naturelle, nous vous garantissons une disponibilité exceptionnelle, des prix compétitifs et une expédition rapide sous 24/48H. Faites confiance à Opalook pour enrichir votre offre avec des bijoux en améthyste uniques, tous accompagnés de leur certificat d’authenticité. Apportez à vos clients la beauté brute de la nature, magnifiée par notre savoir-faire familial.', null, 'bijoux amethyste', 1000, 17, 'Informational', now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/60-bijoux-aventurine', 'Bijoux aventurine', 60, 12, 47, 'Chez Opalook, fort de 180 ans d''expérience et d''une expertise reconnue depuis 30 ans en France, nous sommes fiers de vous présenter notre catégorie de bijoux aventurine. Nos bijoux aventurine, issus de pierres naturelles authentiques, sont des pièces uniques qui sauront séduire vos clients finaux par leur éclat et leur beauté. En tant que professionnels, vous bénéficiez de notre large stock de plus de 2000 bijoux, disponibles à des prix compétitifs et expédiables sous 24/48h. Avec Opalook, grossiste de confiance, vous pouvez compter sur la qualité inégalée de nos bijoux aventurine, tous accompagnés d''un certificat d''authenticité, pour enrichir l''offre de votre boutique. Démocratisez la beauté de la nature avec Opalook, spécialiste des bijoux en pierres naturelles.', null, 'bijoux aventurine', 260, 15, 'Commercial', now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/61-bijoux-calcedoine', 'Bijoux calcédoine', 61, 12, 32, 'Chez Opalook, nous vous offrons une sélection exclusive de bijoux en calcédoine que vous ne trouverez nulle part ailleurs. En tant que spécialistes de la distribution de bijoux en pierre naturelle, nous nous engageons à fournir des pièces authentiques et uniques, issues de notre savoir-faire de plus de 180 ans. Optez pour notre gamme de bijoux calcédoine et émerveillez vos clients avec des créations raffinées. Grâce à notre stock important et à nos prix compétitifs, nous vous garantissons une disponibilité immédiate et une expédition sous 24/48h. Faites confiance à notre expertise et enrichissez votre assortiment avec les bijoux calcédoine d’Opalook pour séduire et captiver votre clientèle.', null, 'bijoux calcedoine', 30, null, null, now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/62-bijoux-grenat', 'Bijoux grenat', 62, 12, 13, 'Chez Opalook, nous vous proposons une collection exceptionnelle de bijoux en grenat, conçue spécialement pour répondre aux attentes des professionnels. En tant que grossiste de bijoux en pierre naturelle, notre expertise de plus de 180 ans se reflète dans chaque pièce de bijoux grenat, garantissant authenticité et singularité. Avec plus de 2000 bijoux en stock, des prix compétitifs et une expédition sous 24/48h, nous vous assurons une qualité inégalée. Faites confiance à notre certificat d’authenticité pour valoriser vos ventes. Rejoignez Opalook et laissez-nous démocratiser la beauté des bijoux grenat auprès de votre clientèle.', null, 'bijoux grenat', 480, 11, 'Informational', now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/63-grossiste-bijoux-labradorite', 'Bijoux labradorite', 63, 12, 53, 'Chez Opalook, nous sommes fiers de vous présenter notre somptueuse catégorie de bijoux labradorite, un véritable hommage à la beauté naturelle. En tant que grossiste de bijoux en pierre naturelle pour les professionnels, nous mettons à votre disposition une large gamme de bijoux labradorite, conçus pour captiver l''attention de votre clientèle finale. Forte de 180 ans d''expérience, notre entreprise familiale franco-polonaise excelle depuis plus de 30 ans sur le marché français, offrant des pièces uniques et authentiques. Nos bijoux labradorite sont disponibles en plus de 2000 variations, garantissant une haute disponibilité en stock et des prix compétitifs. Grâce à notre expertise, chaque bijou est accompagné d''un certificat d''authenticité, et nous assurons une expédition rapide sous 24H/48H. Choisissez Opalook pour démocratiser et partager la beauté des bijoux labradorite avec vos clients professionnels.', null, 'grossiste bijoux labradorite', 20, null, null, now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/64-bijoux-lapis-lazuli', 'Bijoux lapis lazuli', 64, 12, 30, 'Chez Opalook, nous sommes fiers de vous présenter notre catégorie de bijoux lapis lazuli, une sélection soigneusement curée pour les revendeurs professionnels. Forte de 180 ans d''expertise, dont 30 ans sur le marché français, notre entreprise familiale francopolonaise s''engage à offrir des bijoux en lapis lazuli d''une qualité inégalée. Ces pièces authentiques, véritable reflet de la beauté naturelle, sont disponibles en gros et accompagnées de certificats d''authenticité. Avec plus de 2000 bijoux en stock et une expédition sous 24 à 48 heures, Opalook assure des prix compétitifs et un service irréprochable. Explorez notre collection de bijoux lapis lazuli et enrichissez votre offre avec l''assurance d''une qualité supérieure et d''une disponibilité immédiate pour vos clients finaux.', null, 'bijoux lapis lazuli', 390, 19, 'Informational', now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/65-bijoux-multipierres', 'Bijoux multipierres', 65, 12, 279, 'Chez Opalook, nous sommes fiers de vous présenter notre collection de bijoux multipierres, conçue spécifiquement pour les professionnels du secteur. Plongez dans cet univers unique où chaque bijou multipierres est une véritable œuvre d''art, combinant des pierres naturelles soigneusement sélectionnées. Forte de 180 ans d''expertise, notre entreprise familiale franco-polonaise s''engage à offrir des pièces authentiques et uniques. Avec plus de 2000 bijoux disponibles et des expéditions rapides sous 24H/48h, nous garantissons qualité et compétitivité. Optez pour nos bijoux multipierres pour séduire vos clients exigeants, tout en bénéficiant de certificats d’authenticité qui valorisent chaque pièce. Faites confiance à Opalook, votre partenaire de choix pour des bijoux en pierres naturelles incomparables.', null, 'bijoux multipierres', 10, null, null, now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/66-bijoux-pierre-de-lune', 'Bijoux pierre de lune', 66, 12, 45, 'Bienvenue dans l''univers envoûtant des bijoux pierre de lune chez Opalook. Forts de 180 ans d''histoire et 30 ans d''expertise sur le marché français, nous sommes vos partenaires privilégiés dans la distribution de bijoux pierre de lune pour les professionnels. Chaque bijou en pierre de lune est une pièce authentique et unique, capturant l''essence de la beauté naturelle. Avec plus de 2000 références en stock, une qualité inégalée, et des prix compétitifs, nous vous garantissons une disponibilité immédiate et une expédition sous 24H/48H. En tant que grossiste expert, nous offrons des certificats d''authenticité pour chaque bijou en pierre de lune, assurant à vos clients finaux une confiance totale. Rejoignez Opalook et partagez la splendeur des bijoux pierre de lune avec votre clientèle.', null, 'bijoux pierre de lune', null, null, null, now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/67-bijoux-quartz', 'Bijoux quartz', 67, 12, 133, 'Bienvenue dans notre catégorie de bijoux quartz, où Opalook met à votre disposition une collection raffinée de bijoux en quartz dédiés aux professionnels et aux revendeurs. En tant qu''expert grossiste spécialisé dans les bijoux en pierre naturelle, nous sommes fiers de notre héritage francopolonais et de nos 180 ans d''expérience, avec une présence de 30 ans sur le marché français. Offrez à vos clients des pièces authentiques et uniques, issues de notre savoir-faire. Grâce à notre stock de plus de 2000 bijoux en quartz, nous garantissons une disponibilité élevée, des prix compétitifs et une qualité inégalée, avec expédition en 24-48h et certificats d’authenticité pour chaque pièce. Opalook, partenaire de confiance pour tous vos besoins en bijoux quartz, se consacre à démocratiser la beauté naturelle auprès de votre clientèle.', null, 'bijoux quartz', 90, 13, 'Informational', now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/68-bijoux-turquoise', 'Bijoux turquoise (reconstitué)', 68, 12, 36, 'Chez Opalook, nous sommes fiers de vous présenter notre gamme exceptionnelle de bijoux en turquoise reconstitué, spécialement conçue pour les revendeurs professionnels. En tant que grossiste de bijoux en pierres naturelles, nous mettons notre expertise de plus de 180 ans à votre service pour vous offrir des pièces authentiques et uniques. Nos bijoux en turquoise reconstitué sont le fruit d''un assemblage minutieux de morceaux de turquoise naturelle, garantissant une qualité inégalée et une beauté sans pareille. Chaque bijou en turquoise reconstitué est accompagné d''un certificat d''authenticité, assurant à vos clients finaux une acquisition prestigieuse et authentique. Découvrez dès maintenant notre collection de bijoux en turquoise reconstitué et faites rayonner la beauté naturelle auprès de votre clientèle.', null, 'bijoux turquoise', 720, 14, 'Informational', now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/69-bijoux-jaspe', 'Bijoux jaspe', 69, 12, 4, 'Bienvenue chez Opalook, votre grossiste de confiance en bijoux en pierre naturelle. Découvrez notre collection de bijoux jaspe, conçue spécialement pour les revendeurs professionnels. Nos bijoux jaspe reflètent notre héritage de 180 ans d''expertise et notre passion pour la beauté naturelle. Chaque pièce, authentique et unique, est un témoignage de notre savoir-faire. Avec plus de 2000 bijoux en stock, des prix compétitifs, et une expédition rapide sous 24/48h, Opalook est votre partenaire idéal. Profitez d’un certificat d''authenticité pour chaque bijou jaspe. Rejoignez-nous pour partager l''élégance naturelle du jaspe avec vos clients.', null, 'bijoux jaspe', 50, null, null, now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/70-bijoux-onyx', 'Bijoux onyx', 70, 12, 44, 'Bienvenue dans l''univers sophistiqué de nos bijoux en onyx chez Opalook! En tant que grossiste de bijoux en pierre naturelle, nous mettons à votre disposition, professionnels et revendeurs, une collection de bijoux en onyx unique et authentique, idéale pour séduire une clientèle exigeante. Forts de 180 ans d''expérience, nous garantissons à chaque bijou en onyx une qualité inégalée et des prix compétitifs. Avec plus de 2000 références disponibles en stock, nous expédions sous 24/48h et fournissons un certificat d''authenticité. Découvrez le charme intemporel des bijoux en onyx et faites confiance à notre expertise pour enrichir votre offre !', null, 'bijoux onyx', 210, 17, 'Informational', now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/71-grossiste-bijoux-nacre', 'Bijoux nacre', 71, 12, 7, 'Chez Opalook, nous vous proposons une sélection exceptionnelle de bijoux en nacre, conçue spécialement pour les professionnels et revendeurs. Plongez dans l''univers fascinant des bijoux en nacre, où chaque pièce incarne notre savoir-faire de plus de 180 ans dans le domaine des pierres naturelles. Notre expertise vous garantit des bijoux en nacre authentiques et uniques, alliant beauté et qualité inégalée. Avec une disponibilité de plus de 2000 bijoux en stock et une expédition sous 24H/48H, Opalook facilite vos commandes instantanées à des prix compétitifs. Faites confiance à Opalook pour enrichir votre offre de bijoux en nacre authentifiés, et partager la beauté naturelle avec vos clients finaux.', null, 'grossiste bijoux nacre', 40, null, null, now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/570-bijoux-pierre-naturelle-et-argent-dore', 'Bijoux pierre naturelle et argent doré', 570, 12, 113, 'Chez Opalook, nous sommes fiers de vous présenter notre catégorie de bijoux en pierre naturelle et argent doré. En tant que grossiste de bijoux en pierre naturelle pour les professionnels, nous mettons à votre disposition une collection unique qui allie la beauté brute des pierres naturelles à l''élégance de l''argent doré. Forte de 180 ans d''expérience, notre entreprise familiale francopolonaise s''engage à vous offrir des bijoux en pierre naturelle et argent doré de qualité inégalée. Avec plus de 2000 références, une haute disponibilité en stock et des prix compétitifs, nous garantissons une expédition sous 24H/48H. Chaque bijou en pierre naturelle et argent doré est accompagné d''un certificat d''authenticité, assurant à vos clients finaux une confiance absolue. Opalook, votre expert en bijoux en pierre naturelle et argent doré, est là pour sublimer vos collections et satisfaire vos clients.', null, null, null, null, null, null),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/13-grossiste-bijoux-revendeur-professionnel', 'Grossiste bijoux pour revendeur & professionnel', 13, null, 2110, 'Vous cherchez un grossiste bijoux pour revendeur fiable et rentable ? Opalook est le fournisseur bijoux professionnel privilégié des bijouteries, boutiques et e-commerçants en Europe. Spécialiste de l'' argent 925 rhodié , du plaqué or et de l'' or 18 carats (750) , nous proposons aux professionnels un catalogue de plus de 2000 références sans minimum de commande . Maximisez vos marges commerciales et diversifiez vos vitrines avec des stocks expédiés sous 24h/48h depuis la France. Contrairement aux grossistes traditionnels d''Aubervilliers ou de la rue du Temple à Paris, Opalook centralise son approvisionnement pour vous garantir une disponibilité immédiate, des prix transparents et une logistique simplifiée.', 'Nos collections de bijoux en gros pour votre boutique 

 En tant que  fournisseur bijoux professionnel , Opalook propose des  assortiments  adaptés aux besoins réels des revendeurs : rotation rapide, forte valeur perçue et coefficient multiplicateur attractif. Nos gammes couvrent l''ensemble des segments, du  bijou fantaisie tendance  aux  créations en or massif .

 Argent 925 & Plaqué Or : L''alternative premium à l''acier inoxydable 

 Pourquoi privilégier l''Argent rhodié plutôt que l''acier pour votre commerce ? La réponse tient en un mot :  rentabilité . L''argent 925/1000 possède une valeur intrinsèque reconnue par votre clientèle, là où l''acier inoxydable souffre d''une image "bas de gamme".

 
 Argent rhodié 925 : Traitement anti-oxydation qui garantit un éclat durable sans entretien particulier. Votre client paie pour un métal précieux, pas pour un alliage industriel.

 Argent plaqué or (0,5 micron) : Le rendu visuel de l''or à un coût d''achat maîtrisé pour le revendeur. Idéal pour les collections saisonnières et les cadeaux.

 Or 750/1000 (18 carats) : Pour les boutiques positionnées haut de gamme, nos créations en or massif permettent de cibler une clientèle exigeante avec des marges substantielles .

 
 💡 Conseil d''expert : Un bracelet argent acheté 12€ HT se revend couramment 39€ TTC en boutique physique. Avec l''acier, ce coefficient multiplicateur est difficilement justifiable face au consommateur averti.

 📌  Poinçons d''importateur  et  certificats d''authenticité  systématiques pour rassurer vos clients finaux sur la composition exacte.

 Bijoux pierres naturelles & ambre : Surfer sur la tendance lithothérapie 

 Le marché des bijoux en pierres naturelle et de la lithothérapie  explose. Vos clients ne cherchent plus seulement un bijou, ils recherchent un  objet de sens  aux vertus énergétiques reconnues. Nos collections intègrent :

 
 Ambre de la Mer Baltique : Matière noble certifiée, prisée pour ses propriétés apaisantes. Parfait pour les bracelets et colliers à forte valeur ajoutée.

 Quartz rose, améthyste, turquoise, opale : Pierres semi-précieuses sélectionnées pour leur qualité gemme et leur popularité en boutique.

 Oxydes de zirconium : Pour les finitions brillantes à moindre coût, tout en conservant un rendu haut de gamme.

 
 ⚠️ Attention : Nos pierres sont fournies avec leur origine géographique (Baltique, Inde, Afrique) et leur certificat d''authenticité. Un argument de vente décisif face aux copies synthétiques du marché.

 
 Bijoux fantaisie & accessoires mode 

 Notre gamme de grossiste bijoux fantaisie couvre les styles bohème, minimaliste et ethnique. Pour les revendeurs ciblant une clientèle jeune  (18-35 ans) et sensible aux micro-tendances, notre gamme fantaisie propose :

 
 Styles bohème et minimalistes  : Bracelets multi-rangs, boucles d''oreilles créoles fines.

 Inspiration ethnique et vintage  : Bijoux anciens en argent rhodié vieilli, motifs géométriques.

 Piercings argent 925  : Hélix, tragus, cartilage. Matériaux  hypoallergéniques  conformes aux normes européennes, segment en forte croissance chez les 16-30 ans.

 
 📌  Rotation de stock optimale  : Ces produits se renouvellent chaque saison pour coller aux tendances Instagram et TikTok.

 
 Rentabilité & avantages pour le revendeur : pourquoi Opalook maximise votre marge commerciale 

 Pourquoi l''argent 925 optimise votre coefficient multiplicateur ? 

 Un  grossiste bijoux  ne se choisit pas uniquement sur le prix d''achat unitaire, mais sur la  marge nette  qu''il vous permet de dégager. Voici le calcul que font vos concurrents qui réussissent :

 
 
 
 Type de bijou 
 Coût d''achat HT 
 PVC TTC conseillé 
 Marge brute 
 Coefficient 
 
 
 
 
 Bague argent rhodié 
 8€ 
 29€ 
 21€ 
 x3,6 
 
 
 Bracelet plaqué or 
 14€ 
 49€ 
 35€ 
 x3,5 
 
 
 Collier ambre certifié 
 22€ 
 89€ 
 67€ 
 x4 
 
 
 Boucles acier inox (concurrent) 
 3€ 
 12€ 
 9€ 
 x4 mais perception low-cost 
 
 
 
 Le verdict ? L''argent 925 justifie un  prix de vente conseillé  3 à 4 fois supérieur à votre coût d''achat, tout en rassurant le client final sur la valeur réelle du produit. L''acier, même avec un coefficient x4, reste perçu comme un "bijou fantaisie jetable".

 💡 Conseil d''expert : En boutique physique, l''argument "argent véritable poinçonné" convertit 40% mieux qu''un bijou acier au design similaire.

 Zéro Risque : Le concept "Sans minimum de commande" 

 Stock mort = cash immobilisé.  Contrairement aux grossistes traditionnels qui imposent des  lots de 50 ou 100 pièces , Opalook fonctionne à l''unité. Vous testez un modèle, vous le vendez, vous recommandez.

 Vos avantages concrets :

 
 Trésorerie préservée : Pas besoin d''immobiliser 2000€ pour découvrir une nouvelle collection.

 Agilité commerciale : Vous ajustez votre vitrine chaque semaine en fonction des ventes réelles.

 
 📌 Pour en savoir plus sur nos conditions,  créez votre compte professionnel gratuitement .

 Services complémentaires pour booster votre rentabilité 

 
 Emballages et présentoirs professionnels  : Écrins cadeaux, pochettes velours, bustes pour boucles d''oreilles. Disponibles en lot ou à l''unité.

 Contenu photo prêt à l''emploi  : Visuels HD et fiches produits optimisées pour votre site e-commerce (sur demande pour les comptes actifs).

 Réassort express  : Commande validée aujourd''hui, expédiée demain. Colissimo, UPS ou lettre suivie selon votre urgence.

 
 
 Comparatif : Opalook vs Grossistes Paris/Aubervilliers 

 Le Modèle rue du Temple à Paris : avantages et limites 

 La  rue du Temple  et le quartier d''Aubervilliers concentrent des dizaines de  grossistes bijoux  historiques. Le système : vous vous déplacez, vous négociez en face-à-face, vous repartez avec vos achats.

 Leurs points forts :

 
 Contact humain direct : Possibilité de toucher les produits, de négocier les tarifs sur volume.

 Sourcing multi-fournisseurs : Certaines plateformes comme eFashion Paris agrègent plusieurs marques (pratique pour comparer).

 
 Leurs limites :

 
 Déplacement obligatoire : Si vous êtes à Lyon, Marseille ou en Belgique, impossible de passer commande le dimanche soir.

 Stock fragmenté : Acheter chez 5 grossistes différents = 5 factures, 5 délais de livraison, 5 interlocuteurs SAV.

 Transparence tarifaire limitée : Les prix varient selon votre capacité de négociation. Difficile de budgétiser précisément.

 
 La solution Opalook : Showroom + E-commerce 

 Le meilleur des deux mondes. Nous sommes fournisseur de bijoux en gros et disposons d''un showroom à Paris  (sur rendez-vous, comme les professionnels d''Aubervilliers), mais notre force réside dans notre  plateforme en ligne centralisée  :

 ✅ Tarifs publics affichés : Pas de négociation opaque. Vous connaissez vos marges avant de commander.

 ✅ Commande 24h/24 : Votre boutique vend un bracelet améthyste un samedi ? Vous le recommandez immédiatement depuis votre smartphone.

 ✅ Expédition unifiée : Un seul colis, un seul transporteur, un seul SAV. Tout part de notre entrepôt central en France.

 ✅ Frais de port optimisés : Transport gratuit à l''international selon paliers. Pas besoin de "regrouper" vos achats chez plusieurs fournisseurs.

 📌 Notre showroom parisien reste ouvert pour les professionnels souhaitant découvrir les collections en personne. Contactez-nous pour prendre rendez-vous.

 
 Gammes détaillées pour professionnels 

 Grossiste boucles d''oreilles 

 Large sélection pour  femmes, hommes et enfants  :

 
 Créoles argent rhodié  : Du modèle minimaliste 10mm au modèle XXL 50mm.

 Puces et clous  : Pierres naturelles serties (améthyste, quartz rose) ou oxydes de zirconium pour l''éclat diamant.

 Pendantes et dormeuses  : Idéales pour les collections soirée et mariage.

 
 📌 Voir toute la gamme de boucles d''oreilles pour revendeurs 

 Grossiste colliers & chaînes 

 
 Colliers fins et sautoirs  : Argent ou argent doré, maille forçat, gourmette ou vénitienne.

 Colliers à perles naturelles  : Ambre, turquoise, quartz. Segment lithothérapie en forte demande.

 Symboles iconiques  : Arbre de vie, fleur de vie, croix, cœur, main de Fatma.

 
 📌 Nos colliers s''associent parfaitement avec nos  pendentifs disponibles séparément . 

 Grossiste bracelets 

 
 Bracelets chaîne  : Maille gourmette, maille serpent, maille boule.

 Bracelets rigides (joncs)  : Argent martelé, modèles gravés, finitions vintage.

 Bracelets pierres naturelles  : Ambre, œil de tigre, pierre de lave. Clientèle masculine et féminine.

 
 Grossiste bagues 

 
 Bagues solitaires  : Argent rhodié avec oxyde de zirconium central (effet diamant).

 Chevalières homme  : Argent massif, gravure personnalisable sur demande (MOQ).

 Bagues symboles  : Arbre de vie, serpent, tête de mort, motifs floraux.

 
 📌  Disponibles en plusieurs tailles  (48 à 64) pour limiter les retours client.

 Grossiste pendentifs 

 Plus de 300 modèles en stock permanent :

 
 Pendentifs géométriques  : Cercle, triangle, losange. Style minimaliste tendance.

 Pendentifs spirituels  : Croix, main de Fatma, œil d''Horus, Bouddha.

 Pendentifs animaliers  : Papillon, libellule, éléphant, tortue.

 
 📌  Livrés avec chaîne assortie  (40, 45 ou 50 cm) pour une commercialisation immédiate.

 Grossiste piercings Oreille 

 Segment en  forte croissance  chez les 16-30 ans :

 
 Hélix et tragus : Argent 925 hypoallergénique avec mini-pierre naturelle.

 Piercing cartilage : Modèles fin ou épais, avec ou sans pendentif.

 
 ⚠️ Conformité garantie : Tous nos piercings respectent la directive européenne 94/27/CE sur les métaux au contact de la peau.

 
 Services logistiques & marque blanche (OEM) 

 Expédition professionnelle rapide 

 Délais standards : 

 
 France métropolitaine  : 24h/48h via Colissimo Entreprise.

 Europe  : 2 à 5 jours ouvrés via UPS, Colissimo ou Delivengo.

 International  : 3 à 10 jours via UPS, Colissimo ou Delivengo.

 
 Frais de port : 

 
 Gratuits à l''international  selon paliers (100€, 300€, 500€ selon destination).

 Express UPS disponible  : Supplément pour livraison garantie 24/48h.

 
 📌 Consultez nos  conditions de livraison détaillées  pour connaître les paliers exacts selon votre pays.

 Programme marque blanche (White Label) 

 Vous souhaitez commercialiser nos bijoux  sous votre propre enseigne  ? Opalook propose des solutions OEM adaptées :

 
 Packaging sur-mesure  : Pochettes aux couleurs de votre marque, écrins brandés (MOQ 40).

 Production sur demande : vous avez des idées de bijoux que nous ne proposons pas ? Nous pouvons réaliser et chiffrer votre projet.

 
 📌  Créateurs et concept stores  : contactez notre équipe commerciale pour un devis personnalisé. Délai de production : 3 à 8 semaines.

 
 Pourquoi +3000 points de vente nous font confiance 

 Qualité & traçabilité 

 
 Poinçons systématiques  : 925 pour l''argent, 750 pour l''or, poinçon d''importateur et de matière sur chaque pièce.

 Certificats d''authenticité  : Fournis pour l''ambre baltique et les pierres naturelles sur demande.

 Contrôle qualité triple  : À la fabrication, à la réception entrepôt, avant expédition client.

 
 Réactivité commerciale 

 
 SAV dédié B2B : Une équipe formée aux problématiques des revendeurs (pas de standard téléphonique générique).

 Garantie fabricant 1 an : Échange gratuit en cas de vice de fabrication constaté (fermoir défectueux, oxydation anormale).

 Réassort prédictif : Nos best-sellers (ex : bague arbre de vie argent rhodié) sont toujours en stock grâce à notre gestion de flux tendu.

 
 
 💡 Témoignage revendeur : "Avec Opalook, je ne tombe jamais en rupture sur mes produits phares. Le réassort se fait en 48h, mes clientes n''attendent jamais plus d''une semaine." – Juliette M., bijouterie.

 
 Accompagnement business 

 
 Conseils merchandising : Quelles références mettre en vitrine selon la saison ? Notre équipe partage les données de vente agrégées.

 Formations produits : newsletters sur les pierres naturelles, l''entretien de l''argent, les arguments de vente lithothérapie.

 
 
 Salons professionnels & showroom 

 Où rencontrer Opalook ? 

 Nous participons aux principaux  salons de la bijouterie en France :

 
 Bijorhca Paris  (Porte de Versailles) : Janvier & Septembre.

 Rennes HBJO : Mars

 Sainte marie aux mines : Juin

 
 📌  Réservez votre badge visiteur gratuit  en nous contactant avant le salon. Profitez d''offres de lancement exclusives sur les nouveautés.

 Showroom Paris (Sur Rendez-vous) 

 Notre espace professionnel parisien vous accueille  du lundi au vendredi, 10h-17h . Services proposés :

 
 Découverte catalogue complet : Plus de 500 références en exposition physique.

 Conseils personnalisés : Un expert analyse votre positionnement et vous recommande les gammes les plus rentables.

 Commande sur place : Repartez avec un échantillonnage si besoin (facturation classique, pas de surcoût).

 
 📌 Prise de rendez-vous obligatoire via notre formulaire de contact ou par téléphone.

 
 FAQ complète – Tout savoir sur Opalook, votre grossiste bijoux pour revendeur 

 Y a-t-il un minimum d''achat pour commander ? 

 Non, aucun minimum.  Contrairement aux grossistes traditionnels qui imposent des lots de 50 pièces ou des paliers à 500€, Opalook fonctionne à l''unité. Commandez 1 bague pour tester, ou 200 bracelets pour un réassort massif.

 📌 Idéal pour les  boutiques en ligne  qui démarrent ou les créateurs testant une nouvelle collection.

 Quels sont les délais de livraison réels ? 

 
 France  : Expédition sous 24h, réception 48h après validation (Colissimo Entreprise).

 Belgique, Luxembourg, Allemagne  : 2-3 jours ouvrés (UPS Standard).

 Espagne, Italie, Portugal  : 3-5 jours ouvrés.

 Reste de l''Europe  : 5-7 jours.

 International (hors UE)  : 7-10 jours via Ups ou Colissimo.

 
 Option Express UPS : Livraison express dans le monde entier.

 📌 Suivez votre colis en temps réel via votre compte client.

 Comment fonctionnent les moyens de paiement B2B ? 

 Nous acceptons :

 
 Carte bancaire  (Visa, Mastercard, Amex) : Paiement instantané sécurisé 3D Secure.

 Paiement locaux : paypal, appl pay, virement…

 Paiement fractionné 3x ou 4x et différé 30 jours  : Via notre partenaire Klarna (validation automatique selon scoring).

 
 
 💡 Astuce trésorerie : Le paiement différé vous permet de vendre vos bijoux avant de nous régler.

 
 Puis-je personnaliser les bijoux avec ma marque ? 

 Oui, via notre programme OEM (White Label). Services disponibles :

 
 Packaging personnalisé  : Pochettes, écrins, certificats (MOQ 40 unités).

 Production de bijoux sur demande : nous produisons des bijoux hors catalogue en ligne selon vos souhaits (MOQ).

 
 📌 Délai de production : 4 à 8 semaines. Devis sur demande via notre formulaire professionnel.

 Quelle est votre politique de retour et garantie ? 

 Ventes fermes (pas de retour client) : Nos ventes étant réservées aux professionnels, nous n''acceptons ni retour ni remboursement, sauf vice de fabrication avéré et discussions au cas par cas.

 Garantie fabricant 1 an : Nous remplaçons gratuitement tout article présentant un défaut de conception (fermoir cassé, rhodiage défectueux, pierre descellée).

 Procédure SAV :

 
 Contactez notre service via votre compte client.

 Envoyez une photo du défaut constaté.

 Nous validons la prise en charge sous 48h.

 Renvoi du produit défectueux en port payé.

 Expédition du remplacement ou remboursement.

 
 📌 Attention : L''usure normale (oxydation légère après 6 mois d''exposition en vitrine) n''est pas couverte.

 Faut-il un numéro SIRET ou TVA pour commander ? 

 Non, pas forcément. Nos tarifs grossistes sont réservés aux professionnels justifiant d''une activité commerciale (extrait Kbis < 3 mois ou certificat d''inscription chambre des métiers). En tant que grossiste bijoux professionnel, nous acceptons les entreprises en création et les entreprises UE qui n’ont pas de numéro de TVA (la tva devra être payé sur le site).

 Professions acceptées : 

 
 Bijouterie / Joaillerie

 Commerce de détail (habillement, accessoires)

 Vente en ligne (e-commerce)

 Création artisanale (statut auto-entrepreneur accepté)

 Pharmacie / Parapharmacie (rayon bien-être)

 
 📌 Compte professionnel validé instantanément. Accès aux prix immédiat après validation.

 Livrez-vous en dehors de l''Europe ? 

 Oui, expédition mondiale.  Pays les plus fréquents :

 
 Amérique du Nord (Canada, USA) : 5-10 jours via UPS.

 Afrique du Nord (Maroc, Tunisie, Algérie) : 4-10 jours via Colissimo.

 Moyen-Orient (Émirats, Arabie Saoudite) : 6-9 jours via UPS.

 
 Frais de port et douanes :

 
 Frais de port calculés automatiquement selon poids et destination.

 Droits de douane et TVA locale : À la charge du client (nous déclarons la valeur réelle sur les documents d''export).

 
 📌  Conseil  : Pour les commandes >1000€ hors UE, contactez-nous pour optimiser la déclaration douanière.

 Comment s''inscrire et accéder aux prix grossistes ? 

 Procédure en 3 étapes :

 
 Cliquez sur  Créer mon compte professionnel 

 Remplissez le formulaire : Raison sociale, SIRET, TVA adresse de facturation, contact principal.

 
 Validation instantanée : Vous pouvez directement voir nos prix, stock et commander.

 📌 L''inscription est gratuite et sans engagement. Vous ne payez que ce que vous commandez, quand vous le souhaitez.

 
 Propulsez votre activité avec un partenaire fiable 

 Ne laissez pas votre stock dormir ni votre trésorerie s''évaporer dans des achats hasardeux.  Opalook vous offre un sourcing flexible, qualitatif et rentable , adapté aux réalités du commerce moderne (physique et digital).

 Que vous soyez une  bijouterie établie  cherchant à diversifier son offre, un  e-commerçant ambitieux  construisant sa boutique, ou un  créateur de marque  testant un nouveau positionnement, notre catalogue de  2000+ références sans minimum  vous donne la liberté d''expérimenter sans risque.

 Rejoignez les 3000+ points de vente qui nous font confiance en Europe.  Argent 925 rhodié, plaqué or, pierres naturelles certifiées, ambre baltique : misez sur la qualité pour maximiser vos marges.

 
 Opalook – Grossiste bijoux pour revendeur depuis 180 ans | Expédition France, Europe & International sous 48h | +3000 clients professionnels | Showroom Paris sur RDV', 'grossiste bijoux', 2900, 42, 'Commercial', now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/72-bijoux-femme', 'Bijoux femme', 72, 13, 2028, 'Chez Opalook, nous vous invitons à découvrir notre gamme exclusive de bijoux pour femme, conçue spécialement pour les professionnels du secteur de la revente. Forte de 180 ans d''histoire, notre entreprise familiale francopolonaise met à votre disposition des bijoux femme en or 750 et en argent 925, ornés de pierres naturelles telles que l''opale et l''ambre. Avec un catalogue de plus de 2000 bijoux pour femme, nous garantissons une haute disponibilité en stock, des prix compétitifs et une qualité inégalée. Créez votre compte client et passez commande instantanément, avec une expédition sous 24h/48h. Opalook, votre partenaire de confiance pour des bijoux femme authentiques et élégants, accompagnés de certificats d''authenticité.', null, 'bijoux femme', 22200, 36, 'Informational', now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/73-bijoux-homme', 'Bijoux homme', 73, 13, 27, 'Chez Opalook, nous sommes fiers de vous présenter notre catégorie dédiée aux bijoux homme, spécialement conçue pour les professionnels et revendeurs. Nos bijoux homme en or et en argent authentiques sont le fruit de 180 ans d''expertise, dont 30 ans sur le marché français. Découvrez une collection unique de bijoux homme, allant des bracelets aux bagues, tous fabriqués avec des pierres naturelles comme l''opale et l''ambre. Avec plus de 2000 bijoux homme disponibles, profitez de notre stock élevé, de nos prix compétitifs et de notre qualité inégalée. Commandez instantanément et bénéficiez d''une expédition rapide sous 24/48h. Opalook, votre partenaire de confiance pour sublimer la beauté masculine.', null, 'bijoux homme', 12100, 21, 'Informational', now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/74-bijoux-enfant', 'Bijoux enfant', 74, 13, 36, 'Bienvenue chez Opalook, votre partenaire de confiance pour les bijoux enfant de qualité supérieure. En tant que grossiste dédié aux professionnels, nous vous offrons une vaste gamme de bijoux pour enfant parfaits, pour émerveiller vos jeunes clients. Forts de nos 180 ans d''expertise, nous sélectionnons avec soin chaque bijou pour garantir sécurité et élégance. Avec plus de 2000 références en stock, nos bijoux enfant incluent des boucles d''oreilles, des colliers et des bracelets, tous conçus pour répondre aux normes les plus strictes. Profitez de notre service de commande instantanée et de notre expédition rapide sous 24H/48H pour satisfaire vos besoins en toute sérénité. Chez Opalook, notre mission est de démocratiser la beauté de la nature à travers des bijoux enfant exceptionnels.', null, 'bijoux enfant', 1600, 15, 'Commercial', now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/75-grossiste-boucles-oreilles', 'Grossiste boucles d''oreilles', 75, 13, 576, 'Chez Opalook, nous sommes fiers de vous présenter notre collection exceptionnelle de boucles d''oreilles, conçue spécialement pour les professionnels et revendeurs. En tant que grossiste de bijoux avec plus de 180 ans d''expertise, nous vous offrons des boucles d''oreilles en or et en argent authentiques, mettant en valeur la beauté naturelle de l''opale, de l''ambre et de diverses pierres naturelles. Notre catalogue de 2000 bijoux garantit une haute disponibilité en stock, des prix compétitifs et une qualité inégalée. Avec Opalook, bénéficiez d''une expédition rapide sous 24H/48H et d''un certificat d''authenticité pour chaque boucle d''oreille. Rejoignez-nous pour démocratiser la beauté de la nature à travers nos boucles d''oreilles uniques.', null, 'grossiste boucles oreilles', null, null, null, now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/76-grossiste-colliers', 'Grossiste colliers', 76, 13, 337, 'Bienvenue chez Opalook, votre grossiste de confiance pour des colliers d''exception. Explorez notre catégorie de colliers, où chaque pièce incarne l''élégance et l''authenticité de notre expertise de plus de 180 ans. Nos colliers, disponibles en or et en argent, sont conçus pour sublimer les collections de vos boutiques. Que vous recherchiez des colliers en opale, en ambre ou ornés de pierres naturelles, notre catalogue de 2000 bijoux saura répondre à vos attentes. Profitez de nos prix compétitifs, d''une haute disponibilité en stock et d''une expédition rapide sous 24/48h. Opalook, c''est la garantie de qualité et de satisfaction pour vos clients finaux, avec des certificats d''authenticité pour chaque bijou. Rejoignez-nous et embellissez vos rayons avec nos colliers uniques.', null, 'grossiste colliers', null, null, null, now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/77-grossiste-bracelets', 'Grossiste bracelets', 77, 13, 231, 'Chez Opalook, nous sommes fiers de vous présenter notre catégorie de bracelets, une collection exceptionnelle de bijoux en or et en argent authentiques. En tant que grossiste bracelets pour les professionnels, notre expertise de plus de 180 ans, dont 30 ans sur le marché français, nous permet de vous offrir des bracelets de qualité inégalée. Découvrez nos bracelets en opale, ambre et pierres naturelles, conçus pour sublimer les poignets de vos clients. Avec un catalogue de 2000 bijoux, des prix compétitifs et une expédition rapide sous 24/48h, Opalook est votre partenaire de confiance pour répondre à toutes vos exigences en matière de bracelets. Chaque bracelet est accompagné d''un certificat d''authenticité, garantissant la pureté et la qualité de nos créations. Faites confiance à Opalook pour enrichir votre offre avec des bracelets d''exception.', null, 'grossiste bracelets', 90, 14, 'Informational', now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/78-chaine', 'Chaîne pour pendentif', 78, 13, 6, 'Chez Opalook, nous sommes fiers de vous présenter notre catégorie de chaîne pour pendentif, une sélection raffinée pour répondre aux besoins des professionnels et revendeurs. Chaque chaîne pour pendentif est conçue pour sublimer les pendentifs de vos clients finaux, avec une qualité inégalée et des prix compétitifs. Avec plus de 2000 bijoux disponibles, un stock toujours prêt et une expédition sous 24H/48H, Opalook est votre partenaire de confiance pour enrichir votre offre et satisfaire vos clients.', null, 'chaine', 18100, 22, 'Informational, Transactional', now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/79-grossiste-pendentifs', 'Grossiste pendentifs', 79, 13, 406, 'Bienvenue chez Opalook, votre grossiste de pendentifs de confiance pour les professionnels. Plongez dans notre univers unique de pendentifs, où chaque création en or et en argent authentique reflète 180 ans d''expertise familiale franco-polonaise, dont 30 ans sur le marché français. Nos pendentifs en opale, ambre et pierres naturelles, disponibles en argent 925, argent doré et or 750, sont parfaits pour vos clients finaux. Avec un catalogue de plus de 2000 bijoux, des prix compétitifs et une qualité inégalée, nous garantissons des expéditions sous 24H/48H et fournissons un certificat d’authenticité pour chaque pendentif. Opalook, votre partenaire idéal pour démocratiser la beauté naturelle à travers des pendentifs exceptionnels.', null, 'grossiste pendentifs', 50, null, null, now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/81-grossiste-bagues', 'Grossiste bagues', 81, 13, 532, 'Bienvenue dans l''univers enchanteur des bagues chez Opalook, votre grossiste bagues dédié aux professionnels. Forts de 180 ans d''expertise, dont 30 ans d''expérience sur le marché français, nous proposons une vaste sélection de bagues en or 750, en argent 925 et en argent doré. Nos bagues, ornées d''opales, d''ambre et de pierres naturelles, sont conçues pour captiver l''attention de vos clients finaux. Grâce à notre catalogue de plus de 2000 bijoux, une haute disponibilité en stock et des prix compétitifs, vous bénéficiez d''une qualité inégalée et d''une expédition rapide sous 24 à 48 heures. Chez Opalook, chaque bague est accompagnée d''un certificat d''authenticité, garantissant l''excellence de nos produits. Rejoignez-nous pour démocratiser la beauté de la nature à travers des bagues exceptionnelles.', null, 'grossiste bagues', 30, null, null, now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/82-chevaliere', 'Chevalières', 82, 13, 10, 'Chez Opalook, nous sommes fiers de vous présenter notre catégorie de chevalières, une collection exclusive pour les professionnels et revendeurs. En tant qu''expert grossiste, nous mettons à votre disposition des chevalières, fruits de 180 ans d''expertise dans l''univers du bijou. Nos chevalières sont conçues pour captiver vos clients finaux grâce à leur élégance intemporelle et leur qualité inégalée. Avec un catalogue de plus de 2000 bijoux, une haute disponibilité en stock et des expéditions sous 24H/48H, nous garantissons des commandes instantanées et un service irréprochable. Optez pour les chevalières Opalook et bénéficiez de notre certificat d’authenticité papier pour chaque bijou.', null, 'chevaliere', 6600, 39, 'Informational', now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/88-grossiste-bijoux-plaque-or', 'Bijoux plaqué or', 88, 13, 200, 'Chez Opalook, nous sommes fiers de vous présenter notre collection de bijoux en argent doré, spécialement conçue pour les professionnels et revendeurs. En tant qu''entreprise familiale francopolonaise avec plus de 180 ans d''expertise dans l''univers du bijou, nous vous offrons des bijoux en argent doré authentiques, alliant élégance et qualité. Nos bijoux dorés et argent, fabriqués en argent 925 avec 0,5 micron d''or, sont le fruit de notre savoir-faire inégalé. Avec un catalogue de plus de 2000 bijoux, une disponibilité en stock élevée et des prix compétitifs, nous vous garantissons une expédition rapide sous 24/48h. Opalook, votre partenaire de confiance pour des bijoux dorés et argent d''exception.', null, 'grossiste bijoux plaqué or', 170, 25, 'Commercial', now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/89-grossiste-bijoux-or', 'Grossiste bijoux or', 89, 13, 85, 'Chez Opalook, nous sommes fiers de vous présenter notre prestigieuse collection de bijoux en or, une catégorie exceptionnelle qui incarne l''élégance et le savoir-faire artisanal. En tant que grossiste de bijoux pour les professionnels, notre expertise de plus de 180 ans, dont 30 ans sur le marché français, nous permet de vous offrir des bijoux en or authentiques d''une qualité inégalée. Notre catalogue riche de 2000 bijoux répondra à toutes vos attentes, avec une disponibilité immédiate et des prix compétitifs. Grâce à notre service d''expédition rapide sous 24H/48H et à la délivrance d''un certificat d''authenticité pour chaque pièce, vous pouvez être certain de proposer à vos clients finaux des bijoux en or d''une valeur et d''une beauté incomparables. Opalook, votre partenaire de confiance pour des bijoux en or qui sublimeront votre offre.', null, 'grossiste bijoux or', 110, 20, 'Navigational', now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/90-grossiste-bijoux-argent', 'Grossiste bijoux argent', 90, 13, 1649, 'En tant que grossiste et fabricant de bijoux en argent , Opalook propose un large choix de bijoux en argent 925 en ligne destinés exclusivement aux bijouteries, détaillants et revendeurs professionnels. Notre collection inclut des bagues, colliers, bracelets, boucles d’oreilles et pendentifs en argent massif 925, alliant qualité, tendance et durabilité. Bénéficiez de prix attractifs en gros, d’un stock disponible en ligne et d’une expédition rapide pour optimiser votre offre.', '💎 L’Importance de l’argent dans la Bijouterie

 L'' argent 925 est un métal précieux incontournable dans l’univers du bijou. Apprécié pour sa brillance naturelle, sa durabilité et son excellent rapport qualité-prix, il est une alternative idéale à l’or.

 Pourquoi l’argent 925 est-il une matière si prisé ?

 
 Élégance intemporelle : Son éclat argenté s’adapte à tous les styles, du classique au moderne. 

 Durabilité et solidité : Plus résistant que l''argent pur, il conserve sa beauté au fil des années. 

 Accessible et rentable : Moins coûteux que l’or, il permet aux revendeurs de proposer des bijoux abordables tout en maintenant de bonnes marges.

 Polyvalence stylistique : Se marie parfaitement avec des pierres naturelles, des cristaux et d’autres métaux précieux.

 
 Les divers types de bijoux en argent disponibles

 Opalook propose une gamme de bijoux en argent massif varié pour femme, enfant et homme, répondant aux tendances du marché :

 Bagues en argent 925

 Notre bague argent rhodié est déclinée en plusieurs styles pour satisfaire toutes les préférences :

 
 Bagues minimalistes et fines pour femme, parfaites pour un look discret.

 Bagues ornées de pierres naturelles, adaptées aux adeptes de lithothérapie.

 Bagues ajustables – Parfaites pour une clientèle recherchant des bijoux adaptables.

 Bagues avec tailles : la majorité de nos bagues en argent sont proposées en plusieurs tailles paires, allant généralement de la taille 50 à 62.

 Chevalière pour homme.

 
 Découvrir nos bagues en argent 

 Bracelets en argent

 Nos bracelets sont conçus pour s’adapter à différents styles et occasions :

 
 Bracelets chaînes délicats pour un esprit sobre et élégant.

 Bracelets ornés de pierres naturelles comme l’ambre ou l’opale.

 Bracelets de cheville en argent pour femme.

 
 DÉCOUVRIR NOS BRACELETS EN ARGENT 

 Colliers en argent

 Le collier est une pièce maîtresse en bijouterie, c’est pourquoi nous proposons :

 
 Chaînes fines ou épaisses : Disponibles en maille forçat 0,30 mm et 0,50 mm.

 Colliers sertis de pierres semi-précieuses – Un mélange d’élégance et de bien-être.

 Colliers à formes : arbre de vie, lune, mandala, etc.

 
 DÉCOUVRIR NOS COLLIERS EN ARGENT 

 Boucles d’oreilles en argent

 Nos modèles de boucles d’oreilles pour femme répondent aux dernières tendances :

 
 Boucles d’oreilles avec pierres naturelles

 Nos formes de boucles d''oreilles : dormeuses, clous, puces, pendantes,

 
 DÉCOUVRIR NOS BOUCLES D''OREILLES EN ARGENT 

 Pendentifs en argent

 Les pendentifs sont des accessoires polyvalents et incontournables :

 
 Symboliques et spirituels (forme de : cœur, croix, main de Fatma, œil protecteur).

 Pendenitfs avec pierres naturelles

 
 Bijoux en argent doré

 Nos bijoux en argent doré sont conçus avec un plaquage de 0,5 micron d''or, offrant une excellente tenue dans le temps. Contrairement aux bijoux dorés sur base en laiton ou en acier, l''argent 925 assure une meilleure résistance à l''usure et à l''oxydation.

 Nous offrons une vaste sélection de bijoux en argent doré, à l’exception des bagues, car leur couche d’or peut s’altèrer plus rapidement en raison des frottements et du contact fréquent avec les mains. Ces bijoux sont plus abordables que de l''or, tout en offrant une excellente tenue et une belle qualité.

 DÉCOUVRIR NOS BIJOUX EN ARGENT DORÉ 

 Bijoux argent avec pierres naturelles

 Tous nos types de bijoux présentés sur cette catégorie sont proposés avec des pierres naturelles. Opalook est spécialisés dans les pierres comme l''ambre, l''opale, l''améthyste et beaucoup d''autres

 DÉCOUVRIR NOS BIJOUX ARGENT ABEC PIERRES NATURELLES 

 Pourquoi anvisager un grossiste en bijoux argent ?

 Faire appel à un fournisseur de bijoux argent est une solution stratégique pour une bijouterie fantaisie , un concept store ou encore des revendeurs souhaitant élargir leur offre tout en optimisant leurs coûts. Voici les principaux avantages :

 1️⃣ Des prix plus avantageux

 En achetant directement auprès d’un fournisseur, les professionnels bénéficient de prix compétitifs qui permettent de : 

 
 Réduire le coût unitaire et augmenter les marges bénéficiaires. 

 Proposer une gamme variée de bijoux en argent 925 tout en restant compétitif. 

 Tester de nouveaux produits sans prendre de risques financiers.

 
 2️⃣ Une large sélection de bijoux en argent 925

 Un distributeur spécialisé propose des bijoux dans une grande diversité de modèles, offrant aux revendeurs la possibilité de :

 
 Répondre aux tendances actuelles avec des bagues, colliers, bracelets et boucles d’oreilles en argent .

 Adapter leur offre aux attentes de différentes cibles : bijoux minimalistes, créations serties de pierres naturelles, modèles classiques ou modernes. 

 Gagner du temps en regroupant plusieurs références en un seul fournisseur.

 
 3️⃣ Un stock disponible et un réapprovisionnement facile

 Acheter en gros garantit une disponibilité immédiate des produits , sans dépendre de multiples fournisseurs : 

 
 Éviter les ruptures de stock, un élément clé pour maintenir la satisfaction des clients. 

 Gérer plus facilement les pics de vente de bijoux, notamment lors des saisons fortes (fêtes de fin d’ année , Saint-Valentin, etc.). 

 Assurer une livraison rapide pour répondre aux besoins urgents des pros.

 
 4️⃣ Une qualité garantie et certifiée

 Les bijoux avec matière comme l''argent doivent répondre à des normes strictes pour garantir leur qualité et leur longévité. Il est important de travailler avec des entreprises spécialisées et de confiance : 

 
 L’argent 925 doit être poinçonné pour garantir son authenticité. 

 Certains modèles bénéficient d’un traitement rhodié, évitant l’oxydation et prolongeant leur éclat. 

 Un contrôle qualité rigoureux est essentiel pour éviter tout défaut de fabrication.

 
 L''importance du choix d''un grossiste fiable

 1️⃣ Vérifier la qualité et l''authenticité des bijoux

 Un bon fournisseur de bijoux en argent doit garantir des produits conformes aux normes du marché : 

 
 Poinçons officiels (925, argent massif) pour garantir la composition de la matière. 

 Traitement rhodié pour protéger contre l’oxydation et assurer une brillance durable. 

 Contrôle qualité strict avant chaque expédition pour éviter tout défaut.

 
 2️⃣ Privilégier un grossiste réactif et fiable

 Opter pour un fournisseur expérimenté permet d’éviter les mauvaises surprises : 

 
 Expérience et expertise : Un acteur établi sur le marché garantit une meilleure maîtrise des tendances et des attentes clients .

 Stock permanent : Un bon distributeurdoit être en mesure de fournir un réassort rapide pour éviter les ruptures. 

 Service client dédié : Une assistance fiable pour conseiller les revendeurset répondre rapidement aux demandes.

 
 3️⃣ Analyser les conditions d''achat et de livraison

 Pour assurer une gestion fluide des commandes, il est essentiel de comparer ces critères : 

 
 Prix compétitifs et transparence des tarifs (évitez les frais cachés). 

 Délais d’expédition rapides et options de transportadaptées. 

 Absence de minimum de commande, permettant de tester de nouveaux modèles sans contrainte.

 Avoir un support en ligne pour commander facilement.

 
 👉 Pourquoi Choisir Opalook comme grossiste de bijoux argent ?

 En tant que grossiste français en ligne spécialisé dans le bijoux en argent, Opalook vous propose : 

 ✔ Des bijoux en argent 925 certifiés, en stock immédiatement. 

 ✔ Une large sélection de modèles tendances en ligne, des bagues aux colliers en passant par les bracelets et boucles d’oreilles. Plus de 2000 références proposées en ligne, avec des nouveautés régulièrement proposées.

 ✔ Un service professionnel et personnalisé de confiance, adapté aux besoins des entreprises, détaillants et bijoutiers.

 ✔ Des prix compétitifs, sans minimum de commande et avec une livraison rapide.

 ✔ Une expertise de plus de 180 ans dans la vente en gros et la fabrication de bijoux.

 ✔ Une équipe commerciale à l''écoute pour bien accompagner les détaillants.

 🔍 Conseils pour sélectionner des bijoux en argent

 Grossiste de bijoux en argent : À quoi faire attention ?

 Avant de choisir un fournisseur de bijoux en argent, prenez en compte ces éléments clés :

 
 Composition et pureté du métal : Assurez-vous que les bijoux sont fabriqués en argent 925/1000 (également appelé argent sterling ou silver en anglais) pour une meilleure longévité et résistance à l’oxydation. Attention à ne pas confondre avec les bijoux plaqués ou encore l''acier inoxydable. Un bijou plaqué argent est moins durable qu''un bijou en argent massif. En effet, il se compose d''une fine couche d''argent sur un métal principal, qui peut s''user plus rapidement avec le temps.

 Finitions et traitements : Certains bijoux bénéficient d’un traitement rhodié, qui protège contre le ternissement et confère une brillance durable. D’autres sont plaqués d’or, nécessitant des soins spécifiques.

 
 💡 Innovations et tendances actuelles dans la bijouterie en argent

 Les bijoux en argent sont intemporels, mais certaines tendances évoluent de jour en jour, notamment avec :

 
 Le retour du minimalisme : Les bijoux fins et intemporels séduisent un large public, notamment pour les collections élégantes et discrètes. 

 Les bijoux en argent et pierres naturelles : L’association avec des pierres comme le quartz rose, l’améthyste ou la labradorite est en plein essor. 

 La superposition et accumulation (stacking) : Les bagues, colliers et bracelets se portent en couches pour un effet moderne et tendance. 

 L''argent texturé et martelé : Un travail de surface qui donne du relief aux créations et renforce leur caractère unique.

 
 Comment vérifier la qualité de l’argent ?

 L’authenticité de l’argent est un critère primordial lors de l’achat de bijoux. En France, les bijoux avec matières, dont l''argent, doivent répondre à certaines normes strictes :

 
 Le poinçon de titre : Un marquage officiel garantit la composition en argent massif. Pour les bijoux de plus de 30 grammes, le poinçon est obligatoire. En dessous de ce poids, l’apposition d’un poinçon est facultative mais reste un gage de qualité. 

 Le poinçon "925" : Présent sur de nombreux bijoux, il confirme que l’alliage contient 92,5 % d’argent pur, mélangé à d’autres métaux pour améliorer sa résistance.

 Test de l’aimant : L’argent véritable n’est pas magnétique. Si un bijou est attiré par un aimant, il ne s’agit pas d’argent massif, mais plutôt de plomb, d''acier ou d''une autre matière. 

 Réaction au frottement : Un bijou en argent authentique laisse une trace noire lorsqu’il est frotté sur un chiffon blanc, due à l’oxydation naturelle du métal.

 
 👉 Astuce pro : Pour rassurer vos clients et mettre en valeur la qualité de votre collection, communiquez clairement sur ces aspects techniques et mettez en avant les poinçons présents sur vos bijoux.

 🧼 Comment entretenir les bijoux en argent 925 ?

 ✔ Nettoyage doux et sans risque :

 
 Utiliser un chiffon doux en microfibre pour retirer la poussière et les traces de doigts.

 Nettoyer les bijoux avec un mélange d’eau tiède savonneuse et une brosse à poils souples, puis bien rincer et sécher immédiatement.

 Éviter les brosses à dents dures qui pourraient rayer la surface.

 
 ✔ Solutions naturelles pour restaurer l’éclat de l’argent :

 
 Mélanger eau, vinaigre blanc et bicarbonate de soude, puis frotter délicatement avec un chiffon doux pour raviver la brillance.

 Faire tremper les bijoux quelques minutes dans une solution d’eau tiède et de sel, puis les essuyer soigneusement. Veillez à ne pas faire tremper la pierre, si la bague en en contient une.

 En magasin, prenez soin de les protéger contre les chocs et les rayures.

 
 ✔ Attention aux bijoux rhodiés :

 
 L’argent rhodié ne nécessite pas d’entretien particulier, mais il est recommandé d’éviter tout produit abrasif qui pourrait altérer la fine couche de rhodium.

 En cas de ternissement, il est possible de faire réappliquer une couche de rhodium chez un professionnel.

 
 FAQ – Tout savoir sur nos bijoux en argent 925

 Quels sont les meilleurs grossistes de bijoux argent ?

 Un bon distributeur de bijoux doit mettre en vente un large choix de bijoux de qualité en argent massif 925, certifiés et conformes aux normes de qualité. Il est essentiel de choisir un distributeur de bijoux proposant des prix compétitifs, une disponibilité immédiate et un service fiable. Chez Opalook, grossiste bijoux argent de confiance, nous assurons une sélection variée de bijoux en argent 925, allant des bagues aux colliers, en passant par les bracelets et pendentifs, le tout avec un meilleur prix pour les professionnels du secteur. Commandez directement sur notre site internet et profitez d’un paiement sécurisé pour une expérience d’achat simple et rapide.

 Comment acheter des bijoux en gros ?

 Pour acheter des bijoux en argent en gros, il suffit d''être une société et de créer un compte professionnel sur le site d''Opalook. Une fois inscrit, vous avez accès à un stock disponible en temps réel et pouvez passer votre commande sans minimum d’achat. Nos tarifs sont pensés pour garantir un prix compétitif, vous permettant de maximiser vos marges. Tous nos bijoux sont conçus en argent pur ou en argent fin, pour assurer qualité et longévité à votre clientèle. Nous proposons de nombreux moyens de paiements adaptés aux professionnels.

 Quels sont les avantages de l’argent 925 ?

 L''argent est un métal précieux, communément appelé argent 925 ou encore argent sterling. Il est prisé en bijouterie et en joaillerie pour sa longévité et son éclat intemporel. Composé de 92,5 % d’argent pur, il est renforcé avec un alliage pour garantir une meilleure résistance aux chocs et à l’oxydation. Ce matériau est idéal pour la confection de bijoux de qualité, offrant un excellent compromis entre esthétique, robustesse et accessibilité. En plus d’être un métal précieux, l’argent 925 est hypoallergénique et convient parfaitement aux peaux sensibles. Les bijoutiers privilégient l''argent pour ses qualités malléables, facilitant la création de bijoux artisanaux en joaillerie. Ce métal précieux permet de concevoir des pièces raffinées et détaillées, adaptées aux exigences des artisans et aux tendances du marché de la joaillerie.

 Quels sont les bijoux en argent les plus tendance ?

 Les bijoux tendance en argent évoluent constamment, mais certains modèles restent des incontournables. Une collection de bijoux minimaliste, avec des bagues fines et superposables, séduisent particulièrement une clientèle en quête d’élégance discrète. Les bijoux fantaisie en argent, souvent ornés de pierres, connaissent également un grand succès. Les colliers en argent, qu’ils soient sous forme de chaînes épaisses ou de pendentifs symboliques, s’imposent comme des accessoires polyvalents et modernes. La bague plaqué et les bijoux en argent rhodié sont très appréciés pour leur brillance et leur résistance accrue. Enfin, les accessoires en argent, comme les boucles d’oreilles créoles ou les bracelets jonc, restent des pièces intemporelles plébiscitées par les commerces spécialisés et les consommateurs.', 'grossiste bijoux argent', 170, 29, 'Commercial', now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/92-bijoux-vintage-en-gros', 'Bijoux vintage en gros', 92, 13, 82, 'Chez Opalook, nous sommes fiers de vous présenter notre catégorie de bijoux vintage, une collection unique qui incarne l''élégance intemporelle et le savoir-faire artisanal. Nos bijoux anciens sont le fruit de notre expertise de 180 ans dans l''univers du bijou. En tant que grossiste de confiance, nous vous offrons un catalogue de plus de 2000 pièces, disponibles en stock avec une expédition sous 24H/48H. Chaque bijou vintage est accompagné d''un certificat d''authenticité, garantissant à vos clients finaux une qualité inégalée.', null, 'bijoux vintage en gros', null, null, null, now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/93-broche-bijoux', 'Broche bijoux', 93, 13, 14, 'Chez Opalook, nous sommes fiers de vous présenter notre catégorie exclusive de broches bijoux, conçue spécialement pour les professionnels et revendeurs. Plongez dans un univers où chaque broche bijoux est une œuvre d''art, façonnée avec soin en or ou en argent authentiques. Forts de 180 ans d''expertise, dont 30 ans sur le marché français, nous mettons à votre disposition un catalogue de 2000 bijoux, incluant des pièces uniques en opale, en ambre et en pierres naturelles. Opalook, c''est la garantie de stock disponible, de prix compétitifs et de qualité inégalée, avec une expédition rapide en 24h/48h. Rejoignez notre réseau et offrez à vos clients la beauté intemporelle de nos broches bijoux, accompagnées de certificats d''authenticité.', null, 'broche bijoux', 1300, 18, 'Informational, Commercial', now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/96-bijoux-arbre-de-vie', 'Bijoux arbre de vie', 96, 13, 27, 'Chez Opalook, nous sommes fiers de vous présenter notre collection de bijoux arbre de vie, une catégorie qui incarne la beauté et la symbolique de la nature. En tant que grossiste de bijoux pour les professionnels, nous mettons à votre disposition des bijoux arbre de vie en or et en argent authentiques, fruits de notre expertise de plus de 180 ans. Notre mission est de démocratiser la splendeur des bijoux arbre de vie, en vous offrant un catalogue riche de 2000 pièces, toutes disponibles en stock avec une expédition sous 24/48h. Faites confiance à Opalook pour enrichir votre offre avec des bijoux arbre de vie de qualité exceptionnelle et à des prix compétitifs.', null, 'bijoux arbre de vie', 1900, 15, 'Commercial', now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/97-bijoux-fleur-de-vie', 'Bijoux fleur de vie', 97, 13, 24, 'Bienvenue chez Opalook, votre partenaire de confiance pour la distribution de bijoux fleur de vie. En tant que grossiste spécialisé, nous vous proposons une gamme exclusive de bijoux fleur de vie, alliant l''authenticité de l''or et de l''argent à la symbolique puissante de la fleur de vie. Forte de 180 ans d''expertise, notre entreprise familiale francopolonaise est dédiée à fournir des produits de qualité supérieure à nos clients professionnels. Explorez notre catalogue de 2000 bijoux fleur de vie et bénéficiez de notre service d''expédition rapide sous 24/48h, ainsi que de nos prix compétitifs. Créez un compte client et passez vos commandes instantanément pour enrichir votre offre avec des bijoux fleur de vie uniques et authentiques. Opalook, c''est la garantie d''une qualité inégalée et d''une disponibilité optimale pour satisfaire vos clients finaux.', null, 'bijoux fleur de vie', 210, 5, 'Informational', now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/596-kit-de-bijoux-pour-revendeurs', 'Kit de bijoux pour revendeurs', 596, 13, 3, 'Découvrez nos kits de bijoux clés en main spécialement conçus pour les professionnels. Chaque pack comprend une sélection stratégique de bijoux en pierres naturelles, ambre ou opale, accompagnée de présentoirs pour une implantation simple et efficace. Disponibles en plusieurs formats (Démarrage, Standard, Étendu), nos assortiments optimisent la rotation et s’adaptent à tous les canaux de vente. Idéal pour les boutiques physiques, sites e-commerce, marketplaces et ventes sur les réseaux sociaux.', null, 'kit de bijoux pour revendeurs', null, null, null, now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/14-nos-accessoires', 'Nos accessoires', 14, null, 111, 'Chez Opalook, nous sommes fiers de vous présenter nos accessoires, spécialement conçue pour les professionnels et revendeurs. En tant que grossiste d''accessoires en ambre naturel et en pierre naturelle, nous mettons à votre disposition une vaste sélection de décoration en ambre et pierre naturelle. Nos accessoires sont disponibles en stock avec une expédition rapide sous 24H/48H, vous garantissant une haute disponibilité pour répondre aux besoins de vos clients finaux. Opalook, entreprise familiale francopolonaise, a pour mission de démocratiser et partager la beauté de la nature à travers nos accessoires, vous permettant ainsi de proposer des articles uniques et authentiques. Créez un compte client et passez vos commandes instantanément pour découvrir l''univers unique de Nos accessoires.', null, 'nos accessoires', 20, null, null, now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/100-arbres-du-bonheur', 'Arbres du bonheur', 100, 14, 20, 'Chez Opalook, nous sommes fiers de vous présenter notre catégorie d''arbres du bonheur. En tant que grossiste d''accessoires en ambre naturel et en pierre naturelle, nous mettons à votre disposition une sélection exceptionnelle d''arbres du bonheur, conçus pour émerveiller vos clients finaux. Nos arbres du bonheur, fabriqués avec soin à partir de pierres naturelles authentiques, sont des pièces uniques qui apportent une touche de nature et de sérénité à tout intérieur. Forte de ses 180 ans d''expérience, dont 30 ans sur le marché français, notre entreprise familiale francopolonaise vous garantit une qualité inégalée, une haute disponibilité en stock et des prix compétitifs. Avec Opalook, bénéficiez d''une expédition rapide sous 24H/48H et d''un service dédié aux professionnels. Découvrez dès maintenant nos arbres du bonheur et enrichissez votre offre avec des accessoires qui captivent et enchantent.', null, 'arbres du bonheur', 0, null, null, now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/101-vitrail', 'Vitrail', 101, 14, 2, 'Bienvenue chez Opalook, votre partenaire privilégié pour la catégorie vitrail. En tant que grossiste d''accessoires en ambre naturel et en pierre naturelle, nous mettons à votre disposition une sélection exceptionnelle de vitraux. Nos vitraux, conçus avec des décorations en ambre et en pierre naturelle authentiques, sont parfaits pour enrichir votre offre et séduire vos clients finaux. Profitez de notre service d''expédition rapide sous 24H/48H pour répondre aux besoins de votre clientèle professionnelle. Chez Opalook, nous nous engageons à démocratiser et partager la beauté de la nature à travers nos vitraux, pour vous permettre de proposer des pièces uniques et authentiques. Créez dès maintenant votre compte client et passez vos commandes instantanément pour bénéficier de nos avantages exclusifs.', null, 'vitrail', 8100, 41, 'Informational', now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/102-plaque-de-rechargement-pierre', 'Plaque de rechargement pierre', 102, 14, 25, 'Bienvenue chez Opalook, votre grossiste d''accessoires en ambre et en pierre naturelle de confiance. Nous vous présentons notre catégorie de plaque de rechargement pierre, une véritable fusion de décoration et de fonctionnalité. Nos plaques de rechargement pierre, fabriquées à partir de pierres naturelles authentiques, sont idéales pour recharger et purifier les bijoux et objets en pierre de vos clients. Profitez de notre expertise de plus de 180 ans et de notre engagement à offrir des produits de qualité inégalée. Avec une haute disponibilité en stock, des prix compétitifs et une expédition rapide sous 24h/48h, Opalook facilite vos commandes en gros et assure votre satisfaction. Découvrez dès maintenant notre gamme de plaque de rechargement pierre et enrichissez votre offre avec des pièces uniques qui raviront vos clients.', null, 'plaque de rechargement pierre', 70, 7, 'Informational', now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/103-porte-cles', 'Porte clés', 103, 14, 12, 'Chez Opalook, nous sommes fiers de vous présenter notre catégorie de porte clés, conçue spécialement pour les professionnels et revendeurs. En tant que grossiste d''accessoires en ambre naturel et en pierre naturelle, nous mettons à votre disposition une large gamme de porte clés alliant élégance et authenticité. Notre expertise de plus de 180 ans dans l''univers du bijou, dont 30 ans sur le marché français, nous permet de vous offrir des porte clés de qualité inégalée, disponibles en stock à des prix compétitifs. Profitez de notre service d''expédition rapide sous 24H/48H pour répondre aux attentes de vos clients finaux. Rejoignez Opalook et démocratisez la beauté de la nature à travers nos porte clés uniques.', null, 'porte cles', 1900, 29, 'Informational', now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/104-lampe-ambre', 'Lampe ambre', 104, 14, 7, 'Chez Opalook, nous sommes fiers de vous présenter notre collection exclusive de lampes en ambre naturel de la mer Baltique. En tant que grossiste spécialisé, nous mettons à disposition des revendeurs professionnels des lampes ambre d''une qualité inégalée. Forts de notre expérience de plus de 180 ans dans l''univers du bijou et de 30 ans sur le marché français, nous nous engageons à démocratiser la beauté de la nature. Nos lampes ambre, véritables œuvres d''art, sont disponibles en stock avec une expédition rapide sous 24H/48H. Profitez de notre expertise et de nos prix compétitifs pour enrichir votre offre de décoration authentique. Avec Opalook, illuminez vos espaces de vente avec la chaleur et l''élégance de l''ambre naturel.', null, 'lampe ambre', 90, 10, 'Informational', now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/105-verrerie-ambre', 'Verrerie ambre', 105, 14, 2, 'Bienvenue chez Opalook, votre partenaire de confiance pour la verrerie en ambre. Forts de notre expérience de plus de 180 ans dans l''univers du bijou, dont 30 ans d''expertise reconnue sur le marché français, nous vous proposons une sélection exceptionnelle de verreries en ambre naturel de la mer Baltique. En tant que grossiste de renom, nous mettons à votre disposition plus de 2000 articles, garantissant une haute disponibilité en stock, des prix compétitifs et une qualité inégalée. Optez pour notre verrerie en ambre pour offrir à vos clients des pièces uniques et authentiques, expédiées sous 24h/48h. Avec Opalook, démocratisez la beauté de la nature et enrichissez votre offre avec des produits d''exception.', null, 'verrerie ambre', 0, null, null, now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/106-souvenir-en-ambre', 'Souvenir en ambre', 106, 14, 82, 'Chez Opalook, nous sommes fiers de vous présenter notre catégorie exclusive de souvenirs en ambre. En tant que grossiste de souvenirs en ambre naturel de la mer Baltique, nous mettons à votre disposition des pièces authentiques et uniques, parfaites pour enrichir votre offre. Nos souvenirs en ambre, issus d''une tradition familiale francopolonaise forte de 180 ans, allient qualité inégalée et prix compétitifs. Avec plus de 2000 articles en stock et une expédition sous 24/48h, Opalook est votre partenaire de confiance pour répondre aux attentes de vos clients finaux. Commandez dès maintenant et profitez de notre expertise reconnue sur le marché français pour démocratiser la beauté de la nature.', null, 'souvenir en ambre', null, null, null, now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/107-savons-en-ambre', 'Savons en ambre', 107, 14, 2, 'Bienvenue chez Opalook, où nous vous proposons une sélection raffinée de savons en ambre de la mer Baltique, spécialement conçue pour les professionnels et revendeurs. Forte de notre expérience de plus de 180 ans dans l''univers du bijou, notre entreprise familiale franco-polonaise excelle dans la distribution de savons en ambre. Nos savons en ambre, disponibles en gros, allient qualité inégalée et prix compétitifs. Avec une haute disponibilité en stock et une expédition sous 24h/48h, nous facilitons vos commandes instantanées. Découvrez comment Opalook peut enrichir votre offre avec des savons en ambre uniques, et partagez la beauté de la nature avec vos clients finaux.', null, 'savons en ambre', null, null, null, now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/108-pierre-ambre', 'Pierre ambre', 108, 14, 2, 'Bienvenue chez Opalook, votre partenaire de confiance pour l''achat de pierre d''ambre en gros. Spécialistes de la pierre d''ambre brute provenant de la mer Baltique, nous sommes une entreprise familiale francopolonaise avec plus de 180 ans d''histoire dans l''univers du bijou, dont 30 ans d''expertise reconnue sur le marché français. Notre mission est de démocratiser la beauté de la nature en proposant des pierres d''ambre authentiques et naturelles. Nos pierres d''ambre sont parfaites pour la décoration ou pour intégrer dans vos créations de bijoux. Avec plus de 2000 références en stock, des prix compétitifs, et une expédition rapide sous 24/48h, Opalook garantit une qualité inégalée pour satisfaire vos besoins professionnels. Rejoignez notre clientèle professionnelle et profitez de notre expertise pour offrir à vos clients finaux des produits d''exception.', null, 'pierre ambre', 2900, 27, 'Informational', now()),
('2a97f7d5-1d5d-4806-90d8-a10b5e57502c'::uuid, 'https://opalook.eu/fr/109-collier-chien-et-chat', 'Collier chien et chat', 109, 14, 4, 'Bienvenue chez Opalook, votre partenaire de confiance pour les colliers pour chien et chat. En tant que grossiste d''accessoires en ambre naturel et en pierre naturelle, nous sommes fiers de proposer une gamme exceptionnelle de colliers pour chien et chat, spécialement conçus pour les revendeurs professionnels. Grâce à notre expertise de plus de 180 ans dans l''univers du bijou, nous vous garantissons des produits de qualité inégalée, disponibles en stock avec des prix compétitifs et une expédition rapide sous 24/48h. Découvrez notre sélection de colliers pour chien et chat, ornés d''ambre et de pierres naturelles authentiques, et offrez à vos clients finaux la beauté de la nature. Créez votre compte client et passez vos commandes instantanément pour profiter de nos services exclusifs. Opalook, c''est l''assurance d''un partenariat solide et d''une satisfaction totale pour vos besoins en colliers pour chien et chat.', null, 'collier chien et chat', 20, null, null, now())
on conflict (project_id, url) do update set
  name = excluded.name, external_id = excluded.external_id,
  parent_external_id = excluded.parent_external_id,
  products_count = excluded.products_count,
  catalog_short_description = excluded.catalog_short_description,
  catalog_long_description = excluded.catalog_long_description,
  target_keyword = coalesce(excluded.target_keyword, public.categories.target_keyword),
  keyword_volume = coalesce(excluded.keyword_volume, public.categories.keyword_volume),
  keyword_difficulty = coalesce(excluded.keyword_difficulty, public.categories.keyword_difficulty),
  keyword_intent = coalesce(excluded.keyword_intent, public.categories.keyword_intent),
  keyword_data_at = coalesce(excluded.keyword_data_at, public.categories.keyword_data_at),
  updated_at = now();
