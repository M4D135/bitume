# Capture des gestes de l’équipe de stand

La marche et la descente en position accroupie sont issues de la base de capture optique du CMU Graphics Lab. CodePawl a converti les squelettes en GLB à 60 images par seconde et en mètres. BITUME utilise les articulations des acteurs sur ces squelettes. La position des outils et les contacts avec la voiture dépendent du stand de jeu. [Base CMU](https://mocap.cs.cmu.edu/) · [Fiche CodePawl, révision utilisée](https://huggingface.co/datasets/codepawl/cmu-mocap-glb/blob/acfbd6e18d3f928a83767fa677de1b390f52291d/README.md)

## Origine et droits

CMU autorise l’adaptation des mouvements et leur inclusion dans un jeu commercial. La vente des données de capture comme produit autonome, y compris après conversion, est exclue. Les squelettes de CodePawl conservent les conditions CMU. Le jeu distribue les angles et les appuis des deux extraits utilisés. [Conditions de CMU](https://mocap.cs.cmu.edu/) · [FAQ de redistribution](https://mocap.cs.cmu.edu/faqs.php)

> The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.

| Mouvement | Trames source incluses, origine zéro | SHA-256 du GLB de squelette |
|---|---|---|
| [Marche 07_01](https://huggingface.co/datasets/codepawl/cmu-mocap-glb/blob/acfbd6e18d3f928a83767fa677de1b390f52291d/skeleton/07_01-walk/07_01-walk_skeleton.glb) | 35 à 100, pas de 1 | `4893dbc7ef5fc1efb7912e62b27d22dabd3dacbf4bdb11c0c209e3fdc65fd4fa` |
| [Accroupissement 22_14, acteur A](https://huggingface.co/datasets/codepawl/cmu-mocap-glb/blob/acfbd6e18d3f928a83767fa677de1b390f52291d/skeleton/22_14-alternating-squats-2-subjects-subject-a/22_14-alternating-squats-2-subjects-subject-a_skeleton.glb) | 42 à 90, pas de 2 | `919ea2eb2328db09cea2389eab490d263506f70631a1901e81571247dcace4ea` |

## Reproduction et catalogue

Depuis la racine du dépôt, ces commandes utilisent Python 3 et sa bibliothèque standard. Le premier accès télécharge le catalogue ou le clip demandé depuis la révision épinglée. Les accès suivants lisent les fichiers du dossier local. La génération du jeu vérifie les empreintes des deux sources.

```sh
python3 tools/preparer-mouvements-stand.py --catalogue --dossier /tmp/bitume-mocap
python3 tools/preparer-mouvements-stand.py --catalogue squat --dossier /tmp/bitume-mocap
python3 tools/preparer-mouvements-stand.py --clip 07_01-walk --debut 35 --fin 100 --boucle --dossier /tmp/bitume-mocap --sortie /tmp/marche.json
python3 tools/preparer-mouvements-stand.py --jeu --dossier /tmp/bitume-mocap --sortie src/mouvements-stand-data.js
```

Le catalogue de cette révision contient 2 426 clips. `--clip` accepte leur identifiant complet. L’extraction compose les rotations des articulations de la capture pour retrouver leurs positions dans l’espace. Les angles des hanches et des épaules sont projetés dans le plan sagittal du bassin, les flexions des genoux et des coudes proviennent de l’angle entre les segments. Pour un geste fortement tournant ou étendu sur le côté, cette réduction à huit angles perd la composante latérale. [Catalogue source](https://huggingface.co/datasets/codepawl/cmu-mocap-glb/blob/acfbd6e18d3f928a83767fa677de1b390f52291d/metadata.jsonl)

Le cycle de marche couvre 1,48838 m en 1,083334 s, entre deux appuis du pied gauche. L’extracteur estime le poids des appuis à partir de la vitesse horizontale du pied et de la pointe, et de la hauteur de la pointe au-dessus du sol. Il raccorde les extrémités de la marche sur trois trames de chaque côté. Le second extrait descend en 0,8 s et peut se lire dans les deux sens. Les rotations sont stockées au milliradian et interpolées à la lecture. Le navigateur embarque les échantillons dérivés avec le jeu.

## Autres approches examinées

**NVIDIA MotionBricks** génère des mouvements à partir de commandes et de contraintes. Ses logiciels, modèles et mouvements d’exemple ont des conditions distinctes. Les exemples sont fournis pour l’évaluation de logiciels NVIDIA. BITUME utilise les gestes CMU indiqués ci-dessus et ne distribue aucun modèle ni mouvement MotionBricks. [Dépôt et licences au commit étudié](https://github.com/NVlabs/motionbricks/tree/54fc563aeaaf819a753d72cc9fdc6713989cdd43#license)

**3rd Person Physics Sandbox** calcule les orientations dans l’espace, puis les reporte sur un squelette cible en compensant les poses de référence. Ce procédé éclaire la séparation entre la capture du mouvement et la tenue d’un objet. BITUME conserve son propre squelette articulé et calcule les angles des membres hors ligne. [Implémentation du transfert](https://github.com/josh-english-2k18/3rd-person-physics-sandbox/blob/0691879bad6a126f53e33aba67c334123e8b7ae5/src/character/retarget.ts) · [Dépôt et licence MIT](https://github.com/josh-english-2k18/3rd-person-physics-sandbox/tree/0691879bad6a126f53e33aba67c334123e8b7ae5)
