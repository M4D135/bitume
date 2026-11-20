# Monaco 14A — revue des sources, 20 novembre 2026

Les sources consultées préparent l’examen de la chaussée. Aucun profil de course 2026 n’est
encore qualifié ; `readyForRuntime` reste faux et les mesures routières restent inconnues.

## Interprétation des sources

Le [descriptif IGN LiDAR HD](https://data.geopf.fr/annexes/ressources/documentation/DC_LiDAR_HD_1-0.pdf),
révision juillet 2026, distingue le sol naturel/artificiel (p. 16, §2.2.8.2) du tablier de pont.
Le sommet d’un tunnel peut être classé « Sol » (p. 18, §2.2.8.6). Le classement seul ne prouve
donc pas que le point appartient à la chaussée recherchée. `Origin` distingue acquisition et
source exogène (p. 22, §2.2.15). Les dates de dalle excluent les points virtuels et les points
sol issus d’autres campagnes (p. 44, §4.1.1) : elles ne deviennent pas des dates individuelles.

Exemplaire consulté : 6 108 976 octets ; SHA-256
`bd9cfabe7d3dd6267286c77ae06842a353c56788fb4b79be65f901ff3676c35c`.

Les [notes FIA V3](https://www.fia.com/system/files/decision-document/2026_monaco_grand_prix_-_race_directors_competition_notes_v3.pdf),
§30, page 8, signalent des revêtements et limites modifiés en 2026, sans fournir les cotes
manquantes. Les observations de 2021 ne certifient pas ces aménagements.

## Dalles réellement rattachées aux 415 points

Les liens proviennent des [métadonnées figées](sources/mesures-20261120/lidar-tiles.geojson),
croisées avec `mesures-terrain.json`. Les trois autres dalles de l’emprise globale sont exclues.

| Nuage COPC référencé | Points OSM | Période de dalle |
|---|---:|---|
| [1056_6303](https://data.geopf.fr/telechargement/download/LiDARHD-NUALID/NUALHD_1-0__LAZ_LAMB93_SP_2025-06-20/LHD_FXX_1056_6303_PTS_LAMB93_IGN69.copc.laz) | 140 | 13 mai 2021 |
| [1056_6304](https://data.geopf.fr/telechargement/download/LiDARHD-NUALID/NUALHD_1-0__LAZ_LAMB93_SP_2025-06-20/LHD_FXX_1056_6304_PTS_LAMB93_IGN69.copc.laz) | 275 | 13 mai–27 juin 2021 |

Les deux dalles indiquent Lambert-93 / IGN69, édition du 20 juin 2025 et classement
`IGN_AUTO_V5`. Le [catalogue IGN](https://www.data.gouv.fr/datasets/nuages-de-points-lidar-hd)
annonce la Licence Ouverte 2.0.

Le 20 novembre, `HEAD` sur 1056_6304 et les requêtes `GET`, `Range: bytes=0-4095`, sur
**chacune des deux URL** renvoient HTTP 403. Les métadonnées altimétriques répondent 200.
La cause du refus reste non établie : aucun nuage acquis, aucun contournement, aucune
conclusion d’indisponibilité générale.

## Emprises candidates et protocole

La [revue de chaussée](revue-chaussee.json) cible Mirabeau Bas, le petit passage avant Portier,
le tunnel Louis-II et les quais/Tabac. Les enveloppes de reconnaissance utilisent les indices
191–197, 204–219, 218–247 et 276–291, tous rattachés à 1056_6304. Ces emprises des points
OSM et de leur contexte ne mesurent ni les portails ni les limites routières.

1. Vérifier l’accès direct autorisé, la réponse 206/`Content-Range`, la signature LAS et les
   plafonds de transfert avant toute extraction COPC ; arrêter sur refus.
2. Convertir explicitement CRS84 vers Lambert-93, inspecter des coupes locales sans filtre
   d’altitude dérivé du MNT ; conserver classes, origine et niveaux superposés.
3. Enregistrer URL, date, empreinte, référentiels et incertitudes ; identifier indépendamment
   chaussée, portails et limites de course avant toute promotion d’une observation.

Les acquisitions closes restent intactes. Aucun lissage ni valeur de remplacement ne remplit
les altitudes, largeurs ou dévers manquants.
