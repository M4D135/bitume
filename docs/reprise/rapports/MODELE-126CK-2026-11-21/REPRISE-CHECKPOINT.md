# Checkpoint 126 CK, visites et caméras — 21 novembre 2026

## Ce qui est sauvegardé et ce qui est livré

Sources préparées sur **`codex/bitume-0280-implantation-126ck-20261121`**.
Le runtime de `main` reste **0.2.77**, issu de PR 54 au commit `11e7e55` ; le
jalon courant ajoute le suivi documentaire sur main. Aucun déploiement effectué.
Le `dist/bitume.html` de préparation et `VERSION.json` restent la base **.78** :
ils ne contiennent pas les derniers changements de sources. Reconstruire et
qualifier avant d’utiliser le nouveau candidat pour un essai.

Les 41 images RenderBlade et les photos réelles ont leur provenance conservée.
Le premier reçu des photos réelles est `20d7770b8eb76087cb134e842ef7b426c2437bbd`.
Les valeurs de modélisation ci-dessous sont déduites des références, pas des
cotes constructeur certifiées.

## Préparations modèle reçues

- **Implantation commune :** essieux conservés à ±1,35 m ; ouverture déplacée
  vers l’avant de la cellule, volant `[1.10,.655,0]`, assise `[.68,.29,0]`.
  La carrosserie est creusée pour la cuve ; la présence du pilote ne change pas
  sa géométrie. La vue vide conserve siège, volant, colonne, planche et levier.
- **Arrière et ailes :** plateau métallique, arceau/renforts, capot ouvert,
  mécanique visible, sorties d’échappement creuses et effets raccordés, profils
  d’ailes. Les niveaux de détail conservent les volumes et ouvertures utiles.
- **Pontons :** ouïes latérales réellement percées, fond de conduit, montants,
  prises supérieures, joints et raccords de peau.
- **Posture :** corps installé dans le siège, épaules `[.548,.670,.170]`,
  humérus .27 m / avant-bras .29 m, dossier derrière la surface du dos, harnais
  posés, tête avancée et abaissée. Œil neutre courant `[.595,.886,0]`.
- **Miroirs et champ :** supports attachés à la peau réelle, normales adaptées
  aux nouveaux yeux ; champ cockpit sans élargissement automatique pour faire
  entrer toutes les glaces. Valeur par défaut 70°, préférences conservées.
- **Poignets :** candidat R4b séparé, commit
  `fc0155259d063685dac5116d9102cbf2fcb22423` de
  `codex/bitume-126ck-poignets-20261121`, **non intégré au checkpoint `12050e2`**.
  Il articule paume/manchette avec l’avant-bras en gardant les doigts sur la jante.
  Lire `docs/reprise/rapports/MODELE-126CK-2026-11-21/POIGNETS-R4B.md` sur cette
  branche avant réception ; deux défauts mesurés restent ouverts :
  - `voiture-permanents` : chemin cockpit à **16,936 octets/appel et 2 GC mineurs**
    sur 150 000 appels ; isoler l’allocation sans relever le seuil ;
  - `pilote-habitacle`, cas « un rapport interrompt le geste » : contact
    **`avant-bras-1-1/pommeau`**, majeur gauche, volant neutre, retour `0/120` ;
    corriger la trajectoire de la manche sans élargir le seuil de contact.
  Les gestes extrêmes doivent être relancés après les derniers raccords des
  doigts/pouce. Aucun build final, aucune image WebGL et aucune qualification
  générale de ce candidat ne sont déclarés ; la vue extérieure reste prioritaire.

Rapports : [proportions](PROPORTIONS.md), [posture R4](POSTURE-R4.md).

## Compteurs du titre

Les modules client/serveur et le raccord de chargement sont intégrés aux sources.
API `/salon/visites`, sessions de 30 minutes, UUID navigateur persistant,
identifiants hachés côté serveur, écritures atomiques et copie de secours hors
releases. Les réessais historiques ne prolongent pas une session plus récente.
Les valeurs ne sont pas simulées : `—` tant que l’API n’est pas disponible.

**28 contrôles dédiés relancés après intégration locale : 16 serveur + 12 navigateur,
tous réussis.** Fiche : [visites](../../VISITES-TITRE-2026-11-21.md).
Reste à qualifier le vrai titre et le transport HTTP du salon ; le service doit
être livré lors d’un prochain déploiement normal pour commencer à compter.

