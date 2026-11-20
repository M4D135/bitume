# 00 — Coordination et publication

## Prompt à copier

~~~text
Continue BITUME comme coordinateur de la répartition parallèle du 20/11/2026.
Dépôt : https://github.com/M4D135/bitume
Lis AGENTS.md, REPRISE.md puis docs/reprise/PARALLELE-2026-11-20/README.md, 00-INTEGRATION.md et etat/00.json.
Vérifie main et les branches/PR des lots 01 à 05. Préserve les travaux existants. Tu es seul responsable des raccords jeu.js, des builds, du verrou FERRO et du suivi global. Intègre les petits lots prêts, qualifie le candidat exact, commit/push et fusionne sur main sans écraser les travaux parallèles.
Économise le contexte : une intégration à la fois, preuves sur disque, reprise courte après publication. Si rien n'est prêt, termine inventaire/contrats et indique les livraisons attendues ; ne boucle pas en attente. Aucun déploiement du site pour cette mission.
~~~

## Premier jalon

Relever les branches/HEAD, périmètres et prochaines actions. Vérifier les reprises déjà publiées et les brouillons locaux signalés. Ne pas supposer qu'un SHA local existe sur GitHub. Réserver les fichiers de la table et publier les contrats retenus dans raccordements/00.md.

## Contrats à fixer

Ces interfaces sont des propositions à relire, pas des API déjà livrées.

| Échange | Contrat minimal |
|---|---|
| Menu → Troll/séance | Geste et klaxon par joueur, valeurs/défauts partagés, persistance et préparation en ligne conservées |
| Pilote → son | Événement de début réel du geste : séquence unique, pilote, geste, klaxon, instant, côté ; consommé une fois avant les rendus J2/J1 |
| Menu → boucle | Écran actif, mouvement réduit et budget ; aperçu caché arrêté ; course sous menu opaque suspendue sans casser la démo du titre |
| Performance → rendu | Budgets/importance par vue avec hystérésis, sans modifier simulation ou collisions |
| Saisons → préparation | Clé saison/climat dans les caches, résultat déterministe préparé avant départ |
| FERRO → BITUME | Version/SHA qualifiés et contenu exact du verrou ; aucune copie locale divergente |

## Intégrer et qualifier

Utiliser une branche candidate isolée. Reprendre les commits propres et séparer les raccords partagés d'une branche contenant plusieurs lots. Conserver provenance et auteurs. Les versions candidates locales ne réservent pas le prochain numéro du jeu.

00 seul produit les versions/builds à publier. Tests ciblés du changement et des interfaces affectées, captures utiles, contrôle du verrou, build reproductible, puis CI du commit exact et vérification du contenu reçu selon le protocole du dépôt. Conserver les seuils et échecs réels. Une modification de source invalide les preuves qui en dépendent.

Après qualification, publier/fusionner main, relire sa tête et les fichiers reçus ; mettre à jour REPRISE, etat_courant, FILE-TRAVAIL et le journal. Une clôture documentaire ne relance pas la campagne d'un runtime inchangé. Ne pas supprimer les anciennes branches.

Publier les petits lots indépendants sans attendre la totalité du programme. Documenter les changements partiels comme tels. Une preuve locale, une preuve CI et une mesure matérielle sont distinguées.

## Point de reprise

etat/00.json : base, branche candidate, HEAD, lots et SHA intégrés, preuves, publication/PR, réserves, prochain raccord. Si aucune branche prête n'existe encore, finir ce point utile puis rendre la main.
