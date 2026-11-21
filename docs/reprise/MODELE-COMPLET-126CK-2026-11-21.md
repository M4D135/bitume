# 126 CK — voiture complète, puis pilote

**Suivi élargi de cette session :** [feuille de route du 21 novembre](FEUILLE-DE-ROUTE-2026-11-21.md),
avec les poignets, six vues, compteurs du titre et nouveau trajet sommet du col de
Larche → Vinadio. [État de la préparation à reprendre](rapports/MODELE-126CK-2026-11-21/REPRISE-CHECKPOINT.md).

## Demande de David et ordre de travail

21 novembre 2026 : reconstruire fidèlement **la voiture complète**, particulièrement
l'habitacle, à partir du modèle RenderBlade et de photographies réelles sous tous les
angles, avec et sans pilote. Sauvegarder références et feuille de route sur GitHub
avant les modifications. Une seule voiture est construite ; les vues déplacent la
caméra. Le pilote est installé ensuite dans cette voiture et adapte sa posture.

Une occultation naturelle des instruments par le volant n'est pas un défaut de
géométrie. Ne plus déplacer ou déformer une pièce authentique pour satisfaire un
ancien contrôle de cadrage. Les pénétrations de surfaces, les commandes flottantes
et les différences de géométrie entre vues restent des défauts.

## Base conservée

- Poste .77 `f596ac4`, proposé dans PR 54 pour essai, sans approbation utilisateur
  de fidélité. La version .77 est publiée sur main par PR 54, commit `11e7e55`.
- Nez et entrées des pontons repris puis assemblés en .78 `0abc00c` : préparations
  conservées, pas une voiture complète validée.
- 41 images RenderBlade déjà publiées : [galerie et manifeste](../references/ferrari-126ck-renderblade-2026-11-21/README.md).
- [Photographies réelles complémentaires](../references/ferrari-126ck-reel-2026-11-21/README.md) :
  vues générales, arrière, cockpit, siège et pilote ; originaux, provenance et empreintes.
- [Walkaround photographique du châssis 052](https://www.asmonzaracing.com/photos-f1-70-and-80-walkaround-ferrari-126ck-052-1981.html).

La galerie RenderBlade fixe la configuration visuelle cible. Les photos précisent
les matériaux, assemblages et la posture, en identifiant leurs variantes plutôt
qu'en mélangeant des voitures différentes. La photo réelle du volant demandée par
David garde priorité sur le moyeu différent du rendu. Les valeurs de reconstruction
déduites d'images restent des proportions de modélisation, pas des cotes constructeur.

## Feuille de route de la refonte

| Lot | Travail concret | Preuve attendue |
|---|---|---|
| R0 — références | Réunir les originaux, les angles, la provenance, les variantes et le présent plan ; pousser avant le développement | Fichiers et empreintes reçus sur GitHub |
| R1 — coque | Reprendre nez, quille, épaules, pontons droits, entrées de radiateurs, fentes latérales, joints, jupes et prises secondaires | Dessus, profil, face et trois-quarts comparables aux références ; ouvertures réelles |
| R2 — arrière et ailes | Remplacer l'arrière 312 T5 : plateau métallique, renforts d'arceau, capot ajouré, mécanique apparente, échappements et supports ; profils des ailes et dérives | Arrière, vue plongeante, profil ; effets à la sortie des vrais tubes ; silhouette aux trois détails |
| R3 — habitacle vide | Une ouverture longue, doublure, siège et dossier striés, harnais, tableau, colonne, volant, levier, saute-vent et miroirs correctement fixés | Voiture sans pilote montrant les pièces assemblées ; aucune coque alternative selon la présence du pilote |
| R4 — pilote | Installer l'assise dans le siège, ajuster buste/épaules/casque et articulations aux commandes ; yeux attachés au visage | Même posture monde en extérieur/cockpit ; prise des mains, changements de rapport et gestes, sans pénétration |
| R5 — intégration | Construire le vrai jeu ; vérifier extérieur, cockpit, arrière, portrait, duo, braquages et Troll | HTML reproductible, images exactes, contrôles utiles ; publication du candidat puis main qualifié |

Les repères d'implantation sont communs. Les variantes de détail simplifient les
petites pièces sans remplacer l'ouverture, l'arceau, le plateau ou les volumes
principaux par une autre voiture. La vue sans pilote retire uniquement le corps,
les gants et les sangles portées : commandes, coque, siège et saute-vent restent.

## Intégration et critères

- Modélisation procédurale dans les modules du jeu ; aucun modèle ou fichier de
  texture du produit RenderBlade n'entre dans le runtime. Livrée et emblèmes originaux.
- Garder le train roulant, les montes, collisions et physique p15. Une évolution
  dimensionnelle physique se traite explicitement, pas sous couvert de ce lot visuel.
- Synchroniser les embouchures dans `echappement.js` avec la mécanique réellement
  dessinée ; conserver les effets de pluie, l'usure, les dégâts et le fantôme.
- Les 34 modules FERRO verrouillés restent inchangés. Préparer les maillages une
  fois, grouper par matière et conserver les objets permanents.
- Le FOV demandé reste 70° par défaut avec préférences sauvegardées conservées.
  Régler la caméra à partir des yeux ; ne pas déformer l'habitacle pour la projection.
- Références d'articulations déjà consignées : MotionBricks et CMU mocap GLB dans
  [le suivi pilote commun](PILOTE-HABITACLE-COMMUN-2026-11-20.md).
- Réviser seulement les assertions rendues obsolètes par une décision explicite,
  en documentant pourquoi ; conserver les contrôles d'identité entre vues, de
  pénétration, de mécanique, de données, et les témoins négatifs pertinents.
- Une capture Canvas2D vérifie les formes, pas les matières WebGL. Une CI verte ne
  signifie ni fidélité visuelle complète ni validation de l'utilisateur.

## Répartition de ce jalon

Coordination et coque/habitacle dans `codex/bitume-0280-implantation-126ck-20261121` ;
arrière/ailes préparés dans un arbre isolé puis raccordés séquentiellement.
Ne pas modifier les travaux décor, moteur, circuits ou les autres préparations.
Les sauvegardes GitHub sont autorisées. Aucun déploiement sur le site dans ce lot.

## État de la préparation au 21 novembre

R0 reçu sur GitHub au commit `20d7770b8eb76087cb134e842ef7b426c2437bbd` de la
branche : photographies réelles et feuille de route sauvegardées avant refonte.
R1–R3 et la posture R4 sont remaniés dans les sources : implantation du cockpit
avancée par rapport aux essieux, siège/cuve, pontons réellement ajourés, plateau,
arceau, capot ouvert, mécanique et ailes. Les commandes restent dans l’habitacle
vide ; l’absence du pilote ne sélectionne plus une autre coque.

La prise du volant en extérieur, les six caméras et les compteurs font l’objet
des lots supplémentaires. R5 reste ouvert : les images WebGL du candidat assemblé,
les contrôles transversaux et la reconstruction finale doivent encore être reçus.
Les images Canvas locales servent aux formes ; aucune fidélité complète n’est
annoncée approuvée. Les modèles .75/.76 restent refusés.
