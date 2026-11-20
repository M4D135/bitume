# BITUME — reprise courte

## Candidat 0.2.64 — démos, pilotes et météo

Les deux branches sont assemblées sur p15 ; build reproductible, FERRO 0.3.15 conforme.
Campagne locale : 150/152 puis deux reprises ciblées réussies ; dépassement initial Val-Brûlé 165 ms conservé.
Retour geste/rapport corrigé : 810 poses sans traversée ; boîte physique conservée.
Shader natif : 11/11. CI et captures intégrées à terminer avant fusion.
Fiche : `docs/reprise/DEMOS-PILOTES-METEO-2026-11-20.md`.
Route-des-Cimes et couverts sont préparés séparément ; aucune clôture globale du programme.

## Priorité du 20 novembre — modèles, objectifs et continuation

Les six références utilisateur sont archivées avec empreintes :
`docs/references/objectifs-utilisateur-2026-11-20/README.md`.
Modèle courant, objectifs et méthode : `docs/reprise/OBJECTIFS-EXECUTION-2026-11-20.md`.
File complète : `docs/reprise/FILE-TRAVAIL.json` ; journal : `docs/reprise/JOURNAL-AUTONOME-2026-11-20.md`.
Socle publié par PR #36 (`fb6384c`), deux branches de checkpoints sauvegardées.
Suite : intégrer et qualifier démos/pilotes/météo. Route-des-Cimes se prépare séparément. Commits fréquents, sorties
bornées et reprise par lot ; toutes les 17 destinations et les lots transversaux sont conservés.

## Livraison close — aspiration, projections et dégagement 0.2.62 / p15

**0.2.62 / p15 / FERRO 0.3.15** publiée sur `main`.
PR **#31** : `27bdf08de3a712e6658b71d428d2a7d1af3fece5`, **147/147 suites**.
Complément natif PR **#32** : `3fc9421eb87c9bfdc296673e48220c0667626058`, **148/148 suites**.
Les deux arbres de fusion sont identiques à leurs candidats qualifiés.
**41 PNG vérifiés**, cinq groupes réussis : 37 images visualisées et quatre références
faune identiques aux candidats inspectés. Archives de **3 337 puis 3 339 sources** conformes.
L’aspiration bénéficie au suiveur ; gain contrôlé à 235 km/h de **5,324 m et 6,694 km/h en 6 s**.
Le dégagement est prouvé dans le vrai PhysX : choc, recul puis reprise, sans replacement,
vitesse imposée ni réparation des pneus. L’ancien test attendait un choc qui n’avait plus lieu.
Fiche : `docs/reprise/ASPIRATION-SILLAGE-2026-11-20.md`.
Reçu : `docs/reprise/rapports/ASPIRATION-SILLAGE-2026-11-20/PUBLICATION-0262.json`.
Build **14 268 457 octets**, SHA-256
`439bea3969ab4651fbebb87d8403f5a54968917ca6bdecede40e7d9140403297`.

## Prochain lot prioritaire — travail démo, sols et pilotes déjà préparé

Réconcilier ce travail avec `main` p15 : caméras/sols Haut-Col, ancrage du volant,
pilote expressif et gestes, gouttes plus dynamiques et plus denses. Les dépôts à 300 km/h
sont renforcés en cockpit mais restent discrets en poursuite sur les captures actuelles.
Préserver les branches de travail et les preuves closes ; ne pas relancer la qualification 0.2.62.
La suite Monaco 14A et tout le programme restent conservés ci-dessous.

Rappel des branches et lots restants réconcilié le 20 novembre :
`docs/reprise/BRANCHES-ET-LOTS-2026-11-20.md`. Baïkal est le huitième circuit ; Route-des-Cimes
reste à intégrer. Reprendre les essais historiques depuis p15 ; aucune IP à fournir pour préparer
le lot réseau. Les améliorations graphiques partielles ne clôturent pas les grands lots.

## Sous-lot livré — Monaco 14A, carte et provenance temporelle

PR **#29** fusionnée : `d0dbd8544be30ab44aaff399ae55761150074636` ; CI **145/145 suites**.
Archive de **3 327 sources** vérifiée, contenus et modes exacts ; arbre de fusion identique au candidat.
Fiche : `docs/reprise/MONACO-CARTE-REVUE-2026-11-20.md`.
Carte et profils : `docs/references/monaco-2026/revue-chaussee.svg` ; **32 écarts**, sept groupes,
17 arêtes de pente terrain, deux ensembles de tunnel et quatre extrémités candidates non mesurées.
Les périodes des dalles IGN sont distinguées des dates individuelles inconnues des cellules MNT.
**8/8 nouveaux contrôles**, sources et géométrie reconstituées avant revue ; jeu et HTML conservés.
Reçu : `docs/references/monaco-2026/qualification-revue-cartographie.json`.
Les apports des PR #26 et #28 sont conservés ; la PR #27 redondante est fermée, sa branche préservée.
Suite : acquisition routière BD TOPO ciblée, niveaux et ruptures, datums/dates et limites de course.

## Sous-lot livré — Monaco 14A, revue des mesures

Fiche : `docs/reprise/MONACO-REVUE-2026-11-20.md`. **35/35 contrôles ciblés réussis**.
Revue exhaustive : **32 écarts >1 m** en sept groupes, **33 points tunnel**, deux tronçons
et quatre transitions OSM. Avec les 17 alertes de pente, **49 points distincts** sont détaillés.
Les 12 écarts hors tunnel se situent près de Mirabeau Bas et Tabac. Reçu :
`docs/references/monaco-2026/qualification-revue.json`. PR **#26** fusionnée : `ed32c88e0878e57cd5e64476360047d2354f4816`. CI **144/144 suites** ; arbre de fusion identique au candidat.
Une sonde publique IGN BD TOPO conserve **7 objets**, dont la voie 3D BD LOUIS II et une
autre voie souterraine. Source candidate : `docs/references/monaco-2026/PISTE-BDTOPO.md`.
Suite : acquisition ciblée, identification du bon niveau, datum, date et limites de course.
Les observations de chaussée qualifiées restent à zéro ; version et build du jeu conservés.

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
La revue des **32 écarts > 1 m** et des **33 points tagués tunnel** est faite ; qualifier
chaussée, limites de course, largeurs, dévers et portails avec dates, provenance et incertitudes.
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
Site non déployé ici ; scripts Spark présents, accès au lanceur de David non établi. Un sous-lot à la fois, reprise courte, aucun push forcé.
Historique 0.2.60 : `docs/reprise/rapports/REALISME-2026-11-19/PUBLICATION-0260.json`.
