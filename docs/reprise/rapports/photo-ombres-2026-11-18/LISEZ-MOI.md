# Ombres photo — lot 21, étape 1, 18 novembre 2026

**BITUME 0.2.40 sur FERRO 0.3.11** (option `ombresPhoto`). C'est l'étape 1 du plan
`docs/reprise/21-PHOTOREALISME.md` : effets O1 à O5 (O6 est écarté par la consigne). Tout reste local : rien n'est
poussé, fusionné ni mis en ligne.

## Ce qui est plus beau

Le dossier `images/` contient onze vues en 1280 × 720. Chacune est prise avant (FERRO 0.3.10) et après (0.3.11), à la
même pose. Les fichiers `zoom-*` agrandissent la même zone des deux prises. Les vues 10 et 11 sont deux des 80
cadrages du plan (voir « Contrôles »).

- **L'ombre de la voiture filmée est nette** (O3, tuile de 512²). On reconnaît les roues, l'aileron, l'arceau et les
  échappements dans l'ombre portée sur la piste. Avant, c'était une tache floue. Voir `2-poursuite-fine` et
  `zoom-a-poursuite-ombre`.
- **La voiture filmée s'ombre elle-même** (O3). De près, le casque et l'arceau dessinent leur ombre sur le ponton, et
  les roues et l'aileron avant la leur sur la piste. Avant, des taches floues. Voir `10-voiture-34` et
  `11-voiture-haut`.
- **Le bras et la main ombrent l'habitacle** (O3). En cockpit, l'ombre du bras tombe sur le flanc. Voir
  `9-cockpit-fine-volant` et `zoom-g-cockpit-bras`.
- **Les arbres lointains ont une ombre** (O2). Avant, les ombres s'arrêtaient à 176 m devant le pilote. La carte
  lointaine est calculée une fois au chargement et couvre tout le circuit. Elle se fond dans le carré proche, sans
  couture. Voir `7-vue-haute`, `zoom-d-arbres-loin` et `zoom-b-cockpit-horizon`.
- **Les voitures touchent la piste** (O1) : un contact sombre sous la caisse et autour des pneus, dans les trois
  paliers. En Légère, où il n'y a pas d'ombres du soleil, c'est la seule ombre sous la voiture. Voir
  `4-exterieur-legere` et `zoom-c-legere-contact`. Sur la grille, l'effet est discret (`5-depart-grille`,
  `zoom-e-grille`).
- **Les ombres s'éclaircissent quand le ciel se couvre** (O4, part météo, gratuite). Sous la pluie, l'ombre de la
  voiture est plus claire, mais elle reste nette, alors qu'un ciel de pluie la voudrait floue (voir « Ce qui reste »).
  Voir `8-poursuite-pluie` et `zoom-f-pluie-ombre`.
- Le cockpit en Moyenne et la tribune changent peu : 2,2 % et 0,7 % des pixels, surtout par le contact et les arbres
  lointains.

`mesures/ecarts.txt` chiffre les neuf premières paires ; les paires 10 et 11 sont dans `mesures/cadrages-plan.txt`.
Dans sept vues sur neuf, presque tous les pixels qui changent s'assombrissent (de 98,9 à 100 %). Les deux autres
cas :

- en poursuite Fine, 69 % seulement s'assombrissent : l'ombre nette rend la lumière à ce que couvrait l'ancienne
  tache floue ;
- sous la pluie, 41 % seulement, car les ombres s'éclaircissent.

Deux prises de la même construction diffèrent de 0,06 % des pixels en Fine et de 1,9 % en Légère, avec autant de
pixels plus clairs que de plus sombres. Le zoom `zoom-h-casquette-*` explique le choix de la tuile de 512² (voir
« Choix »).

## Ce que ça coûte

Les mesures sont faites sur le Mac de David (M5, 24 Go, macOS 27.2.1), avec Chrome 157 sans fenêtre, à Val-Brûlé,
au soleil. On mesure le temps de l'image principale, en attendant la fin du GPU. Les variantes alternent image par
image dans la même séance. Le résultat est la médiane de trois séances par effet, et de neuf pour la colonne
« Tous ». Les écarts sont en millisecondes. Détails dans `mesures/couts.txt` ; une ligne par séance dans
`mesures/couts-seances.log`.

