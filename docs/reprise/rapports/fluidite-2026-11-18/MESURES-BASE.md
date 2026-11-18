# Fluidité — mesures de base (BITUME 0.2.38, avant modification)

Date : 18 novembre 2026. Machine : MacBook Air, Apple M5 (10 cœurs), écran intégré 2880 × 1864 à 60 Hz, sur secteur.
Navigateur : Google Chrome 157, ANGLE Metal. Page mesurée : `dist/bitume.html` du commit `baf4ddf`
(SHA-256 `46a0b0af…d78d9b`). Outil : `tools/profil-accrocs.mjs` (nouveau). Rapports bruts : `mesures-base/*.json`.

## Ce que chaque mode de mesure prouve

| Mode | Prouve | Ne prouve pas |
|---|---|---|
| Chrome sans interface, GPU réel | Accrocs du fil principal et du processus graphique, ramasse-miettes, compteurs du moteur (triangles, appels) | La cadence d'un écran réel : sans présentation, 16,7 ms tiennent même quand le GPU est saturé |
| Chrome avec fenêtre visible | La cadence réellement affichée | — |
| Rendu logiciel (SwiftShader) | Les accrocs de première utilisation (amplifiés) | Aucune performance de GPU réel |
| Processeur ralenti ×4 ou ×6 (CDP) | Le coût du JavaScript sur une petite machine | Le GPU, qui n'est pas ralenti |

Deux pièges relevés :
- le volet de mesures (`BITUME_JEU.mesures = true`) ouvre le chronomètre GPU du moteur (`rendu.profile`). Ses requêtes
  `TIME_ELAPSED` faussent les temps sur une puce Apple (passes coupées, autre contexte compté) et coûtent elles-mêmes ;
- sous 20 % de batterie, Chrome passe en économie d'énergie et bride l'affichage à 30 images par seconde.
  `profil-accrocs.mjs` coupe ce bridage dans son profil jetable (`--economie oui` pour le garder).

## Cadence réellement affichée (fenêtre visible 1440 × 757 points, densité 2, volet de mesures fermé)

Séance de référence, Val-Brûlé, 75 m/s, vue cockpit, 5 s mesurées après 2 s.

| Réglage | Toile | Triangles par image | p50 | p95 | Images au-delà de 1,5 période |
|---|---|---|---|---|---|
| Fine | 2880 × 1514, MSAA 4× | 4,9 M | 16,7 ms | **33,4 ms** | **60 sur 239 (25 %)** |
| Fine, rétroviseurs peints | 2880 × 1514, MSAA 4× | 4,9 M | 16,7 ms | 17,3 ms | 0 sur 300 |
| Moyenne | 1440 × 757, MSAA 4× | 2,5 M | 16,7 ms | 16,8 ms | 0 sur 301 |

| Fine, pluie (reflets) | 2880 × 1514, MSAA 4× | 4,5 M | 16,7 ms | **33,4 ms** | **77 sur 222 (35 %)** |
| Fine, pluie, rétroviseurs peints | 2880 × 1514, MSAA 4× | 4,5 M | 16,7 ms | 33,2 ms | 19 sur 281 (7 %) |
| Moyenne, pluie | 1440 × 757, MSAA 4× | 2,3 M | 16,7 ms | 17,2 ms | 0 sur 300 |
| Fine, vue de poursuite | 2880 × 1514, MSAA 4× | 4,4 M | 16,7 ms | 16,8 ms | 0 sur 300 |
| Fine, à deux (haut et bas) | 2 × 2880 × 758, MSAA 4× | 4,5 M par vue | **33,3 ms** | 33,4 ms | cadence tenue à 30 images par seconde |

En Fine, la machine rate une image sur quatre : c'est la saccade ressentie. Les images des rétroviseurs (second
moteur, second contexte WebGL, 0,5 à 2,1 M de triangles pour une toile de 495 × 150 pixels) font la différence.
Sous la pluie les reflets s'y ajoutent ; à deux, la machine ne tient que la moitié de la cadence de l'écran.

