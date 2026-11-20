# Aspiration réelle et projections — 20 novembre 2026

## But et état

Poursuite du jeu après la publication vérifiée de la 0.2.61. Mesurer le gain réel de
l’aspiration dans PhysX, rendre l’entrée et la sortie du sillage perceptibles au son,
et conserver les projections d’un rival sur la visière à grande vitesse.

Version **0.2.62 / p15 / FERRO 0.3.15**, publiée sur `main` et qualifiée. Les correctifs de démo,
sols, volant et pilotes préparés dans une autre reprise sont conservés séparément.

## Défaut physique confirmé et correction

`circuit.ecart(c, premier, second)` donne le déplacement du premier point vers le second,
avec bouclage de la piste. `course.aspirer` passait les arguments dans l’ordre inverse :
le meneur recevait la baisse de traînée que devait recevoir le suiveur. Deux anciens bancs
remplaçaient cette fonction par un double au signe inverse, ce qui masquait le défaut.

La correction emploie `ecart(c, a.etat.s, b.etat.s)` pour chercher une voiture **devant a**.
La portée de 30 m, le couloir de 2 m et le coefficient maximal de réduction de traînée
restent identiques. La conduite transmet toujours les forces au vrai châssis PhysX.
**La physique passe en p15** : les records et fantômes p14 restent dans leurs anciennes clés.
Ni le moteur FERRO ni ses modules verrouillés ne changent.

## Mesure contrôlée, avant et après

Deux châssis dynamiques, plein gaz, même vitesse initiale ; le meneur commence 20 m devant.
Leur écart évolue librement. Comparaison du suiveur à une voiture seule après six secondes :

| Vitesse initiale | Gain du suiveur p14 | Distance gagnée p15 | Vitesse gagnée p15 |
|---|---:|---:|---:|
| 160 km/h | 0 m | 2,814 m | 3,872 km/h |
| 235 km/h | 0 m | 5,324 m | 6,694 km/h |
| 300 km/h | 0 m | 7,873 m | 9,686 km/h |

À 235 km/h, la résistance initiale du suiveur passe de −1 658,461 N à −1 482,474 N.
Le meneur retrouve la résistance en air libre. Les écarts résiduels de position du meneur
par rapport au témoin restent de l’ordre de 0,00013 m au maximum dans ces essais.
À 2,1 m de décalage latéral ou 35 m derrière, le suiveur ne gagne rien.

Chaque version parcourt **12 scénarios, 8 640 pas à 120 Hz**, sur un plan de 512 triangles.
Quatre appuis, zéro contact entre voitures, replacement ou correction imposée de pose/vitesse.
Le banc emploie les vrais `course.pas`, `circuit.ecart`, `course.aspirer` et le WASM embarqué.
Le test est rouge sur la p14 et vert sur le candidat. Il couvre aussi le bouclage de la piste
et le changement de bénéficiaire après dépassement.

Ces chiffres décrivent un essai contrôlé du jeu ; ils ne mesurent ni la vitesse maximale,
ni une course complète, ni l’aérodynamique d’une voiture réelle.

## Son et eau

Deux souffles procéduraux sont préparés pour J1/J2. Dans le sillage, les aigus se ferment
et une turbulence plus grave devient présente ; la sortie rétablit progressivement le
souffle libre. Les transitions utilisent les AudioParam, sans créer de nœud par image.
Le volume suit les curseurs Effets/Général, la vitesse, la caméra et la pause. La source
est l’aspiration du véhicule réellement suivi, indépendante de l’humidité.

La pluie ambiante continue de s’évacuer avec la vitesse. Les projections du rival ont
un flux distinct qui renouvelle les impacts même à 300 km/h. Cette correction couvre
la passe optique WebGL2 et le repli Canvas2D, y compris une chaussée encore mouillée
sans pluie. Sortie du panache et tunnel arrêtent les nouveaux apports ; les dépôts
existants s’évacuent progressivement. Les états J1/J2, le réglage 0–2 et la pause restent
indépendants. Les dépôts concernent cockpit et poursuite ; les plans aériens/distants
restent dégagés, de même que les rétroviseurs.

