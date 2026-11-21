# BITUME — reprise courte

## Réception de la 0.2.87 — faune proche et démos

Base main : `7fb5dcc` / .85. Physique p15 et FERRO 0.3.15 conservés.
Le candidat autorisé `4200e03` est publié sur GitHub sous `dbda6a7` :
**même arbre exact** `49fffaac9612fc407eff02c3b608ce93b7d57b99`.
HTML .87 : `d11860da1224be393a24f7d6873f466ad5448b0984e6569887c135c02e6ff9ff`.

- Faune proche de la route, sommeil hors des vues utiles, J1/J2 et rétros actifs.
- Démonstrations des neuf circuits centrées sur route, tracé et lieu.
- Fondu de portée ajouté en .87 ; aucun changement de conduite ni de moteur.
- Qualification locale : 203/203 suites Node et 8/8 contrôles Python.
- CI distante `44952214196` en cours. Démonstrations `44952214169` :
  81 images des neuf circuits inspectées, sans refus ; sécurité reçue, météo en cours.

La première capture de proximité a correctement refusé high/low : le banc
plaçait les états de conduite près d’un habitat mais laissait les corps PhysX
sur la grille. La branche complémentaire corrige uniquement cet outillage,
demande le replacement natif avant chauffe et contrôle le placement réel.
Le témoin Faune désactivée réussit. Ne pas recevoir les images high/low initiales.

Branche complémentaire : `codex/bitume-faune-demos-reception-0287-20261121`.
Elle ajoute le contrôle visuel du passage opaque/FX, low/high, jour/nuit,
et conserve le HTML .87 à l’identique. Réception de ces pixels avant main.

[Reçu distant](docs/reprise/rapports/FAUNE-DEMOS-2026-11-21/RECEPTION-DISTANTE-0287.json)
· [Fiche](docs/reprise/FAUNE-PROCHE-DEMOS-CIRCUITS-2026-11-21.md)

## Suite

1. Recevoir CI, neuf démos, faune proche corrigée et transition de distance.
2. Corriger tout refus réel, puis intégrer le candidat qualifié sur main.
3. Conserver essais matériels Xbox/iOS et autres lots ; aucun FPS matériel annoncé.
4. Larche → Vinadio : L3/L4 puis sa démo lors de l’entrée au catalogue.
