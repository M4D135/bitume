# BITUME — consignes pour les agents

## Reprise par petits lots

Lire d'abord `REPRISE.md` et `docs/reprise/ETAT.json`, volontairement courts. N'ouvrir que la fiche du lot actif et les extraits de source nécessaires. Ne pas recharger les anciennes discussions, les archives ou le HTML généré en entier. Conserver les sorties complètes sur disque et ne rendre que les conclusions utiles. Actualiser le point court après chaque lot publié.

Jeu de course de monoplaces dans le navigateur, original : circuits générés, onze rivaux, dérive et turbo.
Une seule page HTML, moteur FERRO (WebGL2), tout est calculé par le code.

## Règles du projet

- **Jeu original.** Rien n'est pris au Vroom de Lankhor :
  - ni tracé relevé, ni table ST ou Amiga, ni leurs valeurs ;
  - ni son extrait, ni dessin, ni nom ;
  - ni bandeau d'affichage, ni bannière, ni composition du cockpit Amiga.

  Les mécaniques de jeu peuvent être reprises si on les refait avec notre code et nos constantes :
  - celles inventées pour vroom-unreal, le projet Unreal de David ;
  - celles du genre que le jeu de 1991 avait déjà, quand David les demande : le saut roue contre roue, le
    12/11/2026.

  Dans le doute, demander à David. La règle détaillée est dans `FEUILLE-DE-ROUTE.md`.
- **Aucun fichier d'image ni de son**, aucune police chargée, aucun appel réseau. Le budget de la page est de
  1,4 Mo (`construire.py`).
- Textes du jeu en français. Interface et design : Claude. Le Spark écrit des premiers jets, relus avant intégration.
- Le moteur `src/moteur/renderer.js` ne se retouche qu'avec la marque « BITUME » et une ligne dans
  `src/moteur/PROVENANCE.md`.
- Commits limités aux fichiers de la tâche ; dépôt GitHub privé `M4D135/bitume`. Aucune mise en ligne sans demande
  de David (voir « Mettre en ligne »).

## Structure

