# BITUME 12F4 — qualification 0.2.51 / p12

## Résultat

**106 suites sur 107 réussies**, sur les sources gelées. Seul `traces.test.mjs` échoue, avec la même signature
que la base 0.2.50 ; aucune correction de ce défaut n’est revendiquée. La qualification reste assortie de cette
réserve. Résultats : [qualification-execution.json](qualification-execution.json), [suites.json](suites.json),
[reserve-traces.json](reserve-traces.json) et journaux complets dans `tests/`.

- **211 empreintes** de sources, tests, fixtures, assembleur et références suivies avant/après tests et build,
  sans changement durant la qualification.
- **21 scénarios / 1 375 empreintes p12**, identiques à la référence créée après les contrôles comportementaux.
  Le nouveau cas observe effectivement entrée, service, remplacement, sortie et progression d’une IA.
- Références **p9, p10 et p11 intactes** ; aucun écrasement. Les sources de conduite, usure, pneus, circuit,
  dégâts, contacts et obstacles restent identiques à 0.2.50. p12 isole le changement des décisions et trajectoires
  de course ; les records et fantômes sont rangés sous les nouvelles clés, sans supprimer les anciennes.
- Deux builds **0.2.51 identiques**, de **14 056 780 octets**, SHA-256
  `e349f073c872d129367b0d13d9c0b1e72e76fa67e1851663a0ac7e3f64aa7225`.
- **53 scripts** du bundle valides ; **34 modules FERRO 0.3.11 verrouillés inchangés**. Contrat de préparation
  incluant l’empreinte complète des sources vérifié dans le build.

La création de la nouvelle référence est une étape explicite et distincte : [CREATION-P12.json](CREATION-P12.json),
`creation-p12.log` et `hashes-avant-creation-p12.json`. Le qualificateur ne crée ni ne régénère de fixture.
La base conservée est décrite dans [BASE-0250.json](BASE-0250.json).

## Comportement livré

Les rivaux locaux et les humains repris par l’IA peuvent décider un arrêt. La décision est évaluée à **2 Hz** :
usure maximale d’au moins **0,72**, ou avantage d’adhérence d’une autre monte d’au moins **12 %** persistant
**8 secondes** hors tunnel. Ce sont des réglages de jeu, pas des mesures de pneus réels. Un arrêt trop tardif ou
inutile en fin de course est reporté ; le réarmement demande un nouveau passage et au moins **25 secondes**.

L’IA rejoint les stands par les commandes de conduite, tient une file avant le garage et s’immobilise réellement.
L’admission est relue après les collisions. Un service déjà commencé conserve les règles partagées avec les joueurs :
monte figée au début, durée complète et quatre pneus renouvelés ensemble au terme seulement. Une interruption
conserve les pneus usés. Une occupation durable conduit à un dégagement physique, sans téléportation ni réparation.
Les voitures distantes ne sont jamais servies localement ; l’hôte transmet la fin réelle de service par le transport 12F3.

## Preuves des parcours

[cibles/SYNTHESE.md](cibles/SYNTHESE.md) rassemble les cinq reçus ciblés, leurs sources et deux contre-exemples
conservés. Les **17 journaux de parcours issus de la qualification complète sont identiques, octet pour octet,
aux journaux finaux archivés** : [PARCOURS-QUALIFICATION.json](PARCOURS-QUALIFICATION.json).

- Sept circuits du catalogue, avec limites et solides réels : entrée, immobilisation, service, sortie puis reprise.
- Pluie et neige : ancienne monte conservée jusqu’à la fin du service, puis pneus adaptés.
- Trois IA servies successivement ; deuxième arrêt après un vrai tour, sans boucle de service au même passage.
- Déplacement de 20 cm juste avant la fin : annulation, aucune remise à neuf.
- Joueur garé devant l’IA : admission refusée puis dépassement du garage sans contact, service ni replacement.
- Hôte, distant et reprise après déconnexion : une seule autorité, aucun service local concurrent ni remplacement à la reprise.
- Décisions : courte averse, conditions durables, tunnel, entrée tardive, drapeau apparu après engagement,
  voiture étrangère et occupation survenue entre guidage et admission.

Les services sans avarie durent nominalement **2,5 s** ; les événements sont séparés de 301 pas, soit environ
**2,508 s** au pas de 1/120 s. Les poses, compteurs et graines sont contrôlés à chaque pas dans les tests.

## Limites et reproduction

Node **v24.22.3**, Python **3.12.14**, Linux x86_64 : [environnement.json](environnement.json).
Simulation CPU et transport simulé. **Aucune partie réelle entre navigateurs, validation WebGL, mesure de FPS
matériel ou vérification du déploiement** n’est annoncée. Le seuil CPU du décor passe lors de ce contrôle ; sa
variabilité historique reste distincte d’une mesure matérielle.

Depuis la racine : `python3 docs/reprise/rapports/12F4-2026-11-19/qualifier.py --tests`, puis `--build`.
Le second mode refuse des sources modifiées depuis les tests. [commandes.json](commandes.json) conserve les
commandes, codes de sortie, dates, durées et empreintes des journaux. La publication finale et la page servie
doivent être vérifiées séparément de cette qualification.