## Déterminisme et preuves

La nouvelle fixture p15 vient de **deux processus indépendants** : trois courses de
18 secondes, douze corps dynamiques chacune et 54 empreintes exactes. Scènes, états,
contacts, événements, configurations et bilans sont comparés intégralement. Les archives
p14 restent intactes. Le sélecteur refuse une physique inconnue au lieu de tomber
silencieusement dans l’ancien banc Frenet.

Preuves : `rapports/ASPIRATION-SILLAGE-2026-11-20/QUALIFICATION.json`, `comparaison.json`,
`mesure-p14.json`, `mesure-p15.json`. Banc reproductible :
`node tools/qualification/aspiration-physx.mjs` ; régression :
`node verifications/aspiration-physx.test.mjs`.

Le passage complet local compte **146/147 suites réussies**, avec le seul échec
`obstacles-degagement.test.mjs`. Ce scénario dépendait d’un accident après 80 secondes de
trafic p14. Avec p15, ce choc ne se produisait plus. Le même tronc
est désormais exercé dans une situation pré-impact contrôlée, avec aspiration nulle :
choc réel, marche arrière, reprise, plus de 250 m, aucun replacement et pneus préservés.
Les cinq contrôles passent sur p14 et p15 ; ce banc historique utilise explicitement
le solveur de repli. Aucune règle de jeu n’a été modifiée pour ce contrôle.

La CI complète et les captures navigateur sont requises avant fusion.
Les captures utilisent des poses fixées sous SwiftShader ; elles ne qualifient pas les
FPS matériels. L’écoute matérielle, les manettes physiques et le réseau entre machines
restent à vérifier. Aucun déploiement du site n’est annoncé depuis cet environnement.


## Publication vérifiée et contrôle PhysX du dégagement

PR #31 fusionnée au commit `27bdf08de3a712e6658b71d428d2a7d1af3fece5` : **147/147 suites**,
**41 PNG** vérifiés dans cinq groupes, 14 scènes candidates et six références. Les 37 images
visualisées et quatre références faune identiques ne montrent aucun défaut nouveau sur ce lot.
Le groupe pluie termine en environ 31 minutes sans timeout ni relance.

La PR #32 ajoute le contrôle natif `verifications/physx-degagement.test.mjs` et son reçu,
sans changer le jeu. Fusion `3fc9421eb87c9bfdc296673e48220c0667626058` : **148/148 suites**.
Un châssis dynamique de 600 kg heurte un vrai tronc sur un sol triangulé. Le contrôleur IA
provoque le recul puis la reprise ; les assertions surveillent les contacts natifs, l’ordre
des phases, l’espace libre derrière et les pneus pendant 2 160 pas à 120 Hz.
Choc à 0,358 s, premier recul à 1,542 s, reprise à 12,542 s ; deux manœuvres, quatre appuis
retrouvés, zéro replacement, secours, vitesse/pose imposée ou service des pneus. Désactiver
le déclenchement du dégagement dans une copie temporaire fait échouer le test. La CI
reproduit exactement les mesures locales ; une relecture indépendante confirme le contrôle.

Les archives de 3 337 puis 3 339 sources ont été téléchargées et comparées intégralement
(contenus et modes), ainsi que le HTML. Les arbres des deux fusions sont ceux des candidats.
Reçu complet : `rapports/ASPIRATION-SILLAGE-2026-11-20/PUBLICATION-0262.json`.

S8 reste une mesure facultative ouverte : **1 031 °/s² pour une cible ≤ 300 °/s²**,
avec **46/46 critères obligatoires** réussis.

Réserves : terrain clair strié identique à 0.2.61 ; projections encore discrètes en poursuite
sur ces captures, malgré un renforcement clair en cockpit. Les poses figées et SwiftShader
ne qualifient pas les FPS matériels ni une course complète. Le site n’est pas déployé ici.
Suite prioritaire : réconcilier les démos/sols, volant, pilote expressif/gestes et dynamique
des gouttes déjà préparés, en conservant p15, Monaco et l’ensemble du programme.
