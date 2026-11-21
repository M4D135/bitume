# BITUME — feuille de route du 21 novembre 2026

## Demandes retenues et point de reprise

Ce document rassemble les demandes de cette session et leur ordre de réalisation.
Il complète le [programme autonome](CONTINUATION-AUTONOME-2026-11-19.md), sans en
supprimer les autres travaux. Le chantier immédiat reste la voiture 126 CK et son
pilote ; les acquisitions géographiques peuvent avancer séparément.

**Dernière correction de David : le nouveau parcours commence au sommet du col
de Larche et se termine à Vinadio.** Le départ initial de Barcelonnette est
remplacé. Garder la vraie descente italienne par la SS21, environ 32 km, à l’échelle
réelle. Ne pas conserver les 64,5 km de l’idée initiale ni raccourcir artificiellement
les virages. Fiche détaillée : [Col de Larche → Vinadio](COL-DE-LARCHE-VINADIO-2026-11-21.md).

**Point réconcilié après Gemini :** la base géométrique est **0.2.79 /
p15 / FERRO 0.3.15**, commit `d4081241ad40dced72fd4e77c97a4775ed0398ad`, après
fusion des sources `f86e58f`. Le HTML `77d774fd99484f7d` est cohérent avec les
sources ; sa CI réussit 190 suites Node et 8 tests Python. La voiture, les
poignets R4b corrigés, les six vues et les compteurs sont intégrés.
[Reçu vérifié](rapports/MAINS-REALISME-2026-11-21/BASE-0279.json).

**Runtime courant : 0.2.80**, commit `6526493`, publié sur `main` avec détection
passive au démarrage et dans Image. 192 suites Node, 8 tests Python et parcours
WebGL2 mobile réussis ; les mains restent celles de .79.
[Reçu](rapports/DEMARRAGE-MOBILE-2026-11-21/PUBLICATION-0280.json).

David demande ensuite de poursuivre les personnages, surtout les mains plus
réalistes, en repartant des avancées Gemini. Le [lot mains M1–M4](MAINS-REALISME-2026-11-21.md)
prend priorité ; la géographie Larche/Vinadio et le reste du programme sont
conservés. La livraison du code ne prouve pas la mise à jour du site.

## Ordre de travail

| Priorité | Lot | Résultat attendu | État à ce jalon |
|---|---|---|---|
| Acquis | Démarrage téléphone | Détection passive sans banc de charge | Publié .80 ; parcours iPhone émulé reçu, Safari/iOS physique non essayé |
| Actif | M1–M3 — réalisme des mains | Doigts sans contraction, volumes affinés et transitions plus progressives | Correction et comparaison .79/candidat en cours ; vue extérieure prioritaire |
| Ensuite | M4 — personnages/manches | Raccords de manchette, avant-bras, coudes et silhouette | Prévu après réception des mains |
| Acquis | R1–R3 — voiture complète | Proportions, coque, arrière, ailes, habitacle et siège communs | Intégré en .79 ; fidélité finale à apprécier sur les images et à l’essai |
| Acquis | R4 — pilote et poignets | Posture assise, IK et continuité avant-bras/paume | R4b corrigé et intégré en .79 ; anciennes réserves allocation/contact closes |
| Acquis | V — six vues | Cockpit, arceau, nez, aileron avant, deux poursuites | Intégré en .79 ; commandes et pose commune contrôlées |
| À activer | T — compteurs | Visites et visiteurs uniques globaux | Code livré .79 ; mise en service réelle à vérifier lors du déploiement |
| Conservé | L0–L1 — sources Larche/Vinadio | Tracé routier, terrain, provenance et mesures | Sources identifiées ; données détaillées à acquérir |
| Conservé | L2–L6 — nouveau parcours | Descente réelle avec arrivée et chrono adaptés | Planifié ; aucun nouveau trajet jouable |

Les lots peuvent être préparés dans des branches distinctes. Les modifications de
`jeu.js`, du catalogue, des builds et du suivi sont intégrées séquentiellement par
la coordination. Conserver les travaux décor, PR 43, Monaco et Marseille.

## R — voiture 126 CK et pilote

