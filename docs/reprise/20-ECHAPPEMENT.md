# Lot 20 — flammes et détonations à l'échappement

## Demande et périmètre

David, 18 novembre 2026 : « aussi flamme dans les pots d'échappement quand surrégime et pop and bang quand passage
vitesse comme dans la réalité et ça permet de voir pour le passage vitesse en vue extérieure, fais cet effet aussi sur
les voitures concurrentes pour plus de réalisme ».

Demande transmise pendant le lot : « améliore la génération procédurale, rends-la plus détaillée, meilleures matières,
plus diversifiée et aléatoire ». Elle est appliquée ici à l'échappement seulement : formes, teintes, durées et sons des
flammes sont tirés au hasard à chaque claquement. **Ce n'est pas une refonte générale de la génération procédurale** :
décor, circuits et matières du jeu n'ont pas changé. Cette refonte est le lot 22, mené sur la branche
`etude/procedural`.

Statut : **étude**, branche `etude/echappement` sur `8bd3d86` (0.2.39), FERRO 0.3.9. Rien n'est fusionné, poussé ni
publié. La page construite (`dist/`, `VERSION.json`, `SIZE.json`) est restée celle de la base.

| Commité | Hors commit |
|---|---|
| `src/echappement.js` (nouveau), `src/son.js`, `verifications/echappement.test.mjs` (nouveau), `verifications/son.test.mjs`, ce document, `rapports/echappement-2026-11-18/` | `src/jeu.js` et `construire.py` : branchement fourni dans [integration.patch](rapports/echappement-2026-11-18/integration.patch) |

## Ce qui se passe à l'échappement

Moteur visé : douze-cylindres à plat de 1980, à injection mécanique et sans coupure électronique. Le mélange imbrûlé
finit de brûler dans les tubes chauds. Les instants viennent de `conduite.js` : coupure de `rapportDuree` au passage,
cadence du rupteur, régimes.

| Genre | Quand | Flamme | Son |
|---|---|---|---|
| Détonation | Passage montant au-dessus de 7 000 tr/min : de 30 % de chances à 7 000 tr/min, toujours au-delà de 11 400. Rétrogradage : 25 à 70 %, et il relance les crépitements. | 12 à 55 ms après le passage, **les quatre tubes ensemble**. Langues de 30 à 75 cm, étirées jusqu'à 1,45 fois par la vitesse. Un second claquement plus faible, sur un banc, suit 70 à 130 ms après : 45 % des fois en montant, 60 % en rétrogradant. | Coup sourd et sec, quatre variantes. |
| Crépitement | Pied levé (gaz ≤ 0,12) au-dessus de 8 500 tr/min : jusqu'à 18 claquements en 1,6 s, espacés de 30 à 150 ms puis de plus en plus rares et faibles. Rien plus bas. | Un banc entier (55 %) ou un seul tube ; bleue une fois sur quatre (mélange pauvre), sinon orangée ; 35 à 80 ms. | Claquements secs, six variantes. |
| Raté au rupteur | Pied ≥ 0,5 au-dessus de 12 700 tr/min. Sortie sous 12 000, sinon chaque rebond sur la grille ouvrirait un nouvel épisode. | Une coupure par dixième de seconde (± 15 ms). Flamme 70 % des fois en roulant, 45 % à l'arrêt, et plus faible à l'arrêt. | Raté grave, trois variantes. |

Ce que le passage donne à voir : en vue extérieure, quatre langues orangées sortent ensemble des quatre tubes, sur sa
voiture comme sur les concurrentes. Le crépitement, plus petit et d'un seul côté, ne se confond pas avec un passage.

Constat sur deux vraies courses de 20 s (graines 5 et 17017, toutes les voitures menées par l'IA) : tous les ratés
tombent sur la grille, pendant le compte à rebours. Il y en a 341 et 299, soit 19 à 33 par voiture, avant le feu vert
à 6 s. En roulant, les IA passent le rapport avant le rupteur : aucun raté. Script :
[grille.mjs](rapports/echappement-2026-11-18/grille.mjs).

### Dessin

- **Formes.** Trois fuseaux de 16 anneaux de 16 côtés, construits au chargement et enregistrés une fois
  (`bitume-flamme-0/1/2`).
  Le premier est une larme lisse, le deuxième a trois lobes tordus qui lèchent, le troisième est coudé vers le haut.
  Chaque claquement tire sa forme.
- **Trois objets par sortie.**
  - La langue, orangée ou bleue.
  - Son cœur, plus court, plus mince et plus chaud : jaune presque blanc, ou bleu clair.
  - Une bouffée : boule de feu chassée du tube à 6 m/s, freinée par l'air, qui grossit et monte derrière la voiture.
- **Hasard par flamme.**
  - Longueur, largeur, roulis, lacet et tangage.
  - Teinte, au sein d'une famille par claquement (jamais un mélange boueux).
  - Retard de 0 à 5 ms d'un tube à l'autre (détonation).
  - Scintillement à deux battements, fonction du seul temps.
- **Vitesse.** Lancée, la flamme s'étire (jusqu'à 1,45 fois) ; à l'arrêt, le gaz chaud monte.
- **Teintes.** Canaux vert et bleu bas, réglés sur les captures. La passe des effets de FERRO compresse chaque canal
  (x / (x + 0,76)) : à 0,3 de vert, la flamme virait au beige.
