# R4b — continuité des poignets au volant

Demande du 21 novembre 2026 : corriger la tenue des mains, surtout visible en vue extérieure. Lot isolé depuis `75b1cf4`, branche `codex/bitume-126ck-poignets-20261121`.

## Diagnostic et changement

La main entière suivait le plan du volant. Son axe vers la manchette formait environ **43°** avec l'avant-bras au neutre et **40 à 45°** aux braquages examinés. La manche partait ainsi vers le haut avant de redescendre vers le coude.

Le dos, la paume et la manchette disposent maintenant d'un repère commun articulé. Une première résolution vise les jointures avec la longueur avant-bras + paume ; une seconde conserve les os réels de **27 et 29 cm** au poignet ainsi posé. Les doigts de prise restent sur la jante. Leurs racines convergent dans la paume et une petite éminence articulée relie le pouce à celle-ci. Deux pièces s'ajoutent par main : le dos et ce raccord du pouce. Les trois LOD emploient la même pose.

La prise naturelle se relâche avant les trajets du levier et des gestes. Le raccord revient avec la fermeture des doigts. L'enveloppe de toute la grille du levier guide le dégagement de la manchette : le poignet revient exactement à la même place sur le volant après chaque rapport.

La voiture, le volant, la colonne, le siège et les épaules ne sont pas déplacés. Aucun seuil existant de pénétration ou de continuité n'est augmenté.

## Résultats obtenus sur le candidat

| Contrôle | Résultat |
|---|---|
| `main.test.mjs` | 7 vérifications conformes : pièces, normales, prise des doigts et du pouce |
| `pilote-poignets.test.mjs` | 2 tests conformes ; 303 poses sur 3 LOD ; angle maximal au neutre **0,963°**, sur toute la course **14,381°** |
| Raccords des doigts | 21 braquages, les deux mains : quatre racines au contact du dos et raccord du pouce relié aux deux parties |
| `pilote-commun.test.mjs` | 4 tests conformes : 490 poses communes, 1 380 poses de dégagement jante/pommeau, 10 010 poses de continuité |
| Continuité du rapport | Pas maximal poignet **3,810 mm**, coude **3,137 mm** pour une phase de 0,001 ; seuil existant de 6 mm conservé |
| `pilote-habitacle` — gestes | 618 poses conformes, surfaces réelles des mains et bras contre coque/casque/direction |
| `pilote-habitacle` — mains/jante | 380 poses conformes, surfaces Float32 de toutes les pièces des mains |
| `pilote-expressions.test.mjs` | 6 tests conformes : gestes, prise, retour, entrées et préchauffage |
| `pilote-exterieur.test.mjs` | 14 tests conformes, dont 630 poses avec os constants et 60 000 poses sans GC mineur |

Le test des poignets mesure l'angle depuis la rotation de l'objet réellement rendu et le segment coude–poignet. Le test de raccord utilise les triangles du dos rendu et les volumes des doigts. Les anciens tests de jante/pommeau demeurent inchangés.

## Limites et suite

La capture locale du vrai jeu a échoué avant toute image : Chromium refuse `socket()` dans `process_singleton`. **Aucune qualification visuelle WebGL n'est déclarée.** La revue prioritaire reste le profil et les trois-quarts extérieurs, au neutre puis aux braquages, suivie du cockpit issu du même rig.

Le contrôle des gestes extrêmes (60 poses, 3 LOD) était conforme avant les derniers raccords des doigts et du pouce ; il doit être relancé sur le commit intégré. La campagne générale, le build final et la qualification après intégration relèvent du jalon suivant. Aucun déploiement n'est effectué par ce lot.

**Point restant mesuré :** le banc historique `voiture-permanents.test.mjs` refuse la mesure mémoire du chemin `cockpit` : **16,936 octets/appel et 2 GC mineurs** sur 150 000 appels. Les contrôles de permanence d'objets passent, ainsi que le banc extérieur animé ; cette allocation du chemin historique doit être isolée et supprimée avant de déclarer la campagne générale conforme. Aucun seuil n'a été changé pour la faire accepter. Le jalon est donc une sauvegarde de candidat, pas une validation générale du runtime.

**Contact restant mesuré :** le cas « un rapport interrompt le geste » de `pilote-habitacle.test.mjs` échoue sur **`avant-bras-1-1/pommeau`**, geste majeur du côté gauche, volant neutre, retour `0/120`. Les mains et les prises restent dégagées dans le balayage dédié, mais l'enveloppe de dégagement doit aussi guider la manche entière dans ce scénario composé. Ce défaut doit être corrigé dans le modèle puis le cas relancé, sans élargir le seuil de contact.

## Résolution des deux réserves — 21 novembre 2026

1. **Allocation `cockpit` (`voiture-permanents.test.mjs`) :** la lecture de `etat.passage` dans `habitacle()` passait par un opérateur ternaire mélangé avec `expression.passageVisuel` (`Tagged`), forçant V8 à emballer les valeurs flottantes (`16 o/appel`). Le passage en contrôle de flux flottant pur (`+etat.passage`) ramène `cockpit` à **0,07 o/appel et 1 GC mineur sur 150 000 appels** (`voiture-permanents` 12/12 conforme, seuils inchangés).
2. **Contact manche droite / pommeau (`pilote-habitacle.test.mjs`) :** le creux artificiel de manche (`-0,019`) s’efface avec la prise naturelle (`1 - naturel`), et les points de contrôle Bézier `P2`/`P1` puis les nœuds intermédiaires de la manche droite dégagent l’enveloppe complète de la grille du levier par le haut et l’intérieur, sans déplacer ni le poignet ni le coude ni relâcher un seul seuil.
3. **Vérifications relancées après correction :** `voiture-permanents` 12/12, `main` 7/7, `pilote-poignets` 2/2 (0,963° neutre / 14,380° course), `pilote-commun` 4/4 (3,810/3,137 mm), `pilote-thorax` 4/4, `pilote-expressions` 6/6, `pilote-exterieur` 14/14, `pilote-gestes-extremes` 2/2 (60 poses × 3 LOD, continuité 1,406/0,703 mm), `pilote-habitacle` 12/12 (dont 810 poses geste/rapport sans contact, saut initial `0,000001 m`). Balayage complémentaire sur 41 angles de volant × 8 rapports : dégagement minimal positif (`+2,87 mm`). Qualification WebGL et intégration sur `0280` à suivre.
