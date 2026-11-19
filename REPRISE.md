# BITUME — reprise courte

## Point actif — 19 novembre 2026

**Reprise active : correction de sortie de file 12F4, cible 0.2.52 / p13**, dans
`codex/bitume-12f4-sortie-file-20261119`. Fiche : `docs/reprise/12F4-SORTIE-FILE.md`.
Huit contrôles nouveaux, 17 trajets et 6 décisions réussis ; qualification complète et publication à terminer.
Base sources p12 `cb023508` ; la session source termine sa 0.2.51 séparément. Réconcilier sa publication avant
livraison finale. Les références p9 à p12 restent intactes. Ne pas reprendre les lots précédents.

### État hérité du checkpoint p12

**12F4 implémenté, contrôles ciblés acquis ; qualification complète EN COURS.**
Fiche : `docs/reprise/12F4-STRATEGIE-STANDS-IA.md` ; branche `codex/bitume-12f4-20261119`.
Base de branche **`446a350f`**, issue de main `c8afbd49` / **0.2.50**. Sources et tests gelés.
**Build actuel : 0.2.50 ; cible 0.2.51 NON LIVRÉE. p12 actif dans le code**, références p9/p10/p11 intactes.

Lire `git status`, `docs/reprise/ETAT.json` et la dernière entrée du suivi ; ouvrir seulement la fiche active.

- Rivaux locaux et humains repris par l’IA : arrêt pour usure forte ou monte durablement inadaptée,
  approche et file par commandes physiques, admission vérifiée après contacts, vrai service puis sortie.
- Aucun renouvellement avant la fin du service, aucune téléportation ni réparation cachée.
  Un garage occupé est dégagé physiquement ; les voitures distantes restent sous leur autorité.
- **17/17 trajets**, dont sept circuits avec limites et solides réels, concurrence, second service et interruption ;
  **6/6 décisions**, **18/18 stands**, **30/30 stands-pneus**, **8/8 chaussée**.
- Nouvelle référence **p12 créée après les ciblés** : 21 scénarios / 1 375 empreintes. Reçu `CREATION-P12.json`
  dans `docs/reprise/rapports/12F4-2026-11-19/` ; comparaison déterministe et suite globale en cours.
  **Aucun résultat global 12F4 ni build 0.2.51 qualifié annoncé à ce stade.**

## Prochaine action et limites

Terminer la qualification sur les sources gelées, construire deux fois, puis publier sources/tests/build/preuves
et vérifier le distant. Conserver le reçu explicite de création de p12 ; ne modifier aucune référence p9/p10/p11.
Comparer l’échec traces hérité ; ne pas le déclarer corrigé sans preuve.

**Parties réelles entre navigateurs, WebGL, performances matérielles et déploiement non validés.**
Les essais réseau utilisent les vrais contrôleurs avec transport simulé ; le site n’est pas déclaré vérifié.
La variabilité CPU historique du décor reste une réserve distincte.

## Base publiée et demandes conservées

**12A–12F3 livrés jusqu’à 0.2.50**, livraison `9857f627`, suivi main `c8afbd49`.
PR n°3 et n°4 fusionnées : ne pas les redemander. Reçu :
`docs/reprise/rapports/12F3-2026-11-19/PUBLICATION-0250.json`.
La qualification **12F3**, distincte du lot courant, reste 104/105 suites et deux CI à 104/105, seul échec traces hérité.
Safari corrigé et clos ; FERRO **0.3.11**. Conserver les conditions de l’hôte, la manette, les FPS démo,
Faune, le téléchargement m4d135 et le transport pneus 12F3.

**7 circuits jouables**. Conserver Russie, Monaco ultra fidèle, Marseille issue d’EMPRISE avec relief mesuré,
huitième circuit de montagne distinct de Haut-Col et six destinations proposées ; aucun retrait pour tenir 16.
Ensemble : `MASTER-LISTE-CLAUDE-FABLE.md` ; détails : `docs/reprise/12-PLAN-MAITRE-RUSSIE-MONACO-PNEUS.md`
et `docs/reprise/15-SPECIALE-MARSEILLE-RELIEF.md`.

## Méthode

Un sous-lot à la fois, sorties courtes, journal et preuves dans Git. Mac/Spark/amiga indisponibles ici ; reprendre
le Spark d’abord quand l’accès revient. Les branches Mac absentes de GitHub ne sont pas livrées. Les modifications
du moteur passent par FERRO canonique. Vérifier GitHub et le site séparément.
