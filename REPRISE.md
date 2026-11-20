# BITUME — reprise courte

## Lot actif — Monaco 14A, revue localisée

Fiche : `docs/reprise/MONACO-REVUE-2026-11-20.md`.
Les **32 écarts > 1 m** sont regroupés en **sept plages**, avec **17 alertes de pente terrain**.
Deux ensembles de tunnel OSM restent distincts ; **85,190 m non tagués** entre eux,
quatre portails candidats et aucun portail mesuré. Carte et profils :
`docs/references/monaco-2026/revue-chaussee.svg` ; détail dans le JSON voisin.

**8/8 nouveaux contrôles passent**, génération et `--check` concordent ; revue indépendante
et inspection du SVG terminées. **18 entrées historiques identiques**, aucun jeu ni build changé.
Le sous-lot est prêt pour publication/CI. Reçu :
`docs/references/monaco-2026/qualification-revue.json`.

## Livraison du jeu close — 0.2.61

**0.2.61 / p14 / FERRO 0.3.15**, PR #24 et clôture #25 fusionnées.
143/143 suites et 31 PNG qualifiés ; ne pas recommencer cette livraison.
Reçu : `docs/reprise/rapports/HAUT-COL-METEO-2026-11-20/PUBLICATION-0261.json`.

## Suite de Monaco et réserves

Les **415 points OSM / 830 observations de terrain** restent préparatoires : aucune chaussée
qualifiée, altitudes/largeurs/dévers inconnus, `readyForRuntime=false`. **14A demeure ouvert.**
Les deux nuages COPC référencés renvoient HTTP 403 aux requêtes bornées ; cause non établie.
Résoudre l’accès autorisé ou obtenir un relevé adapté, puis contrôler surfaces, portails et limites.
Les périodes de dalle ne deviennent pas des dates individuelles des cellules MNT.
Protocole : `docs/references/monaco-2026/REVUE-SOURCES-20261120.md`.
Ne pas refaire les acquisitions closes ni forcer les **3 323,610 m** pour combler **−13,390 m**.

**8 circuits jouables / 17 destinations prévues** ; programme complet, Marseille et montagne
distincte : `docs/reprise/CONTINUATION-AUTONOME-2026-11-19.md`.
Durées historiques : **188 ms Val-Brûlé, 154/167 ms Haut-Col**, seuil **150 ms** inchangé.
Lignes diagonales du terrain clair à diagnostiquer ; essais matériels/réseau et FPS restent ouverts.
Site non déployé ici ; Spark absent. Un sous-lot à la fois, reprise courte, aucun push forcé.
