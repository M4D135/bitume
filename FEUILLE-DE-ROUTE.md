# BITUME — feuille de route

> **Priorité ajoutée le 21 novembre 2026, base 0.2.85 :** animaux proches de la route,
> sans simulation détaillée hors champ ; démos des circuits actuels centrées uniquement
> sur la route, le circuit et son point d’intérêt. Aucun plan herbe/faune/flore.
> [Demandes et progression](docs/reprise/FAUNE-PROCHE-DEMOS-CIRCUITS-2026-11-21.md) — **à réaliser**.
> Cette consigne remplace les anciens plans de nature et la faune exclusivement lointaine.

> **Référence voiture actualisée le 21 novembre 2026 :** David choisit désormais la
> galerie RenderBlade de la **126 CK** comme objectif visuel, en remplacement de la
> 312 T5 mentionnée dans l'historique ci-dessous. [Objectif et état du chantier](docs/reprise/OBJECTIF-126CK-2026-11-21.md)
> · [41 images reçues avec provenance](docs/references/ferrari-126ck-renderblade-2026-11-21/README.md).
> Cette publication de références ne modifie pas la physique ni le modèle actuellement livré.


État au 12 novembre 2026, après l'essai 0.1 et l'analyse d'écart avec vroom-unreal.

## Où on en est

- **Essai 0.1** (commit `86d0f33`). En ligne sur <https://bitume.estrasse.fr> depuis le 12/11 : page du commit `9886f92`,
  identique.
- **Avis de David** après l'avoir essayé, le 12/11 :
  - « énorme travail à faire pour retrouver la qualité de notre version Unreal, mais c'est une super base » ;
  - « le cockpit c'est pas ok, regarde l'original ; aussi les collisions et sauts quand on frotte les pneus d'un
    autre ; tout le fun du gameplay : poids, équilibrage, dérapages contrôlés ».
- **Soirée du 12/11**, sur d'autres mots de David, deux commits poussés (`3f9787e`, puis celui du cockpit), **pas
  encore en ligne** :
  - « je veux exactement ce modèle de F1 » (la 312 T5) : voiture refaite à ses cotes, sans nom ni emblème ;
  - « pas de musique sauf à l'écran titre » : thème original sur le titre, signaux de course sans mélodie ;
  - « trop de clipping, à corriger » : plus de coupe à distance, ombres portées à 176 m ;
  - « mode démo comme on a fait dans Point de rupture », « démo qui dure » : démo sans fin après 5 s sur le titre ;
  - « le cockpit faut vraiment le soigner », « niveau mains faut retrouver ce qu'on avait sur la version Unreal »,
    « rapprocher la vue du volant afin de voir que les mains et pas tout le bras » : cockpit refait, voir chantier 1.
- **Chantiers 2 et 3 non faits.** Le lot lancé en agents le 12/11 s'est arrêté sur la limite d'usage hebdomadaire
  (retour le 18/11 à 15 h). Il a laissé une réécriture partielle et non vérifiée de `src/conduite.js` dans
  `.claude/worktrees/wf_654723d2-ff3-1` (branche `physique/conduite`, rien de commité) : à relire avant de s'en
  servir, ou à refaire.
- **Référence de qualité** : vroom-unreal 0.35, le projet Unreal de David (GitHub privé `M4D135/vroom-unreal`, commit
  `2aec008` du 20/10/2026). On le lit sans jamais le modifier. Son cockpit suit la photo de David et non le jeu de
  1991 (`docs/COCKPIT_AMIGA.md` de ce dépôt-là). Ses captures de référence sont dans `docs/images/` :
  `cockpit-035-neutral.png`, `cockpit-035-drift.png` et `derby-035-crash.png`.

## Règle de reprise (mise à jour le 12/11)

- **Repris** : les mécaniques de jeu, refaites avec notre code et nos constantes, puis réglées en jouant.
  - Celles inventées pour vroom-unreal : dérive chargée, turbo, petit bond rattrapable, réception contre-braquée,
    retour progressif en piste.
  - Celles du genre que le jeu de 1991 avait déjà, quand David les demande. C'est le cas du saut quand les roues de
    deux voitures se touchent.
