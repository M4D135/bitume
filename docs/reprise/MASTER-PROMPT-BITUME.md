# MASTER-PROMPT-BITUME — consignes canoniques de la mission

> **Fichier canonique des consignes de la mission BITUME.** À relire en entier après
> toute réduction de contexte ou nouvelle session, **avant** de demander quoi que ce
> soit à David. Les définitions de lots présentes ici ne doivent **jamais** être
> redemandées. Mettre à jour le **Tableau de suivi** après chaque lot et avant toute
> interruption.

## Provenance et état de référence

- Pièce jointe `BITUME_MASTER_PROMPT_QWEN_SPARK.txt` : **non accessible** sur le poste
  (recherche épuisée dans `/home/m4d135`, `/tmp`, `/root` — aucun fichier BITUME ; les
  `*MASTER*PROMPT*` trouvés appartiennent à d'autres projets : SAIGNEURS, TMZ, MAESTRO,
  metal-chantier). Les consignes sont donc enregistrées depuis le **message de David du
  2026-11-23** reproduit verbatim ci-dessous, complété par les **acquis reconstitués**.
- Référence GitHub vérifiée : `main` = `832f6f6f6b057dd41ad870a004b694cc0d99f3e4`,
  BITUME **0.2.299**. Vérifier à chaque reprise si le dépôt a avancé ; **ne jamais
  revenir à une version ancienne** pour suivre un document de reprise périmé.
- Dépôt Spark : `/home/m4d135/work/bitume-qwen-20261117/bitume`. Mac canonique :
  `/Users/david/Projects/bitume` (SSH `ssh -i ~/.ssh/spark_access david@192.168.1.128`).
  GitHub `origin` = `https://github.com/M4D135/bitume.git` (poussée **depuis le Mac**).
- Node attendu : `v24.18.0` (ne pas forcer le v22 de `~/.local/node`).

## Règles transverses (rappel dur)

- **FERRO** : les modules de `FERRO.lock.json` sont des copies canoniques ; corriger
  d'abord dans `M4D135/FERRO`, qualifier, puis propager avec le verrou.
- **Vie privée (lot F)** : décision David 21/11 — ne **pas persister d'IP brute**.
  Dédup par **empreinte HMAC** navigateur/cookie opaque + proxys de confiance,
  identité durable, opérations **atomiques**, migration conservant l'historique.
  Estimation **honnête** : ne pas additionner des uniques quotidiens pour fabriquer un
  total.
- **Déploiement** : `./deposer.sh` **depuis le Mac** ; aucune mise en ligne sans demande
  explicite de David. Build déterministe confirmé (Mac = Spark).
- **Qualité** : livrer des modifications **vérifiées dans le vrai jeu**, captures et
  mesures à l'appui. Ne pas relever un seuil ni remplacer une référence uniquement pour
  obtenir du vert. Un problème local n'arrête pas les travaux indépendants.
- **Contrainte Spark** : lavapipe rend la scène 3D **blanche** et ~5 FPS → logique,
  physique, entrées, HUD, menus, géométrie vérifiables sur Spark ; **visuel et perf GPU
  à qualifier sur Mac**. Avant tout test navigateur : `pkill -9 -f "chrome --headless=new"`.
  WebGPU Spark : `DISPLAY=:99` (Xvfb) + `VK_ICD_FILENAMES=VK_DRIVER_FILES=/usr/share/vulkan/icd.d/lvp_icd.json`
  + `argumentsWebGPU('vulkan-mesa')`.

## Documents de reprise (chemins)

- Consignes canoniques : `docs/reprise/MASTER-PROMPT-BITUME.md` (ce fichier).
- Suivi compact des lots : section **« Tableau de suivi »** ci-dessous.
- Suivi détaillé historique : `docs/reprise/SUIVI-2026-11-19.md`,
  `docs/reprise/FEUILLE-DE-ROUTE-2026-11-22.md`, `docs/reprise/FILE-TRAVAIL.json`,
  `docs/reprise/ETAT.json`, `docs/reprise/BRANCHES-ET-LOTS-2026-11-20.md`.
