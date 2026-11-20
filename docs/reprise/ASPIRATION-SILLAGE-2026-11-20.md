# Aspiration réelle et projections — 20 novembre 2026

## But et état

Poursuite du jeu après la publication vérifiée de la 0.2.61. Mesurer le gain réel de
l’aspiration dans PhysX, rendre l’entrée et la sortie du sillage perceptibles au son,
et conserver les projections d’un rival sur la visière à grande vitesse.

Candidat **0.2.62 / p15 / FERRO 0.3.15**, qualification en cours. Les correctifs de démo,
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

La qualification complète et les captures navigateur sont requises avant fusion.
Les captures utilisent des poses fixées sous SwiftShader ; elles ne qualifient pas les
FPS matériels. L’écoute matérielle, les manettes physiques et le réseau entre machines
restent à vérifier. Aucun déploiement du site n’est annoncé depuis cet environnement.
