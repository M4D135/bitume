# Raccordements entre discussions

Chaque rôle crée son fichier NN.md sur sa branche. 00 les reprend et décide l'intégration. Ce dossier évite les écritures concurrentes dans jeu.js, construire.py et les autres fichiers partagés.

Format court : base/HEAD du module ; fonction ou point d'appel existant ; entrées/sorties et valeurs par défaut ; ordre de chargement ; moment d'appel et consommation unique éventuelle ; comportement absent/désactivé ; tests/captures requis ; patch proposé limité au raccord.

Ne pas déclarer un raccord intégré avant le commit du coordinateur. Ne pas changer silencieusement une interface déjà consommée par un autre lot : signaler la compatibilité et garder une transition quand nécessaire.
