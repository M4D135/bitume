# Preuves du lot 26 — animaux des abords (18/11/2026)

Le lot est décrit dans [`docs/reprise/26-ANIMAUX.md`](../../26-ANIMAUX.md). Ce dossier en garde les preuves.

## Contenu du dossier

| Fichier | Contenu |
|---|---|
| `index.html` | Les 37 captures en planche, chacune avec ses chiffres de rendu. |
| `*.jpg` | Les captures, au palier Élevé, en été, de jour, 1280 × 720. Pour chaque circuit : `-proche`, `-loin`, `-fuite`, `-passage` et `-vol` ; en plus, `cap-sequoia-baleine` et `val-brule-legere` (Légère). |
| `mesures.json` | Tout ce que l'outil a relevé (voir plus bas). |
| `creation-page.json` | Temps de création des animaux et mémoire de la grille, mesurés dans la page, en deux séries. |
| `essai-creation.js` | L'essai qui produit `creation-page.json`, à passer à `tools/page-essai.mjs`. |
| `integration.patch` | Le branchement dans le jeu : `src/jeu.js` et `construire.py`. |
| `tests.log` | `verifications/animaux.test.mjs` en détail, puis la suite complète, après le retrait des retouches locales. |

`mesures.json` contient :

- l'environnement : navigateur, processeur graphique, version de la page ;
- par circuit : les statistiques des groupes, le groupe visé par les prises et l'instant de son alerte et de sa fuite ;
- les courses en vue cockpit, avec et sans animaux ;
- pour chaque prise : `rendu.stats` avec et sans animaux à la même image, et la caméra employée.

## Refaire les captures

La page doit contenir le module : il faut appliquer le patch puis reconstruire.

```sh
git apply docs/reprise/rapports/animaux-2026-11-18/integration.patch
python3 construire.py
node tools/planche-animaux.mjs dist/bitume.html /tmp/planche-animaux
node tools/page-essai.mjs dist/bitume.html docs/reprise/rapports/animaux-2026-11-18/essai-creation.js
git checkout -- src/jeu.js construire.py dist VERSION.json SIZE.json   # pour revenir à l'étude seule
```

L'outil travaille dans les conditions suivantes :

- Chrome sans interface, profil temporaire isolé et effacé à la fin, port de débogage local éphémère ;
- horloge d'images commandée (`tools/controle-visuel.mjs`) : les images sont reproductibles, et deux passages ont
  donné 37 images identiques à l'octet ;
- environ deux minutes pour les sept circuits.

Mesures prises ici : Chrome 157 sans interface, ANGLE Metal sur Apple M5, page 0.2.40 reconstruite localement avec le
patch.

## Lire les chiffres

- **Écart de chaque prise** : la même image est redessinée au même instant, animaux coupés. Les triangles de
  `rendu.stats` comptent la vue et les ombres, d'où deux fois les triangles des bêtes.
- **Courses en cockpit** : une course d'échauffement est jetée, puis la même course tourne quatre fois, avec, sans,
  avec, sans. `bruitMs` est l'écart entre deux courses identiques. Sur les sept circuits, l'écart avec et sans animaux
  reste dans ce bruit ; ce banc ne mesure pas la fluidité.
- **`dessin` et `cerveau`** : le temps des seuls appels `B.animaux.dessiner` et `B.animaux.pas` (ceux qui font avancer
  le cerveau), sur les deux courses avec animaux.
