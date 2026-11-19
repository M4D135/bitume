# Démos — paysages, nature et course

## Demande et réalisation

Démos originales inspirées des cadrages F1 et de l'énergie arcade de Daytona USA : découverte de chaque circuit,
panoramas, flore et faune réellement présentes, détails du pilote et peloton, alternés avec la course.
Les trajectoires nature sont préparées au chargement. Les postes animaliers restent fixes ; un sujet masqué
provoque une coupe explicite. Le départ et le sprint final gardent la priorité jusqu'au drapeau.

Intégration 0.2.57 sur la 0.2.56 publiée (PR #11), copie préparée avancée récupérée sans modifier l'original.
Les replis en tunnel ou après masquage conservent désormais le leader et la protection du sprint.
Les sujets et poses utilisés par le rendu sont synchronisés après chaque repli.

## Regard arrière demandé pendant l'intégration

En vue Poursuite, maintenir le stick droit vers le bas regarde derrière ; le relâchement rend immédiatement
la caméra normale. Le cap normal reste entretenu pendant le maintien. Les deux joueurs gardent leurs
propres manettes et états. La commande ne détourne ni cockpit, ni menus, ni démos.
Les rayons statiques PhysX protègent la caméra du terrain, des murs et du plafond ; l'aide indique le geste.
La documentation officielle EA confirme le stick droit vers le bas pour le regard arrière à la manette.

## Qualification et suite

7 suites ciblées réussies, 135 contrôles : cinéma 18, raccords 5, réalisation 7, chargement 9,
regard arrière 13, manettes 39, commandes partagées 44. Deux builds identiques.
Rapport : `rapports/DEMOS-CINEMA-2026-11-19/QUALIFICATION-0257.json`.
Vérifier la CI du lot après publication. Conserver les réserves traces et temps de décor ; aucune fixture ni seuil modifié.
Contrôles numériques distincts d'une appréciation visuelle et d'un essai avec une manette physique, encore à faire.
Aucun asset, image, son ou appel réseau ajouté aux démos ; qualité/Faune, p14, courses continues et sortie sur geste conservés.
13B Baïkal reste le lot suivant ; aucune mise en ligne du site dans ce lot.
