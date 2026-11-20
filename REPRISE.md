# BITUME — reprise courte

## Lot actif : fermer la qualification puis publier le jeu assemblé

Base vérifiée sur `main` : **0.2.62 / p15 / FERRO 0.3.15**, huit circuits.
La **0.2.64** est en PR **#37**, tête `80aa1e2` ; sa qualification intégrée a trouvé des défauts.
Elle reste en brouillon. Ne pas la présenter comme une livraison close ni relancer ses suites déjà exploitées.

Le checkpoint **`9cc701a`** est publié sur `feat/bitume-couverts-final-20261120-ec92` :
raccords des six portails, poing réellement replié, sillage visible en poursuite et captures renforcées.
Le nouveau candidat **0.2.65** est construit deux fois à l’identique. Allocation corrigée :
**1,0612 octet/pose**, zéro GC mineur sur 60 000 poses ; 216 poses avant/après strictement identiques.
Publier ce candidat, terminer sa CI et inspecter ses images avant fusion sur `main`.
Fiche active : `docs/reprise/COUVERTS-CIMES-INTEGRATION-2026-11-20.md`.

## Preuves et défauts à respecter

- CI 0.2.64 : **151/152 suites** ; budget d'allocation du pilote extérieur dépassé, **17,2228 octets/pose**, seuil **4** inchangé.
- Images 0.2.64 : poing trop ouvert et sillage insuffisant en poursuite ; corrections sources présentes, nouvelles images requises.
- L'échec aérien provenait de champs de diagnostic absents ; contrôle raccordé à la vraie API, images aériennes sans dépôt.
- Cimes : **12 voitures**, un tour + 500 m chacune, sec/pluie/neige, **80 256 sondes**, zéro replacement et zéro pose/vitesse imposée.
- Six portails : **882 rayons** ; joints courbes **6 864 rayons** ; tunnel historique conservé. L'affinage rejeté est documenté.
- Captures couverts : six groupes, **24 PNG prévus**, neuf contrôles d'outil. Inspecter entrées/sorties, jour sous galerie, eau et rétros.
- Recevabilité du nouveau candidat : build reproductible, CI complète, images inspectées et empreintes exactes avant fusion.

## Suite conservée

Les neuf circuits sont dans les sources ; huit sont livrés. Route-des-Cimes reste à qualifier en images.
Ne pas clôturer ses sept lieux complets, lac/cascade, ni les grands lots de lumière et photoréalisme.
Programme **17 destinations**, conduite, réseau et calcul : `docs/reprise/FILE-TRAVAIL.json`.
Objectifs et références : `docs/reprise/OBJECTIFS-EXECUTION-2026-11-20.md`.
Journal : `docs/reprise/JOURNAL-AUTONOME-2026-11-20.md`.

## Réserves permanentes

FPS matériels, manettes physiques, écoute, réseau entre machines et déploiement du site non qualifiés ici.
Durées historiques 188 ms Val-Brûlé et 154/167 ms Haut-Col, cible 150 ms ; S8 facultatif 1 031 °/s² pour 300.
Monaco : sources acquises conservées, chaussée/largeurs/dévers non qualifiés, `readyForRuntime=false`.
Historique et reçus des lots clos : `docs/reprise/archives/REPRISE-AVANT-0265-2026-11-20.md`.
