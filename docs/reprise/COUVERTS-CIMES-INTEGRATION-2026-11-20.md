# Couverts et Route-des-Cimes — intégration du 20 novembre 2026

## Qualification finale 0.2.66

La tête `40774189` réussit 159/159 suites ; 3 405 sources et le build sont conformes.
113 images retenues sont inspectées, dont la reprise des deux vues aériennes invalides.
Le correctif ne change que les outils de capture, leur régression et le déclenchement ciblé.
Les échecs initiaux, les deux images refusées et les réserves restent conservés.
Reçu : `rapports/COUVERTS-CIMES-2026-11-20/PUBLICATION-0266.json`.
Fusion et contrôle distant de main à terminer. Les sections suivantes sont l’historique du lot.

## Point initial conservé — 0.2.64

La base démos/pilotes/météo **0.2.64 / p15 / FERRO 0.3.15** est sauvegardée
en [PR #37](https://github.com/M4D135/bitume/pull/37), tête `80aa1e2`,
arbre `e015629469ca27ae5e8af4105c8b2b4a946f79aa`. Ses contrôles GitHub et
ses captures sont en cours. La livraison vérifiée sur `main` reste 0.2.62.

Le lot suivant rassemble la reconstruction métrique de Route-des-Cimes,
son raccord au catalogue après Baïkal, ses premiers ouvrages et le socle
multi-couverts. Les sources sont préparées ; le HTML de ce checkpoint reste
celui de la base 0.2.64. Ce checkpoint ne qualifie pas une nouvelle livraison.

## Défauts trouvés à l'intégration

- **Voûte courbe** : les dalles de tunnel calculées sur leur seule longueur
  centrale laissent des ouvertures côté extérieur au raccord. Les rayons
  peuvent atteindre la roche au-dessus, y compris depuis la chaussée.
  Le cas droit historique et ses 336 rayons ne détectaient pas ce défaut.
- **Entrée de galerie** : dans la vraie campagne à douze voitures, le
  châssis d'un rival rencontre `sol-galerie` avant le portail, puis un pilier
  et subit un replacement. La première preuve de roulage sans galerie
  construite ne couvrait pas cette situation.

Les corrections et leurs régressions sont en cours. Les échecs initiaux
doivent être conservés avec les reprises, sans déplacer les seuils ni
modifier les règles générales de conduite pour faire passer la géométrie.

## Contrôles visuels préparés

`tools/captures-couverts.mjs` prépare **six scènes et vingt-quatre images** :
les deux portails de Haut-Col et du Tunnel du Rocher, le second tunnel,
la galerie éclairée par le jour, la caméra au-dessus du toit et deux vues
simultanées tunnel/galerie. Les phases de portail sont des poses prescrites,
pas une conduite enregistrée. Elles contrôlent les vrais modules du HTML,
les flux d'eau entrants, la décroissance de l'eau résiduelle, la reprise
de pluie à la sortie, les rayons PhysX, les rétroviseurs et les erreurs GPU.

Les neuf contrôles de l'outil passent, dont des mutations de visière absente,
de repli de rendu, d'eau constante, de galerie obscurcie et de vues contaminées.
Ils ne constituent pas des images du jeu. Chromium local échoue au démarrage
sur une création de socket refusée ; aucun PNG n'est attribué à cet essai.
Le workflow `visuel-couverts.yml` prépare les six groupes sur GitHub.

## Conditions avant fusion

1. Corriger et vérifier les raccords de voûte et de chaussée sur les vrais
   ouvrages courbes et inclinés, en conservant l'ancien tunnel droit.
2. Rejouer la campagne native de Route-des-Cimes sur les trois couverts et
   le pont effectivement construits, avec les douze voitures.
3. Construire un candidat exact, vérifier la reconstruction et sa CI.
4. Récupérer et inspecter les images du candidat, notamment entrée/sortie,
   jour sous galerie, pluie aux portails et absence de traversée des parois.

Les limites de performance matérielle, les réserves précédentes et les
17 destinations du programme restent ouvertes. Le lac, la cascade et
l'enrichissement complet des sept lieux ne sont pas déclarés terminés.

## Revue intégrée et correction finale des portails

La CI de 0.2.64 termine à 151/152 : allocation du pilote extérieur au-dessus du seuil.
Ses images ont aussi révélé un poing trop ouvert et un apport de projections insuffisant en poursuite.
Les corrections sources sont sauvegardées avec les couverts ; le nouveau build sera qualifié ensemble.
Le contrôle aérien a été raccordé aux champs réels de diagnostic, sans changer les images ni le runtime aérien.

Les six portails réels passent maintenant 882 rayons, avec moins de 15 mm de variation aux seuils.
Un premier affinage général passait ces rayons mais causait un accident : il est rejeté et conservé dans les preuves.
La finition des dalles est limitée aux sorties courbes, avec prise en compte du dévers.
Douze voitures franchissent un tour plus 500 m au sec, sous pluie et sur neige : 80 256 sondes,
zéro replacement, aucune pose ni vitesse imposée. Le reçu exact est
`rapports/ROUTE-DES-CIMES-2026-11-20/QUALIFICATION-DOUZE-PORTAILS.json`.
Les entrées, milieux et sorties des trois couverts Cimes seront tous photographiés ; les rayons
identifient la vraie voûte et la surface de piste, pour ne pas accepter une roche à la bonne altitude.

## Reprise de la CI 0.2.65 et candidat 0.2.66

La PR #38 a sauvegardé le jeu complet. Les 3 397 fichiers de son archive CI correspondent
exactement aux sources locales ; le build reçu est identique. Résultat : **155/159 suites**.
Les quatre corrections sont décrites dans `rapports/COUVERTS-CIMES-2026-11-20/` :
allocation réelle des recherches de couverts, chauffe bornée des glaces, catalogue à neuf circuits
et oracles distinguant tablier, gorge et raccord de portail. Les seuils sont conservés.

La 0.2.66 possède deux builds identiques. La géométrie est inchangée ; 379 764 comparaisons
du helper modifié rendent les mêmes objets et valeurs. Les images inspectées de 0.2.65
sont conservées avec leur version : 48 démos, 41 météo et cinq poses du Tunnel du Rocher.
La nouvelle CI et les images exactes restent à qualifier avant fusion.

La pluie monde extérieure vue depuis un abri demeure une réserve fonctionnelle distincte
de la visière. Un prototype spatial natif a été retrouvé, mais son coût près des portails
(p95 8,815 ms, pointe 32,880 ms dans son banc) et son compositing nécessitent une qualification
séparée. Ne pas lui attribuer les preuves du candidat ni déclarer ce point terminé.
