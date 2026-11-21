# BITUME — reprise courte

## Priorité utilisateur — poste de conduite, 21 novembre

**Le cockpit .75 est refusé.** Reprise en cours dans la
[fiche 312 T5](docs/reprise/COCKPIT-312T5-2026-11-21.md) : volant et colonne,
planche arrondie, rétros bas, champ **70° verticaux par défaut**, pluie/neige calmes dos au vent,
trois klaxons refaits. Même géométrie intérieur/extérieur ; candidat **0.2.76 construit localement**, CI et images WebGL en attente.
Le lot décor est en pause, son diff reste isolé. Ne pas reprendre l’ancienne clôture
HUD comme une approbation du cockpit : David l’a explicitement rejeté.

## Publié sur main — 21 novembre 2026

**0.2.75 / p15 / FERRO 0.3.15 / neuf circuits.**
[PR #51](https://github.com/M4D135/bitume/pull/51) fusionnée :
`b1e5e98b9029f6254b86dcfb49780883315a9418`, arbre `2d019e71`, identique
au candidat `5d59cae`. [Reçu final et preuves](docs/reprise/rapports/COCKPIT-PLUIE-2026-11-20/reception-0275/PUBLICATION-0275.json).

- Deux CI exactes réussies : **179 suites Node, zéro échec et huit tests Python chacune**.
  Chaque archive contient **3 988 fichiers et modes identiques** au candidat.
- **10 PNG / cinq groupes reçus et inspectés** : petit duo J1/J2, compacts et
  braquages maintenus à **−0,35 et +0,35, 120 pas par pose**. Badge FPS présent
  et dégagé ; glaces, commandes, chaussée et annonces conformes dans ces cas.
- HTML : **14 511 184 octets**, SHA256
  `a19ec4e8ee7f5c9c672cf27ac780c14ab3ebec126d2b80939c025e602594e225`.

Le cockpit commun, les rétros et la pluie embarquée sont publiés avec les
correctifs HUD. « Planche seule » et les textes sont conservés. Annonces sur
**Non** au premier lancement ; choix déjà enregistrés conservés. Aucun déploiement du site.

## En pause : budget CPU du décor, propriétaire 04

La réserve reste **ouverte** : diagnostic local **151,87 / 138,20 / 141,13 /
84,43 / 85,68 ms**, soit un échec au seuil strict **< 150 ms**. Aucun gain prouvé.
Les dépassements historiques **172 / 152 / 168 / 155 ms** restent conservés.
[Diagnostic et piste préparée](docs/reprise/rapports/COCKPIT-PLUIE-2026-11-20/reception-0275/diagnostic-decor/DIAGNOSTIC.json).

Un diff isolé évite **19 323 couples temporaires** ; comparaison interrompue
à **82/117 cas**, aucun écart dans ces seuls cas. Aucune mesure alternée ni intégration.
Corriger d’abord le chargement CommonJS du banc avant de reprendre les mesures.

## Travaux et limites conservés

PR 43 (pluie sous abri), chantiers parallèles 01–05 et états propriétaires préservés.
Saisons S1, menu arcade et Troll acquis ; matières M1 encore séparées. Monaco et
Marseille restent des sources, sans nouveau circuit jouable. Les six demandes
[vidéo arcade et survol](docs/reprise/DEMANDES-VIDEO-ARCADE-SURVOL-2026-11-20.md) restent planifiées.
FPS Xbox/Intel, manettes physiques, écoute et réseau réel ne sont pas qualifiés.
Les événements Troll distants ne sont pas synchronisés ; limite affichée avant course.

Les échecs .70–.74 et la publication .69 restent dans la
[fiche cockpit/pluie](docs/reprise/COCKPIT-PLUIE-2026-11-20.md) et le
[reçu .69](docs/reprise/PARALLELE-2026-11-20/rapports/00-PUBLICATION-0269.json).
Reprendre `docs/reprise/ETAT.json` → `etat_courant`, puis la fiche active et
[FILE-TRAVAIL](docs/reprise/FILE-TRAVAIL.json). [Journal](docs/reprise/JOURNAL-AUTONOME-2026-11-20.md), entrée **040**.
