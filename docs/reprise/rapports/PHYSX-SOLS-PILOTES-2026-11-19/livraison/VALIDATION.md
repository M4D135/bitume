# BITUME 0.2.55 — qualification de livraison

## Résultat faisant autorité

119 suites exécutées, **117 réussies**, en 442,37 s. Deux réserves conservées : temps de création du décor et traces.
Les 235 empreintes avant/après sont identiques, ainsi que les fichiers de la copie de publication. Les 119 journaux
correspondent à leur empreinte enregistrée. Le dossier `../final/` conserve un passage ancien interrompu ; il ne
remplace pas ce bilan. Détails vérifiables : `qualification-finale.json`, `suites.json`, `empreintes-apres.json`.

## Build et moteur

Deux constructions identiques de la 0.2.55/p14 : **14 153 917 octets**, gzip 3 360 641 octets.
SHA-256 : `c9e0c3d93a4456f3d84a56317ab4282bab5deebfea942bfe5a50231459006d2f`.
Les 34 modules installés correspondent au canon FERRO 0.3.14, fusionné par PR #2 au commit `85ba9417`.
Le ZIP, les distributions et les preuves FERRO sont publiés ; l'arbre distant correspond au snapshot qualifié.
FERRO : 210 réussis, zéro échec, un TODO historique ; 25/25 contrôles PhysX. EMPRISE ciblé : 10/12 sur la base et
le candidat, deux journaux de réserve identiques. Son build complet reste indisponible faute de `city-data.js`.

## Physique et géométrie

Le déterminisme p14 rejoue le vrai WASM : deux scènes neuves par scénario, acteurs dynamiques et sol triangulé,
contrôle des appels natifs à chaque pas, perturbation d'un ULP de vitesse et variation des commandes détectées.
Huit scénarios, 141 empreintes et 4 464 poses visuelles passent ; les 19 sources de la fixture sont exactes.
Les contrôles d'anciennes versions restent étiquetés comme tels, sans être présentés comme validation de p14.

Les parcours enregistrés couvrent huit circuits pendant 120 s chacun avec douze voitures, par temps sec en été.
Aucun état invalide constaté ; un replacement après accident à Val-Brûlé. Les sources de simulation sont identiques
à celles du bilan. Ce protocole ne constitue pas huit courses complètes ni une vérification exhaustive du hors-route,
de la pluie/neige ou de toutes les collisions visuelles. Les scénarios de stands natifs sont consignés séparément.
Neuf géométries de décor de référence restent identiques.

## Réserves conservées

- **Val-Brûlé : 486 ms pour un budget de 150 ms.** Le seuil n'a pas été changé. La 0.2.54 comportait déjà des
  dépassements (152, 161 et 166 ms selon les passages). Ces mesures ne constituent pas une comparaison contrôlée
  dans le même environnement : elles ne prouvent pas l'absence de régression de durée.
- **Traces : même signature d'échec** que la réserve 0.2.54 (`ERR_ASSERTION`, `strictEqual`, valeurs réelles et
  attendues inchangées). Les fichiers de journaux complets diffèrent par l'environnement et les mesures.

Le rendu complet du jeu dans un navigateur, les FPS matériels et le déploiement du site ne sont pas validés.
La publication Git des sources, du build et des preuves reste une étape distincte, à attester dans son reçu.
