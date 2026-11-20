# 06 — Qualification de la pluie depuis les abris

Source météo qualifié localement :
`e96267b45927e002fcfdfed096866012de9b042054cb948a26fe357b22434504` (SHA-256).
Base publiée `7a8a53e` ; prototype sauvegardé `d3bd240` ; PR #43.
Le raccord `06-jeu.patch` est appliqué en copie temporaire seulement.

## Défaut corrigé et provenance

Le prototype rend la pluie extérieure depuis les ouvertures avec les vrais
raycasts PhysX, mais sa boîte de rejet ne couvre pas toute la façade d'un
portail. Un scénario oblique à 300 km/h, FOV 105°, montre un trait dessiné
sur la façade : **16 sondes en défaut**. Le rapport original est conservé
dans `traits-prototype.json`, sans modification de ses échecs.

Le candidat inclut les façades dans des enveloppes distinctes, dérivées des
dimensions effectives de `decor.js`. Ces boîtes ne décident jamais de
l'occultation : elles évitent seulement les appels inutiles à PhysX. Leur
rejet porte sur le faisceau entier, pas seulement ses deux rayons de bord.
La queue et le milieu sont ramenés, en perspective, au trait réellement
affiché après limitation de sa longueur en pixels. L'abri logique n'est
recherché que pour les points proches du corps des ouvrages.

## Contrôles locaux

- `physx-module.json` : 7 groupes avec vrai PhysX, fond de tunnel/mur sec,
  ouvertures mouillées, linteau réel, pause, J1/J2 indépendants, palier low,
  visière abritée et séchage. Les 126 943 rayons sont le cumul de campagne.
- `traits-candidat.json` : 11 scénarios et une assertion globale,
  **481 867 sondes du centre des traits, zéro traversée**. Pas de 0,5 pixel
  au maximum, vraie profondeur et vraies parois/voûtes/portails/piliers.
- Le validateur de captures possède 8 tests, dont des défauts injectés.
- Régressions : météo 106, toile 25, visière/météo 19, flux de visière 13.
  Leurs journaux sont conservés ici. Le source des gouttes de visière est
  inchangé et les preuves d'eau 0.2.68 restent conservées.

L'oracle des traits ne certifie pas les franges antialias ni tous les
rochers de décor. La validation raster séparée reste nécessaire.

## Coût CPU, pas FPS du jeu

`mesures-cpu-final.json` compare parent, prototype et candidat sur les mêmes
scènes et séquences, avec chauffe et ordre alterné. Le Canvas est instrumenté,
sans raster ; le vrai WASM PhysX est utilisé. Aucun gain général annoncé :
le nouveau masque protège davantage de géométrie que le prototype.

| Scène du candidat | p50 CPU | p95 CPU | Rayons max/image |
|---|---:|---:|---:|
| Fond de tunnel | 0,775 ms | 1,055 ms | 158 |
| Portail | 1,630 ms | 1,903 ms | 546 |
| Galerie ouverte | 1,564 ms | 1,839 ms | 555 |
| Galerie Légère | 0,735 ms | 0,845 ms | 271 |
| Flou à 300 km/h | 1,541 ms | 1,894 ms | 572 |

Maximum de cinq rayons par trait projeté près d'un ouvrage ; zéro rayon
loin des couverts et au sec. Hors ouvrages, le dessin reste identique au
parent. Les plafonds de 420/630/840 candidats et 2 Mpx sont conservés.
Ces temps ne mesurent ni le GPU, ni Xbox/Intel, ni les allocations.

## Raster et transmission

Chromium local refuse `socket()` ; aucune image locale n'est annoncée validée.
Le workflow `qualification-pluie-abris.yml` construit deux fois la copie
raccordée du commit exact puis capture huit scènes. Il conserve l'image,
le raster pluie et le témoin où seule cette toile est cachée, sans avancer
la frame. Les pixels réellement composés sont contrôlés.

Réception CI à compléter avant de transmettre le lot qualifié à 00.
Ce lot ne livre ni version commune, ni `dist/bitume.html`, ni fusion main.