- **Rien ne s'efface au loin**, comme le veut la règle du lot 5B. Une concurrente à 150 m crache la même flamme qu'à
  5 m, cœur compris. C'est ce point clair qui fait repérer son passage devant soi ou dans les rétroviseurs.
- **Rétroviseurs et cockpit.** Les rétroviseurs montrent les flammes des concurrentes, car `majGlaces` recopie les
  objets de la scène. En vue cockpit, les flammes de sa propre voiture ne sont pas dessinées : l'arrière de la caisse
  ne l'est pas non plus.

### Fluidité et hasard

- **Décision à chaque pas de simulation** (1/120 s), d'après l'état de chaque voiture. Le dessin est fonction du seul
  temps de l'image (horloge interpolée). Mêmes événements et mêmes flammes à 30, 60, 120 images/s ou à cadence
  variable.
- **Hasard propre.** Hachage (lowbias32) de la graine de course, de la voiture, du genre et de l'instant de l'épisode.
  Ni `Math.random` ni le générateur de la course : avec ou sans le module, positions, vitesses, régimes et rapports
  sont identiques après 20 s de course.
- **Tout est préparé au chargement.**
  - Douze objets par voiture.
  - Tableaux typés.
  - Anneau de quatre flammes par sortie.
  - File de 64 sons.
- **Rien n'est alloué par pas ni par image.**

## Son (`src/son.js`)

- **13 tampons synthétisés au démarrage** : 4 détonations de 0,17 s, 6 crépitements de 0,07 s, 3 ratés de 0,13 s.
  - Bruit filtré par biquads, avec un xorshift propre.
  - Identiques à chaque démarrage ; 8 à 10 ms de calcul sous Node.
- **6 voix préparées** : passe-bas → gain → panoramique → bus moteur.
  - Une seule source jouée par claquement : Web Audio n'en réutilise pas.
  - 6 départs par image au plus.
  - La voix la plus faible ne cède sa place que si elle l'est nettement (moins de 0,7 fois le nouveau son).
- **Niveaux à pleine force, tout près** : détonation 0,42, crépitement 0,24, raté 0,3.
  - Atténuation par la distance, comme les moteurs.
  - Passe-bas de 9 500 Hz à 700 Hz avec l'éloignement.
  - Placement gauche-droite d'après l'angle.
  - Depuis le cockpit, sa propre voiture est étouffée (× 0,7, 2 600 Hz) et au centre.
- **Instants.** Un retard constant de 35 ms garde l'écart entre deux claquements de la même image. Un événement de plus
  de 0,25 s n'est pas rattrapé après un accroc.
- **Ancien claquement.** Le claquement de `son.evenement('rapport' | 'rupteur')` ne jouait que pour la voiture suivie,
  avec des nœuds créés à chaque fois. Quand la file de l'échappement mène le son, il ne double plus. Sans le module
  (file non lue depuis 0,5 s), il revient tel quel.

**Pas écouté dans un navigateur** : Chrome sans tête n'a pas de geste de l'utilisateur, le contexte audio reste
suspendu (`actif: false` dans les mesures). Les niveaux sont à régler à l'oreille sur le Mac.

## Branchement ([integration.patch](rapports/echappement-2026-11-18/integration.patch))

- `construire.py` : `echappement.js` après `traces.js`.
- `src/jeu.js` :
  - création de `S.ech` avec la graine de la course ;
  - `B.echappement.pas` à chaque pas de simulation, après les traces ;
  - `B.echappement.dessiner` après les traces, à l'instant interpolé de l'image, en excluant sa voiture en vue
    cockpit ;
  - dans `majSon`, une écoute par voiture (`dedans`, `distance`, `angle`) dans des tableaux typés préparés, puis
    `son.echappement(S.ech.son, écoute)`.

