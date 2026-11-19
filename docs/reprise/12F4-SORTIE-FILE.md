# 12F4 — dégagement de la file des stands

## Reprise du 19 novembre 2026

Demande de David : continuer le lot IA aux stands et résoudre le joueur durablement garé devant un rival.
Base sources p12 publiée : `cb0235085431acbc044f785e27b26ca382c5556a`, branche `codex/bitume-12f4-20261119`.
La session source termine séparément la publication 0.2.51. Cette reprise est isolée dans
`codex/bitume-12f4-sortie-file-20261119` ; **cible 0.2.52 / p13**, qualification complète en cours.
Le build conservé au checkpoint sources n'est pas le livrable de cette correction.

## Défauts reproduits et correction

Les cas initiaux à 8 et 10 m derrière un humain immobile restaient bloqués après 40 secondes. Le service déjà
achevé pouvait lui aussi laisser une IA immobile en sortie. Les tests rouges sont conservés dans le rapport.

- Le dégagement peut prendre un recul par les commandes ordinaires : environ 1 m/s, 5 m et 6 s au plus par
  tentative, deux essais au plus. La réserve de freinage fait partie de la distance ; aucune pose ni vitesse
  n'est écrite par la stratégie. L'espace arrière et les marges des voitures sont relus à chaque pas.
- À très faible vitesse, les commandes de direction suivent le braquage géométrique réellement utilisé par le
  moteur ; la commande de course calculée en v² devenait trop faible pour permettre de tourner au pas.
- Une sortie obstruée après un service achevé peut rejoindre la piste avant le bout de la voie. Le service
  payé reste acquis ; il n'est pas recommencé. Un arrêt abandonné avant service conserve les quatre pneus usés.
- Le trafic latéral est examiné avant toute décision de fusion. La stratégie reste active jusqu'au dépassement
  complet du bloqueur, avec marge des caisses ; aucun retour à l'IA ordinaire pendant le recul.
- L'autorité réseau, les forces de conduite, l'usure et les modules FERRO sont conservés. Pas de contact,
  téléportation ou secours automatique ajouté pour libérer la file.

## Vérification

Neuf contrôles spécifiques acquis : file à 8 m et 10 m, approche réelle depuis 350 m, arrière occupé puis libéré
par des commandes humaines, sortie après service réel, pluie, neige, Haut-Col et joueur qui redémarre pendant la manœuvre. Zéro contact, choc, rail,
accident ou replacement observé ; continuité du déplacement et conservation des pneus vérifiées à chaque pas.
Les 17 trajets du lot initial et les 6 contrôles de décision repassent avec cette stratégie.

Les références p9 à p12 restent intactes. **p13** isole ce changement de comportement et ajoute une référence
avec recul, dépassement et reprise réellement observés. Création documentée puis qualification sans régénération.
Rapports : `docs/reprise/rapports/12F4-SORTIE-FILE-2026-11-19/`.

## Publication et suite

Terminer les suites sur sources figées, intégrer le reçu et le build 0.2.51 de la session source sans l'écraser,
construire deux fois 0.2.52, publier sources/build/preuves et contrôler le distant. Ne pas requalifier les anciens
lots ni rouvrir Safari. Les tests CPU ne valent ni validation WebGL ni essai entre navigateurs réels.
Le déploiement du site reste distinct ; Mac/Spark/amiga indisponibles dans cette session.

Demandes conservées : Russie, Monaco fidèle, Spéciale Marseille issue d'EMPRISE avec relief, huitième circuit
de montagne distinct de Haut-Col et six propositions. Le choix du lot suivant se fera depuis la liste maître.

## Qualification finale acquise

**107/108 suites**, seul échec traces hérité identique ; **22 scénarios / 1 415 empreintes p13**, deux builds identiques de **14 060 666 octets**, 53 scripts valides et 34 modules FERRO inchangés. Neuf scénarios de dégagement réussis ; rapport `docs/reprise/rapports/12F4-SORTIE-FILE-2026-11-19/qualification-execution.json`. Publication finale en cours, reçu à vérifier avant de déclarer la livraison.