## Six caméras

Sources intégrées : cockpit, arceau/T-cam, nez, aileron avant, poursuite proche et éloignée.
Choix avant course/réglages, cycle clavier/manette et J1/J2 indépendants, regard
arrière puis retour à la vue sélectionnée. Les positions lisent les repères
communs de la voiture ; aucun deuxième pilote n’est créé pour une caméra.
La réception du cadrage WebGL, du HUD et des miroirs reste à faire après assemblage.
[Fiche caméras](../../CAMERAS-F1-2026-11-21.md). Les contrôles locaux de caméras
6/6, arrière 20/20, vitre 21/21 et son 8/8 passent sur l’assemblage. Les tests
de manette et de commandes partagées passent également après raccord de leur
contexte isolé au compteur optionnel.

## Qualification déjà utile, limites explicites

- Les contrôles isolés du pilote, de l’arrière, des pontons et des captures
  documentent les lots préparés. Leurs succès ne valident pas l’ensemble final.
- Après le dernier placement de tête et de miroirs, les **3 contrôles de reflet**
  passent : plan réel, horizon utile, voiture suivie à 10/20/30 m.
- Les **4 contrôles de mécanique cockpit** passent : colonne, diamètre physique
  du volant, regroupement des instruments, supports des miroirs.
- La première campagne transversale du modèle n’était pas verte. Plusieurs
  assertions utilisent encore l’ancien emplacement de la cellule, la vieille
  longueur de bras ou une obligation de tout faire entrer dans le cadre.
- Un dépassement d’allocation dans `voiture-permanents` a été observé avant la
  correction de préparation en double ; le contrôle doit être relancé sur le
  candidat final. Ne pas relever le seuil pour le faire passer.
- Des captures **Canvas2D** ont servi à examiner les proportions et cadrages.
  Le Chromium local ne peut pas ouvrir les sockets nécessaires dans cet
  environnement. Les captures WebGL doivent être reçues via la CI disponible.
- Aucun chiffre de FPS matériel ni validation esthétique finale n’est revendiqué.

## Prochain petit lot : réception commune des sources

1. Conserver le lot poignets `fc01552` sur sa branche et corriger ses deux
   défauts mesurés avant réception ; le checkpoint `12050e2` contient les six
   caméras mais pas cette articulation des poignets. Lire les rapports ciblés,
   puis vérifier que les raccords de `jeu.js` et `voiture.js` n’ont pas réintroduit
   l’ancien œil ou une ancienne coque.
2. Relancer les contrôles pilote/habitacle/dossier/gestes extrêmes, arrière,
   pontons, mécanique, reflets et nouveaux modules. Inspecter chaque échec.
3. Reprendre `cockpit-visibilite`, `voiture`, `integration-parallele` et
   `voiture-identite` : distinguer les anciennes coordonnées des vrais défauts.
   Remplacer seulement les exigences devenues obsolètes par la décision de
   garder une voiture unique. Conserver les seuils de contact et les témoins négatifs.
4. Vérifier `voiture-permanents` et les budgets de détails ; actualiser les
   empreintes d’identité seulement une fois le modèle final accepté par les
   contrôles de géométrie. Vérifier les roues et la physique inchangées.
5. Exécuter `python3 construire.py`, reconstruire pour vérifier l’identité du
   HTML, puis la campagne générale. Le verrou FERRO et p15 restent inchangés.
6. Déclencher `.github/workflows/qualification-modele-126ck.yml` sur la branche
   avec un commit `[capture-modele]`. Examiner les PNG du vrai HTML : dessus,
   profil, trois-quarts, arrière, habitacle vide/habité, cockpit, portrait,
   braquage, passage de rapport et Troll. Compléter avec les six vues et le titre.
7. Corriger les défauts observés et publier le runtime qualifié sur main.
   La fidélité finale reste soumise à l’essai du joueur, pas seulement à la CI.

## Suite demandée et préservée

Lire [la feuille de route réunie](../../FEUILLE-DE-ROUTE-2026-11-21.md).
Le nouveau parcours est **sommet du col de Larche → Vinadio**, SS21, environ
32 km, vrai relief. L0 est le prochain lot d’acquisition géographique ; aucun
départ de Barcelonnette et aucune fermeture artificielle ne doivent être repris.
Les autres circuits, travaux décor, PR 43, Monaco/Marseille et la réserve de
construction décor <150 ms restent conservés.
