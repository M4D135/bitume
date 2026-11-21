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

Le runtime publié sur `main` au départ de ce jalon est **0.2.77 / p15 / FERRO
0.3.15**, commit `11e7e55f087484e1099963d42b04309b6bc6220c`. Les sources de la
refonte et les fonctions nouvelles sont sauvegardées sur
`codex/bitume-0280-implantation-126ck-20261121`. Leur présence sur une branche ne
vaut ni qualification globale, ni mise en ligne du jeu. Le numéro de cette branche
ne désigne pas une version construite ; le dernier HTML de préparation est encore
la base .78 et doit être reconstruit après les derniers raccords.

## Ordre de travail

| Priorité | Lot | Résultat attendu | État à ce jalon |
|---|---|---|---|
| 1 | R1–R3 — voiture complète | Proportions, coque, arrière, ailes, habitacle et siège communs à toutes les vues | Sources remaniées ; qualification visuelle globale à terminer |
| 2 | R4 — pilote et prise du volant | Posture assise dans la voiture, poignets naturels, mains en contact pendant les gestes | Posture intégrée ; candidat poignets `fc01552` séparé, allocation et contact à corriger avant réception ; contrôle extérieur prioritaire |
| 3 | V — six vues de conduite | Cockpit, arceau, nez, aileron avant, poursuites proche et éloignée | Sources intégrées ; contrôles ciblés réussis, réception WebGL à terminer |
| 4 | T — compteurs du titre | Visites et visiteurs uniques réellement partagés entre navigateurs | Module préparé, 28 contrôles dédiés réussis ; capture et service à qualifier |
| 5 | R5/V5/T4 — réception commune | Build exact, images WebGL, commandes, duo, réseau, performances | À faire avant publication du runtime sur main |
| 6 | L0–L1 — sources Larche/Vinadio | Tracé routier, terrain, provenance, mesures et inconnus | Sources primaires identifiées ; données détaillées à acquérir |
| 7 | L2–L6 — nouveau parcours | Descente réelle du col jusqu’à Vinadio, arrivée et chrono adaptés | Planifié ; aucun nouveau trajet jouable à ce jalon |

Les lots peuvent être préparés dans des branches distinctes. Les modifications de
`jeu.js`, du catalogue, des builds et du suivi sont intégrées séquentiellement par
la coordination. Conserver les travaux décor, PR 43, Monaco et Marseille.

## R — voiture 126 CK et pilote

La [fiche modèle complet](MODELE-COMPLET-126CK-2026-11-21.md) porte les références
et les lots R0–R5. Les proportions sont communes : implantation de l’ouverture,
du siège et du volant par rapport aux essieux avant d’ajuster le corps.

### R4b — corriger la tenue du volant, d’abord depuis l’extérieur

**Préparation actuelle :** `fc0155259d063685dac5116d9102cbf2fcb22423`, branche
`codex/bitume-126ck-poignets-20261121`, non intégrée au checkpoint `12050e2`.
Le [checkpoint commun](rapports/MODELE-126CK-2026-11-21/REPRISE-CHECKPOINT.md)
conserve les deux défauts mesurés : allocation du chemin cockpit et contact
avant-bras/pommeau lorsqu’un rapport interrompt le geste. Corriger ces défauts,
relancer les gestes extrêmes sur le résultat, puis recevoir les images WebGL.

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

Les 28 contrôles dédiés (16 serveur, 12 navigateur) ont été relancés avec succès
après intégration locale. Restent la capture du titre, le raccord HTTP dans
l’environnement de qualification et la vérification de mise en service effective.

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

Aucun déploiement du site n’est réalisé dans ce jalon. Les prochaines actions
peuvent continuer depuis le dépôt sans rechercher l’historique de la conversation.
