# BITUME — reprise courte

## Main consolidé ; plan publié

Consolidation poussée et vérifiée : `9f2246df61c6503ea8fa0f71a28813b15b17f51c`.
PR #38 puis #37 fusionnées. Les 50 références inventoriées sont conservées dans
l’historique de main : 34 secondaires déjà contenues, 15 têtes ajoutées comme parents.
Études/prototypes archivés avec leur état ; branches historiques conservées.

**0.2.66 / p15 / FERRO 0.3.15 / neuf circuits**, runtime inchangé.
HTML : 14 370 823 octets, SHA-256 `18b15fd06d758cc5cb760a6ad90697a860d0b7a03b819c92a2891033e95adf3b`.

## Prochain lot : E0 — trajectoires des gouttes

Plan complet : [PLAN-CORRECTIFS-VISUELS-2026-11-20.md](docs/reprise/PLAN-CORRECTIFS-VISUELS-2026-11-20.md).
Fiche active : [eau et vitesse](docs/reprise/EAU-VITESSE-2026-11-20.md), E0–E3.
Mesurer les trajectoires par couche et caméra, puis corriger le flux relatif : gravité
à l’arrêt, écartement et sorties visibles par les bords avec la vitesse, dans les deux vues.

Le [plan habitacle et pilote](docs/reprise/PILOTE-HABITACLE-COMMUN-2026-11-20.md)
reste préparé à H0/B0 : identité des deux habitacles, assise plus basse et bras/buste.
Premières fiches poussées : `72f92e2c761dc0ead696033e6be06cb9df891695` ; cette reprise les réconcilie.
**Plans publiés ; corrections visuelles encore à réaliser.**

## Preuves et autres travaux

- Campagne générale 0.2.66 : 159/159, run `44747519912`, tête `40774189` ; 113 images retenues inspectées.
- Réconciliation #37 : 8/8 tests ciblés, 16/16 rapports, 48/48 empreintes PNG, sans nouveau rendu.
- Dix patches de préparation se réappliquent exactement. Quatre échecs 0.2.65 et deux images aériennes refusées conservés.
- Pluie sous abri non qualifiée, bandeaux, neige, relief et 17 destinations restent dans `FILE-TRAVAIL.json`.
- FPS matériels, audio, manettes et réseau entre machines non qualifiés ; Monaco `readyForRuntime=false`.

[Publication de consolidation](docs/reprise/rapports/CONSOLIDATION-2026-11-20/PUBLICATION.json) ·
[Préparations](docs/reprise/preparations/README.md) ·
[Journal](docs/reprise/JOURNAL-AUTONOME-2026-11-20.md), entrée **016**.
Lecture minimale : ce fichier, `ETAT.json` → `etat_courant`, puis la seule fiche active.
