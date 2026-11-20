# BITUME — reprise courte

## Correctif actif : HUD compact, candidat 0.2.72

La **0.2.71 (PR 47) ne doit pas être fusionnée** : en 960 × 540, le classement
recouvre le gant gauche en braquage et le régime des compteurs complets recouvre
la main droite au neutre. Carte et annonce sont bien présentes dans les PNG.
La CI push passe **179 suites Node et huit tests Python** ; les **3 901 fichiers**
de son archive sont identiques au commit `6a708e2`.
[Constat et images des deux défauts](docs/reprise/rapports/COCKPIT-PLUIE-2026-11-20/ci-0271/RECEPTION-INTERMEDIAIRE.json).

Le candidat **0.2.72** corrige la largeur du classement et des compteurs sans
changer le gabarit de l’annonce, la carte ou le modèle commun de la voiture.
Branche : `codex/bitume-0272-hud-compact-20261120`. Les gardes exigent carte,
annonce et compteurs sélectionnés ; « Planche seule » conserve leur masquage.
Deux reconstructions identiques, **49 contrôles ciblés**, **34 copies FERRO**
conformes. HTML : **14 509 186 octets**, SHA256
`391db2defe23308f88500fdd138d3b8573596d1ca0f53e058ef5c66c0c510a90`.
[Construction et limites](docs/reprise/rapports/COCKPIT-PLUIE-2026-11-20/candidat-0272/BUILD-0272.json).

Recevoir la CI et les PNG de ce nouveau HTML avant fusion. Le profil 0.2.71
reste incomplet après expiration DevTools. La pluie/Troll non modifiés conservent
leurs preuves et leurs manques. PR 43 reste séparée. Aucun déploiement du site.


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

[Journal](docs/reprise/JOURNAL-AUTONOME-2026-11-20.md), entrée **035**.
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
