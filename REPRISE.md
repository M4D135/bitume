# BITUME — reprise courte

## 0.2.88 — réception du fondu des animaux

Main observé : **0.2.85**, `7fb5dcc`. Candidat : **0.2.88 / p15 / FERRO 0.3.16**,
branche `codex/bitume-faune-fondu-0288-20261122`, depuis `5eefd967`.

La .87 reste refusée : les PNG montrent une perte de modelé dès le début du fondu,
malgré 203 suites Node et 8 tests Python réussis. Ses démos et sa proximité corrigée
ont terminé avec succès ; les reçus anciens restent historiques.

La .88 importe les **34 modules canoniques** FERRO `eda17f82`. Les corps animaux
gardent leur matière et leur éclairage dans la passe opaque ; `opacity` réduit
progressivement leur couverture. Les souffles restent des effets transparents,
avec remise à zéro après un changement de niveau de détail. La seconde réserve FX
des corps est supprimée. Physique et démos conservées.

Construction reproductible et **5/5 suites ciblées** réussies. FERRO : **4/4 contrôles
opacité**, **120 comparaisons par défaut + 28 opacités EGL** réussies ici.
Les reçus canoniques 217 réussites/1 TODO et EMPRISE sans nouvel échec sont vérifiés.

[Reçu du candidat](docs/reprise/rapports/FAUNE-DEMOS-2026-11-21/reception-0288/CANDIDAT-0288.json)
· [Fiche](docs/reprise/FAUNE-PROCHE-DEMOS-CIRCUITS-2026-11-21.md)

## Suite immédiate

1. Recevoir CI complète et PNG exacts : fondu low/high jour/nuit, proximité et démos.
2. Inspecter .799/.801, disparition et retour ; les tests structurels ne valent pas réception visuelle.
3. Corriger tout refus, puis publier le candidat qualifié sur main et vérifier la publication.
4. Conserver PR 43, essais matériels Xbox/iOS et les autres lots ; poursuivre ensuite Larche → Vinadio L3/L4.

Aucun déploiement du site ni FPS matériel annoncé par cette préparation.
