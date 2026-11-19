# 13A — Russie : tracé et relief de Baïkal

## Point actif — 19 novembre 2026

**En cours, sources initiales ; parcours physiques et qualification finale à terminer.**
Base livrée : `18451e0eeb701d720f08c069b841d79c2439755d`, BITUME **0.2.52 / p13**.
Branche : `codex/bitume-13a-russie-20261119`. Build conservé à 0.2.52 jusqu'à la qualification.

## Contrat du lot

Ajouter la Russie après les sept circuits existants, sans modifier leur ordre, leurs identifiants, leurs graines,
leurs géométries ou leurs records. Le grand circuit de montagne distinct de Haut-Col reste demandé séparément.
L'identité **Baïkal** est un choix de conception de ce lot, issu de la proposition du plan maître ; David a demandé
la Russie sans imposer de région. Ce parcours original ne reproduit aucune route réelle.

| Élément | Choix et mesure initiale |
|---|---|
| Catalogue | ID `baikal`, indice 7, nom Baïkal, thème `baikal` |
| Graine | 179, à figer après qualification des parcours |
| Longueur | Visée 5 400 m ; générée **5 424 m** |
| Relief de piste | **62,9477 m** ; pente absolue maximale **6,8 %** |
| Ligne droite principale | **816 m**, grille et stands plats |
| Rayon minimal | **37,1979 m** |
| Stands | Entrée 30 m, sortie 240 m, service entre 70 et 118 m |
| Validation géométrique | Aucune erreur de `circuit.valider()` |

Le parcours monte depuis une rive basse vers la forêt, atteint un promontoire puis descend vers le retour ouvert.
Le profil altimétrique utilise des raccords quintiques, sans cassure de pente ni de courbure verticale aux jonctions.
Il ne s'applique qu'au thème russe ; les tirages aléatoires et les calculs des sept pistes historiques sont conservés.

Un thème de base explicite fournit conifères, terrain, saisons et solides pour le roulage. Le lac, les berges,
les lieux détaillés, la végétation et la faune propres au Baïkal relèvent de **13B**. L'écologie et les animaux
emploient encore les replis forestiers existants ; ne pas annoncer le décor russe terminé.

## Qualification requise

- Comparer les empreintes géométriques des sept pistes à la base 0.2.52, sans régénérer les fixtures p9–p13.
- Contrôler fermeture, pentes, trajectoire, départ, stands et invariance du nouveau tracé.
- Faire plusieurs tours avec onze rivaux, le joueur conduit par l'IA, les contacts et vrais obstacles du décor.
- Couvrir sec, pluie et neige avec pneus adaptés ; compter contacts, chocs, rails, replacements et stagnations.
- Vérifier le service des stands sur le nouveau circuit et conserver les correctifs de sortie de file.
- Exécuter les suites nécessaires, conserver l'échec traces hérité distinct de tout nouvel échec, puis construire
  deux fois et publier sources, preuves, jeu compilé et reprise.

La physique reste **p13** tant que les sept pistes et la conduite restent identiques. L'empreinte de compatibilité
des sources est recalculée au build ; le nouveau circuit possède son propre identifiant de records.

## Accès et limites

Le wrapper Spark `~/bin/kbza` est absent ici ; travail local et revue par agents. Aucun changement de FERRO.
Pas de mesure FPS matérielle ni de validation WebGL déclarée. Le dépôt GitHub et le déploiement sont suivis séparément.
Après clôture de 13A : **13B — Russie, décor et saisons** ; Monaco, Marseille avec relief, montagne et six propositions
restent dans le plan maître.