La [fiche modèle complet](MODELE-COMPLET-126CK-2026-11-21.md) porte les références
et les lots R0–R5. Les proportions sont communes : implantation de l’ouverture,
du siège et du volant par rapport aux essieux avant d’ajuster le corps.

### R4b — corriger la tenue du volant, d’abord depuis l’extérieur

**Livré en .79 :** la correction `9b15210` de R4b a été intégrée par `f86e58f`,
puis fusionnée sur `main` dans `d408124`. Allocation cockpit et contact
avant-bras/pommeau ont été corrigés sans relever les seuils. La fin du
[checkpoint commun](rapports/MODELE-126CK-2026-11-21/REPRISE-CHECKPOINT.md)
décrit cette réception et les images WebGL2. Les défauts du candidat `fc01552`
sont de l’historique, pas l’état actuel. La suite M1–M4 améliore désormais les
doigts, leurs transitions et la silhouette des membres.

1. Observer le profil, les deux trois-quarts et la vue d’arceau : alignement
   avant-bras–poignet–paume, orientation des pouces, jointures et manchettes.
2. Garder les doigts en prise sur la jante et les pouces cohérents avec celle-ci.
   Orienter la paume et la manchette à partir de l’avant-bras ; supprimer la
   cassure du poignet et la bosse artificielle de manche.
3. Préserver les longueurs des bras et la position des épaules. Un changement de
   caméra ne change jamais l’anatomie, le volant ou la prise de la main.
4. Vérifier les deux mains au neutre, en braquage progressif et maximal, pendant
   l’aller/retour du levier et le geste Troll ; vérifier joueur et concurrents.
5. Tester les trois niveaux de détail : pas de trou entre gant et manche, pas de
   doigt qui flotte, pas de paume dans la jante, pas de coude dans le buste ou la coque.

**Acceptation :** captures du vrai jeu en extérieur avant/après aux mêmes angles,
complétées par les mesures de contact. Une bonne mesure seule ne suffit pas à
valider une prise qui paraît encore artificielle. Le cockpit utilise exactement
la même posture monde ; le champ 70° reste la valeur par défaut.

### R5 — clôture de la refonte

Recevoir dessus/profil/trois-quarts/arrière, habitacle vide et habité, cockpit,
portrait et duo. Contrôler casque sous arceau, dossier derrière le dos, nuque,
siège, harnais, miroirs et reflets utiles. Conserver les contrôles de pénétration,
les témoins négatifs et les budgets d’objets/allocations. Les assertions fondées
sur l’ancien emplacement du cockpit doivent être remplacées avec justification ;
ne pas assouplir un test pour masquer un contact réel.

## V — six vues classiques de jeu de F1

Implémentation et contrôles détaillés : [fiche caméras](CAMERAS-F1-2026-11-21.md).

| Vue affichée | Position et usage | Point à qualifier |
|---|---|---|
| Cockpit | Caméra attachée aux vrais yeux du pilote | Route, mains, instruments et regard arrière |
| Arceau / T-cam | Au-dessus et près de l’arceau | Haut du casque, volant et avant de la voiture |
| Nez | Caméra basse sur le nez | Horizon lisible, absence de traversée de coque |
| Aileron avant | Près de l’aileron avant | Impression de vitesse, dégagement de la route |
| Poursuite proche | Derrière la voiture, assez proche pour lire le pilote | Poignets, silhouette, stabilité dans les lacets |
| Poursuite éloignée | Recul supérieur pour lire la route | Anticipation et visibilité en duo |

- **V0 — contrat :** garder l’ancien identifiant `poursuite` pour la poursuite
  éloignée et `cockpit` pour l’intérieur. Les identifiants des plans de démo
  restent distincts de ceux des vues de conduite.
- **V1 — commandes :** cycle complet clavier/manette ; choix avant course et
  dans les réglages ; préférence conservée. J1 et J2 changent de vue séparément.
- **V2 — regard arrière :** maintien puis retour exact à la vue choisie au
  relâchement, pour les six vues, sans perdre les commandes de pilotage.
- **V3 — effets :** pluie, neige, vent, secousses et miroirs cohérents avec la
  position et le sens de chaque caméra. Conserver les réglages d’accessibilité.
- **V4 — rendu :** même voiture et même pilote, plans proches/lointains adaptés,
  pas de masque qui supprime arbitrairement la carrosserie dans une nouvelle vue.
