# BITUME

Course de monoplaces d'époque dans le navigateur, entièrement procédurale : trois circuits générés, onze rivaux,
dérive et turbo. Moteur FERRO (WebGL2). Aucune image, aucun son enregistré, aucune police chargée : une seule page
HTML d'environ 581 Ko.

Essai 0.1 du 12 novembre 2026. BITUME est la refonte web de vroom-unreal, le projet Unreal de David : il garde le
genre et les mécaniques inventées pour vroom-unreal, et ne reprend rien du Vroom de Lankhor.

## Jouer

En ligne : <https://bitume.estrasse.fr>. On peut aussi ouvrir `dist/bitume.html` dans un navigateur récent avec
WebGL2 (Chrome, Edge, Firefox, Safari 15 ou plus) : la page se suffit à elle-même. Pour la reconstruire :

```bash
python3 construire.py
```

La version en ligne est la page figée d'un commit. Elle ne change qu'à la main, depuis le Mac, sans timer :

```bash
./deposer.sh
```

## Contenu de l'essai

- **Circuits** : Val-Brûlé (forêt, 4,22 km), Port-Sable (bord de mer, 3,64 km), Haut-Col (montagne, 5,22 km).
  Chacun est généré par une graine : arcs et lignes droites, relief, dévers, vibreurs, glissières, trajectoire idéale.
  Haut-Col passe 260 m sous la montagne, dans un tunnel éclairé.
- **Course** : 2, 3 ou 5 tours à douze voitures, départ arrêté aux feux, rivaux faciles, normaux ou coriaces,
  drapeau à damier, classement et écarts en direct, résultats.
- **À deux** : écran partagé sur la même machine, l'un sur l'autre ou côte à côte, chacun avec sa vue et son
  affichage. Chaque joueur choisit manette, clavier ou souris ; les touches de chacun se règlent (par défaut, flèches
  ou ZQSD pour l'un, pavé numérique pour l'autre).
- **En ligne** : course à deux, chacun sur sa machine. L'un crée la partie et donne son code de quatre lettres,
  l'autre le saisit ; les onze autres voitures restent à l'ordinateur. Chacun conduit sans attendre le réseau.
- **Chrono** : seul en piste. Le meilleur tour devient un fantôme bleu gardé dans le navigateur, avec un record
  par circuit.
- **Conduite** : boîte automatique ou manuelle, rupteur, vibreurs et herbe, glissières, dérive à trois niveaux de
  charge et turbo au lâcher (avec une fenêtre « parfaite »), aide au volant réglable.
- **Accidents** : petits contacts plus tolérants ; les gros chocs détachent toujours des pièces, puis la voiture
  revient sur la piste en moins d’une seconde. Un replacement invalide le chrono du tour.
- **Voiture** : une monoplace aux cotes de la Ferrari 312 T5 de 1980 (empattement 2,70 m, voies 1,70 et 1,615 m),
  sans nom, emblème ni commanditaire ; numéro en géométrie sur le nez et les pontons, roues qui tournent.
- **Vues** : cockpit, poursuite, caméra de télévision. Le cockpit est cadré comme celui de vroom-unreal : volant gros
  et bas, gants articulés sur la jante, planche à trois cadrans, rapport et vitesse en segments, lampe de régime,
  levier de vitesses où va la main droite à chaque rapport, rétroviseurs qui montrent les voitures qui suivent. La
  tête du pilote bouge avec les accélérations et regarde vers la corde.
- **Démo** : sans geste pendant cinq secondes sur l'écran titre, l'ordinateur pilote les douze voitures. Les courses
  de trois tours s'enchaînent sans fin d'un circuit au suivant, filmées du bord de la piste, à bord, en poursuite et
  d'hélicoptère. Un clic, une touche ou un bouton ramène au titre ; le réglage « Démo sur l'écran titre » la coupe.
- **Son synthétisé** : moteur à trois oscillateurs et saturation, trois voix de rivaux spatialisées avec effet
  Doppler, pneus, vibreur, herbe, chocs, feux et signaux. Une seule musique, sur l'écran titre : un thème original
  calculé note à note. En course, aucun signal ne porte de mélodie.
- **Image** : rien ne se coupe à distance. Le décor se dessine jusqu'à l'horizon, la brume fait la limite ; les ombres
  du soleil portent à 176 m devant le pilote. Le moteur WebGL2 repris d’EMPRISE apporte ses matériaux humides,
  ses reflets analytiques et ses nuages. La pluie se projette dans le monde avec le vent et la vitesse de la caméra ;
  la route reste humide après l’averse.

## Commandes

| Action | Clavier | Manette |
|---|---|---|
| Accélérer, freiner | ↑ ↓, ou Z S (W S en QWERTY) | gâchettes droite et gauche |
| Reculer (12 km/h maximum) | maintenir le frein à l’arrêt | maintenir LT à l’arrêt |
| Tourner | ← →, ou Q D (A D en QWERTY) | stick gauche |
| Dérive | Espace ou Maj, tenue dans un virage | A |
| Rapports (boîte manuelle) | E monter, A descendre (Q en QWERTY) | RB, LB |
| Vue, son, pause | C, M, Échap ou P | Y, —, Start |
| Menus | Tab, Entrée, Échap | croix, A, B |

Sur écran tactile : glisser le pouce à gauche pour braquer ; pédales et dérive à droite.
Maintenir la pédale Frein à l’arrêt fait reculer ; Gaz arrête le recul avant de repartir en avant.
La vue occupe tout l'écran ; carte et commandes sont transparentes. Dans les réglages, la carte peut être
masquée, placée en haut à gauche ou à droite, et affichée en trois tailles. Ces choix sont mémorisés.
Sur téléphone en portrait, le champ du cockpit est resserré et son ouverture à grande vitesse réduite.

### Xbox avec Microsoft Edge

Ouvrir `https://bitume.estrasse.fr/` dans Edge. Maintenir le bouton Menu permet de basculer entre les contrôles
du navigateur et les contrôles de jeu ([aide Microsoft](https://www.microsoft.com/en-us/edge/learning-center/how-to-use-microsoft-edge-on-xbox)).
En mode jeu : croix pour les menus, A pour valider, B pour revenir ; RT accélère, LT freine, le stick gauche
braque, A ou X commande la dérive, Y change la vue et Menu met en pause. Si le son n'a pas démarré, un clic
sur la page avec le pointeur du navigateur permet de l'activer avant de repasser aux contrôles de jeu.

Le rendu demande WebGL2. L’écran titre a été confirmé sur une Xbox par David le 16/11/2026. Les parcours manette
sont testés dans Chromium avec une manette simulée ; course, son et fluidité restent à confirmer sur la console.

## Pour aller plus loin

- `CONCEPTION.md` : intentions, mécaniques, ce qui est vérifié et ce qui ne l'est pas.
- `PLAN-MAITRE.md` : le plan de travail en cours, phase par phase, avec ce qui reste à faire.
- `FEUILLE-DE-ROUTE.md` : l'écart avec vroom-unreal et les lots pour le combler.
- `AGENTS.md` : structure, conventions, construction et tests.
- `src/moteur/PROVENANCE.md` : origine du moteur et retouches.
