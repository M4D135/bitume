# BITUME — reprise courte

## Livré — 19 novembre 2026

**0.2.55 / p14 publiée sur main**, PR #9 fusionnée au commit `1e4579c5`.
Sources, jeu compilé et preuves identiques au lot qualifié ; FERRO 0.3.14, 34 modules exacts.
Reçu : `docs/reprise/rapports/PHYSX-SOLS-PILOTES-2026-11-19/PUBLICATION-0255.json`.

- Qualification locale : **117/119**, 235 fichiers et 119 journaux contrôlés ; aucun test/build relancé à la reprise.
- CI branche/PR : **118/119** ; CI après fusion : **117/119**, traces héritées et décor Val-Brûlé 163 ms / 150 ms.
- Réserve Val-Brûlé conservée : 486 ms localement, 163 ms sur main pour 150 ms ; absence de régression non démontrée.
- Build : 14 153 917 octets, SHA-256 `c9e0c3d93a4456f3d84a56317ab4282bab5deebfea942bfe5a50231459006d2f`.
- ZIP CI récupéré et contrôlé : même build, intégrité vérifiée. Scène navigateur complète, FPS matériels et déploiement non validés.

## Lot suivant — démos cinéma

Lire `docs/reprise/ETAT.json` puis `docs/reprise/DEMOS-CINEMA-2026-11-19.md` seulement.
Plans F1/arcade, paysages, faune et flore ; préserver la conduite p14 et les courses continues.
Travail préparé dans `/workspace/scratch/749f331cc09f/bitume-demo`, branche
`codex/bitume-demos-cinema-20261119`, base ancienne `838756b`, modifications non commitées.
Le correctif du bond de caméra est **préparé**, à intégrer puis qualifier sur la 0.2.55 publiée.
Ne pas écraser cette copie avec l'ancienne `/workspace/scratch/2540d1a213f9/bitume-demo`.

Puis 13B Baïkal : lac, berges, lieux, végétation/faune et saisons. Conserver Monaco fidèle, Marseille avec relief,
grand circuit montagne distinct et six propositions. Safari confirmé corrigé, ne pas rouvrir.
Un sous-lot à la fois, publication avec reçu, pas de push forcé. L'historique est archivé ; ne pas le recharger en bloc.
