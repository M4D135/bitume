# Haut-Col et météo réaliste — 20 novembre 2026

## Demande et périmètre

David signale un plan de bouquetins sans sol à Haut-Col et demande une pluie/neige beaucoup plus
réalistes, selon le plan de Claude et les trois captures de référence. Priorité sur Monaco 14A,
dont les acquisitions publiées restent closes et conservées. Base : main `a2d0bf5`, jeu 0.2.60.

## Référence retrouvée

`docs/reprise/rapports/etudes-2026-11-18/etudier-vitre.json` décrit le prototype `c5ae5ba` :
microgouttes, lentilles réfractant la scène, nappes et ruissellement, nuage d'eau des voitures,
neige collée, bourrelets de bord et buée. Les captures `pluie-03`, `pluie-04` et `pluie-07`
du dossier d'aperçus sont les références utilisateur. Le runtime 0.2.60 utilise seulement
une surimpression Canvas2D sans réfraction : son bilan précédent ne vaut pas conformité au prototype.

## Contrats à conserver

- Aucun geste d'essuyage ; la vitesse dégage la visière ; réglage « Gouttes sur l'écran » de 0 à 2.
- Vues extérieures atténuées, rétroviseurs dégagés, pause figée et états distincts en écran partagé.
- Terrain/caméras conformes aux triangles réellement dessinés ; animaux hors piste.
- Tout procédural, préchargé et borné par qualité. FERRO verrouillé et conduite p14 conservés.
- Pas de reprise de la campagne locale 0.2.60 ; contrôles du nouveau candidat et CI à son jalon.

## État

Le candidat **0.2.61** est construit. **15/15 suites ciblées passent**. Le shader exact compile et
rend sans erreur sous EGL Mesa llvmpipe ; cette preuve utilise un fond synthétique. Les captures
Chromium du jeu et la campagne CI sont requises avant fusion. Reçu provisoire :
`docs/reprise/rapports/HAUT-COL-METEO-2026-11-20/QUALIFICATION.json`.

Haut-Col : les animaux étaient posés sur le terrain, mais la caméra ne contrôlait que leur corps.
6 postes sur 16 masquaient les appuis derrière une crête. Le contrôle de cinq points du vrai terrain
sous les pattes ramène le défaut à 0/16 ; 240 rayons indépendants et la régression sur l’ancien code
le confirment. Le poste reste fixe, le plan cesse si les appuis se masquent. Aucun relief ni animal déplacé.

Météo : module optique WebGL2 hors FERRO, scène réfractée localement, microgouttes/nappes/ruissellement,
nuage d’eau spatial des rivaux, neige périphérique irrégulière et fonte. État séparé par vue, intensité
0..2, Légère sans copie de scène, repli Canvas2D si WebGL2 indisponible. Préparation sous le voile.
Les ressources sont bornées ; coût réel à vérifier sur matériel.

La CI visuelle compare cinq scènes avant/après et contrôle dix scènes candidates : pluie à l’arrêt,
sillage à 235 km/h, neige à 45 km/h, duo, pause, tunnel, Légère, sec, bouquetins été/hiver.
Les poses sont figées ; il s’agit du rendu réel avec des états de référence, pas d’une course complète.

Réserves historiques conservées : 188 ms Val-Brûlé, 154 et 167 ms Haut-Col, seuil 150 ms.
8 circuits jouables / 17 destinations prévues ; Monaco n'est pas jouable. Site non déployé ici.

## Première CI de la PR #24

La PR est publiée au commit `4355cea7ad43de50529d9052a479f900cd68ab73`.
Le run `44686881553` termine à **142/143** : seul le contrat historique de raccord météo
cherchait encore cinq arguments, alors que la voiture filmée constitue désormais le sixième.
Le contrôle exécute le raccord réel ; 106 contrôles passent et quatre mutations négatives échouent.

Les trois groupes du run visuel `44686881119` échouent : le scénario de course était installé
avant la fin du démarrage asynchrone, qui reprenait ensuite la main et lançait la démo.
Le même défaut touche la référence 0.2.60. Attendre la fin réelle du démarrage avant d'installer
les états de capture ; les assertions de course et la couverture restent requises.
Reçu conservé : `rapports/HAUT-COL-METEO-2026-11-20/CI-PR24-INITIAL.json`.
Le runtime et le build 0.2.61 restent inchangés par ces corrections de qualification.

## Deuxième CI et contrat Légère

Le run complet `44688763745` réussit **143/143 suites**. Archive vérifiée : **3 308 sources**,
contenus et modes identiques au candidat, HTML inchangé. Le run visuel `44688763784` produit
**31 PNG** sur 15 passages (dix candidats, cinq références). Pluie et vues réussissent ;
seul le cas Légère échoue sur une attente erronée du validateur.

Ce profil conserve volontairement les glaces peintes : `retroImages=false`, zéro rendu arrière.
Le contrôle exige maintenant leur absence, deux images en Fine solo et quatre en duo, ainsi que
le bon profil observé. 16/16 tests ciblés passent, avec mutations des glaces et du profil.
Les deux images de pause sont identiques octet par octet et les compteurs reprennent ensuite.
Les lignes diagonales sur les pentes claires sont visibles avant et après : réserve de rendu
terrain conservée pour FERRO, distincte de la correction caméra. Aucun runtime ni build modifié
par les correctifs de qualification. Reçu : `rapports/HAUT-COL-METEO-2026-11-20/CI-PR24-DEUXIEME.json`.
