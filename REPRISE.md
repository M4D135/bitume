# BITUME — reprise courte

## Point actif — 19 novembre 2026

**0.2.54 / p13 publiée sur sa branche, PR n°8 encore ouverte.** Code vérifié `10f71ff1`, build inchangé ; main reste `f03a99cc…` tant que la fusion n’est pas constatée. FERRO canonique 0.3.12 publié sur `a22b738f`.

Lire `docs/reprise/ETAT.json`, la dernière entrée du suivi et `docs/reprise/rapports/VIRAGES-REFLETS-2026-11-19/CLOTURE-PROVENANCE-CI.md`. Les preuves concurrentes sont préservées, dont le contrôle chaussée enrichi **12/12**.

## Résultats à distinguer

- **Qualification locale ciblée : 38/39**, seules traces héritées ; 50 contrôles des repères, 20 lois/oracles p13 inchangés, 54 scripts valides, 34 modules FERRO exacts.
- **Deux CI complètes : 109/111 chacune**, traces héritées identiques et budget décor Val-Brûlé de 150 ms dépassé à **161/166 ms**. Aucun gain ou écart de performance établi sans comparaison de base. Journaux : `rapports/VIRAGES-REFLETS-2026-11-19/github/`.
- FERRO : 194 réussis, aucun échec, un TODO hérité ; EGL logiciel aux trois résolutions. EMPRISE : **9/11 contrats ciblés**, deux échecs hérités, build complet tenté mais bloqué par le blob `city-data.js` indisponible. Provenance réelle : `M4D135/FERRO:docs/reflets-0312/`.

Deux builds identiques de **14 089 230 octets**, SHA-256 `db24f69a55bd6ac6778009e9511dbb901f82e62628adfbaab8e11980a467d3a3`. Aucun source/test/build changé pour la clôture documentaire. Ne pas rejouer les lots pneus, Safari ou 13A clos.

## Suite demandée

Contrôler la clôture documentaire de la PR n°8 avant fusion. Le prochain lot porte sur **PhysX avec nouvelle version physique**, les sols hors-route enrichis par shader entièrement procédural sans fichiers textures, et le pilote extérieur animé (tête, bras, passage de rapport cohérents avec le cockpit et les LOD). Ne pas réécrire les preuves p13.

**13B Baïkal — décor et saisons reste demandé, différé.** Conserver les autres demandes de circuits. Aucun déploiement du site, scène navigateur complète ou FPS matériel validé. Spark, Mac et amiga indisponibles ; publications conditionnelles fréquentes, aucun push forcé.
