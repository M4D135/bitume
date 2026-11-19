# BITUME 12F3 — qualification 0.2.50

## Résultat

**104/105 suites réussies sur sources figées**, sans correction après la passe globale.
Le seul échec est `traces.test.mjs` : logs identiques à 12F2 après neutralisation du chemin et du seul temps CPU
(0,024 puis 0,026 ms par image, 589 objets). Empreintes obtenue/attendue inchangées ; réserve dans `reserve-traces.json`.
Le workflow strict restera rouge pour ce test ; aucun test, seuil ou fixture n’est remplacé.

- **20 scénarios / 1 300 empreintes p11** identiques. Fixtures p9/p10/p11 intactes.
- **205 empreintes** de sources, tests, fixtures, assembleur et verrou contrôlées avant/après.
- Deux constructions identiques : **14042272 octets**, SHA-256 `b1154b9b8a03641f2b166c44bd7cd191589e2375a9cc490733edd90934d5dc21`.
- **52 scripts** syntaxiquement valides ; module pneus réseau chargé avant la coque.
- Empreinte de compatibilité incluse dans le build : `47d571ee06b635c215ac8bbaf2bc014b7afc630307c0afb2cc21c662fea67f50`.
  Elle couvre toutes les sources, dont limites et collisions ; deux builds différents demandent un rechargement commun.
- **FERRO 0.3.11**, 34 modules inchangés.

## Comportements vérifiés

- Type et quatre roues complètes transmis à 2 Hz maximum hors services/synchronisations forcés ; positions inchangées.
- Services transmis immédiatement depuis leur vraie fin, y compris joueur 2 ; aucune remise à neuf par un doublon,
  une interruption, une ancienne séance, un replacement ou une reprise IA.
- Contrôle du propriétaire et de la génération d’autorité ; l’hôte applique avant de relayer les invités.
- 2+2, 2+1, 1+2 ; reconnexion de liaison et instantané après chargement ; perte de service côté pair rattrapée
  depuis l’hôte ; les nouveaux joueurs hors grille attendent la prochaine course.
- Miroir visuel interpolé séparé des états physiques. Choix de prochaine monte activé en ligne pour chaque pilote local.
- Départs répétés/périmés, annulation et incompatibilité pendant chargement : aucune recréation de course tardive.

## Mesures et limites

`transport-mesure.json` mesure les longueurs des vrais encodeurs. Pour 2+2, l’état usé représentatif ajoute
5 942 octets/s de charge utile à 2 Hz (relais compris), contre 30 480 octets/s de positions au scénario à 60 images/s.
Ce sont des débits théoriques, hors en-têtes et événements, pas une mesure du réseau ni des FPS.

Tests Node avec vrais modules et contrôleurs ; DOM, transport et horloges simulés dans les tests d’intégration.
**Parties réelles entre navigateurs, WebGL, FPS matériels et déploiement non validés ici.**
Le Spark, le Mac et amiga restent indisponibles dans cet environnement.

## Reproduction

`python3 docs/reprise/rapports/12F3-2026-11-19/qualifier.py --tests`, puis `--build` sur le même état de sources.
Le script ne régénère jamais p11. `suites.json`, `commandes.json`, manifests et journaux bruts conservent les preuves.
Les premiers logs ciblés sont contextualisés dans `cibles/LISEZ-MOI.md` ; le harnais de conditions a été migré
au nouveau protocole avant la passe globale. Les blancs de logs Node sont conservés pour leurs empreintes.

Suite : stratégie des stands IA, puis circuits demandés. Ce rapport n’annonce aucune publication avant son reçu.
