# 12E — Chaussée et adhérence

## Reprise bornée

Base publiée : **0.2.46**, `9c49abad670b16c67127c921b6522fecd29daf79`.
77 sources et le build vérifiés contre le reçu 12D. Ne pas reprendre l'usure visuelle.
Un seul lot actif, sources et tests puis construction et publication ; sorties complètes dans les rapports.

## Contrat du lot

- Une lecture commune `B.chaussee.lire(circuit, s, meteo, sortie)` fournit eau, couverture neigeuse et abri.
- La couverture `neigeSol` est un état explicite de jeu. La saison, les flocons et l'eau liquide restent distincts.
  Le départ hivernal initialise 75 % de couverture hors Port-Sable, en cohérence avec le paysage enneigé.
  Une observation météo réelle de neige ne prétend pas mesurer une épaisseur au sol. Pas d'accumulation/fonte
  dynamique dans ce lot ; humidité et séchage existants restent dynamiques. Les tunnels restent secs et déneigés.
- Quatre domaines utiles : slick au sec, intermédiaire humide, pluie très mouillé, neige sur couverture neigeuse.
  Coefficients de jouabilité explicités, sans les présenter comme des mesures de pneus réels.
- L'usure de chaque roue réduit progressivement sa capacité, avec une borne ; joueur et IA lisent la même chaussée.
  Conserver l'état des quatre roues après accident et ne pas restaurer les pneus des rivaux en cachette.
- Recommandation et choix neige raccordés au départ, en démo et aux conditions de l'hôte.
- **Physique p9 → p10** : nouveaux espaces de records/fantômes, anciens conservés mais incompatibles.

## Répartition des fichiers

- Surface : `src/chaussee.js`, test de contrat dédié.
- Physique : `src/pneus.js`, `src/conduite.js`, `src/course.js`, test adhérence dédié.
- Raccord : `src/jeu.js`, `src/meteo.js`, `src/index.html`, `construire.py` et tests d'intégration.
- FERRO canonique 0.3.11 inchangé. Ne pas rouvrir Safari, les nouveaux circuits ou la refonte de conduite 17.

## Qualification à conserver

Comparer les quatre pneus sur sec/humide/détrempé/neige et neuf/usé ; contrôler tunnel, absence de valeurs
invalides, usure au repos et hors contact, recommandations, IA et isolation des records. Conserver le témoin p9,
sans réécrire sa fixture pour masquer son échec historique. Enregistrer une référence p10 distincte si qualifiée.
Reconstruction identique, empreintes sources/build, 34 modules FERRO, vérification distante après publication.
Les deux échecs 12D (`determinisme-simulation`, `traces`) doivent être distingués des nouveaux écarts.

## Suite précise

Après 12E publié : **12F**, remplacement réel aux stands, affichage détaillé, état d'usure réseau versionné.
Les rivaux n'ont pas encore de stratégie de changement de pneus ; maintenir une usure adaptée aux courses prévues.
La validation WebGL reste ouverte jusqu'à observation effective ; aucune performance matérielle ni mise en ligne
n'est déduite d'un test CPU ou d'un push GitHub.
