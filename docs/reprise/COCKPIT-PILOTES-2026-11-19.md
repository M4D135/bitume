# Cockpit et pilotes extérieurs — 19 novembre 2026

## Demandes de David

- Les animations du pilote conviennent ; conserver les mouvements de tête et de bras.
- En vue extérieure, le levier de vitesses traverse le cockpit, sur le joueur comme sur les concurrents.
- Le volant est également trop près du pilote dans cette vue.
- Consigner les demandes, corrections, vérifications et la reprise dans GitHub.

## Diagnostic et périmètre

Le placement extérieur transpose uniformément des coordonnées conçues pour le cadrage intérieur.
Le pied du levier tombe dans la coque, et le volant manque de recul par rapport au buste.
Le contrôle des triangles doit aussi couvrir le saute-vent et le trajet de la main au levier.
Corriger l'aménagement extérieur et sa cinématique, conserver le cadrage intérieur et les animations.
Joueur, concurrents, niveaux de détail et rétroviseurs utilisent les mêmes poses corrigées.
La conduite p14 et les modules FERRO ne font pas partie de ce correctif visuel.

## État au démarrage

Base de travail : candidat 0.2.57, commit local `da99e13`, construit deux fois à l'identique.
Sa qualification ciblée reste distincte : 7/7 suites, 135 contrôles.
Sa publication est reprise sur `codex/bitume-demos-regard-arriere-20261119` ; CI complète à constater.
Le correctif cockpit forme le lot suivant, sur `codex/bitume-cockpit-pilotes-20261119`.

## Correction et qualification

Le volant a été avancé de 10 cm. Son dégagement longitudinal minimal devant le buste est de 169,042 mm,
contre 69,042 mm sur la 0.2.57. Le levier est recentré et sa console arrondie rejoint le fond de la cuve.
Son pied est fixé au support ; le reste de la tige garde son débattement libre. La tige reste dessinée dans
le niveau de détail simple. La main droite suit le nouvel ancrage avec le même mouvement de prise et de retour.
Le saute-vent a été adapté pour laisser passer le volant et les gants. Les bras gardent leurs longueurs.

**6/6 suites réussies : 71 contrôles cockpit/voitures et le registre des formes**, avec sources et tests figés pendant les passages.
Le banc indépendant contrôle **840 poses** : cinq braquages, quatorze transitions de boîte dans les deux sens,
et douze phases. Il vérifie aussi 168 phases de levier, 150 poses sur les trois niveaux de détail réellement affichés, deux voitures distinctes,
les attitudes de caisse et les contacts de fixation console/cuve/pied. Aucune traversée détectée sur ces poses.
Le même banc échoue sur les sources 0.2.57 pour les défauts signalés : tige/coque, volant/saute-vent et proximité du buste.
Les 630 poses articulées et 268 groupes d'identité historiques restent conformes, sans réécrire leurs fixtures.

Deux builds 0.2.59 identiques : 14 186 762 octets, SHA-256
`cb02e2250a2e4a7d06bd0fdea659fce641a016975e224bac2823574888439cd4`.
Rapport : `rapports/COCKPIT-PILOTES-2026-11-19/QUALIFICATION-0259.json`.
Les triangles réellement posés ont été inspectés en trois quarts droit, profil droit et vue de dessus par raster logiciel.
Le lancement de Chromium est bloqué dans cet environnement : cette inspection de géométrie ne vaut pas une
validation du jeu complet dans un navigateur ni une mesure des FPS matériels.

## Réconciliation des travaux parallèles — 0.2.59

Deux candidats 0.2.58 ont été publiés en parallèle. La PR #16 (`42a916f`) apporte une ouverture dans la coque
simplifiée et contrôle les vrais obstacles à chaque niveau de détail. La PR #17 initiale (`1d11d08`) apporte
la console fixée à la cuve et la tige visible dans le niveau simple. L'union conserve ces deux apports.

Le premier banc de la PR #17 reprenait les obstacles du modèle détaillé pour les autres niveaux : il manquait
les traversées du dessus plein simplifié. Le banc renforcé retrouve ces contacts sur `ff32d56` (5/6 contrôles),
puis passe 6/6 sur l'union. Les 150 poses testent deux voitures, trois niveaux, cinq braquages et cinq phases.
Les 840 poses détaillées et 168 phases de levier sont conservées ; les contacts du support sont contrôlés séparément.
L'inspection logicielle du niveau simple confirme l'ouverture et l'ancrage. Les géométries détaillées restent identiques.

Preuves historiques distinctes : `rapports/COCKPIT-PILOTES-2026-11-19/QUALIFICATION-0258.json` (PR #16) et
`rapports/COCKPIT-PILOTES-2026-11-19/QUALIFICATION-0258-PR17.json` (premier candidat PR #17, limite LOD ci-dessus).
Le reçu 0.2.59 qualifie la réunion des corrections ; aucun résultat ancien n'est présenté comme une validation de cette union.

## Correctif de qualification de la base 0.2.57

La CI initiale de la PR #15 a trouvé `ReferenceError: cam is not defined` dans `nature-integration.test.mjs`.
Le rendu de production définit bien sa caméra ; le test isole la section faune et omettait cette variable.
Le contexte VM et les cas plan nature/retour course sont corrigés ; les habitats partagés et pools J1/J2 restent contrôlés.
Trois suites ciblées réussissent, 27 contrôles. Aucun code de production ni build 0.2.57 modifié.
Les CI initiales restent consignées : push 123/126, PR 124/126. Les nouvelles CI sont à constater avant fusion.

Le suivi publié contient les résultats utiles et les empreintes du build ; aucun journal local brut
ni chemin de travail interne n'est ajouté. Les réserves antérieures restent séparées des nouveaux résultats.

## Ensuite

Après publication et clôture du correctif : reprendre 13B Baïkal, puis les autres circuits déjà demandés.
