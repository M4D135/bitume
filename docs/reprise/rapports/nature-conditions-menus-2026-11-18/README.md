# BITUME 0.2.33 — nature, conditions et menus

## Changements livrés

- Prairie irrégulière, clairières réelles, bosquets et insectes localisés. Poches proches très denses en Extrême ; transitions vers un sous-ensemble grossier, puis uniquement les couleurs du terrain déjà rendu. Portées nominales 45 / 80 / 110 / 150 m selon qualité, adaptées à la projection.
- FERRO 0.3.9 : indices statiques éliminant les brins déjà invisibles dans le shader, regroupements préparés par vue et réutilisés par les ombres. Aucune boucle CPU par brin et par image.
- Printemps blanc/rose ; été sec à soleil fort ; automne chaud avec feuilles tombantes ; neige hivernale sauf Port-Sable. Faune coupée sur le terrain enneigé. Feuilles/flocons proches et vitre animée, budgets adaptés, pools séparés en écran partagé, abris pris en compte.
- Avant départ seulement : saison, moment et météo ont chacun Manuel, Aléatoire, Réel. Tirage stable pendant la préparation et pneus cohérents. Météo réelle de la zone IP approximative, date/heure et soleil réels ; panne annoncée avec repli. Cache mémoire 12 min, attente bornée à 4 s, actualisation réseau limitée. Aucun appel de localisation en manuel/aléatoire ou pour un invité en ligne.
- En ligne : snapshot de l’hôte, horloge commune au départ, météo observée conservée ; ni IP, ni coordonnées, ni ville transmises aux invités. Préférences locales des invités préservées.
- Préparation en Circuit / Conditions / Pilotes ; réglages en Image / Pilotage / Son / Commandes. Stick/croix, groupes de choix, curseurs, A/B, LB/RB, maintien et focus visible. Départ et aide restent accessibles.
- Détection automatique avant le premier titre : scènes réelles, profils progressifs, GPU chronométré si disponible, annulation, cache de configuration. Dans Image, « Détecter et appliquer » remplace les six choix graphiques, y compris leurs surcharges ; les autres préférences sont conservées.
- Le lien m4d135 reste le téléchargement BITUME.html, avec son avatar et son placement.

## Qualification

61 suites du jeu passent ; les sources sont identiques avant/après. Deux anciens tests de frontière ont été actualisés (profil désormais transmis à l’overlay, contexte tactile de la coquille), puis seuls ces deux tests ont été relancés. Le résumé garde le premier passage et les reprises ciblées.

Les 34 modules FERRO sont identiques à la référence 0.3.9 publiée dans `M4D135/FERRO` au commit `89c784163b8671676b11f3d4114fab22f6200a7e`. Son rapport canonique comprend 168 comparaisons EGL couleur/profondeur identiques et 162 tests réussis, zéro échec, un TODO historique.

Les 12 décors saison × biome gardent les mêmes tracés, positions, géométries et solides. Modules météo réelle/conditions : tests de date, fuseau, hémisphère, minuit, codes WMO, pannes, timeout, annulation tardive, cache, snapshot hôte et évolution temporelle.

La page a été construite deux fois avec la même empreinte ; voir `build-033.json`.

## Coût de l’herbe : mesures instrumentées

| Qualité / vue | Triangles 0.2.32 | Triangles 0.2.33 | Appels avant → après |
|---|---:|---:|---:|
| Moyenne / cockpit | 233 514 | 19 572 | 161 → 44 |
| Moyenne / poursuite | 196 728 | 13 968 | 153 → 47 |
| Fine / cockpit | 963 792 | 107 734 | 285 → 78 |
| Fine / poursuite | 774 144 | 118 992 | 242 → 73 |
| Extrême / cockpit | 35 371 278 | 3 283 372 | 1 330 → 197 |
| Extrême / poursuite | 34 868 044 | 3 383 996 | 775 → 235 |

Somme couleur + ombres pour l’herbe, mêmes caméras et paramètres de référence. Ces gains combinent le décor moins uniforme, la portée détaillée réduite et FERRO 0.3.9. La vue bord-sol est devenue une clairière : ses gains ne doivent pas être présentés comme une comparaison à densité égale. À décor écologique identique, le moteur seul réduit encore les triangles Extrême de 59 à 68 %, avec comparaisons de rendu EGL identiques.

Ce sont des soumissions WebGL instrumentées, pas des FPS sur GPU matériel. Le CPU du regroupement peut augmenter selon la scène ; aucune promesse de FPS portable/RTX 5090. Les métriques Canvas de vitre ne comprennent pas la rasterisation du navigateur. Contrôle navigateur local indisponible/refusé ; aucun contournement effectué.

## Sources du mode réel

- [GeoJS — localisation IP](https://www.geojs.io/docs/v1/endpoints/geo/) : zone approximative seulement.
- [Open-Meteo — météo courante](https://open-meteo.com/en/docs) : données de modèle, attribution affichée dans le jeu ; pas une station personnelle.

## Publication et suite

Publication Git de la 0.2.33 en cours au moment de ce rapport ; reçu séparé après vérification de main. Déploiement autorisé, accès Mac/amiga absent ici, donc aucune mise en ligne annoncée.

Lot suivant isolé : 16 circuits mondiaux, six références issues du dépôt personnel Vroom Unreal, sept nouveaux paysages et conservation des trois tracés actuels.
