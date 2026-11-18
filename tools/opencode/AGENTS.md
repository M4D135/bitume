# Règles

- Tu travailles seulement dans le dossier où tu es lancé. Tu ne lis ni n'écris rien ailleurs.
- Pas de réseau, pas de serveur, pas d'installation de paquet. Tu ne committes pas.
- BITUME : jeu de course dans une seule page HTML, modules `src/*.js` écrits
  `(function (B) { … })(globalThis.BITUME = globalThis.BITUME || {})`, exécutables dans Node pour les tests de
  `verifications/*.test.mjs` (`node verifications/<nom>.test.mjs`). Aucun fichier d'image ni de son, aucune dépendance.
- La simulation est déterministe : ne change aucun résultat de `src/conduite.js`, `src/course.js`, `src/circuit.js`.
- Ne modifie que les fichiers nommés par la consigne. N'affaiblis aucun contrôle pour faire passer un test.
- Commentaires en français, qui disent le pourquoi. Tu dis ce que tu as vérifié, comment, et ce que tu n'as pas vérifié.
