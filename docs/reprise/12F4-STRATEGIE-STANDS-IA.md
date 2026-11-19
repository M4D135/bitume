# 12F4 — stratégie de stands IA

## Base et périmètre

19 novembre 2026. Demande « go la suite » après 12F3 livré. Base **0.2.50 / main `c8afbd49594eaac51876286e471413856117418d`**.
Branche `codex/bitume-12f4-20261119`. **EN COURS, NON QUALIFIÉ** ; cible 0.2.51.

Faire utiliser aux rivaux locaux et aux voitures reprises par l’IA les stands existants. Les voitures distantes
restent sous l’autorité de leur machine ; l’hôte pilote les rivaux en ligne. La conduite manuelle garde ses règles.

1. Programmer un arrêt pour une usure importante ou une monte durablement inadaptée à la chaussée, avec garde
   contre les arrêts répétés, les changements passagers sous tunnel et les demandes inutiles en fin de course.
2. Rejoindre la voie, ralentir, s’immobiliser dans le garage et ressortir **par les commandes de conduite**.
   Même physique, limites et collisions. Aucune téléportation, impulsion ou restauration d’usure ajoutée.
3. Employer le service existant : monte figée au début, durée complète, remplacement atomique des quatre pneus
   uniquement au terme. Une interruption conserve l’état usé et exige un nouveau service complet.
4. Gérer le trafic et plusieurs demandes sans service superposé ni attente indéfinie ; conserver le compte des
   tours et l’invalidation du tour d’arrêt. Reprise IA après déconnexion : aucun pneu neuf avant cet arrêt réel.
5. Conserver le transport 12F3 : le vrai événement de fin de service déclenche déjà la synchronisation fiable.

La loi d’usure, les forces de conduite et les 34 modules FERRO restent inchangés. La stratégie modifie les décisions
et trajectoires de course : **p12 est prévue**, avec archivage intact de p9/p10/p11. Les anciens records et fantômes
restent dans leur espace de version ; aucune référence existante n’est écrasée.

## Validation et publication

- Tests de décision, absence de service sans intention et règles d’autorité.
- Trajets complets sur les **sept circuits du catalogue**, avec limites et solides réels ; événements d’entrée,
  immobilisation, service unique, sortie et progression repris. Vérifier le coût du service et l’absence de remise
  à neuf anticipée. Tests de trafic, interruption et reprise après déconnexion.
- Ajouter un scénario déterministe qui observe effectivement un service IA ; créer p12 uniquement après
  qualification du comportement, puis comparer les reconstructions. Garder les archives p9/p10/p11 intactes.
- Qualification complète sur sources gelées ; réserve traces héritée comparée explicitement et jamais déclarée
  corrigée sans preuve. Deux builds identiques, syntaxe du bundle et modules FERRO contrôlés.
- Publier un checkpoint de périmètre, les sources/tests, puis le build et les preuves. Vérifier le distant et
  enregistrer le reçu ; actualiser la reprise courte et le suivi après chaque publication.

Parties entre navigateurs réels, rendu WebGL, performances matérielles et déploiement restent distincts des essais
CPU. Pas d’accès Mac/Spark/amiga établi dans cet environnement. Circuits Russie, Monaco, Marseille EMPRISE avec relief,
huitième circuit de montagne et six propositions restent conservés après ce sous-lot.
