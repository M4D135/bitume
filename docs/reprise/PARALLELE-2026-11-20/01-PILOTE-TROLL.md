# 01 — Habitacle, pilote et Troll

## Prompt à copier

~~~text
Continue BITUME, discussion 01 « Pilote et Troll ».
Dépôt : https://github.com/M4D135/bitume
Lis AGENTS.md, REPRISE.md, docs/reprise/PARALLELE-2026-11-20/README.md, 01-PILOTE-TROLL.md et etat/01.json. Retrouve d'abord les préparations habitacle et audio Troll et les branches plus récentes.
Termine l'habitacle commun aux deux vues, l'assise basse et les bras sans traversée. Ensuite réalise Troll : un seul appui déclenche ensemble geste et klaxon choisis par chaque joueur ; choix aléatoires et réactions après dépassement pour les IA.
Un petit sous-lot testé à la fois ; commit/push ta branche et ton état. Fournis les raccords jeu.js/menu à 00/03, sans fusionner main ni publier les builds communs. Préserve les travaux qualifiés.
~~~

## Reprises

Lire ensuite [PILOTE-HABITACLE-COMMUN](../PILOTE-HABITACLE-COMMUN-2026-11-20.md), puis [DEMANDES-ARCADE-PERFORMANCE-TROLL](../DEMANDES-ARCADE-PERFORMANCE-TROLL-2026-11-20.md).

Le [checkpoint publié](../preparations/habitacle-commun-2026-11-20/README.md) préserve H1+B2 non qualifiés. Le candidat local 89e4cc3 et le brouillon audio depuis le dossier saisons sont plus récents : voir REPRISES-EXISTANTES.md. Le worktree nommé Troll n'avait pas de code Troll indépendant lors du relevé.

## Sous-lots

1. Reprendre les contacts extrêmes et la continuité du coude, conserver les poses fautives. Même géométrie monde, cuve, assise, commandes et pose dans les deux vues ; seule caméra/projection change. Vérifier mains/volant/levier, manches/buste/coque, joueur et rivaux, gestes/rapports et trois LOD.
2. Qualifier le pilote avec les seuils existants : moins de 4 octets par pose et au plus 2 GC mineurs pour 60 000 poses. Captures et bilan des contacts, raccord caméra à 00.
3. Figer les choix Troll avec 03/00 ; reprendre les klaxons procéduraux classique/ancien/mariage. L'événement sonore suit le démarrage réel du geste : une requête refusée/différée ne klaxonne pas seule. Une seule consommation avant les vues J2/J1.
4. Déclencher l'IA après dépassement réel d'un joueur, avec hasard privé/temporisation, démo comprise. Couvrir J1/J2, bouton maintenu, répétition, changement de rapport, replacement et duel oscillant.
5. Après géométrie/gestes et accord des budgets : matières cockpit, grain/usure/reflets procéduraux bornés et instruments lisibles. Les shaders passent par 02 dans FERRO.

## Contrôles

Tests expressions-pilote, pilote-expressions, son, tests habitacle/pilote et outils captures-habitacle, pilote-surfaces, pilote-thorax présents sur la base. Vérifier les noms exacts avant lancement. Les raccords de menu et captures du build assemblé passent par 00.

Propriété : voiture.js, main.js, expressions-pilote.js, son.js et leurs tests/outils. Écrire raccordements/01.md et etat/01.json. Ne pas modifier le HTML de 03, le décor de 04 ou le suivi global. Une validation de module ne vaut pas intégration au jeu.