- Preuves : `docs/reprise/preuves/`, `docs/reprise/rapports/`.
- Mémoire partagée KBZA (notes) : `bitume-lots-2026-11-23-B-E`,
  `bitume-complement-2026-11-23`.

---

## Consignes de reprise — message de David (2026-11-23), verbatim

Reprends la réalisation de BITUME. Voici les définitions manquantes et la procédure
pour conserver durablement la mission.

Préserve les avancées déjà réalisées. La référence GitHub vérifiée est main
`832f6f6f6b057dd41ad870a004b694cc0d99f3e4`, BITUME 0.2.299 ; vérifie si le dépôt a
encore avancé. Ne reviens pas à une version ancienne pour suivre un document de reprise
périmé.

### 1. Enregistrer les consignes avant de continuer

Conserve intégralement le fichier `BITUME_MASTER_PROMPT_QWEN_SPARK.txt`, s'il est joint
ou accessible, dans : `docs/reprise/MASTER-PROMPT-BITUME.md`.

Si un document canonique existe déjà, rapproche les contenus et préserve les demandes
ultérieures. Ne remplace pas le master complet par un résumé.

Enregistre aussi ce message comme consigne de reprise. Les définitions ci-dessous te
permettent de continuer même si la pièce jointe n'est pas accessible.

Ajoute les chemins aux documents de reprise et utilise un tableau de suivi compact :
lot, périmètre, état, commit, preuves, réserves et prochaine action.

Après chaque lot et avant interruption, actualise ce suivi. Après réduction du contexte
ou nouvelle session, relis les fichiers ; ne me redemande pas les définitions qui y sont
présentes.

### 2. Conserver les acquis et terminer leur réception

- **K** : conserve le correctif marche arrière → accélération avant et les preuves
  pertinentes. Ne recommence pas son développement s'il est effectivement qualifié.
- **A** : ne considère pas tout le lot terminé grâce aux seules glissières continues et
  aux tests 9/9. Vérifie aussi rochers suspendus, grandes nappes artificielles, raccords
  entre étages, dessous de terrain et entrée du tunnel, depuis les vraies vues de
  conduite.
- **B** : requalifie les virages à environ 40 degrés et leurs raccords sur toute la
  largeur de la chaussée, avec les collisions.
- **E** : conserve le renommage « Descente des Freins Chauds » et les identifiants
  internes.
- **F** : établis son état réel ; il n'apparaît pas clairement dans ton bilan.
- **J** : termine ce qui reste partiel.

### 3. Définitions des lots manquants

#### C — Écran partagé local à trois et quatre joueurs

Ajouter une grille 2 × 2 : J1 en haut à gauche, J2 en haut à droite, J3 en bas à gauche
et J4 en bas à droite.

À trois joueurs, la quatrième case montre le circuit et la course en cours, par une
carte animée ou un cadrage adapté du même monde. Elle ne crée ni quatrième pilote ni
seconde simulation.

Chaque joueur garde ses commandes, caméra, HUD et minimap. Vérifier attribution des
manettes, pause, reconnexion, départ et résultats. Préserver solo et duo. Aucun effet
d'écran ni rétroviseur ne doit lire dans la case voisine.

#### D — Minimap zoomée et défilante

Montrer la portion du tracé autour du joueur, avec suffisamment de visibilité vers les
prochains virages. Le joueur reste dans une zone stable et le tracé défile progressivement.

Le suivi doit rester attaché au bon tronçon dans les lacets et passages superposés.
Chaque joueur possède sa carte indépendante.

Afficher rivaux, stands, stations et objectifs utiles. Gérer correctement circuits
fermés, parcours ouverts et route infinie, avec un coût borné.

#### G — Rendu beaucoup plus photoréaliste

Reprendre couleurs, matières, éclairage, proportions et contacts au sol pour corriger
l'aspect cartoon.

