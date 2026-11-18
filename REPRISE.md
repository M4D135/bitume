# BITUME — reprise courte

## État actuel — 18 novembre 2026

- Branche : `main`. Base du lot : `e150378d6e547a8dc1510334643c061b7cba72dc` (0.2.29).
- **Lot 08 qualifié** : brume réduite, herbe au moins ×10, souffle des voitures, optimisation du rendu. m4d135 enregistre BITUME.html.
- BITUME **0.2.31 qualifié**, publication en cours. Moteur **FERRO 0.3.7 publié**.
- Référence moteur : `0250a5750d10789976186a1491ffdf011fb19611`. Reçus exacts dans `docs/reprise/ETAT.json`.
- Fiche unique à lire : `docs/reprise/08-HERBE-SILLAGE-BRUME.md`.
- Contrôles : jeu 47/47, moteur 147 réussis + 1 TODO historique, WGSL 18/18, verrou 34/34, build identique ; lien Enregistrer revalidé.
- Limite : Chromium échoue avant DevTools ; aucune nouvelle image ni mesure FPS GPU réelle.
- Déploiement autorisé depuis le Mac ; accès Mac/amiga indisponible ici.

## Prochain petit lot

Publier BITUME avec sources et build. Depuis le Mac, contrôler le rendu puis `./deposer.sh` et l'empreinte servie.

## Méthode pour garder le contexte court

1. Lire ce fichier, `docs/reprise/ETAT.json` et les consignes applicables. Vérifier les têtes distantes avant toute écriture.
2. Lire seulement la fiche active et les extraits de source utiles ; jamais tout l'historique ni le HTML généré.
3. Un lot borné à la fois ; sorties complètes sur disque et résumés courts dans le chat.
4. Après qualification : commit/push sans forcer, vérifier la tête, actualiser ce point court.

Historique dans `docs/reprise/archives/` et dans Git ; l'ouvrir seulement pour une question précise.
Un commit publié ne prouve pas que le site public a été déployé.
