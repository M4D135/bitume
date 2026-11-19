# 12F4 — stratégie de stands IA

**Complément publié sur main en 0.2.52/p13 :** dégagement des files serrées et joueur qui repart, voir [la fiche de correction](12F4-SORTIE-FILE.md). Le texte ci-dessous conserve la livraison initiale 0.2.51/p12.

## Base et périmètre

19 novembre 2026. Demande « go la suite » après 12F3 livré. Base **0.2.50 / main `c8afbd49594eaac51876286e471413856117418d`**.
Branche livrée `codex/bitume-12f4-20261119` ; tête qualifiée **`6a3fb86a`**.
**LIVRÉ EN 0.2.51 SUR MAIN `4710a400`** ; PR n°5 fusionnée le 19 novembre 2026 à **16:10:18, heure de Paris**.
Arbre **`1054a9a3`** identique à la tête qualifiée ; sources, tests et build conservés.

Faire utiliser aux rivaux locaux et aux voitures reprises par l’IA les stands existants. Les voitures distantes
restent sous l’autorité de leur machine ; l’hôte pilote les rivaux en ligne. La conduite manuelle garde ses règles.

1. Programmer un arrêt pour une usure importante ou une monte durablement inadaptée à la chaussée, avec garde
   contre les arrêts répétés, les changements passagers sous tunnel et les demandes inutiles en fin de course.
2. Rejoindre la voie, ralentir, s’immobiliser dans le garage et ressortir **par les commandes de conduite**.
   Même physique, limites et collisions. Aucune téléportation, impulsion ou restauration d’usure ajoutée.
3. Employer le service existant : monte figée au début, durée complète, remplacement atomique des quatre pneus
   uniquement au terme. Une interruption conserve l’état usé et exige un nouveau service complet.
4. Gérer le trafic et plusieurs demandes sans qu’une attente dans le garage déclenche un service IA non admis.
   Vérifier la place au moment de l’admission, après les collisions ; une attente trop longue reporte l’arrêt.
   Un service déjà engagé continue tant que ses conditions d’immobilité restent vraies, y compris si un humain
   arrive ensuite ailleurs dans la zone. Conserver les règles des humains, le compte des tours et l’invalidation
   du tour d’arrêt. Reprise IA après déconnexion : aucun pneu neuf avant cet arrêt réel.
5. Conserver le transport 12F3 : le vrai événement de fin de service déclenche déjà la synchronisation fiable.

La loi d’usure, les forces de conduite et les 34 modules FERRO restent inchangés. La stratégie modifie les décisions
et trajectoires de course : **p12 est actif dans le code**, avec archivage intact de p9/p10/p11. Les anciens records et fantômes
restent dans leur espace de version ; aucune référence existante n’est écrasée.

## Contrôles ciblés acquis au checkpoint

**17/17 trajets**, dont les sept circuits avec limites et solides réels, trois IA successives, second service,
occupation humaine tardive, dégagement sans contact, interruption et règles d’autorité ; **6/6 décisions**.
Régressions ciblées : **18/18 stands**, **30/30 stands-pneus**, **8/8 chaussée**.
Le contre-exemple du garage occupé a été corrigé par le guidage et une faible avance bornée par les volumes réels,
sans changer les poses, affaiblir les assertions, renouveler les pneus ni déclencher un secours caché.

La nouvelle fixture **p12** a été créée après les ciblés : **21 scénarios / 1 375 empreintes**, dont un service IA
complet effectivement observé. Reçu `rapports/12F4-2026-11-19/CREATION-P12.json` ; archives p9/p10/p11 intactes. **Comparaison globale réussie : 21 scénarios / 1 375 empreintes**, fixture p12 inchangée pendant la qualification.
Prochaine action : **13A Russie, tracé/relief, non commencé** ; Baïkal reste une proposition de thème.

## Qualification finale et publication

- **106/107 suites**, seul échec `traces.test.mjs` hérité à signature identique ; aucun autre échec.
  Rapport : `rapports/12F4-2026-11-19/qualification-execution.json` ; synthèse `VALIDATION.md` dans le même dossier.
- **21 scénarios / 1 375 empreintes p12**, dont un vrai service IA ; référence inchangée pendant la qualification.
  Création initiale attestée dans `CREATION-P12.json`, archives p9/p10/p11 et lois de conduite/usure inchangées.
- **211 empreintes suivies**. Deux builds **0.2.51** identiques : **14 056 780 octets**, SHA-256
  `e349f073c872d129367b0d13d9c0b1e72e76fa67e1851663a0ac7e3f64aa7225`.
  **53 scripts valides**, **34 modules FERRO 0.3.11 inchangés**.
- **Publication vérifiée** : PR n°5 fermée et fusionnée, main `4710a400`, arbre identique à la tête qualifiée.
  Reçu : `rapports/12F4-2026-11-19/PUBLICATION-0251.json`. Deux CI finales terminées en échec :
  push **44550520260** et PR **44550618625**, **106/107 chacune**, seul traces hérité à signature identique.
  Build reconstruit identique ; aucun contrôle ni règle modifié.

**Prochain lot : 13A — Russie, tracé et relief, NON COMMENCÉ.**

Parties entre navigateurs réels, rendu WebGL, performances matérielles et déploiement restent distincts des essais
CPU. Pas d’accès Mac/Spark/amiga établi dans cet environnement. Circuits Russie, Monaco, Marseille EMPRISE avec relief,
huitième circuit de montagne et six propositions restent conservés après ce sous-lot.