- **V5 — réception :** images des six vues en paysage et portrait, deux joueurs
  avec vues différentes, braquage, virage en pente, regard arrière et météo.

## T — visites et visiteurs uniques sur l’écran titre

Libellés retenus : **Visites** et **Visiteurs uniques**. Affichage discret, lisible
sur ordinateur et mobile, uniquement sur le titre. Fiche technique et reprise :
[VISITES-TITRE-2026-11-21.md](VISITES-TITRE-2026-11-21.md).

| Lot | Travail et règle de comptage | Vérification |
|---|---|---|
| T0 — définition | Une visite par session ; nouvelle visite après 30 minutes d’inactivité | Rechargements, retour au titre et onglets ne gonflent pas les totaux |
| T1 — identité | UUID aléatoire persistant dans le navigateur ; seuls les identifiants hachés sont conservés côté serveur | Même navigateur reconnu ; stockage bloqué géré explicitement |
| T2 — service global | API `/salon/visites`, mises à jour sérialisées, réponses idempotentes et stockage durable hors releases | Redémarrage, retry après panne, concurrence et récupération de copie |
| T3 — titre | Afficher les vrais totaux ; `—` si l’API est indisponible ; appels hors de la boucle de rendu | Titre seul, portrait, réseau absent, erreur puis reprise |
| T4 — activation | Livrer le module client, les deux modules serveur et la configuration de persistance ensemble lors d’un futur déploiement | Contrôle HTTP réel et données conservées après redémarrage/déploiement |

« Visiteurs uniques » signifie ici **navigateurs reconnus**, pas personnes
identifiées : deux appareils, deux profils ou un stockage effacé peuvent compter
plusieurs visiteurs. Aucun suivi par IP n’est nécessaire pour ce lot. Les compteurs
commencent à l’activation ; aucun historique n’est inventé. Ce mécanisme ne prétend
pas éliminer tous les robots ou visiteurs malveillants.

Les 28 contrôles dédiés (16 serveur, 12 navigateur) sont présents dans la CI .79
réussie. Le reçu Gemini mentionne le titre hors ligne avec `—`. Le raccord HTTP
et la mise en service effective doivent être vérifiés lors de la livraison du service.

## L — col de Larche → Vinadio

**Parcours supplémentaire, de départ à arrivée, dans le sens de la descente.**
Départ sur la chaussée au sommet du col, arrivée dans Vinadio à positionner sur
le tracé routier vérifié, avec une zone de décélération après la ligne.

Le [plan géographique et technique](COL-DE-LARCHE-VINADIO-2026-11-21.md) détaille
L0–L6 : acquisition, tracé et profil, parcours ouvert, terrain réel, lieux,
streaming, collisions, IA, chronométrage, records, démo et réception visuelle.
Le terrain numérique piémontais est prioritaire ; les données françaises servent
au raccord du sommet et aux montagnes visibles côté France.

## Vérifications et publication pour la suite

1. Sauvegarder les références, les sources préparées et cette feuille de route
   dans GitHub ; publier le suivi documentaire sur `main`.
2. Lire l’état de reprise de la branche avant de reprendre le code. La
   [fiche de checkpoint](rapports/MODELE-126CK-2026-11-21/REPRISE-CHECKPOINT.md)
   distingue les contrôles réussis, les régressions à résoudre et les images absentes.
3. Finir l’intégration, construire deux fois le même HTML et comparer les empreintes.
   Vérifier la conservation de p15 et des 34 modules FERRO verrouillés.
4. Qualifier les scènes du vrai jeu, corriger les défauts observés, puis publier
   le runtime qualifié sur `main`. La demande de pousser la feuille de route
   n’autorise pas à présenter les préparations comme des fonctions déjà en ligne.
5. Reprendre les lots Larche/Vinadio depuis L0, avec le périmètre corrigé de
   sommet à Vinadio. Ne pas repartir de l’ancien départ de Barcelonnette.

L’audit du dépôt ne vérifie pas la version actuellement servie par le site. Les
prochaines actions repartent du point actif ci-dessus, sans réappliquer les lots
déjà intégrés ni effacer les préparations et preuves historiques.
