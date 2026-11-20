# Eau 0.2.68 — tunnels, galerie et portails

**24/24 PNG inspectés en pleine résolution et six rapports conformes.** [Campagne CI](https://github.com/M4D135/bitume/actions/runs/44761148534) réussie après reprise du seul job dont Chromium n'avait pas démarré.

Les artefacts portent le commit de fusion testé `4343db0e`, l'arbre `b84d8553` et le HTML SHA256 `60184ddf5226543ca3f912cc9415927989f14e4e20de3556767ced801e988aa2` (14383155 octets). Ils correspondent au candidat PR39 `3daefb7c`. Les empreintes des archives, rapports et 24 PNG figurent dans le reçu JSON voisin.

| Scène | PNG | Revue |
|---|---:|---|
| Haut-Col, entrée/centre/sortie | 5 | Tunnel et lampes lisibles, adaptation de lumière, eau résiduelle puis reprise dehors. |
| Cimes, tunnel du Rocher | 5 | Même contrôle après reprise du démarrage ; aucun défaut bloquant. |
| Cimes, tunnel des Échelles | 5 | Piste, rival, deux miroirs et portails lisibles. |
| Cimes, galerie ouverte | 5 | Ouvertures latérales et exposition de jour conservées ; eau diminuant sous couverture. |
| Cimes, survol du toit | 2 | Caméra au-dessus de la surface réelle, regard libre et aucune goutte de lentille. |
| Duo, tunnel/galerie | 2 | J1 tunnel adapté, J2 galerie claire, quatre miroirs et surfaces indépendantes. |

Les cinq étapes des quatre portails montrent une diminution de l'eau sous couverture et son retour en extérieur. Dans le Rocher, les valeurs sont 0,7767 → 0,1917 → 0,0470 → 0,0115 → 0,7872. Les contrôles comprennent les vrais appuis/voûtes PhysX, les contextes de caméra, les états de visière et l'absence d'erreur WebGL.

## Échec initial conservé

Le job `136373698503` a produit zéro image : port DevTools absent avant le chargement du jeu. L'artefact `14641565877` et son empreinte restent attribués à cette tentative. Seul ce job a été repris après la fin de la campagne ; le job `136389895636` réussit sur le même code et livre les cinq PNG de l'artefact `14646073492`. Les 19 autres PNG n'ont pas été recalculés.

Ces poses sont des inspections séparées, pas un essai de conduite. Le raster logiciel ne qualifie pas des FPS matériels. La pluie extérieure vue depuis un abri conserve sa préparation distincte ; ce reçu ne la déclare pas corrigée.
