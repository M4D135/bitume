# BITUME — reprise courte

## État — 18 novembre 2026

- Branche unique `main`, sans push forcé ; publications fréquentes du travail réel.
- **0.2.38 publiée et vérifiée** : **`baf4ddf`**, sources, tests, preuves et jeu compilé.
- **Production conforme** : `https://bitume.estrasse.fr/` sert le même fichier, SHA-256 vérifié le 18 novembre à 14 h 47 (Paris). Aucun déploiement effectué par cette reprise.
- **Cap-Séquoia** : septième circuit, côte du Pacifique, **5 234 m**, graine 157 ; falaises, anses, océan et 320 conifères dont les troncs restent visibles au loin.
- **FPS visibles en démo** sur ordinateur et tactile ; réglage **Faune**.
- Qualification : **66/66 suites**, 11 contrôles Pacifique finaux, 11 rivaux arrivés, 24 anciens décors identiques ; deux builds identiques et **34 modules FERRO 0.3.9 conformes**.
- La reconstruction de cette reprise est identique. **WebGL et performances matérielles restent non validés** : Chromium bloque encore au démarrage (`socket(): Operation not permitted`).

## Reprendre

Lire `docs/reprise/ETAT.json`, puis uniquement la fiche du lot actif.
Le lot 11D est publié : reçu dans `docs/reprise/rapports/cap-sequoia-2026-11-18/publication.json`.
Contrôler le rendu WebGL et les FPS sur machine réelle. Prochain lot de contenu : **un seul circuit original d’Europe du Nord ou de l’Est**, cible totale de 16 circuits, 7 déjà publiés.
Conserver l’arrière de monoplace, les conditions de l’hôte, les menus manette et le lien **m4d135 → BITUME.html**.

## Méthode

Un seul lot, sorties bornées ; journaux complets sur disque ; publier le checkpoint réel, puis sources/build qualifiés et reçu.
Ne pas réappliquer le patch historique du checkpoint `896b1c8` sur la version publiée. Vérifier séparément GitHub et la page servie.
Toute modification moteur passe par FERRO canonique.
