# BITUME — reprise courte

## Livraison close — Haut-Col et météo 0.2.61

**0.2.61 / p14 / FERRO 0.3.15** publiée ; conduite et moteur conservés.
PR **#24**, fusion `934132724de6eb368122868ce63feb341b7f9c73` ; arbre identique au candidat qualifié.
Fiche : `docs/reprise/HAUT-COL-METEO-2026-11-20.md`.
Reçu : `docs/reprise/rapports/HAUT-COL-METEO-2026-11-20/PUBLICATION-0261.json`.
CI `44690920229` : **143/143**, archive de **3 309 sources** vérifiée.
Visuel `44690920192` : **31 PNG**, dix scènes candidates et cinq références vérifiées et inspectées.
La première tentative pluie a atteint 35 min ; ses huit PNG et le timeout restent consignés.
La relance complète aussi le tunnel. Les correctifs de qualification conservent le jeu et le build.
Haut-Col contrôle les appuis sous les sabots ; réfraction, gouttes, ruissellement, embruns et neige
humide sont intégrés, avec états J1/J2 et pause distincts. Coût sur matériel toujours à qualifier.
Build : **14 265 416 octets**, SHA-256
`c53c92d83b3c911817c85a1ddaae97284b7085fb70455b95e98edaf98c6ccf6d`.

## Suite — Monaco 14A

Les acquisitions sont publiées : boucle OSM **415 points**, **830 observations de terrain**.
Reçu : `docs/references/monaco-2026/PUBLICATION-MESURES-20261120.json`.
Examiner les **32 écarts > 1 m** et les **33 points tagués tunnel** ; qualifier chaussée,
limites de course, largeurs, dévers et portails avec dates, provenance et incertitudes.
Les altitudes de chaussée, largeurs et dévers restent inconnus : **Monaco non jouable**,
`readyForRuntime=false`. Ne pas refaire les acquisitions closes ni assimiler MNT et chaussée.
Conserver la longueur **3 323,610 m** et l’écart FIA **−13,390 m**, sans mise à l’échelle.
Plan : `docs/reprise/12-PLAN-MAITRE-RUSSIE-MONACO-PNEUS.md`. **14A demeure ouvert.**

## Programme et réserves conservés

**8 circuits jouables / 17 destinations prévues**. Montagne distincte de Haut-Col, Marseille
avec relief, six propositions et lots transversaux : `docs/reprise/CONTINUATION-AUTONOME-2026-11-19.md`.
Durées historiques : **188 ms Val-Brûlé, 154/167 ms Haut-Col**, seuil inchangé **150 ms**.
Les lignes diagonales du terrain clair sont héritées et restent à diagnostiquer dans le lot rendu.
Captures à poses figées sous SwiftShader : ni course complète ni mesure FPS sur matériel.
Manettes physiques, réseau entre machines, FPS matériels et site restent non qualifiés.
Site non déployé ici ; Spark absent. Un sous-lot à la fois, reprise courte, aucun push forcé.
Historique 0.2.60 : `docs/reprise/rapports/REALISME-2026-11-19/PUBLICATION-0260.json`.
