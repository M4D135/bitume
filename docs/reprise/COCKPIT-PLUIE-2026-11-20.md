# Cockpit et pluie — correctif du 20 novembre 2026

## Demande et périmètre

La photo utilisateur montre un volant et un tableau trop hauts, avec des glaces
sur les mains. Le même défaut est signalé depuis l’extérieur. C’est un défaut
bloquant de la livraison 0.2.69, pas une validation acquise par projection.

Le correctif possède une seule géométrie métrique pour intérieur et extérieur,
conserve les yeux et l’assise du pilote et ne change pas le champ manuel mémorisé.
Le dégagement est contrôlé par intersections avec les vrais triangles, puis par
images du HTML assemblé. Une référence 0.2.69 doit échouer aux nouveaux contrôles.

La demande complémentaire porte sur la pluie derrière l’arceau, plusieurs forces
et abondances, des impacts brefs suivis de perles qui glissent, et de l’eau sur les
surfaces des véhicules. Quatre forces : fine, modérée, forte, très forte. La météo
réelle reste liée à ses observations. Sec, neige, toit, pause et deux joueurs
restent contrôlés séparément.

## Coordination

Base publiée : `96f720e788698401a72d41a9e0befa18c88c2e7b`, runtime 0.2.69,
p15 / FERRO 0.3.15 / neuf circuits. Deux worktrees isolés : cockpit et pluie.
00 assemble et publie ; géométrie, optique et carrosserie ont chacun un propriétaire.
Les transferts sont inscrits dans `PARALLELE-2026-11-20/REPARTITION.json`.
Le lot d’abris PR 43 reste conservé sur sa branche ; aucun fichier FERRO verrouillé
n’est modifié et aucun déploiement du site n’est demandé.

## Qualification

Banc cockpit indépendant : 324 rayons vers la chaussée à 10, 20, 40 et 80 m,
trois braquages, yeux gauche/droit/centre ; polygones de glaces et commandes dans
24 cadres. La référence publiée échoue : 324 rayons masqués et 544 recouvrements
ou marges insuffisantes. Les critères ne sont pas relâchés pour accepter le correctif.

Campagne navigateur préparée : cinq dispositions (Mac, paysage, portrait,
partage haut/bas et côte/côte), deux états d’allure/braquage, plus profil et trois
quarts extérieurs. Le workflow Troll suit J1 et J2 dans le HTML du candidat courant.
Chaque capture archive commit, arbre, SHA du HTML et diagnostics ; les images
restent à recevoir et inspecter avant décision de publication.

L’alerte historique de construction décor à 172 ms pour un seuil strict de
150 ms demeure ouverte ; aucun seuil modifié. Les captures logicielles ne sont
pas une mesure de FPS Xbox/Intel ou un essai de conduite matérielle.


## Complément de reprise : caméra et coût au sec

La revue indépendante a trouvé que le champ précédent ne suivait pas le regard
dans les virages : 50 des 216 cadres examinés pouvaient tronquer une glace. La
correction calcule la marge avec les vrais coins dans le repère de la caméra et
les inerties, sans déplacer les pièces ni changer la préférence de champ.

Le module de gouttes de carrosserie évite aussi de parcourir ses 2 304 perles
quand les douze voitures sont déjà sèches. Le dernier pas de séchage et la reprise
de pluie restent exécutés. Les mesures locales sont des coûts CPU et ne prouvent
pas un gain de FPS sur Xbox/Intel.

Les impacts, quatre forces et surfaces sont assemblés avant les captures ; la
qualification doit couvrir le même HTML que le cockpit. Les origines des deux
préparations sont conservées dans [PROVENANCE.json](rapports/COCKPIT-PLUIE-2026-11-20/PROVENANCE.json).


## Réception du candidat et réparation des bancs

Le candidat `c3d49089e68a46dc2163067afbdea7db81364fed` (PR 44) conserve
le HTML `b0f1b5d905f02fd3e5fe142e7580a6ad6b564273c5cb57993e5a650fed2ad344`,
14 502 704 octets. L’archive CI a été rapprochée de ses 3 815 fichiers Git, sans
écart de contenu ni de mode. Aucun runtime ni artefact de construction n’est
modifié par les réparations de qualification.