Appliquer : `git apply docs/reprise/rapports/echappement-2026-11-18/integration.patch && python3 construire.py`.

## Preuves

### Vérifications Node

Toutes peuvent échouer. Sept mutations essayées sur une copie ont chacune fait échouer au moins une vérification :

- `Math.random` dans la hauteur du son ;
- scintillement compté en images ;
- tableau neuf à chaque dessin ;
- exclusion du cockpit retirée ;
- seuil des crépitements déplacé ;
- saut de deux rapports accepté ;
- flamme qui pâlit au-delà de 100 m.

Les deux dernières ont été essayées après le retrait du fondu au loin, avec un témoin intact qui passe.

`verifications/echappement.test.mjs`, 17 vérifications en 2 s environ :

| Vérification | Résultat |
|---|---|
| Embouchures | Prises sur les tubes de `voiture.js` (à 3 mm). |
| Repères | Euler, attitude et angles comme `voiture.js`. |
| Formes | Fermées, normales vers l'extérieur. |
| Placement | Placement de la langue sur une voiture tournée, cabrée et penchée. |
| Passage montant | Sur 200 graines : détonation 12 à 55 ms après, quatre langues lisibles ; second claquement entre 60 et 120 fois sur 200. |
| Passages sans flamme | Bas régime, au pas, vers la marche arrière, saut de deux rapports. |
| Rétrogradage pied levé | Entre 80 et 160 claquements sur 200 ; crépitements relancés à chaque fois. |
| Lever de pied | 11,3 crépitements en moyenne ; 12 à 40 % de bleus ; les deux bancs ; rien à 6 000 ni 8 000 tr/min, rien à 0,3 de gaz. |
| Rupteur | 16 à 26 ratés en 3 s lancé, 9 à 18 à l'arrêt ; un seul épisode par séjour, rebonds compris. |
| Voiture hors course et horloge reprise en arrière | Rien ne reste en attente. |
| 30, 60, 120 images/s et cadence variable | Sur une vraie course de 24 s, mêmes événements et mêmes flammes qu'à 240 images/s. |
| Hasard | `Math.random` jamais appelé ; course identique avec ou sans le module ; chaque voiture ne dépend que d'elle. |
| Mémoire | Mêmes objets d'une image à l'autre, aucune propriété ajoutée. |
| Coût, douze voitures en feu | Pas : 2,4 µs pour les 12 voitures. Dessin : 11,6 µs, 57,9 objets en moyenne, 94 au plus (borne 144). |
| Distance | Même flamme à 10 m, 45 m, 150 m et 1 km. |
| Cockpit | Sa voiture est exclue. |
| Vraie course de 60 s | 106 passages montants à 12 000 tr/min ou plus : les 106 claquent. 161 détonations, 1 496 crépitements, 341 ratés ; 12,6 objets par image en moyenne, 112 au plus. |

`verifications/son.test.mjs` : 20 vérifications, dont 6 nouvelles :

- tampons et voix préparés, une source par claquement ;
- budget de voix et vol de la plus faible ;
- proche ou lointain, angle, cockpit ;
- niveaux bornés, écarts gardés, pause, débordement ;
- repli sur l'ancien claquement ;
- synthèse déterministe.

Les temps en µs varient avec la charge de la machine.

Suite complète (`for t in verifications/*.test.mjs; do node "$t" …; done`) : les 67 fichiers passent sur l'état
commité (68 s) et aussi avec le branchement appliqué et la page construite (94 s).

### Captures dans la page construite

`rapports/echappement-2026-11-18/` : neuf captures en 1280 × 720 par `tools/page-essai.mjs` (Chrome sans tête).

- **Mise en scène.** Course de référence : circuit 0, graine 17017, départ à 40 m/s. La boucle est figée, puis
  avancée pas à pas jusqu'à l'événement choisi, puis jusqu'au plus fort de sa flamme.
- **Lever de pied.** La capture montre le premier crépitement franc sur un banc entier et orangé, la combinaison la
  plus fréquente (41 %). Le premier crépitement venu, un tube seul en bleu, était à peine visible de jour.
- **Mesures.** Appels et instances avec puis sans les flammes. Coût du dessin et du pas mesuré dans la page sur 4 000
  appels.
- **Hors mesure.** Le compteur « 60 FPS » affiché sur les images n'est pas une mesure : la boucle est figée.

