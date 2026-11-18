# Lot 08 — herbe dense, souffle des voitures et horizon lisible

## Demande du 18 novembre 2026

Réduire la brume lointaine, multiplier la densité d'herbe par dix au minimum, faire réagir les herbes au passage des voitures et optimiser le moteur. La capture fournie montre une course pluvieuse et des accotements clairsemés.

## Base et responsabilités

BITUME `main` : `e150378d6e547a8dc1510334643c061b7cba72dc`, 0.2.29.
FERRO `main` : `7d7f1018db33632ae448e6fd6e0b4f6b6f8fe5d1`, 0.3.6.
Versions préparées : BITUME 0.2.30 et FERRO 0.3.7, à qualifier avant publication des sources.

- Jeu : graminées regroupées en maillages instanciés, densité mesurée en brins réellement construits, petites tuiles et géométrie distante allégée.
- Moteur : sources de vent locales bornées, déformation GPU commune aux passes couleur/ombres et aux deux backends. Aucun parcours CPU par brin.
- Jonction : sources de voitures réutilisées entre les images et les vues ; le flux suit la vitesse signée, indépendamment de la dérive de la caisse.
- Brume : densité d'extinction ramenée à 34 % dans l'adaptateur graphique du jeu ; météo et décor de référence conservés.
- Optimisation : cache de visibilité/LOD commun aux passes, préparation des vues sans allocations par lot, coût visible comparé à la base.

## Contrôles attendus

1. Densité High et Ultra au moins dix fois supérieure à 0.2.29 sur les trois biomes ; contrôle des brins, de l'occupation et des exclusions piste/stands/tunnel.
2. Racines ancrées au sol, déplacement au passage, extinction après arrêt, continuité des niveaux de détail ; mêmes mouvements dans les ombres.
3. Buffers et sources partagés entre J1/J2 et rétroviseurs, bornés même avec toutes les voitures.
4. Tests moteur, génération GLSL/WGSL, verrou 34/34, suites jeu et build reproductible.
5. Mesures CPU et de soumission séparées des FPS réels ; validation visuelle et FPS matériels seulement avec un navigateur capable de charger le jeu.

## Point de contrôle intermédiaire

Les sources sont en chantier. Les tests ciblés de sillage/brume et météo passent déjà. Un essai Chromium du build de base échoue avant DevTools : socket interdite ; aucune image ni mesure GPU acquise. Le compilateur de shaders est restauré dans le moteur pour produire les fichiers générés à partir du GLSL canonique.

Publier le moteur qualifié avant le jeu. Déploiement déjà autorisé depuis le Mac via `./deposer.sh` ; l'accès Mac/amiga reste indisponible ici. Garder `REPRISE.md` court et ne lire que cette fiche pour ce lot.
