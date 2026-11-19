# PhysX, sols procéduraux et pilote extérieur

**Version regroupée 0.2.56 / p14, FERRO 0.3.14 : qualification locale achevée, publication finale à terminer.**

## Objectif demandé

Éliminer les traversées du sol et les obstacles sans contact. PhysX doit intégrer les voitures avec leur masse,
inertie, gravité, suspension et forces de pneus. Rendre les sols hors route plus détaillés par le calcul seul,
et animer tête/bras/levier des pilotes vus de l'extérieur.

## Base et répartition

Base exacte 0.2.54 : `10f71ff1ad6c9ae5ae26fbe761c8bfa7332c3c30`, PR #8.
Branche de travail : `codex/bitume-physx-sols-pilotes-20261119`.
La clôture documentaire de #8 a été fusionnée dans `main` (`c28802974b2c138b57ea1bfe377389724ca15724`).
Les sources/builds 0.2.54 ont été préservés ; le chantier courant ajoute la physique p14.

- Canon FERRO : extension de l'adaptateur PhysX et shader procédural, puis verrou et installation officielle.
- Hôte : sol et obstacles depuis la scène réelle ; voitures dynamiques, quatre suspensions, forces de pneus.
- Pilote : animation extérieure, données partagées de direction et passage des rapports.
- Version physique cible p14. Ne pas annoncer le lot qualifié tant que les scénarios réels WASM ne passent pas.

## Constats reproductibles

Avant ce lot, PhysX 5.12.0 était réellement embarqué, mais ne portait que les débris. La conduite imposait une hauteur
au seul centre et une parabole indépendante de la route pour les sauts. Les lisses étaient simulées par une limite
latérale. Le dessus du sol du tunnel est 4 cm plus haut que la route : il doit être pris en compte par le collider.
Le diagnostic détaillé est conservé dans le sous-dossier de rapports de ce lot.

## Qualification nécessaire

Vrai runtime PhysX : repos en pente et dévers, saut sur montée, freinage et marche arrière, route/accotements/tunnel,
voiture contre voiture et petits obstacles à vitesse élevée, masse/inertie/impulsions, libération des scènes.
Courses et stands : reprendre les scénarios ciblés affectés, dont sortie de file bloquée sans contact ni replacement.
Rendu : preuves shader réel des sols, bras/tête/rapport à plusieurs phases et niveaux de détail.
Deux builds reproductibles, modules verrouillés exacts ; distinguer logiciels de contrôle et GPU matériel absent.

Spark/Mac/amiga non disponibles ; aucun déploiement du site n'est revendiqué. 13B et les nouveaux circuits restent prévus.

## Implémentation réalisée et qualification locale

- PhysX est la source des poses/vitesses : 600 kg, centre de masse et inertie explicites ; pas fixe 1/120 s, CCD,
  châssis et quatre cylindres convexes. Les quatre ressorts amortis prennent appui sur les triangles réellement
  dessinés, y compris accotements, terrain et sol du tunnel. Une roue perdue ne porte plus de charge.
- Le modèle de pneus du jeu calcule les efforts ; ils sont appliqués aux contacts, avec leurs moments. Chaque
  roue garde sa propre capacité d'adhérence, selon surface, charge, monte, usure et état de chaussée. Le frein
  de maintien agit par forces bornées. Pas de pose/vitesse imposée en course normale.
- Les acteurs distants en ligne restent cinématiques ; la reprise par l'IA rend la voiture dynamique. Le
  replacement après accident, déjà demandé le 16 novembre, reste un événement explicite qui invalide le tour.
- Débris et voitures partagent le même monde ; aucun second pas de simulation dans les effets, aucune dalle
  plane de substitution. La gomme suit chaque vrai point/normal de contact, et cesse quand la roue décolle.
- Les sols hors route passent sur la matière procédurale 25, en fin de construction après palette/herbier/saison.
  Le shader conserve les couleurs de biome et filtre le détail lointain ; aucune image ni sampler ajouté.
- Pilote : bras articulés et tête, prise du volant et déplacement de la main droite au levier selon la même
  phase de 0,36 s que le cockpit. Poses partagées entre vues et rétroviseurs, articulations cohérentes sur trois LOD.
- Libération native sur changement de séance et sur exception pendant le montage. À la restauration GPU, les
  effets libérés sont recréés dans le monde de la course ; les corps des voitures sont conservés.

Les images EGL sont produites par les vrais shaders/maillages, dans un contexte logiciel llvmpipe. Elles ne
constituent pas un essai de conduite dans Safari ni une mesure de fluidité sur le Mac.

## Résultats au checkpoint 62c9461

- 121/122 suites consolidées : balayage de 118 (115 réussies), correction/reprise de l’autoconfiguration et du
  déterminisme, puis quatre suites natives/réseau supplémentaires. L’échec historique de la signature des traces
  demeure identique ; aucun oracle antérieur n’a été régénéré. Ce résultat n’est pas un balayage unique du HEAD final.
