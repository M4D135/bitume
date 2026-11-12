# BITUME — conception de l'essai 0.1

## Intention

Une course de monoplaces vue du cockpit, nerveuse et lisible, qui tient dans une page web et se lance sans rien
installer. BITUME reprend le genre et les mécaniques de vroom-unreal, en particulier la dérive chargée qui se paie
en turbo. Il refait tout le reste de façon originale et procédurale : circuits, décor, voitures et sons sont
calculés par le code.

## Piliers

1. **Vitesse lisible** : cockpit, compte-tours, repères de piste, son du moteur qui porte l'information.
2. **Dérive et turbo** : prendre un virage en dérive charge une jauge ; le lâcher au bon moment donne le turbo.
3. **Peloton vivant** : onze rivaux qui freinent tard, se dépassent, se gênent et se touchent.
4. **Tout par le code** : aucune image, aucun son enregistré, aucun tracé relevé.

## Mécaniques de l'essai

- **Conduite** (`src/conduite.js`).
  - Cinématique dans le repère du circuit, intégrée au pas fixe de 1/120 s.
  - Six rapports jusqu'à 86 m/s, soit 310 km/h. Pointe vers 307 km/h, atteinte en 27 s environ.
  - Couple de 4 000 à 12 800 tr/min, rupteur à 13 000. Boîte automatique ou manuelle.
  - Adhérence de 1,55 sur la piste, 1,42 sur les vibreurs et 0,85 dans l'herbe, avec un appui aérodynamique.
  - Sous-virage au-delà de la limite. Glissières propres à chaque côté de la piste, avec rebond et frottement.
- **Dérive et turbo**.
  - **Déclenchement** : au-dessus de 44 km/h, dans un virage d'un rayon de moins de 400 m, en braquant et sans freiner.
  - **Charge** : elle monte en contre-braquant, sur trois niveaux.
  - **Fenêtre** : la fenêtre « parfaite » s'ouvre 0,25 s toutes les 1,2 s.
  - **Turbo** : au lâcher, il dure 0,6, 1 ou 1,5 s selon le niveau ; il est plus fort dans la fenêtre.
- **Course** (`src/course.js`).
  - **Départ** : grille en quinconce, cinq feux, extinction au hasard.
  - **Allure des rivaux** : ils roulent à 90, 95,5 ou 99 % de la vitesse de référence du circuit selon la difficulté, à ±1,5 % près.
  - **Pilotage des rivaux** : ils anticipent les freinages sur 200 m et dépassent par l'intérieur quand la place est libre. Un léger élastique de ±2 % joue en difficultés faciles et normales.
  - **Contacts et arrivée** : les contacts sont des rectangles de 4,5 × 1,9 m. Le drapeau à damier tombe pour tous dès l'arrivée du vainqueur.
- **Chrono** : fantôme du meilleur tour, échantillonné toutes les 0,05 s et gardé dans le navigateur pour le même
  tracé, avec un record par circuit.
- **Présentation** (`src/jeu.js`, `src/voiture.js`).
  - **Vues** : cockpit, poursuite, et caméra de télévision au téléobjectif pour la vitrine du titre et la fin de course.
  - **Affichage** : position, tour, temps et écart au meilleur tour à distance égale, tour de classement, plan du circuit, jauge de dérive, compte-tours.
- **Son** (`src/son.js`) : moteur synthétisé à saturation variable, trois voix de rivaux spatialisées avec effet
  Doppler, pneus, vibreur, herbe, chocs et signaux, sans aucun fichier.

## Ce qui est vérifié (12 novembre 2026)

- **Tests Node, tous réussis** :
  - circuits (catalogue valide, relief, dévers, glissières) ;
  - conduite (17 vérifications) ;
  - course (7 tests : départ, dépassements, temps des rivaux, contacts, chrono, déterminisme, performance) ;
  - son (8 vérifications, dont le graphe complet sur un faux contexte audio).
- **Dans le navigateur intégré à l'app Claude, sur le Mac** :
  - **Parcours complet** : écran titre et vitrine, choix du circuit, grille et feux, vues cockpit et poursuite, accélérateur au clavier, pause, réglages, retour par Échap, puis une course de 3 tours menée jusqu'aux résultats.
  - **Chrono** : 3 tours, fantôme gardé (35 Ko) et record enregistrés.
  - **Performance** : 60 images par seconde en 1390×1295 avec ombres, bloom et MSAA ×4, pire image à 29 ms. Une image coûte 0,5 ms de processeur ; une seconde de course à douze voitures coûte 2 à 3 ms de simulation.
- **Construction des trois circuits** (Node) : 12 à 17 ms par tracé, 50 à 64 ms par décor (60 000 à 97 000 triangles de
  nappes, 12 000 à 18 000 objets).

## Ce qui ne l'est pas

- Manette et écran tactile réels, Safari, Firefox, Windows et Linux.
- Le son à l'oreille : seul le graphe audio est testé.
- Port-Sable et Haut-Col dans le navigateur : construits et validés dans Node, pas parcourus à l'écran.
- La prise en main : les constantes de conduite sont des choix de départ, pas encore réglées en jouant.

## Limites connues de l'essai

Pas de dégâts ni d'usure, pas de rétroviseurs, pas de replays, pas de championnat. Le décor reste simple : relief
doux, arbres en primitives, pas d'herbe haute. L'écart avec la version Unreal et les lots pour le combler sont dans
`FEUILLE-DE-ROUTE.md`.
