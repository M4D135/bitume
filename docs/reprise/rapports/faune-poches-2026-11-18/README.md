# Faune en poches — lot 10

## Comportement

Les habitats utilisent le champ commun `decor.ecologie`, préparé à partir de la graine
du circuit. L'herbe et les insectes à zéro laissent réellement une zone vide ; les
abeilles exigent aussi une floraison. Les centres sont répartis dans l'espace du monde,
avec décalages et omissions, sans bandes parallèles à la route ni paires gauche/droite.
Les surfaces et les orbites restent validées sur `surfaceHerbe` : chaussée, eau, tunnel,
bâtiments et rochers exclus. La végétation affichée peut être désactivée indépendamment.

Chaque foyer possède ses capacités propres, de zéro à huit individus par espèce.
Les réglages restent des plafonds : Léger, Moyen, Haut et Maximum ne remplissent plus
les zones pauvres pour atteindre un nombre identique partout. Les plafonds de jour
restent 2/5/12/32 abeilles et 0/3/8/16 autres insectes ; ceux de nuit sont 6/16/64/256
lucioles, exclusivement dans Haut-Col. Au plus 512 objets sont soumis par vue.

Les formes d'orbite, amplitudes, phases, hauteurs et vitesses diffèrent par foyer et
individu. Des oscillations continues modulent la vitesse de parcours, le battement
des ailes et les éclats des lucioles. Aucun bruit aléatoire temporel ne provoque de
saut. Les cœurs et halos gardent leur taille 3D bornée, sans lumière ponctuelle.
Le temps absolu et les pools par vue restent inchangés. Les passages entre foyers,
les changements de qualité et le crépuscule conservent leurs fondus.

L'API `B.faune.creer` / `dessiner` et `BUDGETS` reste compatible. Les requêtes
écologiques et les sondes au sol n'ont lieu qu'à la création. À l'arrêt, la sélection
spatiale est conservée ; un déplacement de 6 m la renouvelle. Les fondus de distance
sont évalués à chaque image : 22–38 m pour les insectes de jour, 55–90 m pour les
lucioles. La limite de préparation du monde est au-delà de ces distances.

## Hétérogénéité mesurée

Le banc compare la source exacte de faune 0.2.32 conservée dans `faune-032.js` et la
photographie du lot 10 `faune-lot10-mesuree.js`, avant son extension saisonnière,
sur **le même décor courant**, avec végétation affichée désactivée.
Il ne compare pas deux builds complets du jeu. Il échantillonne 64 poses espacées
sur chaque circuit, hors tunnel (60 poses dans Haut-Col), en Maximum et sans pluie.
Les SHA256 des modules et dépendances figurent dans `mesures.json`.

| Circuit / moment | Poses vides, 0.2.32 | Poses vides, lot 10 | Population médiane, lot 10 | Maximum observé, lot 10 |
|---|---:|---:|---:|---:|
| Forêt, jour | 0 / 64 | 37 / 64 (57,8 %) | 0 | 45 insectes |
| Côte, jour | 0 / 64 | 27 / 64 (42,2 %) | 3 | 48 insectes |
| Haut-Col, jour | 0 / 60 | 31 / 60 (51,7 %) | 0 | 46 insectes |
| Haut-Col, nuit | 0 / 60 | 12 / 60 (20,0 %) | 34 lucioles | 256 lucioles |

En 0.2.32, les poses de jour portaient toutes 48 insectes ; la nuit comptait
224–256 lucioles, médiane 256. Le coefficient de variation des populations de jour
passe de 0 à 1,33–1,99 ; celui de la nuit de 0,021 à 1,108. Les foyers très riches
existent toujours, mais alternent maintenant avec des poches modestes et du vide.

## Coût d'exécution Node

Après chauffe, 4 000 appels sont chronométrés par cas. Le trajet préparé à l'avance
correspond à 180 km/h, avec appels à 60 Hz sur 3 333 m ; le chronométrage couvre
seulement `faune.dessiner`. Les poses sont identiques entre les versions.

| Trajet Maximum | Objets moyens, .32 → lot 10 | Temps médian, .32 → lot 10 | p95, .32 → lot 10 |
|---|---:|---:|---:|
| Forêt, jour | 205,6 → 34,9 | 0,0116 → 0,0007 ms | 0,0340 → 0,0178 ms |
| Haut-Col, nuit | 479,6 → 136,0 | 0,0543 → 0,0109 ms | 0,1343 → 0,0666 ms |

Un foyer immobile rempli de 256 lucioles reste un cas plus coûteux : médiane
0,0693 ms et p95 0,1656 ms, contre 0,0532 / 0,1299 ms auparavant. Les mouvements
plus variés ajoutent des fonctions trigonométriques. Sur la charge synthétique
identique de 512 objets, médiane 0,0594 ms contre 0,0541 ms ; p95 0,1322 contre
0,1316 ms. Les clairières coûtent environ 0,0001 ms à l'arrêt. Les autres qualités
et tous les relevés figurent dans `mesures.json`.

Ces timings proviennent d'un environnement partagé. **Aucun GPU, rendu complet,
navigateur ni FPS matériel n'est mesuré.** Le nombre réduit d'objets soumis ne prouve
pas à lui seul une amélioration des FPS du jeu.

## Vérifications et reproduction

`node verifications/faune.test.mjs` : **14 contrôles réussis**, y compris absence
effective dans les clairières, lien aux fleurs, populations variées, continuité des
trajectoires et du fondu en quittant une poche, pooling sur 2 000 images, deux vues,
30/120 Hz, montagne seulement, budgets, tailles et exclusions des trois sols réels.
Résultat conservé dans `tests.log`.

```sh
node docs/reprise/rapports/faune-poches-2026-11-18/mesurer.mjs
```

Les deux modules figés accompagnent le banc uniquement comme références de comparaison ;
ils ne sont pas inclus dans les modules du jeu. L'extension saisonnière ultérieure
honore `decor.saison.faune` et `contexte.activite` : aucun habitat n'est même préparé
dans les zones enneigées ; l'hiver du Sud garde son activité réduite. Ses 15 contrôles
et les nouveaux effets sont consignés dans `../effets-saison-vitre-2026-11-18/`.
Aucune version, construction ou référence
Git n'a été changée par cette sous-tâche.
