# BITUME — reprise courte

## Base livrée : 0.2.66 sur main

[PR #38](https://github.com/M4D135/bitume/pull/38) fusionnée et vérifiée :
`f3fb3eaa801494c4a2b0b9c0d22baf6eae2bd1a8`. Neuf circuits, physique **p15**, FERRO **0.3.15**.
HTML : **14 370 823 octets**, SHA-256
`18b15fd06d758cc5cb760a6ad90697a860d0b7a03b819c92a2891033e95adf3b`.

## Consolidation publiée et vérifiée

Main reçu : `9f2246df61c6503ea8fa0f71a28813b15b17f51c`, arbre `4e9d600ebd8b5d60ae533941e87a21e16cc1e952`.
Les 50 références inventoriées sont réunies : 34 secondaires déjà contenues et
15 têtes historiques préservées par ascendance. Les dix patches se réappliquent
exactement ; leurs prototypes restent des préparations attribuées.
Inventaire : `docs/reprise/preparations/MANIFESTE.json`, lecture : son `README.md`.

La PR #37 est réconciliée : dix reçus conservés, contrôles compatibles repris,
ancien seuil de faible sillage rejeté. **8/8 tests**, **16/16 rapports**, **48/48 PNG**
contrôlés sans nouveau rendu. Le jeu et le build restent inchangés.

## Lot actif : publier les plans, puis qualifier l’écoulement

Deux fiches sont prêtes à publier avant les corrections :

- `docs/reprise/PILOTE-HABITACLE-COMMUN-2026-11-20.md` : habitacle métrique unique
  dans les deux vues, assise commune plus basse/enfoncée, dégagement bras/buste,
  contrôles H0–H2 et B0–B5 ; MotionBricks/CMU documentés.
- `docs/reprise/EAU-VITESSE-2026-11-20.md` : gravité à l’arrêt, puis écartement et
  évacuation par vitesse/flux d’air en cockpit et poursuite ; direction, trajectoire
  et sorties par les bords mesurées séparément du séchage.

**Prochaine action :** publier et vérifier ces fiches sur main, puis E0/E1 météo.
Le chantier habitacle reste ouvert à H0/B0 ; aucun défaut du pilote ni écoulement
correct ne sont déclarés corrigés par la publication de ces plans.

## Preuves et réserves à conserver

- Dernière campagne générale : **159/159**, 3 405 sources conformes, run `44747519912`, tête `40774189`.
- **113 images retenues inspectées**, dont 24 références ; deux images aériennes refusées conservées.
- Les quatre échecs de 0.2.65 restent dans leurs reçus. Leurs versions exactes font foi.
- Pluie sous abri : prototype sauvegardé, non intégré et non qualifié ; bandeaux, neige et relief restent ouverts.
- Cimes : neuf circuits livrés au total ; sept lieux complets/lac/cascade et programme des **17 destinations** restent dans `FILE-TRAVAIL.json`.
- FPS matériels, audio, manettes et réseau entre machines non qualifiés ; Monaco `readyForRuntime=false`.

Publication runtime : `docs/reprise/rapports/COUVERTS-CIMES-2026-11-20/PUBLICATION-0266.json`.
Journal : `docs/reprise/JOURNAL-AUTONOME-2026-11-20.md`, entrée **015**.
Lecture minimale : ce fichier, `ETAT.json` → `etat_courant`, puis la seule fiche active.