- **Jamais repris** du Vroom de Lankhor :
  - les tables ST ou Amiga et leurs valeurs : rapports, couple, braquage, freinage des pneus, seuils et impulsions de
    choc et de saut, états des pneus ;
  - les tracés relevés, les sons extraits, les dessins et les noms ;
  - le bandeau du haut, les bannières LANKHOR et VROOM, la composition du cockpit Amiga.
- **Refait autrement** : ce qui tient au moteur Unreal. Les matières M_Asphalt, M_Curb, M_Gravel et M_Grass, les
  maillages importés, Lumen et Nanite deviennent des formes et des matières FERRO générées. On vise la composition et la
  lisibilité des captures, pas le photoréalisme.

## Ordre de travail

Les trois demandes de David passent d'abord. Chaque chantier reprend des lots de l'analyse, décrits plus bas.

| Ordre | Chantier | Lots de l'analyse | Effort |
|---|---|---|---|
| 1 | Cockpit comme l'original | 2, teinte du nez et banc du 1, rétroviseurs du 7 | L |
| 2 | Conduite : poids, équilibre, dérapages contrôlés | 3, 6 | L |
| 3 | Chocs entre voitures et sauts roue contre roue | 8, contacts du 9 | L |
| 4 | Lumière, matière et forêt | reste du 1 | M |
| 5 | Bords de piste : vibreurs, gravier, herbe en touffes | 4 | L |
| 6 | Relief, horizon et caractère des circuits | 5 | L |
| 7 | Voiture vivante | reste du 7 | L |
| 8 | Peloton et voix des rivaux | reste du 9 | L |
| 9 | Tours propres, records et saison | 10 | L |

Le chantier 1 touche au rendu : `voiture.js`, `renderer.js`, caméra et affichage de `jeu.js`. Les chantiers 2 et 3
touchent à la physique : `conduite.js`, `course.js` et un nouveau `contacts.js`. Le cockpit peut donc avancer en même
temps que la physique. Les chantiers 2 et 3 se suivent, parce que le saut a besoin de l'état en l'air de la conduite.

## Chantier 1 — Cockpit comme l'original

**État au 12/11 au soir : livré, à juger par David en jeu.**
- Cadrage de la capture `cockpit-035-neutral.png` : volant gros et bas (16° sous l'horizon), bas de la jante hors de
  l'image, mains au premier plan, manches qui sortent du champ.
- Gants articulés construits en code (le maillage Valve de vroom-unreal ne se copie pas), jante fine en 36 tronçons,
  trois branches ajourées, moyeu à vis.
- Planche anthracite : compte-tours, eau, huile, témoins, rapport et vitesse en segments, lampe de régime.
- Levier de vitesses à droite : la main droite y va à chaque changement de rapport.
- Rétroviseurs : ciel, horizon et piste dans la glace, et les voitures qui suivent, à leur place et à leur taille.
- Tête du pilote : accélérations, regard vers la corde, tremblement à haute vitesse.
- Capot bombé, flancs à arête ronde, liseré, rivets, numéro sur le nez et les pontons, suspension avant en tôle et
  tubes, disques de frein, repères à la craie sur les pneus.

**Reste.**
- Rétroviseurs en vraie image (rendu vers texture dans le moteur) : aujourd'hui les suiveurs sont des silhouettes.
- Carrosserie encore anguleuse à côté des volumes ronds de vroom-unreal : demande des formes courbes dans le moteur.
- Mains : une seule prise ; pas de lâcher de la main haute au-delà de 100°, comme le fait vroom-unreal.
- Le banc `BITUME_JEU.banc()` prévu ci-dessous n'est pas écrit.

**Objectif.** Retrouver la vue de vroom-unreal 0.35 :
- œil bas, nez et flancs rouges visibles, vraies roues avant aux deux coins du bas, bras de suspension ;
- gants blancs à 9 h 15 sur un volant classique : jante ronde noire, trois branches, pas de halo ;
- planche fixée à la coque qui donne vitesse, rapport et régime, séparée du volant ;
- deux rétroviseurs derrière les pneus, sur des supports rouges coudés, qui montrent la route derrière ;
- petit saute-vent.

L'affichage DOM ne recouvre plus la voiture. Tout est en formes générées et rien n'est importé d'Unreal.

**Critères d'acceptation**
- `voiture.test.mjs`, à 41,6° verticaux au repos (68° horizontaux en 16:9) et 47° au plus en pointe :
  - centre du volant entre 12 et 20° sous l'axe de visée (aujourd'hui 38,9°) ;
  - volant entier, deux gants, planche, deux pneus avant et deux rétroviseurs projetés dans le cadre.
