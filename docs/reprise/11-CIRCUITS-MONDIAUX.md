# Lot 11 — circuits mondiaux

## Demande et découpage

Objectif demandé : **16 circuits mondiaux très distincts**, couvrant Europe, Asie, Afrique, USA, Europe du Nord et de l’Est, et **Islande avec aurores nocturnes**.
Conserver une livraison petite et jouable à chaque étape. La répartition complète et les identités suivantes restent à concevoir ; ne pas présenter une liste provisoire comme une demande exacte de l’utilisateur.

## 11A — Lande-Noire, Islande (0.2.34)

- Ajout après les trois circuits historiques : identifiants et graines préservés.
- Graine originale 83, longueur réelle 4 616 m, pente maximale 6,8 %, dénivelé de piste 12,95 m.
- Plateau basaltique sombre, deux caldeiras asymétriques, mousses en poches sur les nappes existantes ; aucun arbre, village ni brin d’herbe ajouté.
- 384 blocs de basalte, à au moins 32,89 m du bord de chaussée ; collisions identiques entre saisons et qualités.
- Quatre saisons, neige en hiver ; Port-Sable conserve son exception sans neige.
- Aurores en géométrie monde, occultées par le terrain : 1/2/3 rideaux pour Low/Medium/High, au plus 18 objets et 3 456 triangles par vue.
- Fondu au crépuscule, disparition le jour/sous couvert, atténuation par nuages/précipitations ; pools indépendants en écran partagé, reprise dans les rétroviseurs.
- Heure et conditions héritées de l’hôte en ligne ; outils de capture étendus au quatrième circuit, à la nuit et aux saisons.

### Qualification et limites

63 fichiers de tests réussis. Onze rivaux terminent un tour en 222,65 secondes simulées. Circuit et décor déterministes ; deux reconstructions identiques ; verrou FERRO 0.3.9 conforme (34 modules).
Les 12 décors historiques (trois thèmes × quatre saisons, High sans végétation additionnelle) sont identiques à la base 7a7ced6.
Preuves : `rapports/islande-2026-11-18/qualification.json`, `decors-historiques.json`, `production.json`.

**L’apparence finale des aurores n’a pas été inspectée dans un navigateur** : Chromium est bloqué par l’environnement. Ne pas annoncer de validation visuelle ni de gain FPS. La borne géométrique des aurores reste sous 3 885 m depuis la piste, dans le plan lointain de 6 000 m.
Le site servi a été vérifié en 0.2.32 ; aucun accès de déploiement Mac/amiga disponible ici.

## Références examinées

- [Vroom Unreal — README](https://github.com/M4D135/vroom-unreal/blob/main/README.md).
- [Vroom Unreal — provenance](https://github.com/M4D135/vroom-unreal/blob/main/docs/REFERENCE.md).
- [Vroom Unreal — environnement](https://github.com/M4D135/vroom-unreal/blob/main/Source/Vroom/Private/VroomEnvironment.cpp).
- [Manuel Vroom original retranscrit, section Environnement](https://www.lankhor.net/jeux/manuel/manuel32-1.pdf), conservé par un site de préservation, pas présenté comme un site officiel actuel.

Retenir la diversité des reliefs, de l’éclairage et des décors. **Ne copier aucun tracé, table, valeur, image, son ni nom de circuit du Vroom original** ; ne pas importer `Content/Data/tracks.json` de Vroom Unreal. Lande-Noire emploie le générateur BITUME et ses constantes originales. Aucun module FERRO modifié.

## 11B — Roche-Fauve, Afrique (0.2.35)

- Cinquième circuit, ajouté après Lande-Noire sans déplacer les identifiants existants ; graine originale 107.
- Hauts plateaux arides : tracé de **4 834 m**, dénivelé de piste de 27,22 m, pente maximale de 6,8 %.
- Trois plateaux asymétriques, ravine sèche et strates de grès ocres, calculés dans les nappes de terrain existantes.
- 321 strates solides, dégagées d’au moins 33,19 m de toute chaussée ; aucun arbre, brin, village, plan d’eau ni effet supplémentaire par image.
- Saisons minérales, neige en hiver sur ce haut plateau ; géométrie et collisions stables entre saisons et qualités. Port-Sable conserve son exception sans neige.
- Sélection dynamique dans les menus, conditions de l’hôte transmises jusqu’au départ invité ; les onze rivaux terminent un tour en 248,83 secondes simulées.
- **64/64 suites**, deux builds identiques, **34/34 modules FERRO 0.3.9 conformes**. Les 16 variantes des quatre décors précédents restent identiques au commit `883f5ca`.
- Preuves : `rapports/roche-fauve-2026-11-18/qualification.json`, `decors-historiques.json`, `production.json`.

Le contrôle visuel reste bloqué au démarrage de Chromium. Aucun gain FPS matériel annoncé. Le site public sert désormais la **0.2.34**, contrôlée par empreinte ; la 0.2.35 n’a pas été déployée depuis cette session.

## Tranche suivante

1. Vérifier en navigateur Lande-Noire et Roche-Fauve, jour/nuit/hiver, aurores, sélection manette, écran partagé et rétroviseurs ; ajuster seulement les défauts observés.
2. Déployer le commit 0.2.35 publié depuis le Mac avec `./deposer.sh` et confirmer l’empreinte servie.
3. Choisir **un seul circuit en Asie** ; conserver les autres régions dans le programme des 16 au total. Construire, tester, publier, puis actualiser le point court.
