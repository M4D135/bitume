# Habitacle commun et pilote : assise, buste, bras et mouvements

Date : 20 novembre 2026. Base consolidée vérifiée : `main` à `9f2246df61c6503ea8fa0f71a28813b15b17f51c` (BITUME 0.2.66, p15).

## Demande et état réel

La lacune de qualification est établie par lecture : les tests de traversée comparent les bras à la coque, au casque, au volant et à ses supports, **mais pas au volume du buste**. Pour son dégagement géométrique, le buste n’est contrôlé explicitement que par une séparation longitudinale d’au moins 8 cm avec la jante. Le signalement utilisateur est donc compatible avec des tests actuels réussis.

La cause géométrique précise reste à mesurer. Un buste visuellement massif, des restes rigides d’épaules issus du corps source, un départ de bras situé trop à l’intérieur, ou le pôle IK qui ramène le coude vers le buste pendant un geste sont des hypothèses distinctes. Cette analyse ne démontre ni une profondeur de pénétration ni le responsable unique. À la publication de ce plan, aucun nouveau test ni rendu dédié à ce défaut n’a encore été exécuté ; la correction du personnage reste à réaliser.

Ordre demandé le 20 novembre : consolider et pousser le travail sur `main`, puis y ajouter tout ce plan. La consolidation est reçue à `9f2246df61c6503ea8fa0f71a28813b15b17f51c` ; cette fiche est prête à publier avant les corrections. Elle organise l’exécution en petits lots. Les études conservées lors de la consolidation restent attribuées à leur version ; leur présence dans l’historique ne les rend pas actives dans le jeu.

## Ce que le modèle fait réellement aujourd’hui

### Buste et variantes de détail

