# 17A — Outillage et loi de pneu isolée

Lot 17 (conduite p10), premier sous-lot, 18/11/2026. Plan : `docs/reprise/17-CONDUITE.md` § 5, 17A.

## Ce qui change dans la conduite

Rien. La voiture roule au bit près comme avant : l'empreinte du banc complet et celle du banc court sont les mêmes,
le garde-fou du déterminisme (19 séances, 1 259 empreintes) passe à l'identique. La physique reste `p9`.

## Ce qui est livré

- `src/pneu.js` (nouveau) : la loi de pneu du lot 17, hors de FERRO. Loi p10 du plan (§ 3.2 à 3.4) : adhérence en
  puissance de la charge normée sur la charge statique de l'essieu, angle du pic selon la charge, montée en sinus puis
  plateau vers 1 − c, glissement combiné de Beckman, relaxation, mémoire du pic. Fonctions pures, sans création
  d'objet. Et la loi p9 : `pneu.p9(FERRO)` rend les fonctions mêmes de FERRO ; `conduite.js` passe désormais par elle.
- `construire.py` : `pneu.js` est placé avant `conduite.js` dans la page.
- `src/conduite.js` : relevé facultatif `_mesure` (demandes et capacités des essieux, dérives rapportées au pic, frein
  moteur). Seul le banc le pose ; les champs « _ » n'entrent dans aucune empreinte d'état.
- Banc v2 (`tools/banc-conduite.mjs`) : essais du lot 17 ajoutés, avec leur propre empreinte (`empreinteP10`) pour que
  celle des essais v1 reste comparable. Freinage pédale tenue (premier essieu à sa limite et à quelle vitesse), départ
  plein gaz sans aide, échelons à 150 et 250 km/h et à 200 km/h manette sans aide, essieu qui fixe la limite et réserve
  de l'arrière, plein gaz en 2e en appui, deux roues dans l'herbe, vibreur, sillage en virage, x_ar pendant la
  dérive, dérive tenue 10 s, régime rapporté à la vitesse, frein moteur par rapport, eau et neige, profil des rivaux.
  `node tools/banc-conduite.mjs --rivaux` donne le profil seul (vitesses d'adhérence de R 20 à R 400, ajustement
  μ_eq, A_eq).
- `verifications/pneu.test.mjs` (nouveau) : les cibles de la loi, la loi p9 identique à FERRO, quatre mutants refusés.
- `verifications/conduite-p10.test.mjs` (nouveau) : les 84 cibles chiffrées de 17B à 17J, avec la valeur p9 du plan et
  la mesure du code présent. Aucune n'est obligatoire : chaque sous-lot ajoute le sien à `OBLIGATOIRES`.
- `tools/cout-pas.mjs` (nouveau) : coût d'un pas de course de douze voitures, la mesure de 5B-7 rendue rejouable
  (Val-Brûlé, 300 s simulées, essais alternés dans des processus neufs, médianes).
- `verifications/voiture-identite.test.mjs` : charge `pneu.js` avant `conduite.js`, comme la page.

## Mesures avant et après

| Mesure | Base (5ce4474) | Après 17A |
|---|---|---|
| empreinte du banc complet / court | 52a7484e7589dd23 / 6dc495a68695aec5 | **les mêmes** |
| empreinte des essais du lot 17 | — | ce461e6c87021649 |
| empreinte des sources du banc | 366aa68b163a | cd03cf6b61be (pneu.js et le relevé en plus) |
| `conduite-criteres` | 46/46, S8 ouverte | 46/46, S8 ouverte |
| `determinisme-simulation` | 19 cas, 1 259 empreintes | identique |
| `pneu.test` | — | 22 contrôles tenus, 4 mutants refusés |
| `conduite-p10.test` | — | 84 cibles, 43 déjà atteintes en p9, aucune obligatoire |
| suite `verifications/` | verte (3 tests sensibles à la charge, repassés) | 81 tests verts |
| coût d'un pas, 12 voitures (médiane de 7) | 54,1 µs | 45,8 µs |
| ramasse-miettes mineurs sur 300 s | 33 | 34 |

Le coût d'un pas est le même : l'écart est celui de la machine, chargée par d'autres travaux (essais de 33 à 70 µs
pour la base, de 44 à 58 µs ensuite). Le compteur de créations en course de 5B reste à zéro
(`voiture-permanents.test`, `effets-allocation.test`, `simulation-sorties.test` verts).

## Ce que les nouveaux essais disent de p9

Ce sont les points de départ de 17B à 17J (détail dans la sortie de `conduite-p10.test.mjs`) :

- l'avant fixe la limite partout ; la réserve de l'arrière y est de 4,6 à 7,4 % (cible 17B : 6 à 13 %) ;
- plein gaz en 2e en appui (R 60, 0,92 × la limite) : l'arrière va à 1,36 fois son pic ;
- pédale pleine : l'avant est à sa limite dès 298 km/h, et la distance est celle du meilleur freinage (pas de
  blocage possible en p9) ; même à 60 % de répartition, l'avant reste le premier ;
- deux roues dans l'herbe ou sur le vibreur, le centre sur la piste : aucun effet (surface lue au centre) ; le centre
  sur le vibreur : −8 % ;
- derrière une voiture à 10 m, en R 120 : +0,4 % (le sillage n'agit que sur la traînée) ;
- dérive : l'arrière tourne à 1,5 à 2,1 fois son pic en R 40 à R 120, 1,0 en R 250, 0,6 en R 400 ; tenue 10 s en
  R 80 : turbo III et aucune perte de vitesse ;
- régime × vPointe / v : 12 950 à 13 709 (affine) ; frein moteur identique en 2e et en 6e ;
- eau 1, R 500 : slicks et pneus pluie bornés par la pointe (aucun aquaplanage) ; la neige est ignorée ;
- rivaux : leur référence vaut 0,938 à 1,000 de la vitesse d'adhérence de R 20 à R 180 ; l'ajustement de la voiture
  donne μ_eq 1,735 et A_eq 115e-5 (référence actuelle 1,55 et 155e-5).

## Choix de mesure à connaître

- En p9 la roue ne tourne pas : « bloquer » ou « patiner » veut dire que la demande d'un essieu atteint ce qu'il peut
  transmettre. Quand la roue aura un état de rotation (17C, 17D), le relevé donnera son glissement.
- « Dehors » en remise des gaz : l'écart maximal à l'axe, comme dans BANC-BASE.md (8 à 19 m en p9).
- Aquaplanage et neige : comptés en adhérence (rapport des carrés des vitesses limites).
- Clavier R 30 et R 120 « pas moins » : p9 mesure 89,6 et 94,7 % ; seuils 89,5 et 94,5 %.
- Non mesuré ici : les rapports de difficulté des rivaux (17J, avec `course.js`) et les tests de sensation (17I).

## Rejouer

```bash
node tools/banc-conduite.mjs --json r.json        # banc complet v2 (v1 + lot 17)
node verifications/conduite-p10.test.mjs --json r.json
node tools/banc-conduite.mjs --rivaux
node tools/cout-pas.mjs --src src --contre <autre arbre>/src --essais 7
```
