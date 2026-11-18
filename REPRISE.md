# BITUME — reprise courte

## État actuel — 18 novembre 2026

- Branche : `main`. Base du lot : `e150378d6e547a8dc1510334643c061b7cba72dc` (0.2.29).
- **Lot 08 en cours** : brume réduite, herbe au moins ×10, souffle des voitures, optimisation du rendu.
- Versions préparées : BITUME **0.2.30**, moteur **FERRO 0.3.7**. Sources à qualifier puis publier.
- Dernier code livré : BITUME `40b31d582e434b8d87379c360648997e940f6d64`, FERRO `7d7f1018db33632ae448e6fd6e0b4f6b6f8fe5d1`.
- Fiche unique à lire : `docs/reprise/08-HERBE-SILLAGE-BRUME.md`.
- Premier contrôle : sillage/brume et jonction météo réussis ; qualification finale à faire.
- Limite : Chromium échoue avant DevTools ; aucune nouvelle image ni mesure FPS GPU réelle.
- Déploiement autorisé depuis le Mac ; accès Mac/amiga indisponible ici.

## Prochain petit lot

Finir et qualifier ce lot. Publier FERRO avant BITUME, avec sources et build. Depuis le Mac, contrôler le rendu puis `./deposer.sh` et l'empreinte servie.

## Méthode pour garder le contexte court

1. Lire ce fichier, `docs/reprise/ETAT.json` et les consignes applicables. Vérifier les têtes distantes avant toute écriture.
2. Lire seulement la fiche active et les extraits de source utiles ; jamais tout l'historique ni le HTML généré.
3. Un lot borné à la fois ; sorties complètes sur disque et résumés courts dans le chat.
4. Après qualification : commit/push sans forcer, vérifier la tête, actualiser ce point court.

Historique dans `docs/reprise/archives/` et dans Git ; l'ouvrir seulement pour une question précise.
Un commit publié ne prouve pas que le site public a été déployé.
