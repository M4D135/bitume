# Séries visuelles du pilote 0.2.25

Huit scénarios, 112 images calculées, zéro erreur JavaScript et zéro alerte automatique. Les rapports conservent les mesures de chaque image ; le dépôt conserve 24 images représentatives et une galerie par scénario. Les séquences complètes sont reproductibles avec `tools/controle-visuel.mjs`, suivant les paramètres des rapports.

L’inspection humaine assistée a porté sur forêt avant/après, pluie, intérieur/sortie du tunnel, les deux dispositions duo et portrait. Elle ne conclut ni sur la fluidité matérielle ni sur toutes les transitions LOD. Les FPS inscrits sur les captures proviennent de l’horloge de test et ne sont pas des mesures de performance.

Le débordement du HUD observé dans la série portrait initiale est corrigé dans le build final ; les preuves de la correction sont dans `../hud-final/`. Les captures initiales restent inchangées pour garder la trace du défaut.
