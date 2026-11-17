# Lot 0 : une seule branche principale

Statut : **terminé** (nettoyage des références fait après intégration et poussée). Base exécutée : `main` à `b9d8c6db3e4eff55b9f1dd05e8e74de45f2d5507`, client **0.2.19**.

## Demande

L'utilisateur veut tout réunir sur la branche principale, qu'il appelle « master », et n'avoir qu'une branche. La branche par défaut réellement observée sur GitHub est `main` (`default_branch: main`, contrôlé le 17/11/2026). Aucun doublon `master` n'a été créé.

## Inventaire vérifié le 17 novembre 2026

`git ls-remote origin` puis `git merge-base --is-ancestor` contre `origin/main` :

| Référence | Tête | Ascendance |
|---|---|---|
| `main` | `b9d8c6db3e4eff55b9f1dd05e8e74de45f2d5507` | principale |
| `archive/versions-0.2.15-0.2.18` | `247d4445e02129af3c28b242eab9783ca3fb010d` | ancêtre de `main` |
| `codex/bitume-reprise4-20261117` | `861c342bee6766f031202ecc7afa0d442d6914fa` | ancêtre de `main` |
| `codex/reconciliation-archives-20261117` | `f53c3b40e477bbe25a264b406a8acbd9fd5878e0` | ancêtre de `main` |
| `codex/bitume-suite-20261117` | `7fab6b77fe37e42369e7a936935ed79c0d8cc5f2` | ancêtre de `main` |
| `codex/reprise-bitume-20261117` | `7fab6b77fe37e42369e7a936935ed79c0d8cc5f2` | ancêtre de `main` |
| `opencode/titre-zip-signature-20261116` | `9e23cc125bdf3763bb3a515f2afd9cb035ac12e3` | **hors `main`** : deux commits propres |

PR : #1 et #2 **closed** (intégrées), aucune PR ouverte.

## Paquet de reprise : réellement absent

Le prompt annonce `BITUME-REPRISE-QWEN-SPARK.zip` (bundle `bitume-main-12dc097.bundle`, relais des lots 1 à 5, qualification lot 0). Recherche effectuée le 17/11/2026 sur le Mac (`/Users/david/Downloads`, `Documents`, `Desktop`, `Projects`, `Documents/Codex/**`, arborescence complète jusqu'à six niveaux) et sur le Spark (`/home/m4d135/**`, `/tmp`, `/mnt/data` absent) : **aucune copie**. Les archives `BITUME-RELAIS-2026-11-17.zip` et `BITUME-REPRISE-QWEN-SPARK.zip` citées par `docs/reprise/ETAT.json` étaient dans l'espace de discussion `/mnt/data/...`, qui n'existe ni sur le Mac ni sur le Spark.

Conséquence vérifiée, après `git fetch origin --prune` sur toutes les références distantes :

- `12dc0977567251e9b568b25c495c900653f0cb90`, `827c3072fbc573241441b8f2d1e100710d8619a9`, `74352fee37a1d579fa431ba4b8dfe79a04e676e5`, `a690e92bc5e6f6a22b1b708dce782208c842890b` et `e074b55` sont **absents de GitHub et de toutes les copies locales** (Mac et Spark). Ils n'ont jamais été poussés.
- La « récupération » 0.2.20 décrite par le prompt (51 suites, HTML de 12 857 043 octets) n'est donc pas récupérable : elle n'existait que dans ce paquet. Rien n'a été réinventé à sa place.
- La série locale `e074b55` reste **non retrouvée**, comme l'annonçait déjà `docs/RECONCILIATION-ARCHIVE-2026-11-17.md`.

La base de travail retenue est donc la tête distante réellement qualifiable : `main` à `b9d8c6d`, client 0.2.19.

## Contenu utile récupéré de la branche opencode

La branche partait de la 0.2.8 et comptait cinq commits de retard. Son seul apport propre est la **signature de l'écran titre** :

- `9832c3d` ajoutait la signature `m4d135` (lien GitHub pastille rouge) **et** un lien « TÉLÉCHARGER · ZIP » ;
- `9e23cc1` retirait le lien ZIP et sa feuille de style, mais laissait `<span class="m4d-pied">m4d135</span></span>`, d'où la fermeture `</span>` excédentaire signalée.

Aucun de ces deux commits n'est dans `main` : `grep` sur `src/` ne trouvait ni `m4d135` ni lien de téléchargement. Le travail a donc été **réintégré proprement** plutôt que fusionné brut (la fusion aurait écrasé onze versions de `jeu.js`, `reseau.js`, `course.js` et les suites de commandes) :

- `src/index.html` : lien `.signature` vers `https://github.com/M4D135`, pastille SVG, sans span surnuméraire, badge de version conservé à sa place ;
- `src/style.css` : règles `.signature`, `.signature:hover/:focus-visible`, `.signature svg`, alignées sur le badge de version ;
- `verifications/titre-signature.test.mjs` : 4 contrôles sur la vraie page et la vraie feuille (présence, appariement des `span`, absence du lien ZIP retiré, tenue de la feuille de style).

Écartés, sans retour possible : le lien ZIP (retiré par le second commit de la branche), et les retraits de `avecHalo`/`avecReflets` propres à l'ancienne 0.2.8, déjà corrigés dans `main`.

## Sauvegarde avant suppression

Bundle complet des sept références, créé sur le Spark puis recopié sur le Mac :

- fichier : `bitume-toutes-refs-2026-11-17.bundle`
- `git bundle verify` : « Le colis enregistre l'historique complet », sha1
- SHA-256 : `4a733d1faf1dec986d89e5bf0969a804f95f6a24463e618fd8897abbaf4fb1ef`

Aucune référence n'a été supprimée avant ce contrôle. Aucun `--force`, aucune réécriture d'historique.

## Preuves de fin

- `git ls-remote origin` après nettoyage : une seule branche `refs/heads/main`, plus `HEAD`.
- Branche par défaut : `main`.
- PR : #1 et #2 closed, aucune ouverte.
- Historiques conservés : tous accessibles depuis `main` ou depuis le bundle vérifié ci-dessus.
