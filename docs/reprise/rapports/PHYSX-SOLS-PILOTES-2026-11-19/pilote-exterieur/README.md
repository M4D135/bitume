# Pilote extérieur — poses et inspection EGL

La tête suit la direction et accompagne le passage du rapport. La main droite quitte la jante, rejoint le levier,
puis revient ; la main gauche garde sa prise. Les deux bras se raccordent aux poignets par deux segments de
22 et 23 cm. Les gants et le trajet viennent de la cinématique du cockpit ; les trois niveaux de détail partagent
les mêmes articulations. Le siège extérieur recule de 10 cm et le volant/gants est ramené à 90 % pour
laisser une marge mesurée au bord et à la bulle. Le cockpit conserve son cadrage. Les objets et leurs buffers sont préparés avec le modèle.

## Vérification

- `qualification.json` : portée, empreintes, résultats et limites.
- `pilote-exterieur-tests.log` : quatorze contrôles, dont 630 poses, identité des LOD, raccordement des cylindres,
  isolation cockpit/J2, rétroviseurs, service pneus et 60 000 appels avec mesure de préallocation.
- `pilote-exterieur-identite.log` : 268 groupes de poses historiques identiques ; `pilote-exterieur-voiture.log` : 33 contrôles existants.
- `encombrement.json` : 634 poses contre les triangles réels, capsules des bras sans pénétration, marge minimale 10,61 mm.
  Les paires écartées par leurs boîtes ont au moins 20 mm de marge ; 3 645 paires proches sont mesurées exactement.
  `avant-correction/` conserve le défaut visuel observé et le diagnostic, puis les pénétrations de la première correction.
- `pilote-exterieur-permanents.log` : douze contrôles historiques des objets permanents.
- `poses.json` : état des douze poses capturées et de la grille de 630 poses, articulations et matrice de tête.
- `report.json`, PNG et `pilote-poses-egl.png` : inspection EGL des vrais maillages du jeu, avec les shaders
  couleur/effets FERRO présents et leurs empreintes. Ce sont des vues techniques du modèle à caméra fixe,
  sans post-traitement, pas des captures de course dans le navigateur. Le LOD simple est volontairement grossi
  pour contrôler la pose ; il est utilisé loin en jeu.

## Reproduire depuis la racine du dépôt

```bash
node verifications/pilote-exterieur.test.mjs
node verifications/voiture-permanents.test.mjs
```

Exporter les poses vers un fichier temporaire (environ 18 Mo), puis lancer la capture :

```bash
preuve=docs/reprise/rapports/PHYSX-SOLS-PILOTES-2026-11-19/pilote-exterieur
node "$preuve/pilote-poses.mjs" "$PWD" /tmp/bitume-pilote-poses.json --grid
python3 "$preuve/pilote-collisions.py" /tmp/bitume-pilote-poses.json --output /tmp/bitume-pilote-encombrement.json
python3 "$preuve/pilote-egl.py" --input /tmp/bitume-pilote-poses.json --egl-base "$preuve/egl-context-reference.py" --output /tmp/bitume-pilote-egl
```

Le contexte EGL est une copie exacte de l’outil canonique FERRO `tests/ferro/renderer-local-wind-egl.py`.
Son empreinte est donnée dans `report.json`. Python requiert NumPy/Pillow et libEGL/libGL ; la capture utilise
llvmpipe logiciel, aucun fichier de texture importé. Aucune mesure de FPS matériel ni mise en ligne.
