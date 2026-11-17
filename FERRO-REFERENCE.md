# FERRO — référence commune 0.3.4

Décision de David du 16 novembre 2026 : entièrement procédural, aucun plafond de taille du code ni du build. Moteur prioritaire, atelier secondaire.

Référence : M4D135/FERRO, dossier src/ferro. Les 34 modules de FERRO.lock.json proviennent de cette source et doivent garder les mêmes empreintes dans les quatre jeux. Les règles et styles du jeu restent dans ses adaptateurs. Le build contrôle le verrou ; ne pas modifier les copies du moteur.

Distribution et documentation : https://github.com/M4D135/FERRO/tree/main/dist

Le paquet contient les sources, les bundles optionnels, un installateur et le contrôleur des empreintes. Les tailles sont mesurées à titre informatif.

La version 0.3.4 ajoute quatre recettes de surface opt-in et un seuil de LOD adapté à chaque caméra. BITUME définit leur usage dans `decor.js` et ses formes dans `vegetation.js` ; les modules moteur restent copiés à l’identique. Qualification et limites : `docs/reprise/rapports/LOT5-2026-11-17.md`.