| Palier (toile) | Vue | Image | Contact | Tuile | Carte lointaine | Pénombre météo | Tous |
|---|---|---|---|---|---|---|---|
| Fine (2880 × 1514) | cockpit | 20,8 ms | +0,3 | +0,5 | 0,0 | 0,0 | **+0,9** |
| Fine | poursuite | 17,5 ms | +0,6 | +0,2 | 0,0 | 0,0 | **+1,0** |
| Moyenne (1440 × 757) | cockpit | 14,3 ms | +0,7 (bruité, −1,5 à +1,2) | +0,1 | −0,1 | bruit (−1,2 à +1,6) | **+1,0** |
| Légère (1152 × 606) | cockpit | 6,7 ms | +0,3 | — | — | — | **+0,3** |
| Légère | poursuite | 5,5 ms | +0,1 | — | — | — | **+0,1** |

- Légère n'a pas d'ombres du soleil : seul le contact y est actif.
- La carte lointaine coûte 0,5 ms au chargement, GPU compris (de 0,1 à 0,9 ms sur 51 séances). Elle ne coûte rien en
  course. Elle n'est pas calculée sur un GPU modeste.
- La préparation des ombres côté jeu (`B.ombres.preparer`) prend environ 1 µs par vue, sans allocation.
- Mémoire graphique : 8 Mo pour la carte lointaine (2048², profondeur 16 bits) et 0,5 Mo pour la tuile.
- Pour comparer : toutes les ombres du soleil ensemble coûtent 3,9 ms en Fine cockpit et 3,0 ms en Fine poursuite et
  en Moyenne.
- Essais écartés :
  - la tuile de 1024² coûtait +0,65 / +0,25 / +0,50 ms (Fine cockpit, Fine poursuite, Moyenne), sous forte charge ;
  - PCSS ne se distinguait pas du bruit (+0,0 et −0,15 ms).

## Contrôles

- **Image stable** (O5, `tools/controle-ombres.mjs`, résultats dans `mesures/controle-ombres.json`). La scène : un
  arbre à 33 m de la piste, le décor immobile, la caméra fixe, et la voiture qui passe, avec le carré d'ombre et la
  tuile qui la suivent.
  - En Fine, la variation d'une image à l'autre vaut **d1 = 0,008** pour un seuil de 0,01. C'est autant que sans
    aucune ombre (0,008) ; FERRO 0.3.10 donnait 0,0085.
  - En Moyenne : 0,0052.
  - Habitacle immobile à l'écran : la tuile de 512² n'ajoute presque rien (+0,023 en d2, seuil 0,05).
- **Journal du gouverneur Auto** : `B.ombres.journal()` note chaque changement de niveau ou d'ombres. Sur 10 s de
  course, il note un changement : niveau 0, ombres allumées.
- **Rien n'est créé en course** : `stats.creations` vaut 0 dans toutes les scènes. Seule exception, une création en
  Fine poursuite dans 13 séances sur 63 ; elle existait déjà en 0.3.10 (2 séances sur 3) et n'a pas de lien avec ce
  lot.
- **Aucune allocation à l'image** : c'est mesuré par `verifications/ombres.test.mjs`.
- **Les 80 cadrages du plan** (§ 7.3 ; scripts `outils/lot1.py` à `lot3.py` du rapport photo du 18/11) sont repris
  avant et après. L'outil du plan tourne en temps réel : deux de ses passages sur la même construction diffèrent déjà
  de 51 % des pixels en cockpit. Les prises sont donc refaites pas à pas, avec un hasard fixe
  (`mesures/outils/prise.js`). Six cadrages pris deux fois avec cet outil : cinq sont identiques au pixel près, le
  sixième diffère de 0,05 % des pixels. Résultats dans `mesures/cadrages-plan.txt` :
  - de jour, en cockpit et en bord de piste sur les sept circuits, de 0,7 à 4,9 % des pixels changent, et presque
    tous s'assombrissent ;
  - au crépuscule et la nuit, on retrouve les mêmes effets, sans défaut visible ;
  - sous la pluie, une partie des ombres s'éclaircit (part météo) ;
  - l'eau et les falaises au-dessus de la mer ne changent pas ; dans le tunnel, 14 pixels au plus bougent ;
  - l'ombre proche d'un arbre ne change pas, et l'ombre d'un arbre lointain apparaît ;
  - les voitures vues de près changent sur 11 à 19 % des pixels : l'ombre nette remplace la tache floue.
- **Sans l'option, FERRO 0.3.11 donne exactement l'image de 0.3.10** : mêmes shaders et mêmes appels GL. Un test le
  prouve par empreintes (`tests/ferro/renderer-ombres-photo.test.mjs`).
