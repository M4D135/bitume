# Préparation mécanique des miroirs — non intégrée

Base exacte : `02afea62e9241704bd1ec0a679fe268e0f6db08f` (candidat .76 refusé).
Le patch conserve le travail isolé : inclinaison mécanique +0,10 rad des boîtiers et
faces, repère commun aux coins et au calcul de cadrage, oracle de réflexion réel.
Il contient les modifications de `voiture.js`, `jeu.js` et le nouveau test.

Contrôles : oracle 3/3, témoin .76 3/3 refusé, visibilité 7/7 et mécanique 4/4.
Les sources exactes et journaux sont indiqués dans le reçu. Aucun build .77,
aucune intégration au runtime livré et aucune nouvelle capture WebGL de ce patch.

Cette préparation concerne les ancrages du candidat .76. **La future 126 CK a une
implantation à reprendre depuis les références : ne pas appliquer les cotes ou
l'angle sans vérifier ses nouvelles positions.** Conserver le principe de reflet
et les contrôles, puis requalifier le résultat dans le modèle demandé.