Travailler asphalte, roche, terre, végétation, peinture, métal, caoutchouc et verre avec
des échelles et réponses lumineuses crédibles. Utiliser des photographies comme
références tout en conservant l'architecture procédurale du projet.

Vérifier exposition, espace colorimétrique, rugosité, normales, humidité et ombres.
Comparer des vues identiques avant/après, en mouvement et sous plusieurs conditions. Une
simple modification de saturation ne suffit pas.

#### H — Végétation beaucoup plus dense

Viser une impression de végétation de l'ordre de 100 fois plus abondante dans les
habitats adaptés, sans multiplier partout les objets détaillés par 100.

Concentrer herbes, buissons, sous-bois et arbres autour du circuit. Employer cellules
déterministes, instances réutilisées, niveaux de détail, groupes simplifiés,
représentations lointaines et caches bornés.

Préserver silhouette, profondeur apparente et transitions stables. Respecter route,
stands, signalisation et bon étage du terrain.

Tenir compte des quatre joueurs, rétroviseurs et ombres. Mesurer géométrie, appels de
rendu, transparence, mémoire et saccades ; l'instanciation seule ne réduit pas les
triangles d'une population identique.

#### I — Route infinie arcade

Créer « Route sans fin », avec ce cycle obligatoire :

plage → plaine → petite montagne → grande montagne → petite montagne → plaine → plage →
recommencer.

Faire varier tracés, paysages, végétation et animaux à l'intérieur de cet ordre. Ajouter
une météo cyclique et progressive, cohérente avec les lieux, l'humidité et l'adhérence.

Générer des tronçons déterministes, raccordés sans bosse ni trou. Le résultat doit rester
identique indépendamment de l'ordre de chargement. Maintenir une fenêtre autour de chaque
joueur, même éloigné, avec mémoire bornée et précision maîtrisée à grande distance.

Mettre un compte à rebours et des checkpoints visibles, comme le principe arcade demandé
de Hang-On et OutRun. Chaque checkpoint valide ajoute du temps. À zéro, fin de
participation du joueur. Empêcher les bonus répétés par marche arrière, replacement ou
rechargement.

Chaque joueur possède son chrono et sa progression. Un joueur éliminé ne bloque pas les
autres.

Ajouter régulièrement des stations-service pour carburant, pneus et réparations. Garantir
une distance atteignable, y compris jusqu'à la première station. Le chrono continue
pendant le service : équilibrer les temps en conséquence.

Tester cycle complet, stations, franchissements proches de l'expiration, retours sur des
tronçons déchargés et quatre joueurs éloignés.

#### L — Cohérence et qualité générale

Améliorer les parcours manette, les menus, le HUD et les affectations. Corriger les
conflits de commandes avec le navigateur et les états bloqués après pause ou reconnexion.

Conserver un modèle commun de voiture et de pilote entre les vues. Corriger les poses
manifestement incohérentes, poignets, mains et intersections, en respectant les
proportions et références du projet.

Vérifier rivaux, trajectoires, entrées et sorties des stands, pneus, carburant, santé,
météo et caméras. Préserver les fonctions existantes, notamment les choix « Troll », sans
les désactiver pour obtenir artificiellement de meilleures performances.

### 4. Autres exigences à poursuivre

**F** doit dédupliquer les visiteurs par navigateur et réseau selon le master, avec IP
issue des proxys de confiance, empreinte HMAC, identité durable, opérations atomiques et
migration conservant l'historique. Afficher une estimation honnête et ne pas additionner
des uniques quotidiens pour fabriquer un total.

**J** exige des démos basses centrées sur la route, sans survol révélant le vide.
Rapprocher faune et flore des zones utiles. Faire voler hélicoptère et drones nettement
plus bas, sur des trajectoires distinctes et avec anticipation des obstacles.

### 5. Diagnostiquer les tests rouges et continuer

Reproduis les échecs parcours-ouvert, physx-circuits et russie. Identifie leur cause et
corrige les défauts démontrés. Ne relève pas les seuils et ne remplace pas les références
uniquement pour obtenir du vert.