La première CI révèle quatre bancs qui omettent le vrai module
`conditions-course` : leurs 97 contrôles passent après ajout de cette dépendance,
sans modifier les assertions. Le run PR conserve aussi un dépassement décor à
152 ms pour un seuil strict inférieur à 150 ms ; cette réserve reste ouverte.

La référence 0.2.69 est désormais extraite par checkout du commit publié et son
SHA est contrôlé. Les expirations suivantes de `Page.captureScreenshot` et de
`Runtime.evaluate` sont archivées. Les pilotes cockpit et impact rendent la main
à DevTools après chaque pas natif : 24 pas de chauffe cockpit, recherche d’impact
bornée à 960 pas et alignement à 60. Les 31 contrôles ciblés passent avec la vraie
horloge rAF, la vraie cadence et la vraie optique. La disparition des expirations
reste à vérifier par les PNG de CI. Aucun seuil, résolution ou délai n’est assoupli.

Les scènes cockpit sont réparties entre sept jobs. Les groupes impact et Troll
poursuite peuvent être demandés seuls pour compléter les preuves déjà acquises.
Les reçus de revue relient chaque image à son HTML : 9 eau/portrait/duo,
8 forces/arceau, 36 démonstrations du candidat (plus 12 références historiques),
4 carrosserie et 13 Troll cockpit ont été inspectées. Les mains gestuelles sortent
latéralement du champ cockpit au plateau ; cette vue établit départ/retour mais
pas la forme complète du geste levé. La poursuite reste à compléter.

Les campagnes cockpit dédiées et les cinq instants d’impact restent des portes
ouvertes avant fusion. La PR 43 et ses preuves d’abris restent séparées ; les
précautions de son intégration ultérieure figurent dans `SUITE-06.json`.

## Images 0.2.70 reçues : HUD bloquant, correctif 0.2.71 en préparation

La CI complète `44818836125` réussit sur `3d9825d4ee6f13525a4b8c0d780e5f127c9a9b4a` :
179 suites JavaScript et huit tests Python, sans échec. Le HTML reste celui de
0.2.70. Les dépassements décor historiques de 172 et 152 ms demeurent ouverts.

Les cinq PNG d’impact sur l’arceau ont été inspectés : même goutte, impact bref,
puis perle persistante qui descend à vitesse nulle. Les 24 PNG de couverts et
les 39 PNG météo disponibles (27 candidat et 12 références) ont aussi été lus.
Le dernier groupe météo a été annulé : son passage `legere` manque et n’est pas
qualifié. La poursuite Troll reste à 11 PNG sur 13 après expiration de capture ;
maintien après délai et relâchement restent absents.

La campagne cockpit apporte dix PNG du candidat et deux de la référence 0.2.69.
Les contrôles de géométrie réussissent en paysage, mais le classement masque
la glace gauche et la carte traverse la droite. En duo haut/bas, l’annonce de
virage recouvre les points centraux de chaussée à 35 et 55 m. **0.2.70 ne doit
pas être fusionnée dans cet état.** Les anciens contrôles ignoraient ces masques
DOM ; leur succès ne validait pas l’image composée. Le bandeau violet/vert en
haut de J2 côte/côte est une publicité native de passerelle : sa projection
correspond aux deux poses, sans corruption de copie J2 démontrée.

Le grand format Mac reste incomplet : les deux PNG de référence sont reçus,
mais la limite externe de 18 minutes coupe la chauffe du candidat. Les deux
versions seront désormais capturées dans des jobs distincts, sans augmenter
les délais ni retirer de pas. La référence 0.2.70 en paysage doit être reconnue
comme négative par le nouveau contrôle HUD.

Le correctif suivant adapte le HUD à la vue propre à chaque joueur et à la taille
de son écran. La carte reste en haut avec ses préférences gauche/droite et taille.
Les yeux, le siège, la géométrie commune, les roues et la physique sont conservés.
L’oracle observe les rectangles visibles de chaque HUD, leurs transformations et
leur découpe, puis mesure leurs intersections avec glaces, commandes et chaussée.
Les six seuils initiaux restent inchangés ; l’absence de données HUD est un échec.

