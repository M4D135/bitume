# 03 — Menu arcade et manette

## Prompt à copier

~~~text
Continue BITUME, discussion 03 « Menu arcade et manette ».
Dépôt : https://github.com/M4D135/bitume
Lis AGENTS.md, REPRISE.md, docs/reprise/PARALLELE-2026-11-20/README.md, 03-MENU.md et etat/03.json. Retrouve d'abord la préparation arcade et les travaux plus récents.
Termine les écrans simples du menu, le choix de circuit avec son vrai tracé 3D tournant et la navigation complète à la manette. Conserve modes, réglages, clavier/tactile et choix par joueur, dont geste et klaxon Troll avant course. Arrête les aperçus cachés.
Tu possèdes index.html, style.css, navigation-menu.js et menu-arcade.js. Fournis jeu.js/construire.py à 00 sous forme de raccords, et le contrat Troll à 01. Petits jalons, commit/push et état de reprise ; ne fusionne pas main.
~~~

## Préparation existante

Lire [MENU-ARCADE-PROFILS](../MENU-ARCADE-PROFILS-2026-11-20.md) et REPRISES-EXISTANTES.md. Le brouillon local f7ef92c comportait des modifications non commitées et un nouveau src/menu-arcade.js de 197 lignes ; son HEAD seul ne suffit donc pas à le restaurer.

Quatre écrans observés : p-piste, p-conditions, p-pilotes, p-bilan. Le module prépare le vrai tracé XYZ puis le projette. B.menuArcade.{preparerTrace,projeterTrace,creerApercu,installer} est une API de préparation, non figée/non livrée. Les champs Troll J1/J2 sont déjà préparés pour le départ et prets ; les reprendre avec 01/00.

## Sous-lots

1. Parcours de chaque mode : aller/retour prévisibles, valeurs conservées, vrai circuit et relief, départ accessible.
2. Focus visible, croix/stick, valider/retour, changement d'écran, répétition maîtrisée et instructions contextuelles. Préserver appareils/J1/J2, reconfiguration, clavier/tactile et absence de vibration dans les menus.
3. Aperçu à coût/cadence bornés, arrêt complet quand caché, mouvement réduit respecté. Faire suspendre par 00 le rendu de la course sous menus opaques, en conservant la démo depuis le titre.
4. Choix Troll indépendants des deux joueurs, via contrat commun avec 01. Préserver pneus/boîte/vue/commandes, préparation en ligne et lien de téléchargement.

Tests : navigation-menu, manette, commandes-partage, prets-enligne et nouvel aperçu. Captures des étapes et parcours clavier/manette simulée ; ne pas confondre simulation et vérification à la manette physique.

Écrire raccordements/03.md et etat/03.json. Le coût global du moteur appartient à 02 ; 03 s'occupe du coût et du comportement du menu.
