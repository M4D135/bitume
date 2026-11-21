# Compteur global sur le titre — 21 novembre 2026

Demande de David : afficher **Visites** et **Visiteurs uniques** sur l’écran titre.
Le compteur reçoit les vrais totaux du serveur ; les retours au menu, rechargements
et réessais ne sont pas de nouvelles visites. Les deux valeurs restent absentes
des écrans de préparation et de course.

## Définition retenue

- Une visite est une session d’activité du navigateur. Après **30 minutes sans
  activité**, le prochain geste ouvre une nouvelle visite. Clavier, souris, tactile
  et accélérateur/frein/direction des deux manettes entretiennent la session.
- Le navigateur conserve un identifiant aléatoire `crypto.randomUUID()` dans
  `localStorage`, ainsi que l’identifiant de session et sa dernière activité.
  Web Locks coordonne les onglets lorsqu’il est disponible ; le serveur fusionne
  aussi les identifiants concurrents d’un même navigateur dans la session active.
- Un visiteur unique est donc **un navigateur dont le stockage est conservé**.
  Une même personne sur deux appareils ou deux navigateurs compte deux fois.
  Effacer le stockage ou changer de profil peut créer un nouveau visiteur unique.
  Il ne s’agit pas d’une identification des personnes ni d’un dispositif antibot.
- Si le stockage est bloqué, le jeu lit les totaux sans inventer de nouvelles
  identités à chaque chargement. En fichier local, hors connexion ou si le service
  est indisponible, les deux valeurs affichent `—`, jamais un zéro fabriqué.

## Réseau et conservation

Le module `src/visites.js` utilise seulement `/salon/visites` sur le même site.
Le premier titre enregistre la session, puis l’activité est regroupée hors du
rendu et signalée au plus toutes les cinq minutes. Une nouvelle session est
signalée à son ouverture ; le titre peut relire les totaux après une minute.
Aucun appel réseau n’est effectué à chaque frame. Une panne produit une attente
de trente secondes avant réessai, sans bloquer le jeu.

L’API accepte `GET` pour les totaux et `POST` pour les deux UUID. Elle refuse les
origines étrangères, les autres méthodes, les identifiants invalides, les clés
supplémentaires/dupliquées, le JSON invalide et les corps dépassant 256 octets.
Les requêtes simultanées sont bornées à 32 et les écritures sont sérialisées.
Le salon WebSocket et sa santé restent sur leurs routes existantes.

Le serveur ne conserve **ni IP, ni UUID brut, ni User-Agent** pour ce compteur.
Il stocke des empreintes SHA-256 réduites à 128 bits, la dernière activité par
navigateur, les identifiants de sessions hachés et les totaux. L’index historique
des sessions assure l’idempotence, y compris pour un réessai ancien. Il augmente
avec la fréquentation ; aucun effacement automatique ne change les totaux.
Chaque alias d’onglet reste lié à son groupe de session : un ancien réessai ne
prolonge pas artificiellement une session différente ou déjà expirée.

## Déploiement et restauration

Le module serveur `serveur/visites.mjs` est copié avec `serveur/salon.mjs` par
`deposer.sh`. Le service fixe :

```text
BITUME_VISITES_FICHIER=/home/ddd/apps/bitume/donnees/visites.json
```

Les données sont **hors des répertoires `releases/`**, de leurs purges et du code
du salon. La copie HTML seule ne suffit pas : le prochain déploiement normal doit
mettre à jour les deux modules et l’unité du salon. Ce lot ne déploie pas le site.
Le compteur commence à sa mise en service ; il ne reconstitue pas les visites
antérieures à son installation.

Chaque réponse positive à une écriture attend une sauvegarde atomique avec
`fsync`. Le fichier principal et `visites.json.bak` contiennent la même génération,
avec checksum. Au redémarrage, le service retrouve la génération valide la plus
récente, y compris une écriture `.next` interrompue. Une copie intacte répare la
copie tronquée ou absente. Deux copies illisibles, des versions incompatibles,
des données contradictoires ou une erreur de permission donnent **503**, sans
remise à zéro ni écrasement par un compteur vide.

Pour une restauration manuelle, arrêter le service, préserver le dossier de
données existant, restaurer le fichier et sa copie d’une même sauvegarde, puis
relancer le service. Les `.next` plus récents doivent être examinés avant d’être
déplacés : le démarrage privilégie la génération la plus haute. Ne pas modifier
à la main les totaux ou leur checksum. Un retour à une version de serveur qui ne
comprend pas le format enregistré doit conserver les données et rester indisponible.

Le format historique explicite `{ "version": 0, "visites": N,
"visiteursUniques": U }` peut être migré sans réduire les totaux. Comme ce format
ne possède pas d’identifiants, ses visiteurs ne peuvent pas être reconnus ensuite :
ses valeurs deviennent un socle conservé. Aucun historique n’est inventé.
La limite de fichier est 32 Mio par copie ; si elle est atteinte, conserver les
données et adapter le stockage avant de reprendre, sans purger les identifiants.

## Qualification du lot

- Contrôles serveur sur de vrais fichiers temporaires : durabilité, redémarrage,
  doublons, onglets concurrents, uniques, sessions, restauration, écriture
  interrompue, migration et refus de schémas/entrées invalides.
- Contrôles du module navigateur avec stockage partagé et vrai compteur serveur :
  rechargement/onglets, activité, inactivité, panne réseau après écriture, stockage
  bloqué, absence de réseau dans le rendu, copie locale et intégration titre seule.
- Syntaxes JavaScript et shell vérifiées. Les essais TCP du salon et les captures
  du vrai navigateur restent des vérifications CI : l’environnement local refuse
  la création de sockets. La présence du compteur ne vaut pas déploiement en ligne.
