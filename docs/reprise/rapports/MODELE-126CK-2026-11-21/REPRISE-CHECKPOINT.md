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

## Sauvegarde GitHub reçue

- Sources et suivi : [`39c80f5`](https://github.com/M4D135/bitume/commit/39c80f5c2d47bfadd2c9362e8b70b0c5d6a20f46), arbre identique au checkpoint local corrigé `be51291`.
- Poignets séparés : [`d487e7f`](https://github.com/M4D135/bitume/commit/d487e7f501d124df214ba8b7a5a6edcf7b544ff3), arbre identique au candidat local `fc01552`.
- Les deux références distantes et les deux arbres ont été relus après écriture.
  [Reçu et périmètre](SAUVEGARDE-2026-11-21.json). Le code des poignets reste à intégrer après correction de ses réserves.

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

## Réception locale 21/11 (poignets R4b + assemblage 0280 + captures WebGL2)

- **Branche `codex/bitume-126ck-poignets-20261121` (`9b15210`) :** les deux défauts mesurés de R4b ont été levés sans relâcher aucun seuil :
  - `voiture-permanents` : suppression du ternaire tagué sur `passageVisuel`/`passage` dans `habitacle()` (`cockpit` ramené de 16,9 o/appel à **0,00–0,07 o/appel, 1 GC**).
  - `pilote-habitacle` : dégagement continu de la manche droite au-dessus et à l’intérieur de la grille de levier (suppression du creux vers le bas à mesure de l’alignement + déviation douce sans allocation des points de contrôle/nœuds de Bézier), jeu minimal mesuré **+2,87 mm** sur 41 braquages × 8 rapports ; 9/9 suites pilote/allocation vertes.
- **Intégration sur `codex/bitume-0280-implantation-126ck-20261121` (`f86e58f`) puis fusion sur `main` (demande David 21/11) :**
  - `src/main.js`, `verifications/pilote-poignets.test.mjs`, `POIGNETS-R4B.md` et les 7 blocs poignets/manche/allocation de `src/voiture.js` intégrés en conservant l’implantation `0280` (`OEIL = [.595, .886, 0]`, `PILOTE_TETE_ORIGINE = [.517, -.034, 0]`, 6 caméras et compteurs de visites).
  - **Défauts réels corrigés dans `src/voiture.js` :**
    1. `FORMES['bulle-pilote']` et `FORMES['loin-dessus-pilote']` passés en alias non énumérables (`formes-libres` vert).
    2. `assise-pilote` et `siege-dossier` rétablis séparés dans `mod.simples` (16 volumes) pour conserver le contrôle thorax/siège aux trois LOD (`pilote-thorax` et `pilote-habitacle` verts).
    3. `poser()` et `poserRetro()` n’émettent plus `e.pilote` sur une voiture cassée (`o.casse === true`), rendant `crash` (22/22) et `pieces` (21/21) verts.
    4. `creuserQuille()` : fermeture de la fente de jour de 15–30 mm sous la cuve entre `x = 0,94` et `1,35` (59 points de jour ramenés à **0**, `voi-1` vert, aucune traversée de `console-levier-pilote` aux trois LOD).
    5. Cloison avant de `S_CUVE` fermée à `x = 1,345` (face intérieure doublée vers `−x`), supprimant les tranches rouges de `fleche`/`goutte`/`quille` visibles derrière le volant dans `cockpit` et `cockpit-portrait`.
    6. Attache intérieure arrière du triangle inférieur avant déplacée de `[1.18, .15, .17]` à `[1.18, .15, .198]` (**0,00 mm** de dépassement dans le plancher de cuve, contact extérieur `2,60 mm <= 11 mm`, `voi-7` vert).
  - **Harnais et assertions obsolètes 312 T5 mis à jour sans affaiblir les seuils :** `choix-pneus-integration`, `cinema-raccords`, `conditions-integration`, `voiture`, `habitacle-monde`, `cockpit-visibilite`, `integration-parallele`, `tools/qualification/troll-assemble.mjs` (os `0,27/0,29 m`) ; `verifications/fixtures/voiture-identite.json` renouvelé (`134/134` groupes primitives + emprise).
  - **Build reproductible (`construire.py` × 2) :** `dist/bitume.html` **version 0.2.79**, `14 554 537` octets (`3 479 462` gzip), `sha256` identique sur deux constructions consécutives : `77d774fd99484f7ddc2a6bbafe801c9dd2ea8f670af0c51ce1377a7e4a429aa8` ; **34 modules `FERRO 0.3.15` vérifiés**, `p15` et les 9 circuits inchangés (`git diff main..HEAD` vide sur `src/ferro/`, `FERRO.lock.json`, `src/conduite.js`, `src/physique.js`, `src/circuit.js`, `src/decor.js`, `src/baikal.js`, `src/route-des-cimes.js`).
  - **Captures WebGL2 locales (Chrome + SwiftShader sur `77d774fd99484f7d`) :** `captures-modele-126ck.mjs` **13/13 passages, 0 erreur** (comparaisons structurelles `dessus`/`dessus-vide` et `habitacle-avec-pilote`/`habitacle-vide` identiques), plus 4 gros plans extérieurs de poignets (neutre et braquages extrêmes), les 6 caméras de conduite (`cockpit`, `arceau`, `nez`, `aileron-avant`, `poursuite-proche`, `poursuite`) et l’état hors ligne des compteurs du titre (`Visites— / Visiteurs uniques—`), tous examinés visuellement.
  - **Limites explicites :**
    - Tests locaux Mac ARM64 (`185/190` verts ; 5 échecs SHA-256 `libm` Linux x86_64 sur fichiers inchangés depuis `main`).
    - `verifications/visiere-png.test.py` non exécuté localement (`numpy` absent).
    - Captures WebGL2 sous SwiftShader (pas de mesure FPS matériel).

## Suite demandée et préservée

Lire [la feuille de route réunie](../../FEUILLE-DE-ROUTE-2026-11-21.md).
Le nouveau parcours est **sommet du col de Larche → Vinadio**, SS21, environ
32 km, vrai relief. L0 est le prochain lot d’acquisition géographique ; aucun
départ de Barcelonnette et aucune fermeture artificielle ne doivent être repris.
Les autres circuits, travaux décor, PR 43, Monaco/Marseille et la réserve de
construction décor <150 ms restent conservés.