| Fichier | Rôle |
|---|---|
| `src/circuit.js` | Tracé généré par graine : arcs et droites, relief, dévers, vibreurs, glissières, trajectoire, vitesse de référence |
| `src/decor.js` | Décor tiré du circuit : nappes (chaussée, accotements, terrain, eau) et lots (arbres, tribunes, portique, glissières) |
| `src/conduite.js` | Conduite : modèle à deux essieux (transfert de charge, ellipse d'adhérence, lacet), intégré dans la caisse puis porté en repère de Frenet (s, d) ; boîte, départ, pente, aspiration, aide au volant, dérive chargée, turbo, glissières |
| `src/course.js` | Grille, feux, IA, contacts, tours, drapeau, classement, fantôme du chrono |
| `src/son.js` | Synthèse Web Audio : moteur, rivaux, pneus, vibreur, herbe, chocs, signaux |
| `src/carene.js` | Carènes (peau entre sections en superellipse) et tubes lisses, en triangles pour les formes libres du moteur |
| `src/main.js` | Main gantée du pilote en carènes et tubes (gant, paume, garde, manchette, sangle), prise à 3 h sur la branche ; la gauche en miroir |
| `src/voiture.js` | Monoplace en primitives du moteur, cockpit vu du siège, fantôme translucide |
| `src/traces.js` | Traces de pneus (512 bandes, effacées en 24 s), fumée et étincelles (48 chacune), à 30 Hz, en objets transparents |
| `src/realisateur.js` | Réalisateur de la démo : choix du plan (caméra et voiture filmée) d'après la course |
| `src/humain-donnees.js`, `src/humain-corps.js` | Tête et corps procéduraux d'EMPRISE (copies exactes du commit 509b2ec) : le pilote, sous son casque |
| `src/reseau.js` | Jeu en ligne à deux : salon, liaison WebRTC (repli par le salon), horloge commune, paquets d'état, prolongation |
| `serveur/salon.mjs` | Salon du jeu en ligne (Node, sans dépendance) : codes de partie, mise en relation, relais |
| `src/jeu.js` | Coque : boucle à pas fixe, commandes, caméras, rendu d'une image, affichage, menus, démo, stockage local |
| `src/index.html`, `src/style.css` | Page (gabarit `/*STYLE*/`, `<!--MODULES-->`) et style, polices du système |
| `src/meteo.js` | Fronts météo, pluie projetée dans le monde, vent et humidité persistante, adaptés d’EMPRISE |
| `src/moteur/renderer.js` | FERRO repris d’EMPRISE, adaptations BITUME (voir PROVENANCE.md) |
| `construire.py` | Assemble `dist/bitume.html` (versionnée), `dist/artefact.html` (non versionnée) et `SIZE.json` |
| `verifications/*.test.mjs` | Tests Node des modules de simulation et du son |
| `deposer.sh`, `deploiement/` | Mise en ligne de la page du commit sur bitume.estrasse.fr, et son vhost Caddy |

Chaque module s'écrit `(function (B) { … })(globalThis.BITUME = globalThis.BITUME || {})` et s'exécute aussi dans
Node pour les tests. Ordre de chargement : celui de `MODULES` dans `construire.py` (renderer et FERRO, circuit, conduite, degats, contacts,
obstacles, course, son, decor, carene, humain-donnees, humain-corps, main, voiture, traces, realisateur, meteo, reseau,
jeu).

## Décisions de David — 18 novembre 2026, nature et conditions

- Conditions uniquement avant course : saison, moment et météo ont chacun les modes Manuel, Aléatoire et Réel.
- Le mode réel demandé utilise la date et l’heure réelles, et la météo de la localisation approximative du joueur par IP.
  Cette demande autorise les appels HTTPS de localisation IP et de météo uniquement pour ce mode ; aucun appel de ce
  type en Manuel ou Aléatoire. Prévoir une reprise locale explicite en cas de réseau indisponible ; ne pas persister IP
  ni coordonnées. Les pilotes en ligne utilisent les conditions choisies par l’hôte.
- Printemps fleuri blanc/rose ; été ensoleillé à végétation sèche ; automne orangé avec feuilles qui tombent ; hiver
  enneigé sauf Port-Sable, circuit du Sud. Neige visible dans l’air et sur la vitre, pluie ruisselant sur la vitre.
- Menus regroupés en onglets, entièrement praticables à la manette. Préserver le lien m4d135 de téléchargement.
- Vraies clairières et poches denses ; herbe détaillée proche, simplifiée au milieu, couleurs du terrain au loin.
- Courte détection graphique avant le titre au premier lancement, mémorisée ; relance dans Image appliquant les
  réglages recommandés même après modification manuelle. Ne pas annoncer de gain FPS sans mesure matérielle.

Formes libres : `window.FRender.forme(nom, triangles)` enregistre une forme faite de triangles `[p0, p1, p2, n0, n1,
n2]` tenus dans le cube unité (`B.carene.normaliser`) ; l'instance porte la vraie taille dans `s`. À appeler avant
`FRender.create` : `voiture.js` le fait à son chargement.

## Conventions

- y vers le haut. Un cap `a` a pour tangente (cos a, sin a) dans le plan (x, z) et pour droite (−sin a, cos a).
- Repère du circuit : abscisse `s`, décalage `d` (> 0 à droite). Courbure > 0 : virage à droite.
  Dévers > 0 : côté droit plus bas.
- `voiture.attitude(cap, tangage, roulis)` = Ry(−cap)·Rz(tangage)·Rx(roulis), tangage > 0 nez levé.
- Caméra FERRO : `yaw = cap + π/2`, `roll = −roulis`. Le champ (`fov`) est vertical, en degrés, borné de 10 à 110.
- Simulation déterministe au pas fixe de 1/120 s, hasard par mulberry32 à graine.
- Records et fantômes portent la version de la physique (`PHYSIQUE` dans `src/jeu.js`, actuellement `p9` en 0.2.38) : changer effectivement la conduite oblige à incrémenter depuis la valeur présente ; une refonte visuelle seule la conserve.
- Mouvement : le réglage « Secousses » (0 à 100 %) règle les secousses des chocs et le tremblement du casque ; nul à
  0 %, il part de 0 quand le système demande moins de mouvement (`prefers-reduced-motion`).

## Décisions de David à tenir (12/11/2026)

- **Musique** : « pas de musique sauf à l'écran titre ». `son.musique(oui)` ne joue que le thème du titre
  (`B.son.THEME`) ; il se coupe sur tout autre écran, démo comprise. Un signal de course tient sur une seule hauteur :
  ni mélodie ni accord (`verifications/son.test.mjs` le vérifie).
- **Cockpit** : cadrage de vroom-unreal 0.35 (`docs/images/cockpit-035-neutral.png` de ce dépôt-là). Le volant est gros
  et bas, 16° sous l'horizon, le bas de sa jante sort de l'image ; on voit les mains, pas les bras. Les gants sont
  articulés (trois phalanges par doigt, pouce, sangle au poignet), construits en code : le maillage des gants de
  vroom-unreal vient de Valve et ne se copie pas. Les mains (`src/main.js`) tiennent la jante à 9 h et 3 h sur les
  branches, comme dans vroom-unreal : dos tourné vers le dehors, pouce couché sur la jante. Volant, planche et mains se règlent dans `VOLANT`, `PLANCHE`,
  `COUDE` et `LEVIER` de `src/voiture.js` ; `verifications/voiture.test.mjs` tient le cadrage.
- **Champ du cockpit** : 60 degrés par défaut (David, 14/11/2026). Le curseur du menu reste réglable de 60 à
  105° (`champ` dans `src/jeu.js`, `v-champ` dans le menu) ; un pilote qui a monté son curseur le garde.
  David demande le 16/11 un champ plus serré sur téléphone en portrait : adaptation de projection dédiée,
  sans changer la valeur mémorisée ni le cadrage paysage/ordinateur. ATH et commandes en surimpression ;
  carte toujours en haut, emplacement gauche/droite, taille et visibilité réglables.
- **Clipping** : rien ne se coupe à distance. Plan lointain `PORTEE_VUE` (6 000 m), lots sans portée propre, bascule
  de détail à 520 m, ombres du soleil sur tout l'atlas (`sunOnly`, carré de 200 m). Ne pas réintroduire de coupe à
  distance sans fondu.
- **Démo** : « comme dans Point de rupture » et « qui dure ». Elle part après 5 s sans geste sur le titre, enchaîne les
  courses sans fin et ne revient au titre que sur un geste.
- **Voiture** : les cotes et la silhouette de la 312 T5, sans le nom Ferrari, sans cheval cabré, sans commanditaire.

## Construire, tester, vérifier

Décisions de David du 16/11/2026 : les collisions ordinaires sont moins sévères ; après un accident, remettre la
voiture sur la piste en moins d’une seconde. Cette décision remplace l’ancienne épave définitive et l’attente de
réparation. Garder les débris des gros chocs, les obstacles solides, et invalider le chrono du tour avec replacement.
Maintenir le frein à l’arrêt engage la marche arrière du joueur, limitée à 12 km/h ; l’IA et la grille restent au frein.
Le moteur 3D et les effets météo reprennent ceux d’EMPRISE ; préserver WebGL2, les nappes/lots du circuit et le HUD mobile.

```bash
python3 construire.py
```

```bash
for t in verifications/*.test.mjs; do node "$t" | tail -1; done
```

Dans le navigateur, servir `dist/` en local (`.claude/launch.json`, port 8781, 127.0.0.1) puis ouvrir `bitume.html`.
Dans la console, `BITUME_JEU.avancer(secondes, true)` fait avancer la séance en confiant la voiture du joueur à l'IA,
et `BITUME_JEU.session` donne l'état. La séance devient d'essai : elle n'écrit plus ni record ni fantôme. Un volet de
navigateur caché bride les images par seconde, ou les arrête : ne mesurer les performances que volet visible.

`await BITUME_JEU.banc({ duree: 20, qualite: 'high', circuit })` lance une course en qualité fixe, la voiture du
joueur à l'IA, grille et feux passés. Après une seconde de chauffe, il mesure l'intervalle entre images pendant 20 s,
revient à l'écran titre et rend en JSON `p50`, `p95` et `pire` (ms), le temps des effets (`effets`) et les effets
vivants (`traces`). Il n'écrit ni record ni fantôme. Critère sur le Mac, en 1390×1295 : p95 ≤ 16,7 ms, pire
≤ 29 ms.

Autres outils d'essai de `BITUME_JEU` :
- `pauseAuto = false` : la course ne se met plus en pause quand la page perd le focus (captures, banc) ;
- `camera = (pose, camera) => ({ pos, yaw, pitch, fov })` : vue libre, par exemple un gros plan sur le volant ;
  `camera = null` rend la vue du jeu ;
- `demo(i)` : lance la démo sur le circuit `i` sans attendre les cinq secondes ; `session.planVu` donne le plan ;
- `son` : `{ actif, voix, musique }`.

Le son ne démarre qu'après un vrai geste (clic ou touche), jamais sur un clic simulé par script.

## Mettre en ligne

Seulement à la demande de David : `./deposer.sh`, depuis le Mac. Le script refuse de partir si `src/`,
`construire.py`, `dist/`, `SIZE.json`, `deploiement/` ou lui-même ne sont pas commités, ou si la page reconstruite
diffère de celle du commit. Sur amiga (compte `ddd`, sans root), il dépose `~/apps/bitume/releases/<commit>/index.html`,
contrôle l'empreinte, bascule le lien `current` d'un coup et garde 3 versions. Il repose le vhost dans
`~/apps/caddy-shared/vhosts.d/` si `deploiement/bitume.estrasse.fr.Caddyfile` a changé, puis vérifie que la page
servie a la même empreinte. Aucun timer : le VPS n'a pas accès au dépôt privé. Le retour arrière est en tête du script.

Le salon du jeu en ligne part avec la page : `serveur/salon.mjs` dans `~/apps/bitume/salon/`, service utilisateur
`bitume-salon` (`deploiement/bitume-salon.service`, 127.0.0.1:8790), servi par Caddy sous `/salon` (WebSocket,
`stream_close_delay` de 10 min). Il n'est reposé et relancé que s'il a changé ; le script vérifie
`https://bitume.estrasse.fr/salon/sante`. Couper le jeu en ligne : `systemctl --user disable --now bitume-salon`.


## Décisions de David — 16 novembre 2026, soir

- **Champ du cockpit** : « fov moins prononcé », « bras de 10 km ». Défaut 60°, ouverture de vitesse de 5 % ; plus
  étroit que 16:9 (fenêtre presque carrée, portrait), le jeu garde la diagonale du cadre 16:9 au lieu de tout le champ
  horizontal. Volant, planche et levier 12 % plus près de l'œil, 15,5° sous l'horizon.
- **Rétroviseurs** : « les deux rétros bien visibles et bien foutus, pas de central ». En vue cockpit, deux
  rétroviseurs dédiés (`RETRO` de `src/voiture.js`) à 21° du regard ; chaque glace reçoit l'image réelle de la scène
  arrière (second rendu FERRO, `majGlaces` de `src/jeu.js`, posé par matrix3d). Réglage « Image des rétroviseurs ».
- **Pneus** : « choisir les pneus, présélectionnés selon le climat, distinguer les types en jeu ». Slicks,
  intermédiaires, pluie (`PNEUS` de `src/conduite.js`, adhérence selon l'eau sur la piste) ; présélection à la
  préparation selon la météo prévue ; rivaux sur les pneus conseillés au départ ; cercle peint sur le flanc (jaune,
  vert, bleu) et rainures ; pastille « Pneus » dans l'affichage.
- **Version** : « incrémente les versions à chaque maj ». `construire.py` monte le dernier nombre de `VERSION.json`
  une fois par mise à jour dont les sources changent ; ne pas éditer la version à la main, sauf pour un grand lot.

## Décision de David — 16 novembre 2026

Aucun plafond de taille du code, du moteur ou des builds. Cette décision remplace les anciens budgets en octets ci-dessus. Le contenu graphique et sonore reste entièrement procédural. Mesurer les tailles et les performances, sans réduire les fonctionnalités pour respecter une limite de fichier.

Les modules listés dans `FERRO.lock.json` sont désormais des copies exactes de la référence `M4D135/FERRO:src/ferro`. Cette décision remplace les anciennes consignes de retouche locale du moteur : corriger la référence et propager une version qualifiée ; conserver les adaptations du jeu hors de ces modules.

## Décisions de David — 16 novembre 2026, nuit

- **Jeu en ligne à deux** : « le multijoueur en ligne, deux pour commencer », « netcode précis et léger, pas de lag,
  précision absolue », « fais les deux modes, solo et online ». Pour ce seul mode, la demande lève la règle « aucun
  appel réseau » : « En ligne » ouvre un WebSocket vers le salon (`serveur/salon.mjs`, même hôte que la page,
  chemin `/salon` ; `?salon=ws://…` pour les essais) et une liaison WebRTC directe (STUN publics de Google), avec repli
  par le salon au bout de 7 s. Le jeu seul ne fait toujours aucun appel réseau. Chaque machine conduit sa voiture
  sans attendre le réseau ; horloge commune ; état envoyé à chaque image ; voiture distante prolongée puis corrigée en
  0,12 s. L'hôte fait courir les rivaux et annonce les temps officiels. La course attend les deux pilotes ; à la
  fin, l'hôte lance la revanche ; une coupure confie l'autre voiture à l'ordinateur. Salon installé sur amiga avec
  l'accord de David (« go », 16/11) : voir « Mettre en ligne ».
  Puis (16/11) : « en ligne jusqu'à quatre ; deux en local contre deux en local ; deux en local contre un seul ». De deux
  à quatre machines par partie, une ou deux voitures humaines chacune (écran partagé), quatre pilotes au plus ; maillage
  de liaisons directes (la plus ancienne machine appelle la plus récente), relais par machine ; horloge de l'hôte ;
  une machine qui part laisse ses voitures à l'ordinateur de l'hôte (`v.reprise`) ; sans hôte, chacun finit seul. Les
  voitures humaines tirent toujours leurs nombres au générateur de la course : la grille est la même partout.
  Avant chaque course en ligne (David, 16/11 : « pourquoi les autres ne peuvent pas choisir les pneus ? », « un écran
  de confirmation quand tout le monde est prêt ») : l'hôte annonce la course (circuit, tours, météo prévue) ; l'écran
  « Avant le départ » (`prets`) laisse chaque machine régler pneus, boîte, vue et commandes puis se dire prête ; la
  course part quand toutes les machines liées le sont ; l'hôte reprend les pneus de chacun dans la configuration.
  Suite, David, 16/11 après la mise en ligne de la 0.2.7 : « on verra plus tard le online, mais je veux du peer to
  peer avec mini serveur pour rejoindre les joueurs, un truc léger, sans besoin de ports ouverts ». Le serveur ne
  sert qu'à se trouver ; la partie passe d'une machine à l'autre ; aucun joueur n'ouvre de port.
- **Tunnel** : « dans le circuit Haut-Col, fais une partie dans un tunnel ». 260 m au milieu de la plus longue ligne
  droite (rayon > 400 m, insensible aux courbures de l'ordre de 1e-15 qui changent d'un moteur JavaScript à l'autre) ;
  les murs sont les limites, en entonnoir sur 40 m. L'intérieur est éclairé « dedans » (`outdoor: false`) par ses
  lampes, l'œil s'adapte ; la piste y est sèche et il n'y pleut pas. `tunnel.test.mjs` le tient.
- **Pilotes** : tête et buste d'EMPRISE sous un casque intégral (coque, visière teintée, bandeau aux couleurs de la
  voiture). Les triangles d'EMPRISE gardent l'ordre de leurs indices : retournés, ils montraient le pilote de dedans.
- **IA** : caractère par pilote (combativité, défense, régularité), aspiration en ligne droite, défense de
  l'intérieur une fois par virage.
- **Écran partagé à deux** : « multi en écran splitté local, 2 manettes possible, écran adapté, un sur l'autre ou un à
  côté de l'autre, au choix ». Menu « À deux », réglage « Écran » (`reglages.partage`). Un seul moteur de rendu : la
  vue du joueur 2 est rendue d'abord et copiée dans la toile 2D `#scene2`, puis celle du joueur 1 reste dans `#scene`,
  chaque toile à sa moitié. État de caméra du joueur 2 : `S.vueJ2` (hérite de la séance). Affichage du joueur 2 :
  copie de `#hud` (`#hud2`, mêmes identifiants), messages de tours propres à chacun ; pluie à l'écran (`#meteo2`) et
  rétroviseurs vivants (`#glace-g2`, `#glace-d2`) par joueur ; vibration de chaque manette.
- **Commandes de chaque joueur** (David, 16/11 : « choix manette, clavier ou souris, et gérer les touches de chacun » ;
  « clavier normal pour un et pavé numérique pour l'autre » ; « souris aussi, comme le vrai Vroom ») : appareil par
  joueur (`reglages.commandes` : auto, manette, clavier, souris) et deux touches par action (`reglages.touches`,
  `TOUCHES_DEFAUT` de `src/jeu.js` : flèches et ZQSD pour le joueur 1, pavé numérique pour le joueur 2), réglables
  dans les réglages. Manettes : deux pour deux ; une seule va au joueur 2. Souris refaite ici : position du pointeur
  pour tourner, bouton gauche gaz, droit frein, molette rapports ; en Auto, au joueur seul ou au joueur 2.

## Décisions de David — 18 novembre 2026, Russie, Monaco et pneus

- Préparer et publier le plan détaillé avant implémentation : `docs/reprise/12-PLAN-MAITRE-RUSSIE-MONACO-PNEUS.md`. Ce volet est la priorité actuelle du plan maître.
- Ajouter un circuit en Russie et un **Monaco ultra fidèle**, reconstruit à partir du vrai parcours et de références vérifiables. La référence 2026 et le thème russe Baïkal sont les choix de départ documentés du plan ; Baïkal reste une proposition de localisation, pas une demande littérale de David.
- Russie, Monaco et Spéciale Marseille entrent dans l’objectif de 16 ; préserver les sept circuits actuels, leurs identifiants et graines. La reconstruction de Monaco est indépendante des tracés ou données de Vroom et des autres jeux.
- Refaire les roues rondes et plus réalistes ; slick lisse, intermédiaire conservé, sculptures pluie et neige distinctes ; usure progressive visible, attachée à chaque roue et liée au roulage.
- Préserver les dimensions de la monoplace et distinguer les lots visuels des changements de physique. Le type neige, l’état de chaussée, les stands et le réseau doivent rester cohérents.
- Un seul sous-lot actif, premier lot **12A** ; publications fréquentes sur `main`, reprise courte et preuves de validation. Les sources/builds réellement modifiés sont publiés à leur jalon, et les validations WebGL manquantes restent explicites.

## Complément de David — 18 novembre 2026, Marseille et passation

- Ajouter **Spéciale Marseille**, à partir de la carte de **M4D135/emprise**, et **du relief** : terrain altimétrique cohérent avec routes, bâtiments et collisions. Fiche `docs/reprise/15-SPECIALE-MARSEILLE-RELIEF.md`.
- Source examinée : EMPRISE 0.6.8, commit `cc004826a506e6979eaaec217748fe85d5cd6ac5` ; centre plat, relief périphérique synthétique. Conserver provenance/attributions et adapter au FERRO BITUME.
- Préparer la master liste complète pour reprise avec **Claude Fable** : `MASTER-LISTE-CLAUDE-FABLE.md`. Elle distingue 7 circuits livrés, 3 ajouts demandés et 6 propositions pour atteindre 16.
- La reprise courante prépare les documents ; aucun des nouveaux lots de code n’est encore réalisé. Premier lot d’exécution : **12A**.

## Décisions de David — 18 novembre 2026, soir : fluidité, conduite, public, pluie, échappements, photoréalisme

Ses mots, dans l'ordre où ils sont arrivés. Chaque demande a son lot ; l'ordre de travail est dans `REPRISE.md`.

- **Fluidité (lot 5B)** : « optimise son moteur pour le rendre le plus fluide possible sur n'importe quelle machine, aucun accro de buffering ou autre pendant le jeu, precache en debut de niveau, fais tout pour tout avoir en ram et que ça soit 100% fluide 30fps ou 60 fps ou 120fps ». Fiche `docs/reprise/05B-FLUIDITE.md`.
- **Conduite (lot 17)** : « il faut aussi améliorer la réaction du vehicule sur la route, la sensation de conduite doit être la plus fidèle et la plus logique et cohérente niveau physique. regarde les meilleures info forum etc de fans de reglages de simulateurs de f1 pour comprendre les mecanismes, renseigne toi un max pour rendre le pilotage realiste et surtout ultra fun et arcade à la fois ». Changer la conduite change la version de physique (`p9` → `p10`).
- **Vibration** : « je ne veux pas de vibration dans la manette pendant les menus accueil et selecton course etc ». Fait en 0.2.39 : la manette ne vibre que sur l'écran de course, quand un joueur conduit (`manetteVibre` de `src/jeu.js`).
- **Public (lot 18)** : « je veux que tu prennes les beaux modeles human body de notre jeu emprise et que tu remplace les cubes dans le public par des vrais modeles humains, animés etc ». Source : `M4D135/emprise` (jeu de David), provenance à consigner.
- **Pluie et neige sur l'écran (lot 19)** : « améliore enorement les effets de gouttes de pluie et de neige sur l'ecran, faut meme que ça devienne genant parfois, comme si on était dans la réalité ».
- **Échappements (lot 20)** : « aussi flamme dans les pots d'echappement quand surregime et pop and bang quand passage vitesse comme dans la realité et ça permet de voir pour le passage vitesse en vue extérieure, fais cet effet aussi sur les voitures concurentes pour plus de realism ».
- **Photoréalisme (lot 21)** : « améliore aussi les effets dans l'eau et les ombres » ; « les effets de lumière aussi, je veux du photoréalisme à fond ! ». À concilier avec le lot 5B : les effets coûteux vivent dans les paliers hauts et se coupent sans accroc ; la qualité Légère reste légère.
- **Génération procédurale (lot 22)** : « améliore la géération procedurale, rend la plus détaillée, meilleures matières etc, plus diversivfié et aléatoire ».
- **Cockpit (lot 23)** : « améliore aussi la qualité graphique du cocpit, matériaux reflets, grnularité rugausité matérieaux, texture compressée genre avec relief et effet digne du dlss5 » ; « il faut qu'on ait plaisir en vue cockpit a admirer les détails et la qualité ». Tout reste produit par le code : le relief et le grain viennent de matières procédurales, la netteté d'un suréchantillonnage ou d'une remise à l'échelle soignée dans le moteur.
- **Vibrations de manette (lot 24)** : « améliore les vibration à la manette ». En course seulement (voir la 0.2.39). À faire avec la conduite : glisse, blocage, patinage, vibreurs au rythme de la vitesse, bosses de la route, passage de rapport, charge de la dérive ; gâchettes vibrantes quand la manette et le navigateur les offrent.
- **Circuits (lot 22, suite)** : « ajoute plus de relief aux circuits, plus d'irrugularité sur les routes, plus d'aménagement accessoire course etc ». Les tracés en plan, les identifiants et les graines des sept circuits restent ; le relief, le dévers, les irrégularités de chaussée et le mobilier de course s'enrichissent. Les bosses qui agissent sur la voiture relèvent de la physique `p10` (lot 17).
- **Tunnels (lots 22 et 21)** : « plus de passage en tunnel, améliore eclairages dans tunnel, pas de clipping ». Aujourd'hui seul Haut-Col a un tunnel (260 m). À faire : des passages couverts sur d'autres circuits (lot 22, avec le relief), un éclairage de tunnel soigné (lot 21 : lampes, flaques de lumière, adaptation de l'œil) et aucune coupe de géométrie ni caméra qui traverse une paroi, dans toutes les vues et dans les rétroviseurs.
- **Voiture (lot 25)** : « améliore le vehicule qui doit avoir une qualité photoréaliste à fond avec tous les effets possibles ». Suit les lots 21 (lumière) et 23 (cockpit) : peinture vernie, métal, caoutchouc, reflets de l'environnement, occlusion, disques qui rougissent, chaleur des échappements, salissures ; silhouette et cotes de la 312 T5 inchangées, sans marque.
- **Aide des modèles gratuits** : « aide toi avec opencode et ses llm gratuites, y'en a quelques unes comme deepseek » ; « sur plus de token y'a iceman free ». `tools/opencode/lancer.sh` lance opencode en réglage isolé (ni mémoire de la machine, ni réseau, ni commit) sur une tâche bornée que des tests vérifient ; le résultat est un premier jet à relire.
- **Circuits, choix validés (lot 22)** : David, 18/11, sur le plan `docs/reprise/22-CIRCUITS-PROCEDURAL.md` (branche locale `etude/procedural`) et ses huit questions : « Oui, vas-y » aux choix proposés. Dénivelés du prototype par thème (côte 10 m, forêt 17 m, Islande 25 m, Asie 24 m, Pacifique 34 m, désert 45 m, montagne 50 m) ; pentes jusqu'à 10 % en montagne et contre-dévers jusqu'à −2° ; crêtes qui allègent de 0,4 g au plus, les vrais sauts attendant la physique `p10` ; records et fantômes repartent à zéro avec le nouveau relief, en même temps que la nouvelle conduite ; bombement de chaussée et bosses agissant sur la voiture avec `p10` ; mobilier mêlant fin des années 1970 et début 1980 selon le circuit, marques imaginaires tirées au hasard ; un à deux passages couverts par circuit et un second tunnel en montagne.
- **Haut-Col (lot 22A)** : David, 18/11 : « haut col pente plus prononcée que 10% avec une partie en bord de falaise avec grand virage ». Le plafond de 10 % ne vaut donc pas pour Haut-Col : y viser des rampes nettement plus raides (à régler avec la physique `p10` et les rivaux), et sculpter une portion en corniche le long d'un grand virage du tracé : paroi d'un côté, vide de l'autre, rail ou muret, vue sur la vallée. Le tracé en plan et la graine restent : c'est le relief et le terrain des abords qui changent.
- **Grand circuit de montagne (lot 22A)** : David, 18/11, à la suite de Haut-Col : « une partie avec pente à 20 30 et circuit long, plus ballade agreable que circuit limite avec tunnels et joli paysage, dans les montages, passage en forent dense ». Un parcours long et roulant, fait pour le plaisir de la route plus que pour la limite : une portion à 20-30 % de pente, plusieurs tunnels, de beaux points de vue, une traversée de forêt dense. Reste à trancher avec lui : refaire Haut-Col ainsi (son tracé de 5,2 km change alors, sous le même identifiant) ou en faire un nouveau circuit en gardant Haut-Col.
- **Circuits mémorables (lot 22F)** : David, 18/11 : « fais des circuit pour tous, très mémorable et impressionnant dans leur conception avec des lieux vraiment exceptionnels quelque soit le biome ». Chaque circuit doit avoir ses lieux signature, pensés avec le tracé (pas un décor posé après coup) ; la demande précédente sur Haut-Col (long parcours de montagne, pentes de 20 à 30 %, tunnels, forêt dense) en est le premier cas. Compris ainsi, sauf avis contraire de David : les tracés peuvent être refaits sous les mêmes identifiants, puisque les records repartent à zéro avec la physique `p10`.
- **Animaux (lot 26)** : « fais aussi des animaux pnj pour décorer, ils font leur vie bougent etc ; selon le biome animaux différent pour marquer l'endroit identité etc ». En plus de la petite faune de `src/faune.js` : des animaux visibles, propres à chaque biome, qui vivent leur vie (paître, marcher, voler, fuir au passage des voitures), hors de la chaussée.
- **Bords de route (lot 22C)** : « un peu plus de panneaux de publicité u bord de la route aussi, quelques bords de routes dansgereux ». Davantage de panneaux publicitaires (marques imaginaires) et quelques portions où le bord punit : vide sans dégagement, arbres ou rochers proches, muret, fossé.
- **Jeu en ligne sans serveur à gérer (lot 27)** : David, 18/11 : « on peut pas s'en faire sans serveur et se donner les ip ? […] full peer to peer ? », puis « fais le plus optimal et le plus fiable mais je veux pas avoir de gestion de serveur pour ce jeu peer to peer ». La partie est déjà en pair à pair (WebRTC) ; seul le salon de mise en relation tourne sur le VPS. À faire : se rejoindre sans serveur à nous (relais publics redondants pour la mise en relation par code, signalisation chiffrée par le code, et invitation à copier-coller ou en QR code comme repli universel, réseau local compris), puis retirer le salon du VPS une fois le nouveau mode vérifié. Limite à dire au joueur : sans relais, certaines paires de réseaux ne peuvent pas se joindre directement.
- **Choix validés sur les prototypes** : David, 18/11 au soir, « Oui, vas-y » aux choix proposés après les études (comptes rendus dans `docs/reprise/rapports/etudes-2026-11-18/`, plans dans les branches locales `etude/*` et `conduite/etude`). Pluie et neige (lot 19) : pas de geste pour essuyer, la vitesse dégage ; réglage « Gouttes sur l'écran » de 0 à 2 ; gouttes atténuées sur les caméras extérieures, aucune sur les rétroviseurs pour l'instant. Public (lot 18) : parapluies seulement aux rangs découverts, plafonds de corps détaillés du prototype. Échappements (lot 20) : flammes un peu plus grandes, moins de ratés sur la grille, mode lumineux à ajouter au moteur pour le jour. Lumière (lot 21) : courbe de couleurs qui garde les teintes partout, palier « Photo » au-dessus de Fine pour les effets lourds, nuit vraiment sombre. Conduite (lot 17) : puissance fidèle à la 312 T5 (521 ch), dérive issue de la glisse réelle, aide Légère par défaut qui rattrape sans conduire, antiblocage absent sans aide, léger en Légère, complet en Forte.
- **Ombres et flaques, en tête du lot 21** : David, 18/11, à qui je demandais où il avait vu les ombres clignoter : « on s'en fout mais améliore les ombres », puis « et les reflets dans les flaques d'eau ». Inutile d'attendre une reproduction du clignotement : améliorer les ombres pour elles-mêmes (stabilité, douceur, ombre de contact sous les voitures), puis les reflets de la piste mouillée et des flaques (aujourd'hui en escalier d'après l'étude), avant le reste du lot lumière.
- **Reflets, grain, préchargement, banc, calcul** : David, 18/11 au soir : « reflets aussi sur les vehicule et persos, grain des textures generées, precache pour optimoiser et charger tout en vram ram, test bench la premiere fois qu'on charge une version pas systemeatique. tous les effets possible gerées par les gpu cuda ou non, des librairies c si necessaire pour otpimiser tout e qui est procedural et math ». Ce que cela fixe :
  - lots 21, 23 et 25 : reflets de l'environnement sur les carrosseries, les casques et les personnages ; grain et micro-relief des matières générées ;
  - lot 5B : tout est préparé et envoyé en mémoire (processeur et carte graphique) pendant le chargement ;
  - détection graphique : le banc ne tourne qu'au premier chargement d'une version du jeu sur une machine, pas à chaque ouverture ni à chaque changement de fenêtre ; il reste relançable dans Image ;
  - lot 28 (calcul) : les effets vont sur la carte graphique chaque fois que c'est possible, quel que soit son fabricant (dans un navigateur, cela veut dire shaders et WebGPU ; CUDA n'y existe pas) ; des noyaux en C compilés en WebAssembly sont admis pour le procédural et les calculs, là où une mesure montre le gain.
- **Grand circuit de montagne : un huitième circuit** : David, 18/11 vers 21 h, à la question « un huitième circuit, ou à la place de Haut-Col ? » : « Huitième circuit ». Le grand parcours de montagne (étude `docs/reprise/22F-CIRCUITS-MEMORABLES.md`, branche locale `etude/lieux` : 9,6 km, le Mur jusqu'à 30 %, trois lacets, corniche, trois passages couverts, un pont) devient un circuit nouveau, avec son identifiant et sa graine. Haut-Col garde son tracé en plan, son identifiant et sa graine ; il reçoit des rampes de plus de 10 % et sa corniche le long de son grand virage. Choix pris par défaut pour les autres questions de cette étude, annoncés à David le 18/11 sans objection de sa part à ce jour : les six autres circuits gardent leur tracé et les lieux se posent dessus ; le Mur garde sa pointe à 30 % ; un fossé arrête la voiture comme toute limite en attendant la physique `p10` ; une sortie dans le vide est un accident, sans chute.
- **Le Spark d'abord** : David, 18/11 vers 21 h, après l'annonce du quota (62 %) : « fais bosser le spark pour economiser tes tokens ». Le code nouveau, les tests, les relectures de diff et les résumés de longs comptes rendus passent d'abord par le Spark : `tools/spark/chaine.py` (fiche, blocs AVANT / APRÈS, tests, commit « Spark : ») et `tools/spark/spark.py` (lectures par morceaux), voir `tools/spark/LISEZ-MOI.md`. Claude cadre, écrit les fiches, vérifie, branche dans les fichiers partagés et juge l'image. Un agent Claude ne se lance que pour ce que le Spark ne sait pas faire ; les relectures par un second agent Claude sont remplacées par une relecture du Spark et des contrôles lancés par l'orchestrateur.
- **Animaux, pas de traversée de piste** : David, 18/11 vers 21 h 30, à la question « veux-tu aussi des bêtes qui traversent la piste, dans un lot à part ? » : « Pas maintenant ». Les animaux restent hors de la piste (aucun à moins de 34 m de l'axe) ; ne pas ouvrir ce lot sans nouvelle demande. Choix annoncés à David sans objection de sa part à ce jour : branchement après la mise en ligne de la fluidité, sous le réglage « Faune » existant, quelques silhouettes lointaines seulement en Légère.

## Décisions de David — 19 novembre 2026, lisibilité des virages et flaques

- Mieux préparer les virages difficiles par les bordures/vibreurs, glissières et décors routiers ; ajouter une option d'annonce des virages dans les réglages. Repères placés avant le freinage, direction et difficulté lisibles. Ce lot visuel conserve les tracés, obstacles et règles de conduite p13.
- Corriger les reflets des flaques qui ressemblent à des morceaux de lignes parallèles (photo de Port-Sable en démo). La correction du calcul appartient au FERRO canonique, puis se propage par le verrou ; ne pas masquer le problème en supprimant les flaques.
- Ces demandes passent avant le décor détaillé du Baïkal (13B), toujours prévu. Le lot 13A et sa livraison 0.2.53 sont clos.

## Décisions de David — 19 novembre 2026, physique, sols et pilotes

- Les véhicules traversent parfois le sol et certains obstacles ne répondent pas aux contacts. Passer réellement
  les voitures, masses, inerties, mouvements et collisions dans PhysX ; une pose cinématique recopiée chaque pas
  ne satisfait pas cette demande. Sols issus des triangles dessinés, contacts de suspension et collisions continues.
  Cette modification de conduite ouvre p14 ; les anciens records et fantômes restent séparés.
- Sols hors route : grain riche et rugueux, impression d'herbe et de relief calculée par le shader. David précise
  « sans textures toujours procedural » : aucun fichier de texture, aucune image importée. Filtrer le détail lointain.
- En vue extérieure, animer la tête, les bras et les changements de rapport du pilote, de manière cohérente avec
  le cockpit ; la silhouette ne doit plus rester figée. Conserver la géométrie procédurale et les niveaux de détail.
- Ces demandes s'ajoutent au lot 0.2.54 déjà construit et passent avant 13B. Ne pas refaire ni effacer la livraison
  des virages/reflets ; préserver les preuves et modifications de la conversation concurrente.

## Décision de David — 19 novembre 2026, démos des circuits

- Refaire la réalisation des démos pour montrer les environnements, la faune et la flore ajoutés, avec de beaux
  plans de course inspirés de la F1 et l'énergie de l'introduction arcade de Daytona USA. Composition originale,
  plans de découverte et de nature réellement présents dans le circuit, alternés avec la course.
- Lot suivant immédiatement après la qualification PhysX : `docs/reprise/DEMOS-CINEMA-2026-11-19.md`.
  Préserver les courses continues, la sortie sur geste, les réglages Faune/qualité, les collisions et la conduite p14.
  La demande porte sur la réalisation visuelle ; la règle de musique limitée au titre demeure.

## Décision de David — 19 novembre 2026, regard arrière

- En vue extérieure Poursuite, maintenir le stick droit vers le bas doit permettre de regarder derrière,
  avec retour à la vue normale au relâchement. Préserver les affectations des manettes et l'indépendance J1/J2.
- Le geste reprend la commande de regard arrière décrite dans la documentation officielle EA consultée
  à la demande de David. La demande ne remplace pas les autres commandes de BITUME.

## Décisions de David — 19 novembre 2026, cockpit extérieur

- Conserver les animations du pilote, mais empêcher le levier de traverser le cockpit en vue extérieure,
  sur le joueur et sur les concurrents. Éloigner également le volant du pilote dans cette vue.
- Adapter les ancrages et le trajet des mains à l'habitacle extérieur, avec des dégagements vérifiés sur
  les vrais maillages ; ne pas transposer simplement le cadrage intérieur à la silhouette extérieure.
- Tout consigner dans le résumé GitHub et la reprise courte. Fiche : `docs/reprise/COCKPIT-PILOTES-2026-11-19.md`.


## Décisions de David — 19 novembre 2026, continuation autonome et réalisme

- Poursuivre en autonomie toute la liste de Claude, en préservant les demandes et les travaux préparés.
  La file complète réconciliée se trouve dans `docs/reprise/CONTINUATION-AUTONOME-2026-11-19.md`.
- Priorité aux bras : les coudes étaient pliés à l'envers et les avant-bras trop hauts. Replier les coudes
  vers le bas, contenir les bras dans l'habitacle et employer le même modèle articulé en vue intérieure
  et extérieure ; seul le cadrage peut changer. Vérifier mains, commandes, manches et coque ensemble.
- Enrichir les matières du cockpit et la pluie/neige sur l'écran. Garder le grain et le relief procéduraux,
  leurs repères attachés aux objets et leur filtrage à distance ; les changements du moteur passent par FERRO.
- Supprimer l'aspect de barres blanches à l'intérieur des pneus. Préférer des profils ronds, des matières
  sobres et une usure naturelle, en conservant les dimensions, les quatre montes et leurs effets physiques.
- Éviter les cubes, les zones de texture carrées et les répétitions symétriques artificielles : contours
  arrondis, variations organiques à graine stable. Préserver la symétrie mécanique nécessaire des pièces.
- Détailler les bâtiments et réaliser les stands : garages, ouvertures, auvents, matériel et signalétique
  raccordés à la voie et aux emplacements de service existants. Conserver les dégagements des voitures.
- Ces priorités passent avant les nouveaux circuits. Le décor Baïkal et la base des tracés explicites
  déjà préparés sont conservés, puis le programme complet continue sans attendre un nouveau « go ».
