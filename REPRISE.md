# BITUME — reprise courte

## Correctif actif : badge FPS, candidat 0.2.75

La **0.2.74 (PR 50) reste bloquée** : le badge FPS recouvre le gant gauche de
75,62 px² en virage maintenu à +0,35. Les huit PNG reçus conservent ce constat ;
le virage gauche n’a pas démarré après une erreur Chrome. Les deux CI sont vertes :
179 suites Node et huit tests Python chacune, 3 935 fichiers/modes exacts.
[Réception et images conservées](docs/reprise/rapports/COCKPIT-PLUIE-2026-11-20/reception-0274/RECEPTION-0274.json).

La **0.2.75** remonte le badge sous le classement dans le petit cockpit paysage,
sans réduire les textes ni masquer le compteur. Les contrôles stabilisés exigent
sa présence ; les 120 pas, annonces actives et seuils restent conservés.
Branche : `codex/bitume-0275-fps-cockpit-20261121`. HTML : **14 511 184 octets**,
SHA256 `a19ec4e8ee7f5c9c672cf27ac780c14ab3ebec126d2b80939c025e602594e225`.
Deux reconstructions identiques, 34 modules FERRO conformes, **61 contrôles ciblés**.
[Construction et limites](docs/reprise/rapports/COCKPIT-PLUIE-2026-11-20/candidat-0275/BUILD-0275.json).

Recevoir CI/archives et les dix PNG exacts avant fusion : petit duo J1/J2,
compacts et les deux virages maintenus, avec le badge FPS présent. La mesure
préparatoire donne zéro recouvrement sur huit poses, mais ne vaut pas capture.
Les annonces restent sur **Non** au premier lancement et les choix enregistrés
sont conservés. PR 43 et travaux parallèles préservés. Aucun déploiement du site.

## Publié sur main : 0.2.69

**0.2.69 / p15 / FERRO 0.3.15 / neuf circuits.**
[PR #42](https://github.com/M4D135/bitume/pull/42) fusionnée normalement :
`89aa13299221ebc8b5f0474ae5a662680dd6fe32`, arbre `18b147cb`, identique
au candidat `7a8a53e` et à l’archive CI reçue. Les PR #40 et #41 sont fusionnées
par la même intégration ; leurs branches et leurs commits sont conservés.
HTML : **14 472 625 octets**, SHA256
`bd1e5c2eeb45638dac825c9c49f5ae52f6136cbb1785f4bca76adce771d86a10`.
[Reçu de publication](docs/reprise/PARALLELE-2026-11-20/rapports/00-PUBLICATION-0269.json).

## Livré et vérifié

Pilote/habitacle commun et Troll J1/J2, menu arcade jusqu’au départ, saisons S1
sur les neuf circuits. Les matières M1 restent exclues. Les raccords sont dans
le jeu construit ; ne pas réappliquer les patches historiques.

- **CI PR 44803603591 réussie : 176 suites Node, 8 tests Python.** Archive reçue :
  **3 777 fichiers et modes identiques**, HTML et empreinte sources conformes.
- Build reconstruit deux fois à l’identique ; verrou FERRO et ses 34 copies conservés.
- **49 PNG assemblés inspectés**, huit groupes réussis dans CI 44801007532 ;
  19 parcours du menu, dont 14 images bureau/portrait/paysage.
- **T3 J1/J2 clos** sur le même HTML : CI 44795943660, 5 080 poses, 26 PNG inspectés.
  Les deux tests caméra sont compris dans les 19 contrôles d’intégration.

La première CI avait sept bancs anciens incomplets. Ils ont été réconciliés avec
les vrais modules, les conditions au départ et la géométrie commune : 90 contrôles
ciblés réussis, comparaison stricte de 134 groupes dans deux configurations.
Aucun changement du runtime lors de cette correction.
[Preuves et diagnostics](docs/reprise/PARALLELE-2026-11-20/preuves/00-assemblage-0269/RECEPTION.json).

## Réserves ouvertes

**Budget décor :** le push parallèle 44803588903 finit à **175 suites réussies,
1 échec**, après la fusion : Val-Brûlé prend **172 ms affichés** pour un seuil
strict de **150 ms**. La même suite passe en PR sur l’arbre identique, sans
enregistrer les durées individuelles. Cause non déterminée ; seuil conservé,
aucune relance pour effacer ce résultat. Il s’agit d’un appel de construction
CPU sans options, pas d’une mesure de FPS ou de préparation complète de séance.

**Lisibilité cockpit :** le volant masque une partie centrale de la chaussée
depuis les vrais yeux du pilote, surtout en paysage. Les tests de projection
ne vérifient pas cette occultation. Les images LOD lointaines attestent la
silhouette (25–30 pixels), pas les détails des bras. Les acquis T3 sont conservés.

Les préférences Troll sont négociées en ligne ; les événements geste/son ne sont
pas synchronisés entre machines, ce que l’écran avant course indique. FPS
Xbox/Intel, manettes physiques, écoute humaine et réseau réel restent non qualifiés.
La mission a publié sur GitHub ; aucun déploiement du site n’a été déclenché.

## Suite et historique

Le suivi de visibilité cockpit et l’alerte de budget décor restent à traiter
avec des mesures comparables. Les optimisations moteur, M1, la pluie sous abri
et les autres destinations restent dans [FILE-TRAVAIL](docs/reprise/FILE-TRAVAIL.json).
[Répartition parallèle](docs/reprise/PARALLELE-2026-11-20/README.md) : 00 conserve
les raccords/publications ; états propriétaires 01–05 préservés.

Eau 0.2.68 reste close, avec ses preuves et échecs historiques. Sources Monaco
et Marseille reçues ; ces circuits ne sont pas encore jouables.
[Publication 0.2.68](docs/reprise/rapports/EAU-VITESSE-2026-11-20/PUBLICATION-0268.json) ·
[Réception 05](docs/reprise/PARALLELE-2026-11-20/rapports/00-RECEPTION-05.json).

[Journal](docs/reprise/JOURNAL-AUTONOME-2026-11-20.md), entrée **037**.
Lire ce fichier, `docs/reprise/ETAT.json` → `etat_courant`, puis la fiche active.

## Demandes ajoutées : vidéo arcade et survol de course

[Liste détaillée du 20 novembre](docs/reprise/DEMANDES-VIDEO-ARCADE-SURVOL-2026-11-20.md) :
transitions continues entre vues, virages inclinés, panneaux de virage clignotants,
bandeaux LED informatifs, hélicoptères visibles et drones repris de METAL.
La vidéo exacte a été examinée ; les sources procédurales des drones sont identifiées.
Six lots sont ajoutés à FILE-TRAVAIL, tous **planifiés, non livrés**. Les travaux cockpit/pluie,
la réserve décor et les demandes précédentes restent suivis séparément.

Réserve tardive 0.2.71 : la CI PR `44825452386` termine à **178/179** suites,
Val-Brûlé **168 ms** pour un seuil strict de **150 ms**. Son archive de
3 901 fichiers/modes est identique à la CI push verte ; les huit tests Python
sont sautés en PR après cet échec. Résultat conservé, sans changer le seuil.