Pour menu-arcade, vérifie le contrat derrière « onze circuits attendus contre neuf
disponibles ». Distingue objectif futur et régression actuelle. Ne crée pas de circuits
factices et ne supprime pas silencieusement l'objectif.

Conserve les échecs et réserves dans le suivi. Un problème local ne doit pas arrêter tous
les travaux indépendants.

Commence par enregistrer les consignes, rapprocher les acquis de leurs preuves et
compléter les défauts bloquants encore présents. Poursuis ensuite C/D, G/H/J, puis I,
avec L au fil du travail et F en parallèle lorsque possible.

Livre des modifications vérifiées dans le vrai jeu, avec captures et mesures pertinentes.
Continue jusqu'à réception des lots ou jusqu'à un blocage précis sur les tâches restantes,
sans me redemander de choisir entre des travaux déjà demandés.

---

## Acquis reconstitués (méga-prompt d'origine — pièce jointe non accessible)

Reconstitués depuis la mémoire KBZA partagée (notes `bitume-lots-2026-11-23-B-E`,
`bitume-complement-2026-11-23`) et le journal de session. À confirmer contre la pièce
jointe si elle redevient accessible.

- **K — Recul → accélérer** : après une marche arrière, reprendre l'avant était bloqué
  (`jeu.js` forçait `marcheArriere:true`). Corrigé dans `src/conduite.js` (sortie de recul
  sur intention avant `gaz>0||!autorise` ; frein du recul conditionné `(autorise&&gaz<=0)` ;
  sortie cinématique `autorise&&gaz<=0`). Preuve navigateur vrai jeu : base bloquée
  (rapport −1, v 0.01) vs correctif (rapport 1, v 4.74).