La prochaine campagne comprend neuf scènes et seize PNG du candidat, plus deux
PNG de référence dans un job dédié. Deux cas à 960 × 540 exercent un rival natif
à 18 m, la carte normale à droite et la grande carte à gauche avec tableau complet.
Le pilote Troll rend aussi la main à DevTools entre chacun des pas natifs, sans
changer les treize instants, les entrées réelles, les 80 pas maximum ni le délai.
La validation de ces changements par les images reste ouverte avant publication.

### Construction du candidat HUD

0.2.71 est reconstruite deux fois à l’identique : 14 507 449 octets, SHA256
`0e4cdb72ecceb434c086a6bdc365346cfac1900871b95afadd96932cb3fd8ce3`.
Seuls `src/index.html`, `src/jeu.js` et `src/style.css` changent dans le runtime.
Les 34 copies FERRO sont conformes. Les cinq suites ciblées passent 60 contrôles :
19 cockpit, huit captures Troll, 13 HUD, 11 options et neuf raccords Troll assemblés.

La revue a également fermé un faux positif de référence : un message générique
« HUD » ne suffit plus. Chacune des deux poses de la référence paysage doit
montrer une vraie intersection avec une glace au-delà de 1 px² et son constat
explicite ; des données HUD absentes ou invalides font échouer la référence aussi.
Les contrôles négatifs avant correction et leurs résultats après sont conservés.

Les calculs de disposition prévoient une carte toujours haute, avec réservation
entre compteurs et chronos et les trois tailles relatives conservées. Cette
prévision reste à confirmer par les rectangles DOM réels et la revue des PNG.


## Réception 0.2.71 et correction compacte 0.2.72

La CI push `44825410913` passe 179 suites Node et huit tests Python ; les
3 901 fichiers/modes reçus sont identiques au candidat `6a708e2`. Pourtant les
PNG compacts révèlent deux masques : classement sur gant gauche en braquage
(3 147,68 px² cumulés), régime complet sur volant/gant droit au neutre
(455,87/9 163,98 px²). Le seuil de 1 px² reste inchangé. Carte et annonce
sont présentes, donc ces défauts ne sont pas des témoins manquants.

Le garde publié séparément `ee3bb57` est repris à arbre identique, puis complété
pour les compteurs : présence obligatoire en mode complet, absence obligatoire
en mode Planche seule. Il garde les six seuils, poses, 24 pas et résolutions.

0.2.72 ne modifie que style.css dans le runtime : classement limité à la hauteur
locale et aligné au bord extérieur ; annonce conservant sa largeur ; compteurs
complets disposés dans une colonne extérieure, vitesse/unité empilées, régime et
rapport conservés. La jauge de dérive suit cette largeur sans changer son état.
Le masquage Planche seule est respecté en solo (#jeu) et par joueur en duo.
49 contrôles ciblés et deux reconstructions passent ; images du nouveau HTML
encore attendues. Aucun changement de géométrie, conduite, FERRO ni déploiement.

[Réception intermédiaire 0.2.71](rapports/COCKPIT-PLUIE-2026-11-20/ci-0271/RECEPTION-INTERMEDIAIRE.json) ·
[Construction 0.2.72](rapports/COCKPIT-PLUIE-2026-11-20/candidat-0272/BUILD-0272.json).

Réserve tardive 0.2.71 : la CI PR `44825452386` termine à **178/179** suites,
Val-Brûlé **168 ms** pour un seuil strict de **150 ms**. Son archive de
3 901 fichiers/modes est identique à la CI push verte ; les huit tests Python
sont sautés en PR après cet échec. Résultat conservé, sans changer le seuil.

## Réception 0.2.73 et correctif stabilisé 0.2.74

La [réception .73](rapports/COCKPIT-PLUIE-2026-11-20/candidat-0273/RECEPTION-0273.json)
valide le petit duo et conserve le défaut réel du virage maintenu : régime et
classement sur le gant droit. La CI générale est verte, les 43 PNG pluie/Troll
sont inspectés ; la fusion de PR49 reste bloquée.

Le [candidat .74](rapports/COCKPIT-PLUIE-2026-11-20/candidat-0274/BUILD-0274.json)
conserve les textes et la largeur des noms, compacte les espaces du classement
et raccourcit la barre de régime dans le seul petit paysage. Les deux braquages
stabilisés, annonce activée, sont requis sur son HTML exact avant publication.