- **Suites** :
  - FERRO : 191 tests, 0 échec (1 « todo » déjà présent avant le lot).
  - BITUME : 78 suites sur 78.
  - Parcours `smoke` sans fenêtre : 0 erreur.
  - Détails : `mesures/verifications.txt` et `mesures/suites-hote.log`.

## Choix

- **Tuile de 512²** et non de 1024². À 1024² (texels de 7 mm), la casquette de la planche, mince et à facettes,
  projette des dents de scie qui rampent quand la caisse tangue : +0,11 en d2, au-dessus du seuil. À 512²
  (texels de 14 mm), les dents disparaissent et l'ombre du bras reste nette. Comparer `zoom-h-casquette-tuile1024`
  et `zoom-h-casquette-tuile512`.
- **Pénombre variable (PCSS) coupée.** Elle faisait trembler l'ombre d'un arbre au passage de la voiture : d1 = 0,033
  dans la première version. Une fois sa grille accrochée au monde, il restait 0,012, toujours au-dessus du seuil de
  0,01. Seule la part météo, gratuite, est allumée, en Moyenne et en Fine. `B.ombres.reglages.pcssFine = true` la
  rallume en Fine. Le plan (§ 7.4) la faisait de toute façon attendre les gains du lot 5B.
- **Contact allumé en Légère**, avec quatre voitures au plus. Il coûte de 0,1 à 0,3 ms sur le M5.
  `B.ombres.reglages.contactLegere = false` le coupe si une machine modeste le paie trop cher.

Le détail des essais écartés est dans `mesures/diagnostics.txt`.

## Ce qui reste

- **Fine dépasse déjà son budget** : le rapport de fluidité du 18/11 montre qu'elle rate une image sur quatre en cockpit
  avec les rétroviseurs. Ce lot y ajoute environ 1 ms, et autant en Moyenne. Le seul effet de ce lot que le § 7.4
  réserve à l'après-5B est O4 : seule sa part gratuite (météo) est allumée. Il faudra remesurer après le 5B.
- **Pas mesuré** :
  - sur une machine modeste ;
  - en fenêtre visible, à cadence réelle (`tools/profil-accrocs.mjs`) : la consigne interdisait d'ouvrir une fenêtre
    Chrome ;
  - au chronomètre GPU, effet par effet : les requêtes de temps GPU de Chrome donnaient des résultats contradictoires
    sur ce Mac (`mesures/diagnostics.txt`, point 4). Les coûts sont des temps synchronisés ;
  - en mode duo, où le contact et la tuile sont préparés pour chacune des deux vues ;
  - le temps de compilation des nouveaux shaders au chargement.
- **La tuile ne s'adoucit pas sous un ciel couvert.** Sous la pluie, l'ombre de la voiture filmée reste nette, plus
  claire seulement. Il faudra l'élargir avec la couverture nuageuse.
- **PCSS** : il faudra accrocher au monde la profondeur de l'atlas, comme sa grille, puis remesurer le tremblement.
- **La carte lointaine** ignore le vent et suppose un soleil fixe : BITUME garde la même direction du soleil pour
  chaque circuit.
- L'ombre d'une autre voiture sur la voiture filmée vient encore de l'atlas, pas de la tuile.
- WebGPU n'est pas porté : l'image y reste celle de 0.3.10.
- Les scènes du banc (`scene-bench.js`) posent leurs propres lots de décor : elles n'ont pas de carte lointaine.
- O6 n'est pas traité : il était écarté par la consigne.

## Contenu du dossier

- `images/` : les onze paires avant/après et les zooms (JPEG ; la provenance et les empreintes des prises sont dans
  `mesures/prises.json`).
- `mesures/` :
  - `couts.txt` et `couts-seances.log` : les coûts ;
  - `controle-ombres.json` et `diagnostics.txt` : la stabilité et les essais écartés ;
  - `ecarts.txt` : les écarts des neuf premières paires ;
  - `cadrages-plan.txt` : les 80 cadrages du plan, avant et après ;
  - `verifications.txt` et `suites-hote.log` : les suites ;
  - `outils/` : les scripts de prise (`prendre.py`, `prise.js`), de comparaison (`comparer.mjs`,
    `ecarts_cadrages.py`) et de coût (`couts.py`, `couts.js`, `resume_couts.py`), avec leurs listes (`vues.json`,
    `cadrages-plan.json`, `plan-couts.json`). Exemple : `python3 mesures/outils/prendre.py dist/bitume.html
    mesures/outils/vues.json /tmp/prises`.
