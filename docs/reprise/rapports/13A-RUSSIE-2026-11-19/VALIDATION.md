# BITUME 0.2.53 — 13A Baïkal : tracé et relief

**Qualification CPU terminée avec deux réserves documentées. Publication finale en préparation.**
Base : `18451e0eeb701d720f08c069b841d79c2439755d`, 0.2.52/p13. Sources et tests qualifiés : checkpoint distant `3d173d16f8d75e4c77548b8caaf77314af3287f9` (même arbre que local `feacd351`).
Le reçu canonique est `qualification-finale.json`. Le passage global brut reste intégral dans `qualification-execution.json` et `qualification.log`.

## Circuit ajouté

Baïkal est un choix de conception issu du plan maître pour répondre à la demande de circuit russe. Ce tracé est original, sans reproduction d’une route réelle. Il est ajouté après les sept circuits historiques ; le nouveau grand circuit de montagne reste une demande distincte.

| Mesure | Résultat |
|---|---:|
| ID / indice / graine | `baikal` / 7 / 179 |
| Longueur du tour | 5 424 m |
| Dénivelé de piste | 62,9477 m |
| Pente maximale | 6,8 % |
| Ligne droite principale | 816 m |
| Rayon minimal | 37,1979 m |
| Largeur de chaussée | 12 m |
| Voie des stands | 30–240 m ; service entre 70 et 118 m |
| Solides actifs dans le banc | 1 134 |

Le relief comporte une rive basse, une progression en forêt, un promontoire et un retour descendant. Les raccords quintiques évitent les cassures de pente ; grille et stands restent plats. La carte `carte-relief.png` est une représentation des données exactes du jeu, pas une capture WebGL.

## Parcours et conservation de l’existant

**9/9 contrôles ciblés**, reproduits dans la qualification globale avec des mesures identiques. Douze voitures, dont onze vrais rivaux, effectuent trois tours sur sec, sous pluie et sous neige avec pneus adaptés, contacts et solides actifs. Le joueur est conduit par les commandes IA avec prudence initiale `hab=0.88`, pour laisser les rivaux terminer avant la fermeture normale de la course ; aucune pose ni règle de fin n’est modifiée.

| Condition | Arrivées après trois tours | Accidents | Replacements | Stagnation |
|---|---:|---:|---:|---:|
| Sec | 12/12 | 0 | 0 | 0 |
| Pluie | 12/12 | 0 | 0 | 0 |
| Neige | 12/12 | 0 | 0 | 0 |

Les contacts et frottements aux rails sont comptés, pas effacés. Le détail est dans `DIAGNOSTIC-NEIGE.md` : une allée de troncs proches, initialement dangereuse après un contact dans la descente enneigée, a été déplacée vers une droite peu pentue. La correction se limite au thème russe et conserve les collisions.

**84 tableaux numériques des sept pistes historiques restent identiques bit à bit.** Les identifiants, graines et ordre du catalogue sont conservés. Les **22 scénarios et 1 415 empreintes p13** sont reproduits sans régénérer les références ; les fixtures p9 à p13, les lois de conduite, l’usure, les stands et le réseau sont inchangés. Le test de stratégie des stands inclut désormais Baïkal ; les neuf cas de dégagement restent contrôlés.

## Suites complètes et réserves

**107/109 suites réussies au premier passage complet.** Deux échecs restent visibles :

- `traces.test.mjs` : signature obtenue/attendue strictement identique à la réserve héritée de la base.
- `decor.test.mjs` : seuil de construction de Val-Brûlé fixé à 150 ms, atteint lors du passage global. Contrôles séquentiels ultérieurs : base 0.2.52 à 205 ms, candidat 0.2.53 à 211 ms ; même test, seuil inchangé, fichiers stables. Le dépassement existe donc aussi sur la base dans cet environnement. Une mesure par version ne permet pas de conclure à une différence de performance.

Le qualificateur a rendu le code 1 et conservé ses échecs. `qualification-finale.json` ajoute la comparaison de la base et les deux réserves ; aucun échec n’a été supprimé, aucun seuil changé, aucune qualification entièrement verte annoncée.

## Build et preuves

- Deux builds strictement identiques, **14 063 125 octets**.
- SHA-256 : `686db2c0863bd8dfa042389f22501fb9bacde19dca2bb1dcabf9f9a527ccd510`.
- **53 scripts** embarqués valides ; **34 modules FERRO 0.3.11** inchangés.
- Physique **p13** conservée ; empreinte de compatibilité des sources embarquée et contrôlée.
- Empreintes de sources/tests/qualificateur identiques avant les tests et après les builds.
- Journaux complets sous `tests/`, commandes et empreintes dans les JSON associés. Les 20 fichiers de parcours sont conservés sans perte dans `parcours-physiques.tar.gz`, avec index et empreintes dans `PARCOURS.json`.
- Contrôles chronométriques : `controle-temps-decor/`. Diagnostics neige antérieurs : `diagnostic-neige/` et `banc-joueur-prudent/` ; ils ne remplacent pas le résultat corrigé.

## Suite

**13A est qualifié pour livraison ; 13B reste à réaliser** : lac, berges, lieux signature, végétation/faune propres au Baïkal et validation visuelle des saisons. Le thème de base actuel sert au roulage. WebGL, FPS matériels, parties réelles entre navigateurs et déploiement ne sont pas validés ici. Monaco fidèle, Marseille depuis EMPRISE avec relief, grand circuit montagne et six propositions sont conservés.