## D'où viennent les triangles (Fine, Val-Brûlé, ombres comprises)

| Sous-ensemble dessiné | Triangles par image |
|---|---|
| Tout | 4,23 M |
| Sans aucun lot (voitures, habitacle, nappes) | 0,51 M |
| Lots de tronçon seuls (38 lots : glissières, poteaux, 1 082 feuillus) | 4,10 M |
| Prairie seule (2 353 lots d'herbe) | 0,61 M |
| Tous les lots dans leur version lointaine, sans herbe | 2,95 M |

Les arbres font l'essentiel : un feuillu Fine compte 2 022 triangles en version proche et 1 410 en version lointaine
(conifère : 3 702 et 2 514 ; palier Moyenne : 1 074 et 810). La bascule se fait à 520 m (760 m en Fine), où un arbre
de 7 m tient en une dizaine de pixels.

## Accrocs mesurés

Sur le M5, GPU réel, sans interface (60 Hz synthétique) :

| Scénario (chemin réel du joueur : titre, préparation, départ) | En course, après 2 s | Première image du départ |
|---|---|---|
| Val-Brûlé, Fine, soleil | p95 16,8 ms, pire 16,8 ms | 150 ms |
| Idem, processeur ralenti ×4 | p95 16,8 ms | 417 ms |
| Haut-Col, Fine, pluie | p95 16,8 ms | 150 ms |
| Idem, processeur ralenti ×4 | p95 16,7 ms | 483 ms |
| Cap-Séquoia, Fine | p95 16,7 ms | 117 ms |
| À deux, Val-Brûlé, Fine | pire 33,4 ms (4 images) | 167 ms |
| Lande-Noire, Auto, processeur ralenti ×4 | p95 16,8 ms | 250 ms |

La première image contient la création du moteur des rétroviseurs (compilation et liaison de ses shaders avec lecture
synchrone des statuts, copie du décor), la faune, les effets de saison et les cibles du moteur principal.

Rendu logiciel (amplificateur), Val-Brûlé, Légère, 640 × 360 : image nominale 133 ms ; accrocs de première
utilisation en pleine course à 1,5 s (**1 383 ms**), 1,9 s (400 ms), 2,3 s (383 ms), 2,8 s, 3,0 s, 5,7 s (433 ms),
12,2 s et 17,5 s. Haut-Col, Moyenne, pluie, 480 × 270 : 1 517 ms à 1,5 s, 583 ms à 9,3 s, 667 ms à 14,5 s.
Ce sont les compilations paresseuses du pilote au premier tracé : rien ne chauffe le rendu avant le départ.

Ramasse-miettes en course (M5) : 4 à 6 ramassages mineurs par seconde, 0,9 à 2,1 ms chacun ; 2,2 à 3,5 ms avec le
processeur ralenti ×4. Aucun ramassage majeur sur 20 s.

Temps du fil principal par image (M5, Fine, cockpit) : boucle 2,3 à 2,9 ms (simulation 0,3 ms, rendu principal 0,7 à
1,2 ms) ; ×4 : 7,3 à 8,5 ms ; à deux : 4,0 ms.

## Détection graphique du premier lancement

Sur ce M5, sans interface : profil retenu **Légère**. Mesures : cadence d'écran relevée 33,3 ms ; Moyenne refusée
pour un temps GPU de 43 ms au 95e centile ; Légère acceptée (12,8 ms). Le temps GPU vient du chronomètre du moteur,
dont le coût et l'imprécision sur puce Apple sont décrits plus haut : le verdict ne reflète pas la machine, qui tient
Moyenne à 60 images par seconde sans une image ratée.

## Suite de vérification avant modification

66 suites Node sur 66 réussies ; 34 modules FERRO 0.3.9 conformes au verrou.
