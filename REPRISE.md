# BITUME — reprise courte

## Livré sur main : 0.2.66

La [PR #38](https://github.com/M4D135/bitume/pull/38) réunit démos, pilotes, météo,
multi-couverts et **Route-des-Cimes, neuvième circuit**. Physique **p15**, FERRO **0.3.15**.
Fusion vérifiée : `f3fb3eaa801494c4a2b0b9c0d22baf6eae2bd1a8`.
Arbre reçu identique au candidat ; fichier jouable et sources qualifiées conformes.

Tête des outils qualifiée : `40774189dc3a68242a3908f72e09f2676519ccbf`.
Arbre : `52c3b4be0c5ea159ffc90a05a60631d0a7956a02`. Les commits suivants ne portent que les documents.
HTML : **14 370 823 octets**, SHA-256
`18b15fd06d758cc5cb760a6ad90697a860d0b7a03b819c92a2891033e95adf3b`.

## Preuves acquises — conserver leur attribution

- **159/159 suites** sur la tête finale ; **3 405 sources**, contenus et modes conformes.
  Run `44747519912`. La première campagne 0.2.66 était déjà à 159/159.
- **113 images retenues inspectées**, références comprises : 48 démos, 41 météo, 24 couverts.
- Le scénario aérien invalide est corrigé uniquement dans l’outil : 10 tests ciblés,
  vrai PhysX, sujet hors tunnel, caméra au-dessus du relief, regard libre et visière vide.
  Ses **deux images refusées** restent conservées ; la reprise ciblée `44747519881` réussit.
- Les **quatre échecs de 0.2.65 (155/159)** restent dans leurs reçus, avec leurs corrections.
- Cimes : 12 voitures, un tour + 500 m chacune au sec/pluie/neige ; 80 256 sondes,
  zéro replacement. Géométrie et runtime inchangés par le correctif de capture.

Reçu principal : `docs/reprise/rapports/COUVERTS-CIMES-2026-11-20/PUBLICATION-0266.json`.
Fiche : `docs/reprise/COUVERTS-CIMES-INTEGRATION-2026-11-20.md`.
Journal détaillé : `docs/reprise/JOURNAL-AUTONOME-2026-11-20.md`, entrée **013**.

## Suite préparée et réserves

Pluie extérieure depuis un abri : prototype sauvegardé sur `backup/pluie-abris-20261120`,
commit `d3bd240a`, **non intégré et non qualifié** (CPU et compositing à reprendre).
Bandeaux de démo : aucun correctif préparé. Neige claire/grain discret et relief facetté restent ouverts.
La PR #37 possède ses propres reçus et des contrôles de sillage plus anciens : ne pas la fusionner aveuglément.
Inventaire : `docs/reprise/rapports/COUVERTS-CIMES-2026-11-20/APRES-0266-PREPARATIONS.json`.

Les sept lieux complets de Cimes, lac/cascade et **17 destinations** restent dans
`docs/reprise/FILE-TRAVAIL.json`. FPS matériels, manettes, audio et réseau restent à mesurer.
Réserves historiques : Val-Brûlé 188 ms et Haut-Col 154/167 ms pour 150 ; S8 facultatif
1 031 °/s² pour 300. Monaco : chaussée non qualifiée, `readyForRuntime=false`.
Lecture minimale suivante : ce fichier, `ETAT.json` → `etat_courant`, puis la seule fiche active.