- **Volant et bras** :
  - rotation visuelle du volant de 95° au plus ;
  - gants à 9 h 15 reliés à des avant-bras coudés ;
  - coque creuse, sans face de carrosserie entre l'œil et le volant.
- **Roues avant** : rotation égale à distance/rayon à ±1 %, braquage d'Ackermann (roue intérieure plus braquée).
- **Nez** : R/G ≥ 3 et au moins 25 % d'écart de luminance entre le dessus et le flanc. Aujourd'hui, la surimpression
  l'éclaire en aplat saumon (`renderer.js`, `vOverlay`).
- **Rétroviseurs** :
  - vue arrière partagée de 512×128, champ de 110° ;
  - rafraîchie à 30 Hz en cockpit et à 10 Hz en poursuite ;
  - 1,5 ms GPU au plus par image rafraîchie ;
  - désactivables dans les réglages.
- **Réglages et affichage** : focale de 60 à 105° horizontaux, bornée à la lecture ; carte et vitesse DOM masquables en
  cockpit.
- **Banc `BITUME_JEU.banc()`** (oubli de l'analyse) :
  - qualité fixe, 20 s ; p50, p95 et pire image en JSON ;
  - sur le Mac, en 1390×1295 : p95 ≤ 16,7 ms et pire image ≤ 29 ms ;
  - n'écrit ni record ni fantôme.
- **Captures** au repos et en dérive, comparables à `cockpit-035-neutral.png` et `cockpit-035-drift.png` : sans
  bandeau du haut, sans bannière.

## Chantier 2 — Conduite : poids, équilibre, dérapages contrôlés

**Objectif.** Une voiture qui pèse et qui vit.
- **Poids** : la charge passe sur l'avant au freinage et sur l'arrière à l'accélération.
- **Équilibre** : il change avec les pédales.
  - Lever le pied ou freiner en entrée referme la trajectoire.
  - Accélérer élargit, ou fait glisser l'arrière sur les rapports courts.
- **Glisse** : elle se tient et se rattrape au contre-braquage.
- **Dérive chargée de vroom-unreal** : elle tient dans les virages rapides et se charge 2,5 fois plus vite.
- **Direction** : vive et progressive sur toute la course du stick.
- **Départ, pente et aspiration** : le départ pousse, les montées freinent, l'aspiration récompense le suivi.

L'IA garde la même loi que le joueur.

**Critères d'acceptation**

*Poids et équilibre*. Ces critères sont nouveaux et seront réglés en jouant avec David.
- `conduite.test.mjs` :
  - la répartition de charge suit l'accélération longitudinale : à −3 g, l'avant porte au moins 60 % ;
  - le transfert latéral réduit un peu l'adhérence totale.
- Dans un R 120 m à la limite :
  - lever le pied augmente le lacet d'au moins 5 % en 0,5 s ;
  - plein gaz en 2e ou 3e fait passer l'arrière à au moins 6° de glisse ;
  - un contre-braquage donné en 0,3 s rattrape la voiture sans tête-à-queue.
- Sans correction, une forte glisse finit en tête-à-queue. L'aide au volant la rattrape aux niveaux 1 et 2.

*Direction, départ, pente, aspiration* (lot 3)
- **Volant au clavier** :
  - 0 → 90 % en 120 ms au plus ;
  - relâché 1 → 0,1 en 80 ms au plus ;
  - contre-braquage 1 → 0 en 30 ms au plus (aujourd'hui environ 183 / 183 / 200 ms).
- **Plein braquage** : 1,2 fois le lacet limite au plus à 120, 200 et 300 km/h (aujourd'hui 4,9 fois à 200 km/h).
  `braquageMax(v)` est partagé avec l'IA.
- **Manette** : zone morte de 0,07, exposant de 1,3. Aide de 0 à la manette et de 0,15 au clavier.
- **Départ** : régime d'au moins 9 000 tr/min pendant les 0,5 s qui suivent le vert ; 0-100 km/h entre 2,2 et 3,4 s.
- **Pente** : g·sin(pente) dans l'accélération. En montée à 6 %, la pointe est inférieure d'au moins 2 % à celle du
  plat.
- **Aspiration** :
  - à 10 m derrière un rival à 250 km/h, au moins 3 m gagnés en 4 s par rapport à l'air libre ;
  - rien au-delà de 30 m ou de 2 m d'écart latéral.

*Dérive et turbo* (lot 6)
- **Clavier** : avec des impulsions de 0,20 s ou de 0,10 s, à 30, 60 et 120 Hz, le palier 3 est atteint. 30 appuis
  martelés ne donnent qu'un départ.
- **Tenue** : dans des virages de R 40, 120, 250 et 400 m, aux vitesses de référence, |d| < 5,5 m pendant 3 s au
  contre-braquage idéal. Aujourd'hui, au-delà de R 40 m, la dérive s'annule en 0,9 à 2,0 s.
- **Paliers** : 0,7 / 1,3 / 2,1 s au mieux (aujourd'hui 1,54 / 3,38 / 5,54 s). Chaque nouveau palier ouvre une fenêtre
  de 0,22 s, avec un libellé écrit.
- **Gain** : dans un R 80 m, dérive puis turbo III plus rapides de 0,1 à 0,3 s que l'adhérence seule.
- **Coupure** : le turbo est coupé par le frein, l'herbe et le contact.
- **Lissage** : |d²β/dt²| ≤ 300°/s² à 60 et à 120 Hz (aujourd'hui environ 13 500°/s² au premier pas).
- **Effets** (`traces.js`) :
  - au plus 512 bandes de traces, effacées en 24 s ;
  - au plus 48 fumées et 48 étincelles, mises à jour à 30 Hz ;
  - 0,3 ms au plus au banc.
- **Mouvement** : réglage des secousses, nul à 0 % ; prefers-reduced-motion respecté.

*IA*
- `course.test.mjs` : temps au tour de chaque rival entre 0,90 et 1,25 fois la référence du circuit.
- Déterminisme gardé.

## Chantier 3 — Chocs entre voitures et sauts roue contre roue

**Objectif.** Comme dans l'original, frotter les roues d'un autre fait sauter la voiture.
- **Frottement léger** : petit bond rattrapable. Contre-braquer à l'opposé de la poussée reçue pendant le bond garde
  la vitesse à la réception.
- **Contact de roues rapide** : vrai saut, avec arc, tangage et roulis. Une mauvaise réception casse la voiture,
  puis vient un retour progressif en piste.
- **Chocs de caisse orientés** : ils font tourner les voitures, au lieu des auto-tamponneuses d'aujourd'hui.
- **Glissières** : le choc dépend de l'angle et de la vitesse, et la caisse ne traverse plus rien.
- **Dégâts** : ils coûtent de l'adhérence et de la vitesse.

Les seuils et les impulsions sont les nôtres. Aucune valeur ne vient de `vr2.asm`.

**Critères d'acceptation** (`contacts.test.mjs`, nouveau)
- **Petit bond** :
  - un contact de roues, rapprochement d'au moins 2,5 m/s (seuil adouci le 16/11/2026), donne un bond de 0,10 à
    0,35 m pendant 0,25 à 0,45 s ;
  - à la réception, la vitesse vaut 100 % de la vitesse d'arrivée avec une bonne correction, 97 % au neutre et 94 %
    avec une mauvaise : coefficients de vroom-unreal ;
  - jamais de gain de vitesse.
- **Grand saut** :
  - un contact de roues rapide, au-delà d'un seuil réglé en jouant, donne un arc parabolique de 1 à 3 m pendant 0,7 à
    1,3 s, avec tangage et roulis ;
  - la voiture se dirige moins en l'air ;
  - au-delà d'une limite de roulis ou de tangage à la réception, c'est l'accident.
- **Une réponse par paire** : réarmement après séparation et 0,35 s ; 1,25 s au moins entre deux petits bonds.
- **Roue contre roue décalée** : le cap tourne d'au moins 2° et la vitesse baisse. Jamais deux événements en 0,3 s.
- **Glissières**, sur une grille d'angles de 2 à 90° et de vitesses de 50 à 300 km/h :
  - sous 8°, frottement qui garde au moins 90 % de la vitesse après 0,5 s ;
  - la violence se mesure par la vitesse normale au rail : roue à 20 m/s, casse à 30 m/s ; un passage rapide mais
    rasant ne compte pas comme un choc frontal (seuils adoucis le 16/11/2026) ;
  - jamais renvoyée au-delà de l'axe de la piste.
- **Emprise de la caisse** (environ 4,95 × 2,02 m) : aucun coin au-delà du rail ni dans un mur de pneus, quel que
  soit le cap.
- **Accident puis retour** :
  - décision de David du 16/11/2026 : retour sur le revêtement en moins d’une seconde, sans longue réparation
    ni abandon automatique ; les gros chocs conservent leurs débris ;
  - `replacer()` remet immédiatement en piste ; abscisse conservée, tour invalidé pour les records et fantômes.
- **Dégâts** (`degats.js`) : adhérence −8 % et traînée +8 % au plus ; aucun dégât sous 2 m/s de vitesse normale ;
  éclair réservé aux impacts importants, sans rougeur permanente.
- **En vol** : hauteur et attitude rendues dans toutes les vues, caméra cockpit portée par la voiture, son de
  réception.
- **Cadence** : comportement identique à 30, 60 et 120 Hz ; 60 s de course simulées en moins de 1,5 s dans Node.
- **IA** (`ia.test.mjs`, nouveau) : un rival à 80 m/s évite une voiture arrêtée au milieu de la piste. Aujourd'hui,
  arrivé à 75 m/s, il la percute vers 59 m/s.

## Lots suivants

Numérotation de l'analyse. Les fichiers et les lignes visées sont dans les rapports détaillés.

### Lot 1 (reste) — Lumière, matière et forêt [M]

Chaussée sombre et propre, forêt continue le long du tour, arbres avec une silhouette, focale de poursuite resserrée.
- `decor.test.mjs` : sur les 3 circuits, moins de 10 % du tour sans arbre à moins de 200 m (aujourd'hui 62 / 9 / 63 %).
  Au moins 20 arbres par tronçon de 300 m hors stands, plafond de 2 600 tenu. Décor construit en moins de 150 ms.
- Poursuite : 44° verticaux au repos, 52° au plus en pointe (aujourd'hui 64 à 72°).
- Chaussée sur les captures : gris moyen sous 64/255, écart-type sous 6/255 sur 64×64 px, sans motif de fissure.
- 6 ko de plus au maximum dans `SIZE.json`.

### Lot 4 — Bords de piste : vibreurs, gravier, herbe en touffes [L]

- **Vibreurs** (`circuit.test.mjs`) :
  - sur au moins 90 % des virages de R < 400 m, sur 30 m au moins ;
  - à l'extérieur en sortie et à l'intérieur à la corde ;
  - aujourd'hui, seuil R < 140 m, pour 16,5 / 21,9 / 8,5 % du tour.
- **Surfaces** : adhérence lue aux 4 roues, avec un fondu sur 0,5 m. Saut de décélération de 1 m/s² au plus à chaque
  changement de surface.
- **Son du vibreur** : cadence proportionnelle à la vitesse, gain nul à l'arrêt.
- **Touffes d'herbe** : 1 ms GPU au plus, coupées en qualité basse.
- Les matières M_Curb, M_Gravel et M_Grass d'Unreal sont refaites en matières FERRO générées.

### Lot 5 — Relief, horizon et caractère des circuits [L]

- **Sol** :
  - médiane du sol à 150 m de la piste d'au moins +4 m (aujourd'hui −0,8 / −0,1 / +0,4 m) ;
  - talus de 35 % au plus à moins de 30 m de la bordure.
- **Profil** :
  - au moins 2 crêtes ou compressions par tour ;
  - pente de 8 % au plus ;
  - dénivelés de la forêt, de la côte et de la montagne distincts d'au moins 30 %.
- **Familles de tracés** : rapide, technique et vallonné, distinctes sur au moins 3 mesures (nombre de virages, plus
  longue droite, rayon médian).
- Tracés, noms et reliefs sont inventés.

### Lot 7 (reste) — Voiture vivante [L]

- **Modèle** : carrosserie lissée au lieu des pavés, pneus mats, laque vernie.
- **Budget** : 2 500 triangles au plus par voiture proche, 300 pour le modèle lointain.
- **Réglages** : ombres des rivaux désactivables. Le mode Auto ne coupe rien sans le dire.
- **Performance** : p95 de 16,7 ms au plus avec 12 voitures dans le champ.

### Lot 9 (reste) — Peloton et voix des rivaux [L]

- **Course** : 3 tours à 12 voitures sans le joueur, sans contact entre rivaux, avec au moins 4 dépassements et en 1 s
  de calcul au plus.
- **Caractère** : des rivaux qui ont un caractère.
- **Coriaces** : au moins 2 rivaux sous 1,0 fois le temps de référence. Aujourd'hui, aucun rival ne dépasse la
  référence (oubli de l'analyse).
- **Son** : 6 voix plus une nappe de peloton. Doppler tiré des vitesses relatives et borné à 0,8-1,25.
- **Résultats** : `montrerResultats` découpé à 4 ms au plus par image. Aujourd'hui, 28 800 pas d'un bloc.

### Lot 10 — Tours propres, records et saison [L]

- **Tours invalidés** :
  - un tour coupé (4 roues hors du revêtement plus de 1 s) ou avec contact est invalidé et signalé ;
  - le tour 1 est exclu des records.
- **Records v2** (`bitume.v2`) :
  - par circuit, mode et boîte, avec historique ;
  - écart calculé sur le fantôme du record. Aujourd'hui, il se calcule sur le profil de la séance, ce qui donne
    environ 3,7 s d'avance fictive au tour 2.
- **Stockage** : `avancer()` et le banc n'écrivent plus rien. Réglages bornés champ par champ à la lecture.
- **Saison** (`saison.js`) :
  - plusieurs courses, avec un format et un barème propres à BITUME ;
  - ni tour qualificatif, ni ordre fixe de circuits, ni barème repris ;
  - points attribués une fois par course, reprise identique après rechargement.

## Ce que BITUME fait déjà aussi bien ou mieux

- **Conduite** :
  - vrai modèle de lacet, d'où émerge le sous-virage ;
  - appui aérodynamique dans l'adhérence ;
  - tangage et roulis suivis par la caméra ;
  - boîte maison avec rupteur ;
  - dérive pilotable dans les deux sens ;
  - alerte de contresens et remise en piste.
- **Contacts** : entre tous les couples de voitures, choc arrière qui pousse vers l'avant, un événement par paire,
  secousse proportionnelle au choc.
- **Course** :
  - les rivaux conduisent la même physique que le joueur, sur une trajectoire calculée ;
  - départ tendu, vraie arrivée pour tous, classement en direct ;
  - pilotes inventés aux livrées distinctes, distance de course au choix.
- **Circuits** :
  - dévers et relief sur les trois circuits ;
  - paysages contrastés, glissières et murs de pneus ;
  - panneaux de freinage, bandes de tonte, vent dans les arbres, ciel procédural.
- **Rendu** :
  - 60 i/s avec ombres, bloom et MSAA ×4, pour une page de 305 Ko ;
  - poursuite vivante et caméra de télévision au téléobjectif ;
  - gouverneur de résolution.
- **Son**, entièrement synthétisé :
  - rupteur et passages de rapport audibles, moteur sensible à la charge ;
  - rivaux au vrai régime, chocs gradués ;
  - signaux de dérive, mélange limité.
- **Affichage et commandes** :
  - messages annoncés aux lecteurs d'écran, menus accessibles ;
  - clavier lu par position physique, commandes tactiles, aide au volant ;
  - typographie française des temps, fantôme compact.

## L'écart mesuré

- **107 écarts sur 7 domaines** :
  - par impact : 33 majeurs, 51 moyens, 23 mineurs ;
  - par origine : 90 de vroom-unreal, 11 du moteur Unreal, 6 du jeu de 1991 ;
  - par faisabilité : 89 faisables dans le navigateur, 17 à adapter, 1 non.

| Domaine | Écarts | Majeurs | Déjà mieux |
|---|---:|---:|---:|
| Conduite et sensations de pilotage | 16 | 5 | 10 |
| Contacts, dégâts, sorties de piste et débris | 15 | 6 | 10 |
| IA, règles de course, séance et progression | 12 | 3 | 8 |
| Circuits, relief et décor | 16 | 7 | 12 |
| Voiture, cockpit, rétroviseurs, caméras et rendu | 19 | 7 | 10 |
| Son et retours | 13 | 2 | 12 |
| Affichage, menus, réglages, commandes et joueur | 16 | 3 | 17 |

Les 41 points majeurs ont été revérifiés un par un, en cherchant à les réfuter : 33 confirmés, 7 corrigés, 1 réfuté.
- **Corrigés** :
  - **Paliers de dérive** : ils tombent aujourd'hui à 1,54 / 3,38 / 5,54 s, soit 2,3 à 2,7 fois plus lents que dans
    Unreal.
  - **Arbres** : 62 % du tour de Val-Brûlé sans arbre, à cause du remplissage en grille arrêté à 2 600.
  - **Vibreurs** : 16,5 / 21,9 / 8,5 % du tour. Pas besoin de la bande continue d'Unreal : un vibreur par virage suffit.
  - **Tracés** : leurs formes se ressemblent ; Val-Brûlé compte 11 virages.
  - **Saison, stands, essence et usure** : la saison d'Unreal suit le format de 1991. Stands, essence et usure sont des
    règles de 1991 : écartés.
  - **Moteur du joueur** : celui d'Unreal joue des échantillons Amiga, donc aucune parité. On enrichit la synthèse, à
    l'oreille.
- **Réfuté** : Unreal n'a ni vibration de manette ni retour de force. On pourra en ajouter, hors parité.

## Risques et parades

- **Performance** :
  - arbres, touffes, relief, traces, rétroviseurs et voitures s'additionnent ;
  - mesurer chaque chantier au banc, en qualité fixe ; le mode Auto masque les régressions ;
  - budget : p95 en hausse de 0,3 ms au plus par lot.
- **Gel de fin de course** : `montrerResultats` simule tout d'un bloc ; contacts orientés et IA plus fine l'allongent.
  Découper la simulation de fin et limiter les contacts aux paires proches.
- **Temps de génération** : le décor se construit en 50 à 64 ms ; le tenir sous 150 ms. La taille n'est pas un souci :
  environ 100 à 150 ko de plus pour 1,4 Mo permis.
- **Calibrage de l'IA** : sa direction copie la loi du joueur et ses vitesses de référence ignorent la pente. Les
  chantiers 2 et 3 et le lot 5 déplacent ses temps : relancer `course.test.mjs` à chaque fois.
- **Records** : versionner les records avec la physique, sinon ceux de l'essai 0.1 deviennent incomparables.
- **Stockage pollué** : `avancer()` écrit records et fantôme jusqu'au lot 10. Le stockage du navigateur intégré, sur
  127.0.0.1:8781, garde un record de 1:21,429 à Val-Brûlé tiré d'un tour piloté par l'IA. Les captures de référence se
  font sur un profil vierge.
- **Constantes à confirmer** :
  - plusieurs chiffres de l'analyse sont des estimations ;
  - les paliers d'Unreal sont déduits de ses constantes ;
  - les temps d'image d'Unreal sont lus dans sa documentation.
- **Mobile** : aucun banc sur processeur graphique mobile. Les lots 4, 5 et 7 gardent un niveau bas jouable.
- **Un module par fonction** : `traces.js`, `degats.js`, `contacts.js`, validateur dans `course.js`. Sinon, deux lots
  réécrivent la même chose.
- **Hors parité** : Unreal n'a ni météo, ni nuit, ni ralentis. Le fantôme à 20 Hz pourra servir de base aux ralentis.

## Méthode

- **Organisation** : un chantier à la fois par fichier, dans l'ordre ci-dessus. Le cockpit et la physique peuvent
  avancer en parallèle sur des branches distinctes.
- **Avant chaque commit** :
  - `python3 construire.py` ;
  - tous les tests Node ;
  - critères mesurés ;
  - vérification dans le navigateur, volet visible, et captures comparées à celles de vroom-unreal.
- **Mise en ligne** : seulement à la demande de David, par `./deposer.sh`.
- **Rapports détaillés** : écarts, preuves, propositions et vérifications sont gardés sur le Mac, hors du dépôt. Ils
  sont dans `docs/analyse/` (ignoré par Git), avec les scripts de mesure de l'analyse. Ils ne sont pas versionnés,
  parce qu'ils citent des valeurs d'origine Lankhor qu'on ne reprend pas.
