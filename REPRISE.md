# BITUME — reprise courte

## Lot actif — Monaco 14A, relevés et registre contrôlé

Le jeu **0.2.60 / p14 / FERRO 0.3.15** est livré et clos : PR #20, reçu
`docs/reprise/rapports/REALISME-2026-11-19/PUBLICATION-0260.json`. Ne pas refaire cette livraison.
Le sous-lot actuel ajoute des données de préparation et des outils ; **aucune nouvelle course jouable**.
Lire `docs/reprise/ETAT.json`, puis `docs/reprise/MONACO-MESURES-2026-11-20.md`.

## Résultat local, prêt à publier

Deux acquisitions IGN sur les mêmes **415 points OSM**, soit **830 observations de terrain**,
avec requêtes, réponses, dates et empreintes figées. Les métadonnées WFS rattachent les 415 points
à deux dalles LiDAR, système vertical IGN69, relevés de mai–juin 2021. La date HTTP de 2026
n'est pas présentée comme la date de mesure de la chaussée.

Le croisement indépendant retrouve exactement les valeurs et rattachements de l'importeur :
**32 points avec un écart supérieur à 1 m**, maximum **25,23 m** dans un secteur tagué tunnel.
Ces écarts sont diagnostiques : le datum et la date individuels du RGE ne sont pas établis.
Les 33 points tagués tunnel et les fortes variations locales sont isolés pour la revue.

**26/26 contrôles ciblés passent** (20 nouveaux, 6 de la reconnaissance historique), trois fichiers.
La génération hors réseau et `--check` concordent. Les six fichiers de référence OSM, le runtime,
la version et le HTML restent identiques. La campagne locale 0.2.60 et son build ne sont pas relancés.
Qualification : `docs/references/monaco-2026/qualification-mesures.json`.
La CI de cette nouvelle préparation reste à constater à la publication, séparément du résultat local.

## Ce qui reste ouvert

**Zéro observation n'est qualifiée comme chaussée.** Les 415 valeurs `y`, les largeurs gauche/droite
et les dévers du tracé restent `null` ; `readyForRuntime` reste faux. Une altitude de MNT ne donne
pas le niveau d'une route couverte ou portée par un ouvrage. Une résolution de 50 cm ne constitue
pas une précision vérifiée de 50 cm. La largeur FIA isolée ne devient pas une largeur constante.

Après publication de ce sous-lot, examiner les points signalés et acquérir des mesures de chaussée,
limites de course et portails, datées et assorties d'incertitudes. Ne pas réacquérir la boucle OSM déjà
résolue ni corriger son écart de −13,390 m par une mise à l'échelle. La politique saisonnière et
l'intégration de course suivent les données. **14A complet n'est pas clos.**

## Programme et limites conservés

**17 destinations prévues, 8 jouables** ; Marseille, montagne distincte de Haut-Col, six propositions
et lots transversaux restent dans `docs/reprise/CONTINUATION-AUTONOME-2026-11-19.md`.
Réserve de durée 0.2.60 : **188 ms Val-Brûlé, 154 et 167 ms Haut-Col**, seuil inchangé 150 ms.
Jeu complet en navigateur, manettes physiques, essais entre réseaux et FPS matériels restent à valider.
Aucun accès Mac/VPS : **site non déployé depuis cet environnement**. Spark absent ici ; aucun calcul
ne lui est attribué. Un sous-lot à la fois, publications et reprises courtes, pas de push forcé.