Dans [`src/voiture.js`](https://github.com/M4D135/bitume/blob/9f2246df61c6503ea8fa0f71a28813b15b17f51c/src/voiture.js), le bloc `HUMAIN` extrait un maillage statique du corps procédural d’EMPRISE : rotation du repère, déplacement vertical de 0,781 m, filtrage des triangles et resserrement latéral. Le filtre garde les triangles dont le centre satisfait `y > 1.2 && (abs(x) < .19 || y > 1.38)` dans les données source. Au-delà de 0,16 m de l’axe source, la largeur excédentaire est ramenée au quart. Le commentaire vise environ 40 cm de largeur ; cette intention ne remplace pas une mesure des sommets effectivement rendus.

Le buste complet reste un morceau rigide : il suit la caisse et reçoit le recul `PILOTE_RECUL = -.10`, tandis que la tête dispose de son propre pivot. Ce n’est pas un torse déformé par un squelette importé. Le filtrage par centre de triangle peut conserver une zone d’épaule ou de haut de bras source ; il faut inventorier cette zone avant d’attribuer une intersection à ce phénomène.

`construirePiloteExterieur` utilise, pour les niveaux moyen et simple, une sphère mise à l’échelle par `[.30, .20, .38]`, placée à `[-.14, .66, 0]`. Le volume à vérifier dépend donc du niveau réellement affiché. Tester seulement le maillage HUMAIN complet ne couvre pas les deux bustes simplifiés. [Source : `HUMAIN`, construction du modèle, `construirePiloteExterieur`, pose des tables dans `src/voiture.js`.]

### Épaules, os et manches

`articulationPilote` fixe les épaules à `[-.125, .73, ±.14]` dans le repère voiture. Les deux segments ont des longueurs constantes de **21 cm et 23 cm**. La position du poignet provient du gant préparé par `majVolant`, puis le coude est obtenu par une construction IK à deux segments. Le pôle principal replie le coude vers le fond de la cuve ; pendant la montée d’un geste, un terme `versBuste` le ramène aussi latéralement vers le corps pour éviter le jonc.

Les humérus et coudes sont dessinés avec des primitives dont la largeur nominale est de 7,5 cm. Les avant-bras utilisent six petits tubes et six raccords sphériques, disposés sur une courbe entre la manchette et le coude. Les volumes visibles ne se limitent donc pas aux deux segments d’os : il faut vérifier aussi cette courbe et son épaisseur.

Le tableau `H.articulations` est partagé par l’habitacle et le pilote extérieur. Les gants, commandes et manches extérieurs proviennent des pièces préparées dans l’habitacle, avec une transformation de cadrage/échelle. La visibilité du corps diffère selon la vue. Le correctif doit conserver cette pose commune et éviter d’introduire un second calcul de coude pour la caméra extérieure. [Source : `construireHabitacle`, `construirePiloteExterieur`, `articulationPilote`, `majVolant`, `poserPiloteExterieur` dans le même fichier.]

## Volumes contrôlés et angle mort actuel

| Contrôle existant | Ce qu’il vérifie réellement | Ce qu’il ne prouve pas |
|---|---|---|
| [`pilote-habitacle.test.mjs`](https://github.com/M4D135/bitume/blob/9f2246df61c6503ea8fa0f71a28813b15b17f51c/verifications/pilote-habitacle.test.mjs), `piecesCoque` / `coque` | Triangles Float32 de la goutte, paroi intérieure, jonc, bulle et cuve ; coque réellement affichée aux niveaux moyen/simple ; console du levier. | Le buste n’est pas ajouté à ces obstacles. |
| Même fichier, gestes et interruption par rapport | Gants, bras, avant-bras, raccords et coudes contre coque, casque, visière, planche, casquette, supports/moyeu ; mains contre jante. | Absence de pénétration dans le torse, ni bras gauche contre bras droit. |
| Même fichier, test jante/buste | Écart longitudinal minimal de 8 cm entre les triangles du buste complet et ceux de la jante. | Dégagement latéral ou vertical des bras ; buste moyen/simple ; raccord d’épaule. |
| [`pilote-exterieur.test.mjs`](https://github.com/M4D135/bitume/blob/9f2246df61c6503ea8fa0f71a28813b15b17f51c/verifications/pilote-exterieur.test.mjs) | Longueurs 21/23 cm, bornes des coudes dans la cuve, matrices finies, correspondance aux LOD et aux rétroviseurs, indépendance des voitures ; allocations. | Un coude contenu dans la cuve peut être contenu dans le buste également. |
| [`pilote-commun.test.mjs`](https://github.com/M4D135/bitume/blob/9f2246df61c6503ea8fa0f71a28813b15b17f51c/verifications/pilote-commun.test.mjs) | 490 poses de mêmes articulations, gants, commandes et manches entre vues/LOD ; surfaces des mains contre pommeau/jante ; continuité du poignet. | L’égalité des deux vues n’atteste pas l’absence d’intersection avec le torse. |
| [`pilote-expressions.test.mjs`](https://github.com/M4D135/bitume/blob/9f2246df61c6503ea8fa0f71a28813b15b17f51c/verifications/pilote-expressions.test.mjs) | Formes des doigts, lisibilité des gestes, os constants, retour à la prise, partage du rig et données finies. | Dégagement des bras par rapport au buste pendant ces gestes. |
| [`expressions-pilote.test.mjs`](https://github.com/M4D135/bitume/blob/9f2246df61c6503ea8fa0f71a28813b15b17f51c/verifications/expressions-pilote.test.mjs) | Déclenchement, côté, regard, priorité du levier, indépendance J1/J2, déterminisme et sorties préallouées. | Collision géométrique du personnage. |

Le contrôleur actuel `traversee` effectue une présélection par capsules/sphères ou boîtes, puis vérifie les intersections des triangles réellement rendus. Son extension au buste doit également traiter une partie **entièrement contenue** dans le volume, sans croisement de surface. Un test d’intérieur sur un buste découpé ouvert n’est pas fiable par défaut : employer une enveloppe fermée vérifiée, ou une méthode d’intérieur adaptée et contrôlée indépendamment.

## Mesures à produire avant de modifier le pilote

Conserver les résultats dans un reçu court avec le commit, le hash du HTML, la pose, le niveau de détail, le joueur/rival et la caméra.

1. **Silhouette rendue** : largeur, profondeur et hauteur aux épaules, au thorax et sous les aisselles ; boîtes et sections du maillage HUMAIN et des deux bustes simplifiés. Repérer les triangles source appartenant à un éventuel haut de bras rigide.
2. **Repères communs** : coordonnées épaule/coude/poignet dans le même espace voiture, sans confondre l’espace apparent du cockpit et celui du monde. Mesurer la position de l’épaule par rapport à la surface du thorax.
3. **Pénétrations** : pièces concernées, profondeur maximale, faces/zone du buste rencontrées, longueur de bras enfouie et phase. Inclure les six tubes de manche, leurs raccords et les gants ; ne pas limiter le diagnostic au coude.
4. **Raccord autorisé** : définir une petite zone d’attache autour de chaque épaule où les pièces doivent se joindre. Une tolérance d’attache ne doit pas ignorer tout l’humérus ni toute l’aisselle.
5. **Matrice de poses ciblée** : repos, braquages gauche/droite, passages montants/descendants, trois gestes des deux mains, montée/maintien/retour et interruption par un rapport. Ajouter les poses entre échantillons autour de la plus forte pénétration.
6. **Captures utiles** : face, profil et trois quarts rapprochés, même pose dans les deux vues, mannequin/voiture joueur et rival, trois niveaux de détail. Ajouter des vues de diagnostic sans masquer le corps dans les images finales. Les scénarios actuels de [`tools/captures-demo.mjs`](https://github.com/M4D135/bitume/blob/9f2246df61c6503ea8fa0f71a28813b15b17f51c/tools/captures-demo.mjs) couvrent déjà volant et gestes ; les étendre avec ces cadrages précisément nommés.

## Une seule voiture et un seul habitacle, quelle que soit la caméra

**Nouvelle précision utilisateur :** le cockpit extérieur doit correspondre au cockpit intérieur ; c’est la même voiture et seule la vue change. Ce contrat est plus fort que le partage du rig. Il remplace les anciennes adaptations géométriques destinées au cadrage intérieur. Les lots H0 à H2 ci-dessous doivent cadrer le correctif buste/bras, afin de ne pas recalibrer le pilote sur deux habitacles différents.

### Pourquoi les deux vues diffèrent dans le code actuel

Les différences suivantes sont constatées dans les sources, sans supposer ce que montrerait une nouvelle capture :

1. **Deux enveloppes d’habitacle.** `src/voiture.js` construit spécialement `epaules`, `epaules-jonc`, `flancs`, `dome`, `pare-brise` et `pare-brise-arete` avec le drapeau `dedans`. La vue extérieure emploie notamment `goutte`, `goutte-dedans`, `jonc`, `bulle` et `retros`. `preparerTable` filtre les pièces selon la vue. La cuve est partagée, mais les contours visibles ne sont pas une unique coque observée depuis deux endroits.
2. **Deux mises à l’échelle et deux placements des commandes.** L’habitacle est composé en coordonnées apparentes puis ramené autour de `OEIL = [-.30,.74,0]` avec `K = .5`. `placer` pose ces coordonnées directement dans le monde. `poserPiloteExterieur` reprend les pièces source mais applique `PILOTE_ECHELLE = .9/K`, soit **1,8**, et `PILOTE_DECALAGE`; les tailles reçoivent le même facteur. Le volant extérieur possède l’ancrage nominal `PILOTE_VOLANT = [.25,.70,0]`, et le levier `PILOTE_LEVIER = [.18,.57,.16]`. Partager le maillage source ne rend pas ses dimensions et sa place identiques dans le monde.
3. **Œil et capot choisis pour une image particulière.** Les commentaires de `OEIL` précisent que ce point n’est pas l’œil du pilote et que le capot intérieur a été abaissé pour le cadrage. Cette intention explique l’architecture historique ; elle ne satisfait plus la demande actuelle.
4. **Contenu de la planche différent.** Même au niveau extérieur complet, `construirePiloteExterieur` reprend `H.planche[0]` et `H.planche[5]` comme planche/casquette, plus les supports. Le chemin cockpit dessine `H.planche`, aiguilles, rapport et vitesse. Le détail instrumental n’est donc pas simplement le résultat de la caméra.
5. **Tests compatibles avec cette différence.** `pilote-commun.test.mjs` calcule une échelle et une translation à partir du volant extérieur, puis vérifie l’équivalence des pièces après cette transformation. Il ne demande pas l’identité des sommets dans le monde. `voiture.test.mjs` vérifie expressément l’absence du capot et des glaces extérieurs en vue cockpit. Les tests actuels peuvent donc passer avec deux habitacles visuellement différents.

Sources : [`src/voiture.js`](https://github.com/M4D135/bitume/blob/9f2246df61c6503ea8fa0f71a28813b15b17f51c/src/voiture.js), [`pilote-commun.test.mjs`](https://github.com/M4D135/bitume/blob/9f2246df61c6503ea8fa0f71a28813b15b17f51c/verifications/pilote-commun.test.mjs), [`voiture.test.mjs`](https://github.com/M4D135/bitume/blob/9f2246df61c6503ea8fa0f71a28813b15b17f51c/verifications/voiture.test.mjs).

### H0 — inventaire et preuve de l’identité manquante

Attribuer un rôle stable à chaque pièce de l’habitacle : coque intérieure/extérieure, jonc, saute-vent, planche, cadrans, volant, colonne, levier, console, rétroviseurs et pilote. Comparer les objets et sommets rendus des deux vues dans le **même repère voiture**, à la même pose et au même niveau de détail. Consigner séparément taille, position, orientation, matériau et pièces absentes. Ne pas ajuster une homothétie pour faire coïncider les résultats : c’est précisément ce qui masquerait l’écart demandé.

**Livrable :** tableau des écarts, captures comparables et régression explicitement refusée par les deux constructions actuelles.

### H1 — géométrie canonique, cadrage par la caméra

Définir un seul habitacle métrique, raccordé à la coque extérieure réelle. Les commandes, supports, instruments, surfaces intérieures et rétroviseurs existent une seule fois en espace voiture. Les deux vues utilisent leurs mêmes dimensions, poses et matériaux. Les LOD simplifient cette géométrie sans changer ses ancrages ni déplacer sa silhouette.

Supprimer progressivement les transformations propres à une vue et les coques de substitution après migration vers ce modèle canonique. Régler la caméra cockpit depuis une position d’œil cohérente avec le siège et le pilote ; ajuster le champ, la projection portrait/paysage et les plans de coupe pour obtenir la lisibilité. Ne plus rétrécir, abaisser ou translater l’habitacle pour le cadrage. Le traitement de visibilité du propre casque doit être local et documenté ; il ne justifie pas une seconde voiture. Les objets d’affichage peuvent conserver leurs buffers séparés pour éviter les contaminations entre vues, tout en représentant exactement la même géométrie monde.

**Livrable :** bascule intérieur/extérieur sans changement de voiture, puis recalage mesuré du buste et de la chaîne épaule/coude/poignet sur cet habitacle unique.

### H2 — invariants monde, contacts et captures

Faire évoluer le contrat des tests : mêmes pièces communes, mêmes sommets transformés, dimensions, orientations et ancrages en espace voiture, sans normalisation par une échelle ou une translation propre à la vue. Garder les garanties de rig partagé et y ajouter l’habitacle entier, les instruments et rétroviseurs. Tester la bascule de caméra au milieu d’un braquage, d’un passage et d’un geste ; elle ne doit modifier ni la pose ni la géométrie.

Reprendre les contrôles de coque et le nouveau contrôle bras/buste sur le modèle canonique, aux trois LOD. Inspecter les images exactes depuis le siège, de face, de profil et en trois quarts. Préserver les mesures d’allocation et les buffers indépendants. Les anciennes références de cadrage restent archivées comme historique ; elles ne doivent plus imposer la conservation des deux habitacles.

### Complément impératif — pilote plus bas et plus enfoncé

Nouvelle précision utilisateur : en vue extérieure, le pilote doit être davantage enfoncé dans la voiture et plus bas, comme le suggère la vue intérieure. Cette assise appartient **au modèle commun** ; aucun abaissement réservé à la vue extérieure ne satisfait la demande.

- **H0 / B0 :** relever le fond utile de la cuve, le jonc, le point d’assise/bassin, les épaules, la base du cou, le sommet du casque et les yeux dans le même repère voiture. Le code actuel n’expose pas de repère explicite de bassin/assise nommé ainsi dans `voiture.js` ; le définir et vérifier sa relation au siège/cockpit plutôt que déduire toute la posture d’un décalage de tête.
- **H1 / B1 :** abaisser l’assise et asseoir plus profondément le pilote commun, avec une posture de buste cohérente. Mesurer l’amplitude dans les vues de profil et trois quarts ; ne pas choisir arbitrairement un nombre de centimètres. Raccorder à cette assise épaules, cou, tête, bras et variantes de détail.
- **H1 / B2 :** recalculer les chaînes épaule/coude/poignet en conservant l’atteinte du volant et du levier, les longueurs d’os constantes et les contacts de mains. Vérifier le casque, le siège, le jonc et la coque, y compris en braquage et pendant les gestes. Un pilote abaissé ne doit pas être obtenu en comprimant ses bras ou en le faisant traverser le fond.
- **Caméra :** placer son origine au repère réel des yeux du pilote ainsi assis. Le champ et la projection règlent ensuite le cadrage ; la géométrie de la voiture ne change plus selon la vue. Conserver les réglages de regard et de confort de caméra sans fabriquer une deuxième position corporelle.
- **H2 :** publier les hauteurs relatives au jonc et au fond avant/après, puis les mêmes poses depuis les yeux, en extérieur et aux trois LOD. Vérifier la continuité lors de la bascule de vue et tous les dégagements du rig commun.

## Exécution du pilote sur l’habitacle commun

**Ordre de dépendance :** H0 et B0 établissent les mesures ; H1 fixe la géométrie métrique et l’assise ; B1 à B4 règlent et qualifient le corps ; H2 et B5 vérifient l’ensemble puis le publient. Les positions historiques citées ci-dessous sont des références de mesure, pas une obligation de maintenir les deux anciens habitacles.


### Lot B0 — cas reproductible et contrôle manquant

Ajouter d’abord une régression indépendante **bras/buste**, construite depuis les surfaces réellement affichées. Elle doit échouer sur au moins une pose mesurée du défaut, conserver les coordonnées et images de cette pose, puis distinguer le raccord d’épaule intentionnel des pénétrations du thorax. Ajouter des témoins qui placent volontairement une manche dans le torse et qui déplacent le torse hors de portée ; inclure un cas d’enfouissement sans intersection de surfaces. Ne pas faire du code de production son propre oracle.

**Sortie du lot :** diagnostic mesuré et reçu versionné, aucune revendication de correction. Si le signalement n’est pas reproduit, conserver les observations disponibles et préparer un cadrage permettant de l’identifier ; ne pas réduire arbitrairement le buste.

### Lot B1 — silhouette et raccords du buste

Adapter la silhouette dans `src/voiture.js` à partir des mesures : volume thoracique, épaisseur latérale, forme sous les aisselles et raccord aux épaules. Retirer uniquement les parties rigides identifiées comme des restes du bras source. Raccorder la tête, le siège, la cuve et les commandes à l’habitacle commun défini en H1, puis requalifier leurs dégagements. L’assise plus basse appartient au modèle commun ; elle ne se limite pas à déplacer le personnage extérieur. Mettre les variantes moyen/simple en cohérence avec la silhouette corrigée.

**Sortie du lot :** comparaisons identiques avant/après, sections et dimensions publiées, raccords fermés ou explicitement traités, absence de nouvelle traversée de coque. Une simple sphère rétrécie sans vérification de silhouette ne suffit pas.

### Lot B2 — chaîne épaule/coude/poignet et dégagement du corps

Régler les ancrages d’épaule et le choix du pôle du coude dans le modèle commun. Préserver les contacts main/volant et main/levier. Conserver d’abord les longueurs de 21/23 cm ; tout changement anatomique éventuel doit être explicite, mesuré et constant pour un pilote, jamais un allongement dépendant de la pose pour éviter une collision.

Tenir compte conjointement du torse et de la cuve : écarter un coude du buste ne doit pas le faire traverser le jonc. Le terme actuel `versBuste` est à mesurer pendant la levée du geste ; sa seule suppression pourrait réintroduire la traversée de coque déjà corrigée. Vérifier aussi la courbe réelle des manches, pas seulement les extrémités de l’IK.

**Sortie du lot :** contrôle bras/buste réussi, contrôles coque/volant/levier/casque préservés, même tableau d’articulations et mêmes poses entre cockpit/extérieur.

### Lot B3 — gestes, contacts et continuité

Requalifier le cycle complet de chaque geste et son interruption par la boîte. La trajectoire doit contourner les obstacles avec des transitions continues de poignet, coude et orientation de main. Les tests actuels évaluent notamment le saut initial sous 1 mm et comparent les pas à 120/240 Hz lors d’une interruption : conserver ces critères et compléter le suivi du coude, sans remplacer une preuve temporelle par quelques poses statiques.

Les références MotionBricks / CMU mocap GLB pourront alimenter l’étude des attitudes, du rythme et du passage entre poses. Elles ne remplacent pas l’ajustement aux contacts propres à cette monoplace. Prévoir un raccord explicite des repères, de l’échelle, des noms d’os et de la pose de repos avant toute utilisation de clés ; l’identité du modèle commun reste le contrat. La sélection et la provenance exactes de ces références appartiennent au volet documentaire du plan principal, hors de cette lecture de code.

**Sortie du lot :** gestes lisibles, départ/retour sur la même prise, priorité du levier conservée, aucun saut de coude ni traversée entre les poses testées.

### Lot B4 — trois niveaux de détail, vues multiples et coût

Vérifier le buste réellement affiché à chaque LOD, avec joueur/rival, J1/J2, rétroviseurs et attitudes de caisse. Garder une seule pose articulée ; seule la géométrie détaillée et sa visibilité changent. Les captures doivent inclure le passage d’un LOD au suivant pour détecter un changement brusque de largeur du torse ou une réapparition de pénétration.

Préparer les formes, enveloppes de contact et tableaux pendant le chargement. Réutiliser les tampons du rig pendant les poses. Reprendre seulement après correction le banc existant `pilote-exterieur.test.mjs` : **moins de 4 octets alloués par pose et au plus 2 GC mineurs sur 60 000 poses**, sans relever ces seuils. Les tests permanents généraux restent requis pour les rétroviseurs et les variantes d’affichage. Ce banc ne constitue pas une mesure FPS matérielle.

### Lot B5 — intégration et publication

Après les contrôles ciblés, construire le candidat, vérifier la reproductibilité du HTML, exécuter les gates d’intégration pertinents et inspecter les captures exactes. La physique p15, les trajets de course et FERRO restent hors du correctif visuel ; le numéro du jeu suit l’assembleur habituel.

Pour chaque petit lot : commit borné, reçu synthétique, échecs initiaux conservés et état de reprise actualisé. Le reçu final relie les corrections aux poses qui échouaient et distingue les surfaces vérifiées des réserves de silhouette encore ouvertes.

## Fichiers concernés, sans travaux supplémentaires implicites

- `src/voiture.js` : adaptation du buste et de ses LOD, ancrages, IK partagé, trajectoires et pose des manches.
- `src/main.js` : seulement si une correction de manchette/poignet le nécessite ; conserver les formes de doigts déjà qualifiées.
- `src/expressions-pilote.js` : seulement si les transitions ou la priorité du levier doivent évoluer ; un changement de silhouette seul ne le requiert pas.
- `src/humain-corps.js` et `src/humain-donnees.js` : données sources à inspecter pour identifier les zones conservées ; ne pas les modifier globalement pour masquer un problème d’adaptation à la voiture.
- `verifications/pilote-habitacle.test.mjs`, `pilote-commun.test.mjs`, `pilote-exterieur.test.mjs`, `pilote-expressions.test.mjs`, `expressions-pilote.test.mjs` et `voiture-permanents.test.mjs` : régression manquante et garanties existantes.
- `tools/captures-demo.mjs` : scènes rapprochées, mêmes poses et provenance exacte des images.
- Fiche du nouveau lot, journal autonome, `REPRISE.md` et état court : progression, mesures, preuves et prochaine action.


## Exploitation des deux références fournies par David

Sources consultées le **20 novembre 2026**. Elles servent à étudier les corps et leurs mouvements ; aucun fichier de modèle, poids, animation ou texture n’est importé par cette publication du plan. Les révisions exactes devront être figées dans un reçu avant toute acquisition utilisée dans un correctif.

| Référence primaire | Apport vérifié | Usage prévu dans BITUME |
|---|---|---|
| [NVlabs / MotionBricks](https://github.com/NVlabs/motionbricks) | Génère des transitions à partir de poses récentes et de poses cibles ; modèles SOMA et G1, runtime Python avec Warp, Newton et TensorRT. | Étudier les transitions et la définition de poses de contact ; évaluer, si utile, un outil de préparation hors du jeu. |
| [codepawl / cmu-mocap-glb](https://huggingface.co/datasets/codepawl/cmu-mocap-glb) | 2 426 clips CMU ; variante `skeleton/` à 31 articulations sans maillage, ainsi que des personnages réadaptés. | Choisir quelques mouvements pertinents pour observer épaules, coudes, rythme et retours ; travailler d’abord sur les squelettes source. |

MotionBricks utilise TensorRT avec un GPU NVIDIA dans son runtime fourni. Le choix de ce plan est donc une étude hors du navigateur : l’animation procédurale existante reste la voie d’exécution de BITUME. La génération d’une transition ne démontre pas à elle seule le dégagement des bras dans notre habitacle. [Documentation officielle](https://github.com/NVlabs/motionbricks#setup).

La fiche CMU signale des défauts de réadaptation et fournit `retarget_ok` / `retarget_issue`. Filtrer ces métadonnées, regarder les clips sélectionnés et comparer au squelette source avant d’en tirer des poses. Aucune animation de conduite adaptée à notre volant n’est présumée disponible. Le dataset décrit des mouvements ; il ne livre pas à lui seul les volumes de collision, masses et contraintes de notre pilote. [Fiche du dataset](https://huggingface.co/datasets/codepawl/cmu-mocap-glb).

### Provenance et droits à conserver

- MotionBricks distingue le code **Apache 2.0**, les documents/médias **CC-BY-4.0**, les poids/ONNX sous **NVIDIA Open Model Agreement**, et les clips d’exemple sous **NVIDIA Sample Data Evaluation License**. Le README réserve ces derniers à l’évaluation et aux tests des technologies NVIDIA. Ne pas confondre ces quatre périmètres. [Licences du projet](https://github.com/NVlabs/motionbricks#license).
- Le dataset codepawl rattache les mouvements à **LicenseRef-CMU-Mocap** et le personnage Quaternius à **CC0-1.0**. Le site CMU autorise l’inclusion des données dans un produit commercial et interdit leur revente comme données, même converties. Conserver les crédits et les conditions lors de toute réutilisation effective. [CMU](https://mocap.cs.cmu.edu/), [FAQ CMU](https://mocap.cs.cmu.edu/faqs.php), [Quaternius](https://quaternius.com/packs/universalbasecharacters.html).

Le lot B0 ne dépend d’aucun téléchargement externe. Une expérimentation ultérieure consigne seulement les clips nécessaires : URL, révision, SHA-256, identifiant de sujet/essai, licence, fréquence, unités, repère, pose de repos, correspondance des articulations et transformations appliquées. Les données de référence et les constantes originales écrites pour BITUME doivent rester distinguées.

## Modèle de corps retenu pour l’étude

Le besoin immédiat est un pilote articulé assis, dont les surfaces restent cohérentes avec ses commandes. Décrire ensemble thorax, épaules, bras, avant-bras, mains et siège. Des capsules de membres et une enveloppe fermée du thorax peuvent servir à guider la pose ; leur résultat reste contrôlé contre les surfaces rendues. Le raccord épaule/thorax est anatomiquement continu et doit avoir une zone précise, bornée et mesurée.

Étudier une petite mobilité d’épaule ou de clavicule uniquement si les mesures démontrent qu’un ancrage fixe empêche un geste correct. Conserver les longueurs d’os constantes et les contacts de main. Un arbitrage entre thorax, jonc et commande doit déplacer le trajet ou la pose, sans faire apparaître une manche à l’intérieur du buste ni étirer le bras en cours d’animation.

Le plan n’introduit pas de ragdoll dynamique attaché au châssis. Une telle simulation serait un lot physique distinct, à justifier et qualifier. Ici, les attitudes et accélérations de la voiture alimentent la pose visuelle selon les règles existantes ; la conduite **p15** demeure la base.

## Matrice minimale d’acceptation

| Dimension | Échantillons à couvrir | Preuve attendue |
|---|---|---|
| Commandes | Neutre, braquages extrêmes dans les deux sens, montée/descente de rapport | Contacts main/jante/pommeau et bras hors du thorax hors raccord autorisé |
| Expressions | Trois gestes, chaque côté, montée, maintien, retour, interruption | Continuité temporelle du coude, poignet et orientation ; trajectoire dégagée |
| Représentations | Buste détaillé, moyen et simple ; transition entre niveaux | Dimensions cohérentes et aucun retour du défaut à une autre distance |
| Vues et participants | Cockpit, extérieur, rétros, J1/J2, joueur et onze rivaux | Une pose partagée, aucune contamination d’état entre pilotes |
| Attitude de caisse | Accélération, freinage, tangage, roulis et relief | Repères et collisions cohérents avec la même transformation |
| Ambiances | Sec, pluie et neige sur les cadrages utiles | Lisibilité du corps et absence de régression des effets ; pas de multiplication de captures sans risque identifié |
| Coût | Banc des poses et allocations, rétroviseurs | Seuils existants conservés ; toute limite de mesure matérielle indiquée |

Le diagnostic géométrique doit enregistrer les poses les plus défavorables et les réexaminer avec une cadence plus fine ; une grille finie de poses ne prouve pas toutes les configurations possibles. La validation visuelle utilise des images avant/après de face, de profil et de trois quarts, ainsi que des séquences des transitions. Conserver le résultat initial qui échoue et la correction correspondante.

## Reprise et articulation avec le programme complet

**Prochains lots du pilote : H0 et B0**, inventaire métrique commun, reproduction du défaut et régression bras/buste. Publier cette fiche avant leur implémentation. Chaque lot donne lieu à un commit borné, un reçu court et une mise à jour de `REPRISE.md`, `ETAT.json` et du journal ; les sorties détaillées restent dans leurs artefacts.

Les autres travaux restent dans [FILE-TRAVAIL.json](FILE-TRAVAIL.json) : pluie visible depuis les abris, composition des démos, finitions Cimes, Monaco, Marseille et programme des 17 destinations. Le prototype pluie et les études historiques sont conservés par la consolidation, avec leurs réserves propres. Le dégagement du pilote et l’identité de l’habitacle restent des corrections prioritaires. La demande sur les gouttes dispose d’une fiche indépendante [E0 à E3](EAU-VITESSE-2026-11-20.md) ; son exécution ne clôt pas le présent chantier.
