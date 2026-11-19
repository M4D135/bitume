# BITUME — reprise courte

## Point actif — 19 novembre 2026

**0.2.52 / p13 publiée et vérifiée sur main**, livraison `b5b4c0c693e6f47199c31384c9217831d10acd0f`.
**PR n°6 fermée et fusionnée. Lot 12F4 et correction des files serrées terminés.**
Ne pas recommencer ces correctifs, leurs publications, les lots 12A–12F3 ou Safari (corrigé et clos).
**Prochain sous-lot : 13A Russie — tracé et relief, NON COMMENCÉ.**
Lire `docs/reprise/ETAT.json`, la dernière entrée du suivi et le volet 13A du plan maître uniquement.

## Livraison vérifiée

Les sources, le jeu compilé et les preuves correspondent à la tête revue `b8c67028` ; l'arbre de fusion est
identique au lot qualifié. Reçu : `docs/reprise/rapports/12F4-SORTIE-FILE-2026-11-19/PUBLICATION-0252.json`.
La clôture 0.2.51 `db3e8da1` est préservée avec ses reçus et journaux.
Le présent suivi est documentaire et ne reconstruit pas le jeu.

L'IA quitte une file serrée par les commandes de conduite, peut reculer brièvement quand l'arrière est libre,
contourne aussi après un service achevé et reprend la course quand le joueur garé redémarre. Aucun pneu n'est
renouvelé avant la fin d'un vrai service. Les neuf scénarios de dégagement exigent la restitution effective à la
conduite ordinaire, sans contact, choc, rail, accident ni replacement ; pluie, neige et Haut-Col sont couverts.

## Qualification conservée

**107/108 suites**, seul échec `traces.test.mjs` hérité et identique. **22 scénarios / 1 415 empreintes p13**
reproduits ; archives p9–p12 et lois de conduite/usure intactes. **9/9 dégagements**, 17 trajets initiaux et 6 décisions
réussis. Deux builds identiques de **14 060 666 octets**, SHA-256
`4c8f43204fa79323d652202d12c534570b67fa85a2980fdbc4f589559e94f976`.
**53 scripts valides**, **34 modules FERRO 0.3.11 inchangés**. Rapport :
`docs/reprise/rapports/12F4-SORTIE-FILE-2026-11-19/qualification-execution.json`.
Les deux CI GitHub du commit de code sont **terminées : 107/108 chacune**, seul échec traces hérité identique.
Reçu et journaux : `docs/reprise/rapports/12F4-SORTIE-FILE-2026-11-19/github/RECU-CI.json`.
Aucune CI entièrement verte annoncée ; cette vérification est close, ne pas la reprendre au début.

## Suite et demandes conservées

13A fixe le tracé, le relief et l'identité précise du circuit russe ; **Baïkal est une proposition de thème**.
Conserver Monaco fidèle, Marseille depuis EMPRISE avec relief mesuré, huitième montagne distincte de Haut-Col et
six propositions. Les sept circuits existants restent conservés. Fiche de correction close :
`docs/reprise/12F4-SORTIE-FILE.md` ; ensemble : `MASTER-LISTE-CLAUDE-FABLE.md`.

WebGL, FPS matériel, parties entre navigateurs réels, déploiement et page servie non validés. Mac/Spark/amiga
indisponibles ici. Publication GitHub et déploiement restent distincts. Un sous-lot à la fois, sorties courtes,
publications fréquentes et aucun push forcé ; moteurs modifiés uniquement dans FERRO canonique.
