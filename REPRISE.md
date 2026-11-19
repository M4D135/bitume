# BITUME — reprise courte

## Livraison close — réalisme 0.2.60, 20 novembre 2026

**0.2.60 / p14 / FERRO 0.3.15** publiée sur `main` par [PR #20](https://github.com/M4D135/bitume/pull/20).
Fusion `50c2a540b3903c1a67f982b1ff1a57fc59a4478a` ; tête qualifiée `43720ca0d8fd2a78c60fb37aa8ed181dcbbd30a7`.
Arbre distant exact : `43c220669d7360d7565f189df372148722b72904`. Aucun lot clos à refaire.
Lire `docs/reprise/ETAT.json`, puis seulement la fiche du prochain sous-lot.

Bras communs aux vues et coudes bas, pneus sans barres blanches, matières du cockpit,
gouttes/neige, bâtiments détaillés et garages sont livrés. Les doigts utilisent six formes préparées,
le poignet suit une trajectoire continue ; le service reste dans la voie existante.
Baïkal 13B, la fondation métrique de tracé et les paquets sources Monaco/Marseille sont conservés.

## Preuves conservées

Qualification locale : **137/137 suites réussies** ; 317 fichiers, 103 éléments de publication et
137 journaux existants revérifiés sans relancer campagne ni build. CI de la PR #20 : 137/137 suites réussies, aucun échec.
Les dépassements des essais ciblés restent consignés : 188 ms à Val-Brûlé, 154 et 167 ms à Haut-Col, pour le seuil inchangé de 150 ms. Un passage réussi ne supprime pas cette réserve.
Les passages précédents 129/136 puis 136/137 restent conservés. Les 54 empreintes historiques p14
restent exactes ; la nouvelle scène a sa référence distincte. L'ancienne signature des traces reste
inexpliquée ; les contrats actuels passent leurs mutations négatives.

Build : **14 242 311 octets**, SHA-256 `cf71191600060626c5aa6bbf4523a332e867673984c47e7b48d9eaec79322655`.
60 scripts analysés, 34 modules FERRO verrouillés conformes.
Rapport : `docs/reprise/rapports/REALISME-2026-11-19/QUALIFICATION-0260.json`.
Reçu et détail CI : `docs/reprise/rapports/REALISME-2026-11-19/PUBLICATION-0260.json`.

## Limites

Le jeu complet en navigateur, les manettes physiques, les essais entre réseaux et les FPS matériels
restent non validés. Aucun accès Mac/VPS : **site non déployé depuis cet environnement**.
La CI PR ci-dessus et les éventuelles exécutions sur `main` sont distinguées dans le reçu ; aucun succès distant
n'est déduit de la seule preuve locale. Aucune facturation, protection ou tolérance de test modifiée.

## Suite autonome — Monaco 14A

Compléter altitudes, largeurs, dévers et incertitudes à partir du paquet FIA/OSM acquis, puis raccorder
à la course. La boucle OSM de 415 points/arêtes est déjà résolue ; les mesures de chaussée restent
inconnues. Acquérir des références avec licence/date/précision/datum, sans combler les champs `null`
ni forcer l'écart de longueur de −13,390 m par une mise à l'échelle. Lire
`docs/references/monaco-2026/README.md`. Marseille suit avec le corridor EMPRISE et le relief mesuré, dont couverture/datum
restent à qualifier. Le circuit montagne distinct de Haut-Col et les six propositions sont conservés :
**17 destinations prévues, 8 jouables**. Programme complet :
`docs/reprise/CONTINUATION-AUTONOME-2026-11-19.md` et master liste.
Une tête livrée à la fois, pas de push forcé ; conserver les preuves sans relancer les lots clos.
