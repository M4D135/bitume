# BITUME — reprise courte

## Lot prêt à publier — réalisme 0.2.60, 19 novembre 2026

**0.2.60 / p14 / FERRO 0.3.15**, sources et build réunis. Base distante vérifiée : 0.2.59,
main `f350dd7` après clôture PR #19. Les livraisons 0.2.57 et 0.2.59 restent closes.
Lire `docs/reprise/ETAT.json`, puis `docs/reprise/REALISME-2026-11-19.md`.

Bras communs aux vues et coudes bas, pneus sans barres blanches, matières du cockpit,
gouttes/neige, bâtiments détaillés et garages sont intégrés. Les doigts utilisent six formes préparées,
sans morphing continu ; le poignet suit une trajectoire continue. Le service reste dans la voie existante.
Baïkal 13B, la fondation métrique de tracé et les paquets de sources Monaco/Marseille sont conservés.

## Qualification locale

**137/137 suites réussies** dans la campagne complète, aucun échec dans ce passage. Des dépassements de construction restent observés dans les trois passages ciblés inchangés de l’optimisation : 188 ms sur Val-Brûlé, 154 et 167 ms sur Haut-Col, pour un seuil de 150 ms. Cette réserve ne disparaît pas avec un passage complet réussi.
Les deux passages précédents restent conservés : 129/136 avant corrections, puis 136/137 avec
un dépassement de durée. L’optimisation suivante est qualifiée sur la source finale, sans changer le seuil.
Le panneau des stands est désormais derrière le muret, dégagé de la chaussée et de la voie de service.
Les 54 empreintes historiques p14 restent exactes ; la nouvelle géométrie de scène a sa référence distincte.
Les traces passent : l’ancienne signature reste inexpliquée, les contrats actuels sont vérifiés par mutations.

Deux builds identiques : **14 242 311 octets**, SHA-256
`cf71191600060626c5aa6bbf4523a332e867673984c47e7b48d9eaec79322655`. **60 scripts** analysés, **34 modules FERRO** verrouillés conformes.
Rapport : `docs/reprise/rapports/REALISME-2026-11-19/QUALIFICATION-0260.json`.

## Publication et limites

Publier l’arbre exact qualifié, observer la CI puis consigner les références distantes.
FERRO 0.3.15 est déjà publié par PR #4 : 213 réussis, zéro échec, un TODO hérité localement.
Ses Actions sont bloquées avant démarrage par paiement/plafond du compte. Vérifier séparément BITUME ;
ne pas annoncer une CI verte sur la seule preuve locale. Aucune facturation ni protection modifiée.
Jeu complet en navigateur, manettes physiques et FPS matériels restent non validés.
Aucun accès Mac/VPS pour `deposer.sh` : **site non déployé depuis cette session**.

## Suite autonome

Après publication, compléter les mesures Monaco **14A** à partir du paquet FIA/OSM déjà acquis :
altitudes, largeurs, dévers et incertitudes, puis raccordement à la course. Marseille suit avec le corridor
EMPRISE et le relief mesuré, dont la couverture/datum restent à qualifier.
Le circuit montagne distinct de Haut-Col et les six propositions restent : **17 destinations prévues**,
**8 jouables actuellement**. Tous les autres lots sont dans
`docs/reprise/CONTINUATION-AUTONOME-2026-11-19.md` et la master liste.
Une tête livrée à la fois, aucun push forcé ; conserver preuves et réserves sans refaire les lots clos.
