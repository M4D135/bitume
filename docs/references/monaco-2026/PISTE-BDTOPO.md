# Monaco — piste de mesure routière BD TOPO

## Sonde publique reçue le 20 novembre 2026

Une requête WFS IGN bornée autour du boulevard Louis-II a renvoyé **7 objets sur 7**,
soit **6 210 octets**. La réponse brute est conservée dans
`sources/bdtopo-20261120/sonde-louis-ii.geojson` ; l'URL exacte, l'heure, les paramètres,
les droits et le SHA-256 figurent dans [`bdtopo-sonde.json`](bdtopo-sonde.json).
Les objets complets peuvent dépasser l'emprise de sélection. Ce n'est pas un relevé complet du circuit.

| Champ reçu pour `TRONROUT0000000074274447` | Valeur |
|---|---|
| Nom / nature | BD LOUIS II / Route à 1 chaussée |
| Position par rapport au sol | −1 |
| Géométrie | Ligne 3D, 28 sommets |
| Précisions déclarées Z / XY | 1,5 m / 2,5 m |
| Méthode altimétrique | BDTopo |
| Modification de l'objet | 9 août 2018 ; ce n'est pas la date de mesure |
| Apparition / confirmation | Inconnues |
| Datum vertical dans la réponse | Non explicité |
| Largeur indicative reçue | 4 m ; non utilisée comme largeur de piste |

Un second objet souterrain, `TRONROUT0000000074274448`, coupe la même emprise.
Il faut donc identifier le bon ouvrage avant d'associer une altitude aux points OSM.
Les extrémités de la ligne routière ne sont pas déclarées portails du circuit.

## Sens des données et décision

Le [descriptif officiel BD TOPO 3.5, juillet 2026](https://data.geopf.fr/annexes/ressources/documentation/DC_BDTOPO_3-5.pdf)
décrit les tunnels de la classe Construction linéaire comme liés à la géométrie et au niveau
de leur voie. Cette règle de classe ne prouve pas que l'objet routier reçu délimite un tunnel.
La largeur de chaussée est indicative et peut provenir du nombre de voies ; elle ne définit
pas les barrières FIA. La [page IGN sur les données ouvertes](https://www.ign.fr/institut/des-donnees-et-logiciels-ouverts-au-service-de-la-nation)
documente la diffusion de BD TOPO sous Licence Ouverte 2.0.

**Piste retenue pour une acquisition ciblée**, sans importer de profil dans le jeu :
figer les objets des secteurs prioritaires de [`revue-mesures.md`](revue-mesures.md),
confronter leur niveau et leurs écarts horizontaux, établir le datum vertical et la date
de mesure ou son absence explicite. Les limites de course, dévers et portails demandent
des références supplémentaires. Les 415 valeurs de chaque champ routier restent `null`.

Source : IGN, BD TOPO, flux acquis le 20 novembre 2026. L'échantillon conserve ses données
et ses inconnues ; il n'est pas présenté comme une mesure certifiée de la piste en 2026.