- PhysX : quatorze scénarios de véhicules, géométrie et 5 181 rayons sur huit circuits, partage du monde avec les
  débris, libération des séances, préchauffe isolée et restauration des effets. Les courses longues restent des
  observations : quatre replacements après accident à Haut-Col, règle antérieure conservée.
- Stands : cinq scénarios natifs et huit contrôles de la branche parallèle. Dégagement sans contact ni replacement,
  service de 2,5 s immobile avant changement de monte, limiteur appliqué par les commandes moteur/frein.
  Correction de l’entrée historique 035 : la suite concurrente contient huit contrôles à ce checkpoint, pas onze.
- Réseau : paquet facultatif de vitesse 3D/rotation/suspension, onze contrôles dédiés, compatibilité des paquets
  historiques et deux transferts d’autorité. Une partie entre plusieurs navigateurs n’a pas été jouée.
- Pilote : quatorze contrôles, 630 poses sur trois niveaux de détail ; 634 poses vérifiées contre la coque réelle,
  aucune pénétration détectée parmi 3 645 paires proches. Les douze rendus EGL sont des contrôles techniques.
- Déterminisme p14 : deux processus natifs indépendants, trois courses de douze voitures sur sec/pluie/neige,
  54 empreintes identiques ; ancien p13 conservé. La garde p14 passe après les derniers changements de cycle de vie.
- Sols : 68 contrôles de routage saison/biome/qualité ; shader réel procédural, sans fichier d’image.

Build 0.2.55 : deux constructions identiques, 56 scripts valides, 14 160 335 octets, SHA-256
`8f3bba41c8255f72da2c828d153225eb13649c733142f9e216162928b37bbb98`. FERRO 0.3.13 est publié
(PR #1, main `b09a4e82`) et ses 34 modules sont exacts. Rapport et réserves :
`rapports/PHYSX-SOLS-PILOTES-2026-11-19/QUALIFICATION-FINALE.json`.

## Réconciliation et suite

La branche parallèle `6e9c1ea0` est fusionnée avec son historique et ses preuves. Les corrections de limiteur,
libération et reprise d’autorité sont conservées dans l’implémentation finale ; les deux tests réseau distincts
sont gardés sous des noms différents. Les captures et sources de pilote retenues sont celles qualifiées contre
la coque, plus récentes que les premières captures concurrentes.

Le checkpoint parallèle `b8f05074` et FERRO 0.3.14 sont désormais réconciliés. Les 32 modules moteur hors
adaptateur/version et les shaders restent identiques. Le suivi des vues WebIDL supprime leur rétention après
libération native et respecte les vues partagées par plusieurs mondes (préchauffe/course). Canon publié PR2,
main `85ba9417`, installé par le script officiel depuis 41 fichiers vérifiés.

Douze reprises ciblées passent, dont véhicules, circuits/tunnels, stands, cycle de vie/préchauffe, autorité réseau,
déterminisme, autoconfiguration, Russie historique, solides WASM et chargement. 234 fichiers sont stables durant
ces reprises. Les 54 empreintes p14 restent identiques sans réécriture de la fixture. La nouvelle suite circuits
ajoute quatorze contrôles et les stands passent à onze scénarios, avec trajets complets sec/pluie/neige.
Le bilan regroupé est **122/123 suites**, par consolidation des passages et reprises ; seule réserve traces
héritée. Le balayage concurrent b8f (117/119, décor486 ms et traces) reste une archive distincte.

Build final 0.2.56 : deux constructions identiques, 56 scripts valides, 14 162 317 octets, SHA256
`d93139352b308a1b5c2b3e60b8a15a52803b254577030d470037fa0838ac2e65`. Le constructeur a incrémenté
la version après intégration du correctif canonique ; aucun numéro n’a été modifié à la main.

La réalisation des démos est enregistrée dans `DEMOS-CINEMA-2026-11-19.md` comme lot suivant ; elle n’est pas
implémentée ici. Le site n’est pas déployé par ce travail. CI et publication du snapshot final restent à constater.

### Clôture intermédiaire parallèle conservée

La PR #9 a publié le checkpoint b8f en 0.2.55 (main `1e4579c5`). Sa clôture documentaire PR #10
(main `44978324`) est intégrée à ce regroupement : reçu `PUBLICATION-0255.json`, deux journaux CI
118/119 et artefact c9e0c3d9 sont conservés dans `rapports/PHYSX-SOLS-PILOTES-2026-11-19/github/`.
Ils concernent l’intermédiaire 0.2.55 ; les CI du regroupement 0.2.56 sont à consigner séparément.
La fiche démos garde également la préparation isolée et le correctif du bond de caméra, à reprendre ensuite.
