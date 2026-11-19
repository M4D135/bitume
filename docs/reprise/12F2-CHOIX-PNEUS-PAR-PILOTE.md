# 12F2 — Choix des pneus par pilote

## Périmètre du 19 novembre 2026

Suite de 12F1 (0.2.48), depuis sa copie qualifiée `fbd8098`. La publication distante de cette base est
à rapprocher du reçu GitHub avant livraison. Travail isolé dans la reprise `67676bee9b18` : ne pas reprendre
les lots 12A–12F1 ni écraser une autre session.

## Comportement

- Chaque pilote local garde son choix de pneus : ancien `reglages.pneus` migré vers les deux entrées de
  `reglages.pneusPilotes`, puis choix séparés. L'ancien champ reste l'alias du premier pilote.
- « Conseillés » suit la chaussée prévue pour le pilote qui l'active. Une monte choisie manuellement reste
  mémorisée et n'est pas remplacée quand l'autre pilote change de choix ou quand on revient des réglages.
  Un navigateur sans préférence commence en mode Conseillés ; une ancienne préférence est conservée.
- La préparation solo, duo et la confirmation en ligne présentent les pneus de chaque pilote local.
  La configuration finale associe chaque monte à son identifiant de voiture humaine, y compris en 2+2,
  2+1 et 1+2. Une modification retire l'accord de départ avant l'envoi du nouveau choix.
- Les messages de choix portent `versionChoixPneus: 1` et un tableau dont la longueur correspond au nombre
  de pilotes de la machine. Types invalides, tableaux incomplets, expéditeurs inconnus/non liés et versions
  incompatibles ne peuvent pas autoriser le départ. Les anciennes versions doivent être rechargées.
- En solo et à deux en local, le menu Pause propose la monte du prochain arrêt pour chaque voiture locale.
  Cette commande ne change ni les pneus montés ni leur usure. Le début du service fige le choix ; le
  remplacement atomique se produit à la fin effective du service, avec les protections de 12F1.
- Les quatre variantes graphiques sont préparées au chargement. La fin du service bascule les sculptures,
  le fond des rainures et les couleurs des flancs dans les objets et tables existants, dans tous les niveaux
  de détail et les vues. Aucun modèle n'est reconstruit en course.

## Frontière avec 12F3

En ligne, les stands continuent de renouveler la monte de départ. Le choix d'une autre monte pendant la
séance reste désactivé jusqu'à la synchronisation du type, de l'usure et de la révision de service ; cela
évite qu'une voiture roule sur une monte différente de celle vue par ses pairs. L'usure distante n'est
toujours pas transportée par ce lot. Ce point doit rester explicite dans la reprise et dans le bilan.

12F3 doit apporter les instantanés à faible fréquence, les identités séance/pilote/service/séquence,
l'événement fiable et idempotent, les contrôles d'autorité, puis la reprise IA depuis le dernier état
accepté. La stratégie de stands IA pour les courses longues reste un sous-lot distinct.

## Validation

Physique **p11 conservée** : les coefficients de conduite et les règles du service 12F1 ne changent pas.
Comparer les 20 scénarios et 1 300 empreintes à la fixture p11 existante, sans la régénérer ; conserver p9/p10.
Les tests ciblés exécutent la migration, le vrai gestionnaire de changement des menus, la confirmation réseau,
les services interrompus/complets, et les représentations des quatre types après remplacement.

Le rapport `rapports/12F2-2026-11-19/qualification-execution.json` fera autorité après la qualification globale
et deux reconstructions. La comparaison CPU des objets de rendu ne vaut pas validation WebGL ou mesure FPS.
Les modules FERRO restent inchangés. Aucun déploiement du site n'est annoncé par ce lot.

## Publication

L'envoi direct du commit de base 12F1 vers `main` a été refusé par le contrôle automatique d'approbation dans
cette session, pour autorisation jugée insuffisamment explicite. Ne pas contourner ce refus par une autre API.
Préparer une branche de revue et une proposition de fusion avec les fichiers réellement qualifiés. Toute
fusion dans `main` reste en attente de l'autorisation correspondante ; vérifier indépendamment l'avancement
des autres sessions avant de créer les commits de revue.
