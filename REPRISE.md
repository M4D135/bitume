# BITUME — reprise courte

## Point actif — 19 novembre 2026

**0.2.55 / p14 qualifiée, publication Git à terminer.**
Branche `codex/bitume-physx-sols-pilotes-20261119`, checkpoint distant `6e9c1ea0`.
Lire `docs/reprise/ETAT.json` et `docs/reprise/PHYSX-SOLS-PILOTES-2026-11-19.md`.
Le build contient les voitures dynamiques PhysX, les sols entièrement procéduraux et les pilotes extérieurs animés.

## Validation terminée

- 119 suites exécutées, 117 réussies ; 235 fichiers inchangés pendant les tests.
- Réserves : décor Val-Brûlé 486 ms pour 150 ms (dépassement déjà observé en 0.2.54, absence de régression de durée
  non démontrée) ; traces à signature héritée identique. Aucun seuil modifié.
- Déterminisme natif p14 : 8 cas, 141 empreintes, deux scènes par cas, 4 464 poses sans changer la simulation.
- Huit circuits × 120 s × 12 voitures : aucun état invalide, un replacement après accident. Protocole sec/été,
  sans prétendre couvrir des courses complètes ni tout le hors-route. Neuf géométries de décor inchangées.
- Deux builds identiques : 14 153 917 octets, SHA-256
  `c9e0c3d93a4456f3d84a56317ab4282bab5deebfea942bfe5a50231459006d2f`.
- FERRO 0.3.14 : 34 modules exacts, PR #2 fusionnée au commit `85ba9417`, ZIP déjà publié.

Preuves faisant autorité : `docs/reprise/rapports/PHYSX-SOLS-PILOTES-2026-11-19/livraison/`.
Le dossier voisin `final/` est historique et interrompu. Le rendu complet navigateur, les FPS matériels et le
déploiement restent non validés. Dernière livraison BITUME sur main : 0.2.54, `c2880297`.

## Suite conservée

Après publication et reçu : démos cinématographiques F1/arcade, paysages/faune/flore,
fiche `docs/reprise/DEMOS-CINEMA-2026-11-19.md`. Préserver le travail isolé déjà préparé et traiter le bond de caméra
quand un arbre quitte le champ. Ne pas mélanger ce lot au snapshot PhysX.
Puis 13B Baïkal — lac, berges, lieux, végétation/faune et saisons ; conserver Monaco fidèle, Marseille avec relief,
grand circuit montagne distinct et six propositions. Safari confirmé corrigé, ne pas rouvrir.
Publier par petits lots, sans push forcé ; maintenir ce point court après chaque livraison.
