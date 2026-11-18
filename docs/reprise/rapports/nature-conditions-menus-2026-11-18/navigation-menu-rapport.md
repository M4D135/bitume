# Navigation des menus — 18 novembre 2026

Sources gelées après 11 contrôles Node et revue croisée en lecture seule. Aucun navigateur utilisé.

## Contrat d’intégration

- `B.navigationMenu.initialiser(zone)` à chaque entrée d’écran : écouteurs locaux uniques, état des manches remis au neutre.
- `ouvrirOnglet(zone, id, focus=false)` garde `hidden`, `aria-selected`, `aria-labelledby` et le tabindex des onglets cohérents.
- `naviguer(zone, nouveau, {pad, temps, retour, activer})` reçoit le Gamepad brut, le prédicat de front existant et un temps en millisecondes. Retour booléen : geste consommé.
- `activer` est le rappel de son/gestuelle, sans clic supplémentaire. Le module possède le clic ou les événements input/change.
- Le jeu conserve Start/pause, la garde hors course et le retour propre à chaque écran. B en pause doit rappeler `basculerPause()`.

## Comportement

Haut/bas parcourt les groupes et retrouve le choix sélectionné. Gauche/droite modifie un radio, une carte, une case, un select ou un curseur ; les curseurs restent bornés. A valide sur front, B revient, LB/RB changent l’onglet. Le stick a une zone morte de 0,55 avec hystérésis à 0,35. Croix/stick : répétition après 360 ms, puis toutes les 95 ms, sans rattrapage en rafale. Une direction tenue depuis la conduite attend le neutre à l’entrée du menu. Les gestes simultanés de deux manettes sont réunis sur 60 ms pour éviter deux clics opposés.

Les éléments cachés, inertes et désactivés sont exclus. Les radios transparents utilisent leur étiquette visible. Le focus défile au plus près sans animation et pose `data-manette=true`, retiré à la souris ou au clavier. Les onglets acceptent aussi flèches/Home/End au clavier ; Entrée/Espace gardent leur clic natif. Aucun écouteur global et aucun parcours DOM/layout sur une image sans geste.

## Qualification et limites

11 contrôles du module de production sur frontière DOM contrôlée : onglets/ARIA, clavier natif, groupes, événements radio uniques, curseurs décimaux/bornes, options désactivées, A/B, maintien, neutralisation du stick, deux manettes, absence de requêtes DOM au repos. La revue croisée de locate_reprise n’a trouvé aucun défaut concret. Ces preuves ne qualifient ni le rendu CSS ni une manette physique. Voir `navigation-menu-final.log` et `navigation-menu-verification.json`.
