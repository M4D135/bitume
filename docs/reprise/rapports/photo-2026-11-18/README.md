# Preuves du lot 21 (photoréalisme), 18 novembre 2026

Ce dossier accompagne [21-PHOTOREALISME.md](../../21-PHOTOREALISME.md). Base mesurée : `main` `8bd3d86`
(BITUME 0.2.39, FERRO 0.3.9), Chrome 157 sans interface, ANGLE Metal sur Apple M5 ([mesures/gpu.json](mesures/gpu.json)).

## Contenu

- `images/` : les 31 prises commentées dans l'étude, réduites à 960 px de large en JPEG. Elles sont prises en
  1280 × 720, densité 1, qualité Fine, affichage de course masqué. Les noms donnent le circuit (`c0` Val-Brûlé,
  `c1` Port-Sable, `c2` Haut-Col, `c4` Roche-Fauve, `c6` Cap-Séquoia), le cadrage et la condition. Les noms en
  `-maquette` montrent la maquette de l'étude (§ 6), les autres la base. `annexe-legere-msaa4.jpg` montre l'écran
  noir de Légère avec MSAA 4×.
- `mesures/` : résultats bruts en JSON (`valeur`, `erreurs`), tels que les rend `tools/page-essai.mjs`.
  - `couts-*.json` : coût de l'image principale par variante (médiane `p50` et `p90` en ms, `niveauMoyen` d'une
    bande de pixels, ce qui permet de repérer une image noire) ;
  - `ab-origine-*` et `ab-maquette-*` : séances alternées entre la base et la maquette ;
  - `scint-*.json` : indice de scintillement (`d1`, `d2`, allers-retours) ;
  - `eclat.json` : l'adaptation de l'œil du tunnel ;
  - `noir.json` : l'erreur GL de l'écran noir ;
  - `gpu.json` : le navigateur et le GPU utilisés ;
  - `controle-charge-1757.json` : la même mesure relancée sur la machine chargée (étude, § 2, « Limite »).
- `outils/` : les modèles JavaScript injectés dans la page et les scripts qui les lancent.
- `integration.patch` : la maquette sous forme de diff de `src/moteur/renderer.js`. Elle sert de référence, **pas
  d'intégration** : la copie est verrouillée et commune aux quatre jeux FERRO (étude, § 6 et § 7).

## Refaire les mesures

Depuis `outils/`, avec une page construite :

    python3 lancer.py couts-cam.js /tmp/couts.json '{"__REF__": {"circuit": 0, "qualite": "high", "vue": "cockpit", "retro": "non"}, "__CAM__": "", "__VARIANTES__": [{}, {"shadows": false}]}' 1440,757 2
    zsh scint.sh ; zsh scint2.sh

`lancer.py` lit la page dans la variable `PAGE` (par défaut `dist/bitume.html` du dépôt). `prendre.py liste.json`
fait les prises d'une liste produite par `lot1.py`, `lot2.py` ou `lot3.py`. Les PNG vont dans le dossier `SORTIE`,
par défaut un dossier temporaire. Ils ne sont pas versionnés : seules les réductions JPEG le sont.

Pour comparer deux constructions, alterner les séances (base, maquette, base, maquette…). D'une séance à l'autre, la
machine dérive de plusieurs millisecondes (étude, § 2).

## Refaire la maquette

`outils/maquette.py` applique les quatre retouches à `src/moteur/renderer.js` du dépôt où il se trouve. Chaque ancre
doit y figurer une seule fois, sinon le script s'arrête. `construire.py` refuse ensuite la copie modifiée :
`tools/check-ferro-lock.py` est son premier appel, et ce refus est voulu. Pour l'étude, la construction a été lancée
localement en sautant ce seul appel, puis tout a été remis en place :

    git checkout -- src/moteur/renderer.js dist VERSION.json SIZE.json

Rien de ce qui a été construit ainsi ne doit être commité ni mis en ligne.
