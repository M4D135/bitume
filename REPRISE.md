# BITUME — reprise courte

## Main consolidé ; plan publié

Consolidation poussée et vérifiée : `9f2246df61c6503ea8fa0f71a28813b15b17f51c`.
PR #38 puis #37 fusionnées. Les 50 références inventoriées sont conservées dans
l’historique de main : 34 secondaires déjà contenues, 15 têtes ajoutées comme parents.
Études/prototypes archivés avec leur état ; branches historiques conservées.

**0.2.66 / p15 / FERRO 0.3.15 / neuf circuits**, runtime inchangé.
HTML : 14 370 823 octets, SHA-256 `18b15fd06d758cc5cb760a6ad90697a860d0b7a03b819c92a2891033e95adf3b`.

## Lot actif : eau, candidat à terminer et qualifier

Candidat **0.2.68** construit deux fois à l’identique : 14 383 155 octets,
SHA-256 `60184ddf5226543ca3f912cc9415927989f14e4e20de3556767ced801e988aa2`.
Repli de vitesse hors PhysX corrigé : déplacement entre poses physiques au pas fixe,
sans confondre tangage visuel et montée ; 18 contrôles d’intégration conformes.
Les 112 contrôles CPU gardent leurs sources exactes et leur attribution antérieure.
**Main jouable reste 0.2.66** ; campagne générale et images du jeu final à qualifier.

[PR #39](https://github.com/M4D135/bitume/pull/39), checkpoint 0.2.67 publié `a8a2369`.
Fiche : [eau et vitesse](docs/reprise/EAU-VITESSE-2026-11-20.md).
Reçu : `docs/reprise/rapports/EAU-VITESSE-2026-11-20/CANDIDAT-0268.json`.
Terminer le suivi indépendant des motifs dans les PNG, publier la tête finale,
puis campagne générale et captures exactes par CI (Chromium local bloqué).
Les nappes sont déjà mesurées sans prédiction ; le négatif « PNG identique mais
uniformes en mouvement » a révélé un faux positif de l’ancien appariement des perles.
Le verdict final doit le refuser. Aucun contrôle incomplet n’est annoncé conforme.

Le [plan habitacle/pilote](docs/reprise/PILOTE-HABITACLE-COMMUN-2026-11-20.md)
reste préparé à H0/B0 : habitacle unique, assise plus basse et dégagement bras/buste.

## Preuves et autres travaux

- Campagne générale 0.2.66 : 159/159, run `44747519912`, tête `40774189` ; 113 images retenues inspectées.
- Réconciliation #37 : 8/8 tests ciblés, 16/16 rapports, 48/48 empreintes PNG, sans nouveau rendu.
- Dix patches de préparation se réappliquent exactement. Quatre échecs 0.2.65 et deux images aériennes refusées conservés.
- Pluie sous abri non qualifiée, bandeaux, neige, relief et 17 destinations restent dans `FILE-TRAVAIL.json`.
- FPS matériels, audio, manettes et réseau entre machines non qualifiés ; Monaco `readyForRuntime=false`.

[Publication de consolidation](docs/reprise/rapports/CONSOLIDATION-2026-11-20/PUBLICATION.json) ·
[Préparations](docs/reprise/preparations/README.md) ·
[Journal](docs/reprise/JOURNAL-AUTONOME-2026-11-20.md), entrée **018**.
Lecture minimale : ce fichier, `ETAT.json` → `etat_courant`, puis la seule fiche active.
