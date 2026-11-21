# Mains : reprise et mémoire, 21 novembre 2026

## Base et périmètre

Base mobile qualifiée : `6526493d3f2dfc472eb0dc8f8a6e2354dedf6ace`.
Sa géométrie est celle de la .79. Ce candidat reprend les préparations mains
les plus récentes, sans modifier le démarrage passif, la physique ni FERRO.
Les seules sources runtime modifiées sont `src/main.js` et `src/voiture.js`.
La version et le HTML ne sont pas reconstruits par ce lot préparatoire.

Les doigts et le pouce gardent leurs longueurs pendant les mouvements. Le majeur
et l'annulaire prolongent leur prise au dos de la branche du volant pour garder
des proportions cohérentes lors du déploiement. Les treize états restent
discrets ; leur nombre accru ne constitue pas une interpolation continue.
La trajectoire du poignet et sa rotation dégagent les doigts et la manchette.

## Réduction du stockage des mains

Les coordonnées identiques des triangles de mains sont partagées à leur
enregistrement. La comparaison porte sur les valeurs Float64 exactes, zéros
signés compris ; les collisions de hachage sont départagées par égalité exacte.
Les tableaux partagés sont immuables. Aucun triangle, normale, ordre de face,
état de geste ou buffer FERRO n'est supprimé ou modifié par ce partage.

1 211 760 références de coordonnées ne retiennent plus que 208 732 tableaux.
Le heap médian de préparation du candidat passe d'environ 203,3 à 141,1 Mo.
La base .79/mobile retenait environ 173,9 Mo dans le même banc. Ces mesures
Node portent sur les modules du modèle, pas sur toute une partie WebGL.

Le candidat conserve 98 formes d'expression et 197 200 triangles, contre 48
et 143 232 dans la base. Les buffers géométriques totaux restent à 37 601 928
octets, soit 4 533 312 octets de plus que la base. Leur réduction demanderait
un autre choix de géométrie ou de rendu. Les temps et RSS varient avec la charge
de l'hôte ; aucun gain de vitesse ni résultat sur téléphone n'est annoncé.

Mesures complètes : `BUDGET-PARTAGE-MAINS.json`.

## Vérification locale

Dix fichiers de vérification ciblés réussissent : main, articulations, cache,
pilote commun, expressions, surfaces, gestes extrêmes, poignets, identité voiture
et pilote extérieur. Les contrôles de contact ne sont pas assouplis.

- Partage : empreinte binaire identique avant/après pour toutes les formes de
  mains ; coordonnées gelées et au moins 60 % des tableaux évités.
- Ancrages, longueurs, normales, peau contre jante et branches : conformes.
- 1 380 poses de contact et 10 010 poses de continuité ; pas maximal
  poignet/coude 3,696/3,951 mm par phase 0,001.
- Gestes extrêmes et trois LOD : thorax, coque, tête et autre bras dégagés.
- 60 000 poses extérieures : 1,491 octet échantillonné par pose, aucun GC mineur.
- Invariants indépendants de la fixture : 212 formes hors mains, 18 constantes
  et 240 sorties prescrites hors mains/bras identiques à la base mobile.
  Le témoin d'un déplacement de pommeau de 1 mm est bien rejeté.

Reçu : `INVARIANTS-BASE-MOBILE.json`. La fixture d'identité reprend les poses
volontairement modifiées par les mains ; les contrôles hors mains sont séparés.

## Réception restante

Le candidat nécessite encore une construction par l'intégrateur, la CI du
commit construit et les captures du vrai jeu avant/après aux mêmes phases.
Inspecter particulièrement les prises des deux mains, le salut maintenu,
le retour du levier et le cockpit. Les contrôles de surfaces ne prouvent pas
à eux seuls le réalisme visuel. Aucune publication ni modification du site
n'est réalisée par cette préparation.
