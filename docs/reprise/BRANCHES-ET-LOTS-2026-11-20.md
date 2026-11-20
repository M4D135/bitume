# Branches préparées et lots restants — 20 novembre 2026

## Base livrée et portée de cet audit

La base à conserver est **BITUME 0.2.62 / physique p15 / FERRO 0.3.15**.
Cet audit rapproche les comptes rendus historiques du code livré. Il ne récupère pas à lui seul les
anciennes branches, ne réexécute pas leurs essais et ne clôt aucun grand lot encore incomplet.

| Livraison | Qualification observée | Fusion observée |
|---|---|---|
| [PR #31 — aspiration, souffle et projections](https://github.com/M4D135/bitume/pull/31) | [147/147 suites](https://github.com/M4D135/bitume/actions/runs/44718436891), 3 337 sources vérifiées ; [20 passages et 41 PNG](https://github.com/M4D135/bitume/actions/runs/44718437031), dont pluie et tunnel | `27bdf08de3a712e6658b71d428d2a7d1af3fece5`, arbre `736048cac03e5fe474757816d442dc2f70f60be8` |
| [PR #32 — preuve de dégagement PhysX](https://github.com/M4D135/bitume/pull/32) | [148/148 suites](https://github.com/M4D135/bitume/actions/runs/44718771726), 3 339 sources vérifiées ; deux fichiers de test/preuve ajoutés | `3fc9421eb87c9bfdc296673e48220c0667626058`, arbre `1667d290b85268c4f7d0621cd26d6ae03fc82959` |

Les résultats de ces PR sont distincts. Le complément #32 conserve le runtime et le HTML de #31 :
**14 268 457 octets**, SHA-256 `439bea3969ab4651fbebb87d8403f5a54968917ca6bdecede40e7d9140403297`.
Les arbres de fusion correspondent aux candidats qualifiés. Aucune nouvelle campagne du jeu n'est
attribuée à cette mise à jour documentaire. Les captures SwiftShader sont des poses fixées, sans
mesure des FPS matériels ni qualification d'une course complète.
La [clôture documentaire PR #33](https://github.com/M4D135/bitume/pull/33) est déjà fusionnée ; ce bilan
la complète avec l'état des branches et du programme, sans refaire la publication 0.2.62.

## Travaux mentionnés dans des branches historiques

Les branches et SHA courts ci-dessous viennent des notices conservées. Leurs objets n'ont pas été
retrouvés dans le checkout inspecté ; ils ne sont donc pas présentés comme des artefacts récupérés.
Leur absence ici ne prouve ni leur suppression ni leur absence sur le poste d'origine. Récupérer le
contenu et vérifier son identité avant relecture ou intégration ; ne pas réappliquer un ancien patch
sur des fichiers dont le moteur, la physique et les interfaces ont changé.
Les recherches des familles `etude`, `conduite`, `spark` et `circuits` n'ont retrouvé ces branches ni
sur GitHub ni parmi les références des 34 bases Git locales accessibles examinées. Certains fichiers
d'étude sont néanmoins conservés, dont `tools/lieux-partitions.mjs` et le prototype de cache cité ci-dessous.

| Travail historique | Ce que les notices attestent | État dans la base p15 et prochaine étape |
|---|---|---|
| Route-des-Cimes, `circuits/lot22`, `d30ff56` ; étude `etude/lieux`, `df14675` | Premier jet : graine 181, 9 698 m, deux tours, Mur à 30 %, tunnel du Rocher ; terrain et plusieurs ouvrages encore manquants | Absent du catalogue actuel ; `src/partitions.js` et `src/lieux.js` absents. Récupérer le tracé et ses preuves, puis adapter relief, ouvrages, surfaces PhysX, IA et caméras. Préserver les huit circuits existants. |
| Conduite, `conduite/etude` puis `spark/conduite` | Banc `912f17b`, plan `3ab50fa`, 17A `4799fb6`, 17B `54e7b68`, puis essais Spark non relus sur l'ancien modèle | Partir de **p15**, sans importer directement les calculs p9. Réévaluer puissance, ABS, glisse et guidage avec les châssis natifs et les règles de records actuelles. |
| Invitations, `etude/enligne`, `964123b` puis `2aba084` | Code, lien/QR, signalisation chiffrée et relais publics ; 69 suites et essais 2–3 Chrome sur un même Mac rapportés | Le jeu livré utilise encore son salon. Récupérer le prototype et préserver les états PhysX et les services ajoutés depuis. Un essai sur deux réseaux distincts reste requis. Aucune IP à fournir par David. |
| Terrain/lieux/couverts, `spark/circuits` | Relevé final : terrain 5 fiches/0 commit ; lieux 7 fiches/5 commits après `d30ff56` ; couverts 5 fiches/1 commit après `be31975` | Jets non relus dans le relevé historique. Récupération, revue et comparaison aux géométries actuelles avant attribution de fonctionnalité ou de gain. |
| Cache, `spark/calcul` | Quatre fiches et trois commits après `b1ed8e4`, non relus au dernier relevé ; fichier d'étude `prototypes/calcul/scenario-worker-cache.js` conservé | Aucun `src/cache-niveau.js` ni accès IndexedDB de niveau dans le runtime inspecté. Récupérer les commits ; qualifier clé de version, invalidation, quota/erreurs, intégrité et repli par régénération. |
| Visière, `etude/vitre`, `c5ae5ba` | Prototype et mesures, sans intégration au moment du rapport | Une optique de visière a été livrée depuis en 0.2.61, puis enrichie en 0.2.62. Comparer le prototype récupéré au runtime actuel et aux demandes récentes ; ne pas reclasser tout le lot en « non commencé ». |
| Photoréalisme, `etude/photo`, `a9ac32e` | Étude, maquette shader et mesures sur machine chargée ; aucune implémentation livrée par ce commit | Ombres, flaques et grain ont été améliorés depuis. Réconcilier les effets restants et refaire les mesures utiles ; toute correction de moteur passe par FERRO canonique. Le vieux patch n'est pas applicable en bloc. |
| Circuits procéduraux, `etude/procedural`, `2807e0b` | Étude du lot 22 et prototype de relief avec 14 planches | Des décors, limites et repères existent déjà ; les grands reliefs, ouvrages et lieux non intégrés restent à réaliser. Comparer aux surfaces effectivement affichées et utilisées par PhysX. |

Sources historiques : [PILOTAGE-2026-11-18.md](PILOTAGE-2026-11-18.md), sections du 18 novembre
à 21 h 15, 22 h, 22 h 50 et 23 h 35, puis relevé final du 19 novembre ; rapports
[visière](rapports/etudes-2026-11-18/etudier-vitre.json) et
[photoréalisme](rapports/etudes-2026-11-18/etudier-photo.json),
[circuits](rapports/etudes-2026-11-18/etudier-circuits.json),
[données d'étude des lieux](../../tools/lieux-partitions.mjs) et
[prototype de cache](../../prototypes/calcul/scenario-worker-cache.js).
Le nombre de commits rapporté n'est ni une preuve de relecture ni une preuve de livraison.

## Grands lots : acquis, fondations et travail restant

| Lot | Déjà livré ou préparé et identifié | Ce qui reste ouvert |
|---|---|---|
| Catalogue | Huit circuits dans `CATALOGUE`, dont Baïkal en huitième position ; 17 destinations au programme | Route-des-Cimes, Monaco, Marseille et les six destinations supplémentaires ne sont pas jouables. Conserver le programme complet et tous les identifiants existants. |
| Haut-Col | Tracé et tunnel actuels, correction des appuis sous la faune et du cadrage en 0.2.61 | Le relief généré reste plafonné à 6,8 % et un tunnel de 260 m est construit. Rampes >10 %, corniche et second tunnel du projet ne sont pas clos. |
| Passages couverts multiples 22B–22D | Tunnel historique et bords dangereux/repères généraux intégrés | Runtime encore fondé sur un seul `c.tunnel`, sans `c.couverts` ni `dansCouvert`. Adapter passages, abri météo, lumière, caméras, rétroviseurs et solides natifs avant les nouveaux ouvrages. |
| Monaco 14A–14F | Boucle OSM de 415 points, observations de terrain, revue et carte/profils publiés ; fondation de tracé explicite | Chaussée, largeurs, dévers, limites et portails non qualifiés : `readyForRuntime=false`. Les données de terrain ne deviennent pas automatiquement la hauteur des routes ou tunnels. Ville et course complète restent à construire. |
| Marseille 15A–15F | 1 177 polylignes de voies, 5 274 empreintes/parties bâties, 119 repères et grille de 4 225 altitudes archivés | Choix du corridor, couverture et provenance altimétriques, distinction terrain/quais/tabliers, raccords, IA, collisions et course jouable. Les sources acquises ne constituent pas une livraison du circuit. |
| Conduite 17 | Châssis dynamique PhysX, Légère par défaut, aspiration p15 au bénéfice du suiveur et preuve native de dégagement | Calibration 521 ch, niveaux d'ABS, dérive fondée sur la glisse et guidage clavier/tactile à qualifier. La propulsion utilise encore `coeffMoteur = 13` ; p15 ne clôt pas ces choix. |
| Pluie/neige 19 | Réfraction, gouttes, ruissellement, neige humide et fonte ; recharge de projections à grande vitesse et tunnel contrôlés | Réconcilier les évolutions préparées de déplacement, fusion et expulsion des gouttes, puis leur jugement visuel et coût matériel. Les 41 PNG ne prouvent pas tous les comportements d'une longue séquence. |
| Lumière/eau 21 | Ombres, flaques et sols partiellement livrés | Rendu Photo, courbe conservant les teintes, nuit, tunnels et reflets voiture/personnages à réconcilier avec les études ; stries héritées du terrain à diagnostiquer. |
| Matières 23/25 | Cockpit, roues, formes et une partie du grain améliorés | Freins, chaleur, salissures et autres effets prévus ; préserver les dimensions et ancrages du cockpit lors des nouvelles corrections. |
| Calcul 28 | Herbier et saisons améliorés, socle de chargement livré | Précréation/installation à mesurer, cache IndexedDB historique à récupérer ; C/WASM, Worker et WebGPU seulement pour un calcul identifié avec gain démontré et repli conservé. |
| Records et championnat | Records/fantômes séparés par physique, chronométrage et courses existants | Historique détaillé et championnat de plusieurs courses non livrés. Préserver migrations, identité de piste et isolation des essais. |

Références de l'état courant : [jeu](../../src/jeu.js), [circuit](../../src/circuit.js),
[conduite](../../src/conduite.js), [physique](../../src/physique.js),
[réseau](../../src/reseau.js), [Monaco](../references/monaco-2026/README.md),
[Marseille](../references/marseille-2026/README.md) et
[programme complet](CONTINUATION-AUTONOME-2026-11-19.md).
Les anciennes cases « à faire » du public, des vibrations, des animaux ou des échappements ne remettent
pas en cause leurs livraisons déjà consignées ; les essais matériels encore ouverts restent distincts.

## Lot 27 — ce que signifiait la question sur les IP

La note historique du 18 novembre concernait **la visibilité de l'adresse réseau des joueurs par les
relais publics lors de la mise en relation**. Elle ne demandait pas que David fournisse une liste d'IP.
Aucune réponse explicite à cette question précise n'est attestée dans l'audit ; ne pas lui attribuer un
accord inventé. La demande ultérieure de continuation autonome permet de préparer, récupérer, adapter
et tester le code sans faire de cette ancienne note un blocage de développement.

Le flux visé reste un code de partie ou une invitation : les joueurs n'ont pas à saisir leur IP publique
ni à configurer une redirection de port. WebRTC découvre et échange ses candidats réseau, tandis que
la signalisation passe par le mécanisme choisi par l'application. La [spécification W3C, exemple 10.1
et section 13.2](https://www.w3.org/TR/webrtc/) décrit ces étapes et la visibilité des adresses proposées.
Le chiffrement de la signalisation masque son contenu, pas l'adresse de connexion vue par son relais.

Un code ou un QR ne résout pas tous les NAT ou pare-feux. Lorsque la liaison directe est impossible,
un relais de trafic est nécessaire ; [TURN, RFC 8656](https://www.rfc-editor.org/rfc/rfc8656.html),
décrit ce rôle. Les relais de mise en relation ne sont pas automatiquement des relais de trafic.
Ne pas promettre une connexion universelle avec du direct seul ni assimiler « sans serveur à gérer »
à « aucune infrastructure ». L'ancienne remarque sur l'absence d'un service TURN gratuit sans clé
reste historique, sans être présentée comme un état actuel du marché.

Le runtime livré utilise STUN, WebRTC et le salon, avec repli de trafic par celui-ci. Conserver ce mode
tant que son remplacement n'est pas qualifié ; récupérer le prototype, intégrer les états de jeu p15,
vérifier les reprises et coupures, puis éprouver deux réseaux distincts. La disponibilité de relais
publics et les conditions réelles d'un éventuel service TURN devront être vérifiées au moment du choix.

## Ordre de reprise et limites conservées

1. Réconcilier les corrections préparées séparément : caméras de démo, sols, volant, regard et gestes
   du pilote, puis gouttes qui se déplacent, fusionnent et s'évacuent avec la vitesse. Les comparer à
   la base p15 avant qualification ; cet audit ne les déclare pas intégrées.
2. Récupérer les branches historiques utiles, contrôler leurs identités et sélectionner leurs apports
   encore nécessaires. Garder une seule base livrée et des sous-lots limités.
3. Poursuivre les données et fonctions communes de Monaco, puis Marseille, la montagne distincte et
   les six destinations ; les travaux indépendants peuvent avancer en parallèle. Les lots transversaux
   suivent leurs dépendances, sans effacer les tâches restantes du programme à 17 destinations.

Réserves maintenues : construction **188 ms Val-Brûlé, 154/167 ms Haut-Col**, seuil **150 ms** ;
S8 facultatif **1 031 °/s² pour une cible de 300**, avec **46/46 critères obligatoires** réussis ;
stries du terrain, FPS matériels, écoute matérielle, manettes et réseau entre machines à qualifier.
Ce document ne revendique ni exécution sur le Spark, ni déploiement du site, ni gain issu d'un prototype
qui n'aurait pas été récupéré et mesuré.
