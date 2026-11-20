# Eau 0.2.68 — portraits et deux caméras

[Campagne CI réussie](https://github.com/M4D135/bitume/actions/runs/44762219230), tête `073b70dd`. HTML identique au candidat PR #39 : `60184ddf5226543ca3f912cc9415927989f14e4e20de3556767ced801e988aa2`, 14383155 octets.

| Scène | Format | Images inspectées | Résultat |
|---|---|---:|---|
| Sillage seul, cockpit, 300 km/h | 540 × 960 | 3 | Pluie ambiante nulle, projections du rival présentes, deux rétroviseurs, route et HUD lisibles. |
| Sillage seul, poursuite, 300 km/h | 540 × 960 | 3 | Eau réfractive visible, rival et piste lisibles, optique raccordée à la caméra de poursuite. |
| Duo, cockpit J1 et poursuite J2 | 960 × 540 | 3 | Deux surfaces humides distinctes, flux associés à leurs caméras, miroirs du cockpit uniquement. |

Les neuf PNG ont été inspectés en pleine résolution. Les trois rapports réanalysés passent le vérificateur courant sans erreur WebGL, perte de contexte ou image manquante. Les archives, rapports et PNG sont identifiés dans le reçu JSON voisin. Les 13 tests ciblés du dispositif comprennent les témoins négatifs de mauvais format, caméra, qualité et miroirs.

Les scènes sont figées et rendues par SwiftShader. Ce contrôle prouve leur composition et leur intégration ; les trajectoires indépendantes proviennent du reçu natif distinct. Il ne mesure ni la conduite ni les FPS matériels. Le duo exerce 162 km/h en J1 et 45 km/h en J2. L'habitacle/pilote reste le lot suivant.