| Capture | Voiture, événement, force | Objets | Appels de dessin, sans → avec | Instances d'effets, sans → avec | Dessin | Pas (12 voitures) |
|---|---|---|---|---|---|---|
| jour-passage | joueur, détonation, 0,88 | 34 | 332 → 339 | 77 → 111 | 11,5 µs | 1,6 µs |
| jour-gros-plan | joueur, détonation, 0,88 | 34 | 346 → 355 | 77 → 111 | 14,0 µs | 1,9 µs |
| jour-lever | joueur, crépitement, 0,54 | 7 | 280 → 283 | 40 → 47 | 2,2 µs | 0,5 µs |
| jour-rival | rival 3, détonation, 0,99 | 24 | 304 → 307 | 41 → 65 | 7,0 µs | 1,1 µs |
| jour-retro (cockpit) | rival 2 derrière, détonation, 0,88 | 18 | 464 → 474 | 76 → 94 | 8,0 µs | 1,2 µs |
| nuit-passage | joueur, détonation, 0,88 | 34 | 322 → 330 | 41 → 75 | 11,5 µs | 1,5 µs |
| nuit-lever | joueur, crépitement, 0,54 | 7 | 272 → 275 | 24 → 31 | 4,9 µs | 1,2 µs |
| nuit-rival | rival 3, détonation, 0,99 | 24 | 304 → 307 | 41 → 65 | 9,2 µs | 1,3 µs |
| legere-passage (Légère) | joueur, détonation, 0,88 | 34 | 126 → 134 | 41 → 75 | 6,3 µs | 0,9 µs |

Coût mesuré dans les captures :

- de 3 à 10 appels de dessin de plus, sur 130 à 470 ;
- de 7 à 34 instances d'effets de plus, sur environ 4 800 instances par image ;
- aucune erreur dans la console.

**Aucun gain ni aucune cadence annoncés** : rien n'a été mesuré en fenêtre réelle sur le Mac. La qualité Légère
garde les flammes, avec le même nombre d'objets.

## Limites et non fait

- **Pas d'éclat.** La passe des effets de FERRO mêle par transparence, sans mode additif ni halo. De jour, la
  flamme reste orangée mais ne brille pas comme une vraie. Un mode additif serait un changement du moteur
  (`M4D135/FERRO`) : proposé, non fait.
- **Matière de feu de FERRO écartée.** `fxFire` (matière 14) ignore la couleur, donc pas de bleu possible. Sa
  turbulence est trop grosse pour des flammes de 10 à 60 cm.
- **Pas de lumière.** Les flammes n'éclairent ni le sol ni la caisse : la passe des effets n'a pas de lumières
  dynamiques.
- **Rétroviseurs.**
  - Les flammes de sa propre voiture n'y sont pas, car la caisse n'y est pas non plus.
  - Une concurrente qui suit crache vers l'arrière, à l'opposé de nous : sa flamme est en grande partie cachée par sa
    propre caisse.
- **Vue poursuite.** Les flammes partent vers la caméra et paraissent raccourcies. Les crépitements de jour se voient
  à peine, comme en vrai ; ils s'entendent surtout.
- **Son** non écouté dans un navigateur ; niveaux à régler à l'oreille.
- **Autres sons.** Les autres événements de `son.js` créent toujours leurs nœuds à chaque fois : c'est la suite
  5B-7, non touchée.
- **Aucune mesure de cadence en fenêtre réelle.**

## Reproduire

```sh
node verifications/echappement.test.mjs
node verifications/son.test.mjs
git apply docs/reprise/rapports/echappement-2026-11-18/integration.patch
python3 construire.py
sh docs/reprise/rapports/echappement-2026-11-18/captures.sh   # environ 1 min
git checkout -- src/jeu.js construire.py dist VERSION.json SIZE.json
```

## Questions pour David

1. **Taille des flammes.** Langues de 30 à 75 cm au passage, jusqu'à 1 m environ lancées à plus de 190 km/h : faut-il
   plus grand, plus lisible mais moins vrai, ou plus petit ?
2. **Flammes de sa voiture dans les rétroviseurs ?** Aujourd'hui elles n'y sont pas, faute de caisse.
3. **Grille de départ.** Pendant le compte à rebours, les douze voitures tiennent le rupteur et crachent à 45 % des
   coupures, soit 19 à 33 flammes chacune avant le feu vert. Faut-il garder, réduire ou supprimer ces flammes à
   l'arrêt ?
4. **Mode additif dans FERRO**, pour des flammes qui brillent : faut-il l'ouvrir comme lot du moteur ?
5. **Réglage du son.** Les claquements passent par le bus moteur (curseur « moteur ») ; l'ancien claquement passait
   par celui des effets. Lequel garder ?
6. **Poids des captures.** 5,8 Mo de PNG dans le dépôt : faut-il les garder ainsi ?