- **A — Route des Cimes (Aiglière)** : glissières/limites continues (entonnoir pente
  latérale ≤ 0,35 rejoué après `preparerParcours`) ; référence historique `cimes` créée
  (élargissement stands de `9703e71` accepté par David). Reste à qualifier le visuel
  (rochers suspendus, nappes, raccords d'étages, dessous, tunnel) — **Mac**.
- **B — Autodrome des Alizés** : dévers porté à ~40° (`asin(sin40°)`) avec rampe découplée
  `raccordDevers=64` vs `raccord=24` (`circuit.js creerOvaleDesForges`). Reste : requalifier
  sur toute la largeur + collisions.
- **E — Renommage** : circuit id `larche` → « Descente des Freins Chauds », sous-titre
  « Grand col alpin · plaquettes en surchauffe » ; id/graine/longueur conservés.
- **F — Visiteurs** : compteur `serveur/visites.mjs` ; dédup navigateur + réseau par empreinte
  HMAC (secret `fichier.sel`), IP via XFF seulement derrière proxys approuvés, aucune IP brute
  persistée, migration v1→v2 sans perte. Tension David 21/11 « pas d'IP persistée » résolue.
- **J — Aériens & démos** : hélico +30→+16 m, drones +22/+25→+10/+12 m, trajectoires
  distinctes, plus de téléportation ; `cameraHelico` +21→+11 m ; poids réalisateur
  orientés bas/proches. Reste : démos basses centrées route sans survol du vide, faune/flore
  rapprochées, anticipation obstacles.
- **Priorité d'exécution** : K, A, B, C/D, G/H/J, I, L ; E/F en parallèle quand possible.

---

## Tableau de suivi

Légende état : ✅ livré+qualifié · 🟡 partiel/en cours · ⛔ bloqué (préciser) · ⬜ non commencé.
« Preuves » = tests/commits/captures. « Réserves » = ce qui reste ou bloque.

| Lot | Périmètre | État | Commit | Preuves | Réserves | Prochaine action |
|-----|-----------|------|--------|---------|----------|------------------|
| K | Recul → accélérer | ✅ | `757ab11` | `recul-physx.test.mjs` (rouge base/vert fix) ; `reprise-recul.test.mjs` 21/21 ; preuve navigateur v 0.01→4.74 | — | Conserver ; re-test navigateur si conduite modifiée |
| A | Route des Cimes (glissières + visuel) | 🟡 | `d1f1d89`,`e2dab57`,`c1047a5` | `route-des-cimes.test.mjs` 9/9 ; entonnoir limites ; réf `cimes` ; **rochers flottants corrigés** (`c1047a5`) : colonnes de flanc et pitons posés sur `terrain.sol` (la colonne alignée piste contre les murs reste à la chaussée ; pitons jamais sous la voûte, chute des coins incluse) ; `appui-objets-cimes.test.mjs` : 537 rochers mesurés sur terrain dessiné + caisses solides, **149/537 à 1,2–23 m de ventre exposé → 0** ; tympans de portail (ouvrages à jambes) exclus ; `tunnel.test.mjs` vert ; build 0.2.303 | Visuel (nappes, raccords étages, dessous, tunnel) non qualifié (lavapipe blanc) ; 4 pitons limites (2/5 appuis sur pente, tolérés par le contrôle) | Passe Mac depuis vraies vues conduite ; puis lot I |
| B | Virages ~40° Alizés | 🟡 | `120f860`, `d43c064` | **Fausse référence corrigée** : le « 40° » de `120f860` était la valeur de config ; le mesh produisait `atan(sin 40°)`= **32,73°** (mesuré sur triangles PhysX). Fix `d43c064` : hauteur chaussée `d·tan(devers)` (14 sites), normale déclarée exactement perpendiculaire, `gN=G·sin(devers)` cohérent avec la pente réelle. `devers-alizes.test.mjs` 6/6 : 40° mesuré sur triangles PhysX au cœur des 4 gauches, plan toute largeur (résidus ≤ 2 cm, axe/roues/bords), sens extérieur, pas de ressaut (≤ 1,2°/m), contact=dessin. `reprise-recul`/`solides-physx-geometrie`/`-wasm` : contrats actualisés sur la formule remplacée. Build 0.2.302, **PHYSIQUE p55** | Rendu et ressenti (trajectoires course, rivaux) à confirmer sur Mac ; enregistrements p54 conservés séparés | Captures Mac Alizés + essai trajectoires basse/haute vitesse |
| C | Split-screen 3-4 joueurs | 🟡 | `05fcf96`,`fb7b602` | `split-screen.test.mjs` 8/8 (grille 2×2 DOM/CSS, `joueursLocaux` 1–4, `joueursIci` borné à 2, `S.nbJoueurs`/`S.locaux` 3–4 sans voiture fantôme, HUD J3/J4 distincts masqués, case carte animée à 3 sans dessin à 2/4, effets lourds coupés pour J3/J4) ; `minimap-zoom` 5/5 ; `hud-pneus` 14/14 ; `visites-serveur` 20/20 ; `visites-navigateur` 12/12 ; `salon-protocole` vert ; `course` + `cameras-course` verts ; build 0.2.300 | Implémenté : grille 2×2 (J1 haut-gauche, J2 haut-droite, J3 bas-gauche, J4 bas-droite), 4e case = carte animée du circuit à trois joueurs (suit le leader, sans pilote fantôme), une vue+HUD+minimap+commandes par pilote, J3 `IJKL`+`UO;NB`, J4 rangée `4-9`+`0-8`/`-`/`=`, manettes affectées jusqu'à 4 (défaut clavier si moins de manettes), en ligne resté à 2 locaux/machine. Effets désactivés explicitement pour J3/J4 (jamais lus chez le voisin) : rétroviseurs, pluie projetée/lentille, vitre, faune, bêtes, saisons, aurores. Reste : qualification visuelle Mac (lavapipe blanc), cadence réelle des 4 vues, ressenti J3/J4, touches à valider par David | Captures Mac grille 3 et 4 joueurs + perf ; ajuster touches/caméras J3/J4 sur retour Mac |
| D | Minimap zoomée défilante | 🟡 | `eeeed2e` | `minimap-zoom.test.mjs` 5/5 ; `hud-pneus.test.mjs` 14/14 ; build 0.2.300 | Suivi par abscisse curviligne `s`, joueur centré, tracé défilant, rivaux/stands/départ/virages difficiles dessinés, état indépendant par HUD. Reste : qualification visuelle Mac (lavapipe blanc), réglage optionnel zoom/plan complet si David veut garder la vue globale | Captures Mac HUD J1/J2 ; décider si une option « plan complet » est nécessaire |
| E | Renommage Descente des Freins Chauds | ✅ | `183597d` | CATALOGUE jeu.js ; méta index.html | — | Conserver id internes |
| F | Visiteurs navigateur/réseau, HMAC, proxys, atomique | 🟡 | `b666e99` | `visites-navigateur` 12/12 ; `visites-serveur` 20/20 (exit 0) ; salon-protocole vert | Implémenté : v2 avec `reseauxUniques`/`reseaux`, HMAC-SHA-256 tronqué via secret `fichier.sel`, IP lue depuis XFF seulement si connexion directe dans `BITUME_VISITES_PROXIES`, route POST passe `{ ip: compteur.ipClient(req) }`, migration v1→v2 sans perte, aucune IP brute persistée. Reste : config/proxys en production, éventuelle affichage titre si David veut la métrique réseau, déploiement Mac | Déployer/configurer proxys depuis Mac ; décider affichage `reseauxUniques` |
| G | Rendu photoréaliste | ⬜ | — | — | Visuel → Mac | Matières/éclairage/contacts + avant/après Mac |
| H | Végétation ×100 | ⬜ | — | — | Perf GPU → Mac | Instances/LOD/caches + mesures géométrie/draw calls |
| I | Route sans fin (arcade) | 🟡 | `f06b0bd`,`6a98c86`,`548fc80`,`3b1a498` | **I-1 noyau** (`f06b0bd`) : `src/route-sans-fin.js` — cycle obligatoire plage→plaine→petite→grande→petite→plaine (période 6), variantes de thème par (graine, index), tronçons purs de (graine, index) (état de bord = somme des déplacements), raccords C1 (courbure/pente de sortie tirées une fois, placage quintique 60 m, Hermite cubique altitude), bornes par biome ; `route-sans-fin.test.mjs` 7/7 (ordre de chargement indifférent prouvé, coutures sans bosse ni trou, chargement en parcours ouvert). **I-2 mode** (`6a98c86`) : `B.course.creer(…, {mode:'sans-fin', checkpoints, sansFin:{temps,bonus}})` — compte à rebours par joueur au vert, bonus rendu au checkpoint validé par le plus loin atteint (anti-abus marche arrière/replacement prouvé), élimination à zéro sans bloquer les autres, chrono par joueur, pas de ligne d'arrivée ; `route-sans-fin-course.test.mjs` 5/5 | I-3 stations-service et I-4 intégration jeu (fenêtre glissante décor/PhysX, menu, HUD, météo cyclique) non faits ; 4 joueurs éloignés et retours sur tronçons déchargés à tester en I-4 **I-3 stations** (`548fc80`) : `stationsEntre` pur et mémoïsé, cible 2 400 m, écart garanti 1 800–3 600 m, première ≤ 2 500 m, ≥ 208 m droits et plats (κ ≤ 1/90, pente ≤ 0,055 ; minimax sous échéance) ; essence toujours active en sans-fin, multiplicateur `conso` (défaut 20 → portée ≈ 4,9 km > écart max) ; `route-sans-fin-stations` 5/5 (cycle complet entree→service→repare→sortie, plein, pneus neufs, réparations, chrono couru). **I-4a fenêtre** (`3b1a498`) : `route-sans-fin-fenetre` — fenêtre déterministe sur positions absolues, derrière 600 / devant 1 400 m, plafond de tronçons, libération derrière, traduction absolue ↔ fenêtre, station active en repère circuit ; 6/6. Reste : I-4b branchement jeu.js (écran, HUD compte à rebours, décor/PhysX par intervalle), météo cyclique, test 4 joueurs éloignés en jeu | I-4b : brancher la fenêtre dans preparerSeance/pasSimulation (setNappes/setLots par intervalle, solides PhysX par plage), bouton « Route sans fin », HUD temps restant par joueur |
| J | Aériens & démos | 🟡 | `d63c523`,`3d6c24c`,`e44d90a` | `verif-aeriens.mjs` (h/drones bas, séparations) ; `terrain-corrections.test.mjs` 3/3 ; `demos-course-virages` | Démos basses centrées route, faune/flore proches, anticipation obstacles | Compléter J ; qual visuel Mac |
| L | Cohérence & qualité générale | ⬜ | — | — | — | Manette/menus/HUD, modèle commun, poses, Troll préservé |

### Tests rouges (état 2026-11-23)

**Vrai périmètre (détection par code de sortie, pas par « fail ») : 79 fichiers sur 238 sont
rouges** (≈ 33 %). C'est une dette massive préexistante (sessions inachevées + commits
automatisés « R##### » `[skip ci]`), **pas** des régressions de cette session : chaque échec
reproduit à l'identique sur HEAD propre. Un problème local n'arrête pas les travaux
indépendants. À trier par familles, sans jamais relever de seuil ni truquer une référence.

**Cause systémique découverte — inflation de `PHYSIQUE`** : `jeu.js` est à `PHYSIQUE = 'p54'`
mais plusieurs tests l'épinglent à `'p17'` (`records-physique`, `chaussee-preparation`,
`determinisme-simulation`, `russie`). Sur les 40 derniers commits ayant modifié `PHYSIQUE`,
**seuls 6 touchaient `conduite.js`** : 34 bumps pour des changements non-conduite
(implantation d'habitations, rochers, traces de pneus, humidité…). Violation de la règle
AGENTS.md (« seul un vrai changement de conduite bump PHYSIQUE ») par le processus automatisé
« R ». **Conséquent pour les records/fantômes → à trancher par David** (dé-inflation ou
acceptation). Ne pas « verdir » les tests en épinglant p54 : ce serait masquer le défaut.

| Test | Symptôme | Cause établie | Décision / état |
|------|----------|---------------|-----------------|
| `parcours-ouvert` | décélération insuffisante (45 m/s après l'arrivée) | **Régression fc3c5fe** : cible de freinage post-arrivée au fond du dégagement → la voiture finie coastait | **CORRIGÉ** `d19c7a9` : frein ferme, jamais de gaz, arrêt prompt réparti. 8/8 |
| `russie` (nom) | attendait nom 'Baïkal' | Renommage intentionnel `783ef1f` → « Circuit de la Glace Vive » | **CORRIGÉ** `b6f80fe` : référence à jour |
| `russie` (84 tableaux) | sha `val-brule` ≠ baseline '0252' | Élargissement stands `9703e71` (accepté par David, réf `cimes`) | **CORRIGÉ** `b6f80fe` : re-basé `cimes`, tracés vérifiés identiques au courant |
| `russie` (neige) | « replacement de L. Brasquet » (1≠0) | Rival bloqué en neige (sec et pluie passent) | **Gameplay neige réel** — à diagnostiquer (adhérence/IA neige), pas de seuil truqué |
| `russie` (catalogue/PHYSIQUE) | `PHYSIQUE` p17 ≠ p54 | Inflation PHYSIQUE (ci-dessus) | **Bloqué — arbitrage David** |
| `physx-circuits` (Baïkal) | saut encore en l'air à 1 s (`saut` true≠false) | Saut PhysX Baïkal : arc trop long / montée ne rattrapant pas à s≈2520 | **À diagnostiquer** (terrain/vélocité Baïkal), propre au lot 13A |
| `menu-arcade` | `catalogue.length` 9 ≠ 11 | Objectif « 16 circuits » : 2 circuits non livrés | **Objectif futur** — pas de circuits factices, ne pas supprimer l'attente |

### Historique de mise à jour du suivi

- 2026-11-23 : création du fichier canonique ; consignes David 2026-11-23 enregistrées
  verbatim ; acquis K/A/B/E/J reconstitués ; dépôt vérifié à `832f6f6` (0.2.299).
- 2026-11-23 (suite) : fixes de tests sûrs (`conduite` stub, `cameras-course` scope) ;
  **parcours-ouvert corrigé** (régression fc3c5fe, `d19c7a9`) ; **russie** nom + 84 tableaux
  re-basés `cimes` (`b6f80fe`) ; **état réel de F établi** (navigateur/atomicité/migration OK,
  réseau/HMAC/proxy manquants) ; **vrai périmètre rouge mesuré : 79/236** ; **cause
  systémique PHYSIQUE p17→p54 sur-inflée découverte** (34/40 bumps non-conduite) → arbitrage
  David. Prochaine action : dimension réseau de F (HMAC+proxys, sans IP brute), puis lots C/D.
- 2026-11-24 : **F réseau commité** (`b666e99`, tests serveur/navigateur verts) ; **D minimap
  zoomée commitée** (`eeeed2e`) ; **C écran partagé 3-4 joueurs commité** (`05fcf96`,
  `fb7b602`, `9fcdbdb`) avec grille 2×2, case carte animée à trois joueurs et harnais adaptés ;
  **stands corrigés** (`e3490b1`) et **options image** (`c3c2d27`) ; périmètre rouge re-mesuré
  **79/238** (aucune nouvelle régression détectée par comparaison avec `2f5ff3f`).
- 2026-11-24 (session reprise) : post-coupure vérifié (aucun lock git, arbre propre, aucun
  processus orphelin, `dist/` du 02:04 cohérent) ; baseline revérifiée (`construire.py` reproduit
  0.2.301, FERRO 0.3.33 35 modules ; 11 tests ciblés verts). **Incident production corrigé** :
  le site servait **V0.2.90** (`ac6a74a4`, basculé dans `current` le 23/11 22:00 GMT par erreur) ;
  rollback atomique documenté (`ln -sfn` + `mv -T`) vers `releases/e2dab57…` = **0.2.299**, sha256
  servi `ee016800…` identique au `dist/bitume.html` commité ; `/salon/sante` 200. Note flotte
  `bitume-incident-deploiement-0290-20261124`. `REPRISE.md` et `ETAT.json` rapprochés de l'état
  réel (0.2.301 local, 15 commits devant origin). Prochaine action : B requalif largeur+collisions,
  A contrôles géométriques programmatiques, puis lot I (route sans fin).
- 2026-11-24 (lot B) : **la référence « dévers 40° » de `120f860` était fausse** — mesure sur les
  triangles PhysX réellement produits : **32,73°** (`atan(sin 40°)`, la hauteur de chaussée employait
  `d·sin(devers)` avec latérale horizontale pleine). Corrigé par `d43c064` : hauteur `d·tan(devers)`
  sur 14 sites (decor/circuit/conduite/chaussee/couverts/destinations/equipe-stands/jeu/physique/
  vegetation), normale `(sin,cos)` désormais exactement perpendiculaire au plan produit, `gN` cohérent.
  Nouveau contrôle `devers-alizes.test.mjs` 6/6 sur triangles PhysX. Trois tests épinglaient l'ancienne
  formule (`reprise-recul`, `solides-physx-geometrie`, `solides-physx-wasm`) : contrats actualisés,
  aucun seuil abaissé. **PHYSIQUE p54→p55** : bump légitime (géométrie de conduite réellement changeante,
  documents p54 conservés sous leurs clés), à distinguer de l'inflation préexistante en arbitrage David.
  Suite complète : 77 rouges, identiques à la base propre, **aucune régression**. Build 0.2.302.
