# R4 — posture dans l'implantation 126 CK

Préparation isolée du 21 novembre 2026, branche
`codex/bitume-126ck-posture-reprise-20261121`, commits `f0362dd` et `46cd166`.
La coque, le siège, les commandes et la caméra restent la responsabilité du
raccordement principal. Cette fiche ne déclare pas le jeu intégré conforme.

## Géométrie commune

Le thorax est maintenant construit directement dans le repère de la voiture :
bassin à `(0,680 ; 0,290 ; 0)`, centres des sections reculant jusqu'au cou à
`(0,486 ; 0,714 ; 0)`, soit un buste incliné d'environ 24°. Le raccord du cou
monte jusqu'à `y=0,744` pour rejoindre le dessous du casque, sans vide visible.
Les trois niveaux de détail conservent les mêmes sections et les mêmes bornes.

Les axes d'épaule sont à `(0,548 ; 0,670 ; ±0,170)`. Leur avance de 33 mm par
rapport au centre de la section du thorax est nécessaire pour que l'humérus
sorte de l'attache sans rentrer dans la poitrine. Le rayon des rotules reste
26 mm et la zone de raccord autorisée reste 35 mm.

La tête source reçoit une translation unique `(0,482 ; −0,024 ; 0)` : les yeux
neutres se placent vers `(0,560 ; 0,896 ; 0)` et le casque culmine vers 1,055 m.
Le pivot de regard est au cou. `OEIL` doit être raccordé à ces yeux par le lot
principal. Aucune transformation ne dépend de la caméra.

Les deux segments des bras mesurent désormais 27 et 29 cm. Les références
numériques des trois suites pilote et de l'outil de qualification ont été
actualisées ; leurs tolérances et les oracles de contact n'ont pas été relâchés.
Pendant la prise du levier, le coude droit s'écarte progressivement jusqu'à
`z=0,205` ; le détour enlève les pénétrations observées contre le thorax incliné.
Le geste Troll vise maintenant `(0,760 ; 0,930 ; ±0,240)`, avec les modulations
existantes du salut et du poing.

## Vérifications de préparation et limite

Les vérifications corporelles ci-dessous ont été exécutées avec les ancrages
du raccordement convenu appliqués **temporairement** dans le worktree de préparation :
volant `(1,10 ; 0,655 ; 0)`, rayon monde 0,126 m, planche `(1,25 ; 0,68 ; 0)`,
levier `(0,93 ; 0,55 ; 0,16)`. Ces quatre modifications temporaires ont été
retirées avant le commit pour ne pas remplacer les sections du propriétaire R3.

- `pilote-thorax.test.mjs` : les trois tests passent, y compris la manche
  volontairement enfouie et le thorax volontairement éloigné.
- Contrôle géométrique isolé du corps : 288 poses, soit 96 poses sur chacun des
  trois LOD ; zéro contact des membres avec le thorax ou la tête, zéro raccord
  d'épaule non conforme. Erreur maximale de longueur des os : `1,11e−16 m`.
  La matrice comporte trois braquages, huit phases de rapport, les trois gestes,
  les deux côtés et quatre intensités de geste.
- Balayage des seules articulations sur 1 920 états : portée maximale observée
  `0,540644 m`, pour une portée disponible de 0,56 m ; erreur maximale des os
  `1,67e−16 m`.
- Continuité dans la fenêtre extrême existante : déplacement maximal du coude
  `1,406 mm` pour un pas d'intensité de 0,001, puis `0,703 mm` au demi-pas ; le
  seuil de 2 mm reste inchangé et le test passe.

La vérification incluant **toute la coque** ne passe pas dans ce worktree,
qui conserve encore l'ancien capot et l'ancien saute-vent devant le nouveau
pilote. Les erreurs sont conservées, pas masquées. Refaire les contrôles de
surfaces sur le modèle R1/R2/R3/R4 effectivement réuni, en particulier dossier,
cuve, miroirs, avant-bras pendant le braquage et gestes des deux côtés, puis
inspecter les images du jeu. Le contrôle isolé du corps ne valide pas ces
raccordements ni la fidélité visuelle globale.
