# Lot 27 — Jeu en ligne sans serveur à gérer

Date : **18 novembre 2026**. Branche `etude/enligne`, base `7033ced`.

Statut :
- **Fait :** module réseau, tests Node et essais réels dans Chrome.
- **À intégrer :** l'interface est fournie en correctif (`rapports/enligne-2026-11-18/integration.patch`), à appliquer après le lot fluidité.
- **Pas encore fait :** essai sur deux vrais réseaux. Le salon d'amiga reste en service tant qu'il n'a pas eu lieu.

Demandes de David (18/11) :
- « pour le multijoueur on utilise des codes pour se rejoindre donc serveur obligatoire, on ne peut pas s en faire sans serveur et se donner les IP ? full peer to peer ? » ;
- puis « fais le plus optimal et le plus fiable mais je ne veux pas avoir de gestion de serveur pour ce jeu peer to peer ».

## 1. Réponse courte

- **La course était déjà de pair à pair.** Les liaisons WebRTC sont directes entre les machines. Seul le rendez-vous (se trouver, échanger les descriptions de session) passait par le salon d'amiga, et il servait aussi de repli quand la liaison directe échouait.
- **Se donner l'adresse IP ne suffit pas.** Un navigateur n'ouvre pas de liaison vers une adresse brute. WebRTC doit d'abord échanger, dans les deux sens, une description de session : clés DTLS, identifiants ICE, adresses candidates. L'**invitation à la main** fait exactement cet échange, sans aucun serveur :
  1. l'hôte envoie un texte, ou un code QR ;
  2. l'invité renvoie une réponse.
- **Le code reste, sans serveur à nous.** Le rendez-vous passe en même temps par des relais publics gratuits de trois natures (courtiers MQTT, traqueurs WebTorrent, relais Nostr), et le premier qui livre l'emporte. Tout est chiffré et authentifié par une clé tirée du code : ces relais ne voient qu'un nom de salle sans rapport visible avec le code, et des octets chiffrés.
- **Aucune architecture sans relais à nous ne passe partout.** Sans serveur TURN, deux machines derrière des NAT symétriques (ou un pare-feu qui bloque UDP) ne se joignent pas directement. Dans une partie à trois ou quatre, une machine qui voit les deux autres relaie leur trafic. À deux, un message clair le dit (§ 5).

## 2. Ce que voit le joueur (après le correctif d'interface)

L'écran « En ligne » propose trois cartes :

- **Créer une partie** : un code de dix caractères, affiché `XXXXX-XXXXX`.
  - Toucher le code copie le code et le lien `https://bitume.estrasse.fr/#partie=XXXXX-XXXXX`.
  - Le fragment `#…` ne part jamais vers un serveur. Il est effacé de l'adresse dès qu'il est lu.
- **Rejoindre** : taper le code, ou coller le lien.
  - La saisie ignore les tirets, les espaces et les minuscules. Elle lit O comme 0, et I ou L comme 1.
  - Le dixième caractère vérifie les neuf autres : une faute sur un caractère se voit avant toute recherche.
- **À la main** : « Inviter » et « Coller une invitation ». Pour un réseau local sans Internet, ou quand le code ne trouve personne :
  1. l'hôte obtient un texte d'environ 200 caractères (un lien `#invitation=…`) et un code QR ;
  2. l'invité le colle, ou ouvre le lien, et reçoit une réponse d'environ 150 caractères ;
  3. l'invité renvoie cette réponse, que l'hôte colle à son tour.

  Une invitation reste valable dix minutes et sert à une seule machine. Pour la machine suivante, l'hôte utilise « Inviter une machine à la main », puis la partie complète elle-même les liaisons entre invités.

Dans le salon :
- une ligne d'état dit combien de relais sont joints (« Relais publics joints : 9 (MQTT, WebTorrent, Nostr). »), ou qu'ils sont injoignables et que l'invitation à la main reste possible ;
- chaque machine est marquée « liaison directe » ou « relayée par <machine> ».

En course, une liaison directe perdue affiche « Liaison directe perdue : la course passe par <machine> ».

Le reste ne change pas :
- « Avant le départ » ;
- chaque machine conduit ses voitures sans attendre le réseau ;
- l'hôte fait courir les rivaux ;
- une machine qui part laisse ses voitures à l'ordinateur de l'hôte.

## 3. Architecture

### 3.1 Trois couches, une seule changée

1. **Signalisation**, interchangeable. Ce sont les messages de rendez-vous : présence, offre, réponse, candidats ICE. Ils passent par l'un de trois transports :
   - les relais publics (par défaut) ;
   - le salon de David (`?salon=ws://…`, pour les essais) ;
   - l'invitation à la main (texte ou QR).

   Les messages sont les mêmes partout, et chiffrés de la même façon.
2. **Liaisons WebRTC**, inchangées :
   - canal `etat` (identifiant 0, sans ordre ni reprise) pour les paquets d'état à chaque image ;
   - canal `fiable` (identifiant 1) pour la partie, l'horloge, les départs et les temps.
3. **Maillage et chemins** : chaque machine diffuse la liste de ses voisins directs. Un message pour une machine sans liaison directe prend le plus court chemin, par une troisième machine. Les paquets d'état relayés portent `[2][ttl][de][a]`.

Ce qui n'a pas changé : paquets d'état (15 nombres par voiture), prolongation et correction en 0,12 s, horloge de l'hôte, admission par l'hôte, quatre pilotes et quatre machines au plus.

`PROTOCOLE` passe à **2**. Une page plus ancienne est reconnue et prévenue (« L'autre machine a une autre version de BITUME »), au lieu d'être ignorée.

### 3.2 Le code, le nom de salle et la clé

- **Code** : neuf caractères tirés au hasard en base 32 de Crockford (45 bits), plus un caractère de contrôle (Luhn modulo 32). Il est court à dicter et tient dans un lien.
- **Dérivation** (WebCrypto) :
  1. `PBKDF2-SHA256`, 600 000 tours, sel fixe `bitume/signal/1` ;
  2. `HKDF` en tire ensuite :
     - le **nom de salle** (16 octets en hexadécimal) ;
     - l'empreinte de l'essaim WebTorrent (20 caractères) ;
     - le genre d'événement Nostr (20000 à 29999) ;
     - la **clé AES-GCM 256**.
- **Pourquoi 600 000 tours** : un nom de salle est visible sur les relais. Retrouver le code à partir de lui demande d'essayer les 2^45 codes à 600 000 tours chacun. Sur une carte graphique récente, cela prend des dizaines d'années, alors qu'une partie dure quelques minutes. Côté joueur, la dérivation coûte environ 0,23 s (mesure dans Node sur ce Mac ; pas mesurée dans Chrome), une fois par partie.
- **Enveloppe** : `[1][protocole][iv 12][AES-GCM(JSON)]`, avec les données associées `bitume|<salle>|<protocole>`.
  - Un relais, ou quiconque lit la salle, ne peut ni lire ni forger un message.
  - Rejouer un vieux message ne produit au pire qu'une tentative de liaison qui échoue.
- **Identité de session** : un jeton aléatoire par partie. La clé Nostr est jetable, tirée à chaque partie. Rien ne relie deux parties d'un même joueur.

### 3.3 Les relais publics

- **Une seule source pour la liste** : `RELAIS` de `src/reseau.js`. Trois relais par nature sont en service, toujours les premiers de la liste et dans le même ordre, pour que toutes les machines prennent les mêmes. Les autres attendent en réserve.
- **Envoi** : chaque message part sur tous les relais prêts.
- **Réception** :
  - la première copie passe ;
  - les autres sont écartées par leur identifiant (mémoire de deux minutes) ;
  - un relais qui devient prêt reçoit les messages des dix dernières secondes.
- **Délais** :
  - une connexion qui ne s'ouvre pas en 8 s est un échec ;
  - après un premier échec, nouvel essai 2 s plus tard, puis 4 s après le deuxième ;
  - un relais qui refuse, ou qui échoue trois fois de suite, est écarté deux minutes, et le suivant de la liste prend sa place ;
  - un relais Nostr qui limite le débit est mis en pause cinq secondes, sans être écarté.
- **Clients écrits à la main**, sans dépendance :
  - **MQTT 3.1.1** sur WebSocket (sous-protocole `mqtt`). Un sujet `<salle>` pour toute la salle, un sujet `<salle>/<pid>` par machine. Trames coupées ou collées recomposées ; QoS 1 acquitté ; identifiants facultatifs.
  - **Traqueur WebTorrent**. Diffuser, c'est annoncer cinq « offres » dont la description porte notre enveloppe ; le traqueur remet chaque offre à une autre machine de l'essaim. Trois traqueurs sur quatre refusent une « réponse » adressée sans offre d'origine (essai du 18/11). Tout part donc à la salle, et seul le destinataire inscrit dans l'enveloppe garde le message.
  - **Nostr**. Événements **éphémères** : genre 20000 à 29999, jamais conservés par les relais. Étiquette `x` égale à `<salle>` ou `<salle>.<pid>`. Signature BIP-340 écrite à la main et vérifiée contre les vecteurs officiels.
- **Salon d'essai** (`?salon=`) : le salon de David devient une boîte aux lettres comme les autres, avec les mêmes messages chiffrés.

### 3.4 Rendez-vous et maillage

1. L'invité se signale toutes les 3 s sur les relais tant qu'il n'est pas admis.
2. L'hôte l'appelle : offre, réponse et candidats ICE passent par les relais, au fil de l'eau.
3. Une fois la liaison établie, l'hôte admet l'invité et diffuse la liste des machines.
4. Chaque membre appelle le nouveau venu pour compléter le maillage.
5. Si l'invité ne joint pas l'hôte directement, il entre par un autre membre, qui relaie.

Un relais qui ne répond plus après l'admission ne gêne rien. Les messages de la partie passent ensuite par les liaisons entre machines.

### 3.5 Invitation à la main

- **Description compacte** : identifiants ICE, empreinte DTLS, rôle, candidats (noms `.local`, adresses IPv4 ou IPv6, ports). Le tout fait environ 120 octets, avec une somme de Fletcher-16 qui détecte un texte abîmé, encodés en base64url.
  - L'invitation est un lien d'environ 200 caractères, soit un **code QR version 10**, niveau de correction M.
  - Le code QR est dessiné par le jeu, sans bibliothèque : mode octets, versions 1 à 20.
  - Il est relu par le détecteur de Chrome et par CoreImage sur macOS.
- **Collecte des candidats** : rien ne peut suivre le texte, donc l'invitation attend ses candidats ICE. Elle part 1,2 s après la première adresse publique, ou au bout de 3 s au plus.
  - Chrome laisse souvent la collecte ouverte bien plus longtemps, par exemple pour un serveur STUN muet en IPv6.
  - Mesure : l'invitation était prête en 3,0 à 3,3 s (`essai-main-*`) ; elle l'est maintenant en 1,3 et 1,5 s (`final-main-3`), et 1,2 à 1,6 s lors d'un passage précédent.
- **Sans Internet** : les noms `.local` (mDNS) des candidats suffisent sur le même réseau local.
- **Trois ou quatre machines** : une invitation par machine invitée ; l'hôte complète le maillage par les liaisons déjà ouvertes.
- **Invitation qui porte le code** : si les relais répondent, l'invité cherche aussi la partie par le code. La première liaison établie l'emporte, l'autre est fermée.
- **Échec** : une invitation qui n'aboutit pas est signalée des deux côtés : réseaux qui ne se voient pas, ou dix minutes passées. Une annulation, elle, ne l'est pas.

### 3.6 Relais par une machine de la partie

- Dans une partie à trois ou quatre, deux machines sans liaison directe passent par la machine qui voit les deux. Cela couvre par exemple deux invités qui ne se joignent pas entre eux, mais joignent chacun l'hôte.
- Les paquets d'état sont relayés tels quels, avec leur origine et une durée de vie de quatre sauts. Les flux fiables gardent leur ordre quand leur chemin change.
- Une liaison directe perdue en course bascule par la troisième machine sans départ, puis redevient directe si elle revient.
- STUN : quatre exploitants (Cloudflare, Google, Nextcloud, Twilio). Pas de TURN (§ 5).

### 3.7 Deux cas corrigés sous forte charge

Ce sont deux défauts de la première version de ce module, avant le commit ; le `reseau.js` de la base n'est pas en cause. Ils ont été trouvés en faisant tourner les tests Node par dizaines en parallèle, avec une charge de 30 à 58 sur 10 cœurs. Chacun est corrigé et couvert par un test qui échoue avec l'ancienne règle (§ 7).

1. **Liaison directe perdue, un instant sans chemin, puis relayée.**
   - Le cas : la troisième machine annonce sa liaison avec la machine perdue un peu après la perte. Il y a alors un instant sans aucun chemin.
   - Avant : le passage par la troisième machine n'était pas signalé comme « relayé ». Le message « Liaison directe perdue : la course passe par … » ne s'affichait pas.
   - Maintenant : chaque machine retient la nature de la dernière liaison prête, directe ou relayée. Le passage est signalé quel que soit l'ordre des événements.
2. **Liaison coupée dès son ouverture.**
   - La règle : une liaison ouverte avec une machine jamais admise est fermée au bout de 30 s (`D.etranger`).
   - Avant : ce délai courait depuis l'appel. Une négociation plus longue que lui faisait couper la liaison à peine ouverte, avant la demande d'entrée, et de même à chaque nouvel appel.
   - Maintenant : il court depuis l'ouverture des canaux. Une liaison qui ne s'ouvre pas tombe d'elle-même au bout de 14 s (`D.essai`).
   - Avec les délais de production, ce cas demandait déjà plus de 16 s entre l'ouverture et l'admission : il était improbable. La règle ne dépend plus de la durée de la négociation.

## 4. Relais retenus et risques

Les trois premiers de chaque liste sont en service ; les autres sont la réserve. Sonde du 18/11 depuis Chrome, page `file://` d'origine `null` (`rapports/enligne-2026-11-18/relais-depuis-chrome.json`) : **24 relais sur 25 ont répondu**. `relay.damus.io` a échoué depuis Chrome comme depuis Node ; il est retiré.

La colonne « Ouverture » vaut pour les 16 invités des essais par le code avec les trois natures (rapports `essai-*` et `final-*`) : temps moyen d'ouverture, et nombre de fois où le relais était prêt au relevé, juste après l'admission.

| Nature | En service | Réserve | Ouverture | Ce qu'ils voient |
|---|---|---|---|---|
| MQTT | `test.mosquitto.org`, `broker.emqx.io`, `broker.hivemq.com` | `public.cloud.shiftr.io`, `mqtt-dashboard.com`, `broker-cn.emqx.io` | Mosquitto 0,47 s, prêt 16 fois sur 16 ; EMQX 0,69 s, 14 sur 16 ; HiveMQ 0,50 s, 8 sur 16 (les autres fois encore en cours d'ouverture, sans échec) | adresse IP du joueur, nom de salle, taille et instant des messages chiffrés |
| WebTorrent | `tracker.openwebtorrent.com`, `tracker.webtorrent.dev`, `tracker.files.fm` | `open.ftorrent.com` | 0,47 à 0,56 s, 16 sur 16 | idem, plus l'empreinte d'essaim tirée du code |
| Nostr | `relay.primal.net`, `nostr.mom`, `relay.nostr.net` | onze autres, dont `nos.lol` et `yabu.me` | 0,21 s (nostr.mom) à 0,65 s, 16 sur 16 | idem, plus une clé publique jetable |

Le premier à livrer :
- **Offre de l'hôte** : pour les 16 invités des essais avec les trois natures, elle est arrivée la première par `test.mosquitto.org`.
- **Messages livrés en premier**, sur les 19 invités admis par le code, y compris les trois essais à une seule nature : 17 par `test.mosquitto.org`, 8 par `nostr.mom` et 1 par `tracker.openwebtorrent.com`. Un invité compte pour chaque relais qui lui a livré au moins un message en premier.

Avec une seule nature en service (`?relais=mqtt`, `torrent` ou `nostr`), l'admission a pris 2,2 s, 1,1 s et 1,2 s.

Risques :
- **Ce sont des services publics gratuits, sans engagement.** `test.mosquitto.org` est explicitement un serveur d'essai. N'importe lequel peut disparaître, exiger une clé ou limiter le débit. Trois natures et trois relais par nature rendent improbable la panne de tout à la fois, mais pas impossible.
- **Le jour où trop de relais tombent**, il faut corriger la liste dans `RELAIS`. La page en ligne ne se met pas à jour seule.
- **Vérifier la liste** : `node tools/essai-enligne.mjs --scenario code --relais mqtt --course non`, une nature à la fois. Le rapport donne chaque relais, prêt ou non, et le premier à livrer.
- **Ce que voient les relais.** Un relais voit l'adresse IP de chaque joueur qui s'y connecte, comme n'importe quel site, et peut compter les messages d'une salle. Il ne voit ni le code, ni les descriptions de session, ni les adresses locales, ni le contenu de la partie. Les adresses IP restent visibles des autres joueurs, comme dans toute liaison directe.
- **Réseaux filtrants.** Un réseau d'entreprise qui filtre ces domaines, ou les WebSocket sortants, empêche le code. L'invitation à la main reste possible.
- **Sécurité des en-têtes.** `https://bitume.estrasse.fr/` n'envoie pas de `Content-Security-Policy` (relevé le 18/11) : rien n'y bloque ces connexions. Si un jour le snippet `security_headers` de Caddy en ajoute une, elle doit autoriser ces relais dans `connect-src`.

## 5. Ce qui reste impossible sans relais à nous

- **Deux machines qui ne peuvent pas se joindre directement, et aucune troisième pour relayer.** Les cas typiques sont :
  - un NAT symétrique des deux côtés ;
  - un NAT symétrique d'un côté et un NAT à filtrage strict de l'autre ;
  - UDP bloqué (réseaux d'entreprise, certains réseaux mobiles ou d'hôtel).

  Seul un serveur TURN, qui relaie le trafic, passe dans ces cas. Il n'en existe pas de gratuit et ouvert sans clé secrète, et une clé mise dans une page publique est vite épuisée par d'autres. Le joueur lit alors : « L'hôte est trouvé mais aucune liaison ne passe depuis ce réseau (pare-feu, réseau d'opérateur mobile). Essayez un autre réseau, ou l'invitation à la main. » Pour une invitation : « La liaison n'a pas pu s'établir avec cette invitation : les deux réseaux ne se voient pas. »
- **Se trouver par le code sans aucun relais public joignable**, depuis l'une des deux machines. Il reste l'invitation à la main.
- **Découvrir une partie sur le réseau local sans rien échanger.** Les navigateurs n'offrent ni diffusion ni découverte locale : il faut l'invitation à la main.
- **Une liste publique de parties ouvertes.** Elle demanderait un service qui garde un état. Le code ou le lien suffit entre amis.
- **Continuer sans l'hôte.** Comme avant ce lot, l'hôte tient la partie et l'horloge : s'il part, chacun finit seul.

## 6. Essais réels du 18/11/2026

### 6.1 Méthode

Outil : `node tools/essai-enligne.mjs --scenario <code|main|sans-internet|tiers|par-invite> --machines <2..4>`, sans dépendance.

Lancement :
- 2 ou 3 Chrome 157 sans interface, chacun avec un profil jetable et lancé comme `tools/profil-accrocs.mjs` (DevTools sur un port choisi par le système) ;
- chacun ouvre `dist/bitume.html` en `file://` (contexte sécurisé).

Déroulé, sans raccourci interne :
1. clics réels dans l'écran « En ligne » ;
2. code, ou invitation, puis réponse ;
3. « Choisir la course », puis « Avant le départ » ;
4. 20 s de course, l'ordinateur au volant de chaque voiture ;
5. départ de la dernière machine invitée.

Relevés, toutes les 250 ms : âge et débit des états reçus, cadence de la simulation, et écart entre ce que chaque machine affiche d'une voiture et ce qu'en dit son propriétaire. L'outil vérifie aussi que l'hôte reprend les voitures de la machine partie.

Scénarios :
- `tiers` : deux invités sans liaison directe entre eux ;
- `par-invite` : le troisième n'atteint pas l'hôte.

Dans ces deux scénarios, les liaisons directes sont refusées dans la page (`R.essai.sansDirect`), le reste est réel.

`sans-internet` coupe la résolution de noms dans Chrome (`--host-resolver-rules`, sauf `*.local`) : relais et STUN deviennent injoignables.

Les rapports (`rapports/enligne-2026-11-18/*.json`) ne gardent ni code de partie, ni description de session, ni adresse. Les invitations, codes QR et captures d'écran sont restés hors du dépôt.

### 6.2 Page finale (sha256 `3f074976` : module de ce commit, correctif d'interface appliqué)

Les six rapports `final-*` ont été faits à la suite, avec une charge du Mac de 15 à 32 sur 10 cœurs (d'autres travaux tournaient en parallèle). Seul `final-par-invite-3-sous-charge` vient d'une page antérieure (`6ed0b30d`, avant les deux corrections du § 3.7), à une charge de 137.

Légende des colonnes :
- Âge p95 : âge des états des autres machines au 95e centile, en ms.
- Accord p95 : écart longitudinal au 95e centile, en m, entre ce qu'une machine affiche d'une voiture et ce qu'en dit son propriétaire, au même instant de l'horloge commune.
- Reprise : délai entre le départ de la machine et la reprise de ses voitures par l'hôte. Dans chaque essai, la voiture reprise a ensuite avancé de 49 à 90 m en 2 s.
- L'outil interroge les pages toutes les 100 ms environ : les durées « liés … après » et « reprise » sont des majorants, à ce pas près.

| Rapport | Mise en relation | Relais | Liaisons | Paquets/s | Âge p95 | Accord p95 | Reprise |
|---|---|---|---|---|---|---|---|
| `final-code-2` | admis 1,0 s après le clic | Mosquitto le premier ; 8 relais prêts sur 9 | directe | 60 | 21 à 24 | 0,78 | 15 ms |
| `final-code-3` | admis 1,2 et 1,4 s | Mosquitto ; 9/9 et 9/9 | maillage direct complet 108 ms après les admissions | 58,1 à 60 | 23 à 25 | 0,54 | 11 ms |
| `final-main-3` | invitation prête en 1,3 et 1,5 s, QR relu ; réponse en 0,25 et 0,7 s ; liés 105 et 201 ms après la réponse collée | aucun (`?relais=aucun`) | maillage direct complet en 168 ms | 59,7 à 60 | 21 à 24 | 0,62 | 67 ms |
| `final-sans-internet-3` | invitation en 0,2 et 0,4 s ; réponse en 0,3 s ; liés 106 et 134 ms après | les 9 en échec, ligne d'état « injoignables » | maillage direct complet dès le premier relevé | 59,9 à 60 | 17 à 24 | 0,97 | 51 ms |
| `final-tiers-3` | admis 1,0 s | Mosquitto ; 8/9 et 9/9 | A ↔ B relayée par l'hôte, au début comme à la fin de la course | 59,9 | 18 à 23 | 2,72 (§ 6.4) | 37 ms |
| `final-par-invite-3` | admis 1,0 s, B entré par A | Mosquitto ; 8/9 et 9/9 | B ↔ hôte relayée par A | 58,7 à 59,6 | 23 à 27 | 1,13 | 4 ms |
| `final-par-invite-3-sous-charge` | admis 2,2 et 2,4 s, B entré par A | Mosquitto ; 8/9 et 9/9 | B ↔ hôte relayée par A | 53,8 à 58,7 | 17 à 24, sauf la voiture de A : 594 (§ 6.4) | 0,57 | 150 ms |

### 6.3 Essais précédents, mêmes scénarios

Pages `9ad7dee7` et `ba130ee8` : avant le réglage de la collecte et le retrait de `relay.damus.io`. Fichiers `essai-*.json`.

| Rapport | Mise en relation | Liaisons | Paquets/s | Âge p95 | Accord p95 | Reprise |
|---|---|---|---|---|---|---|
| `essai-code-2` | admis 1,2 s (Mosquitto) | directe | 59,5 à 60 | 20 à 23 | 0,62 | 51 ms |
| `essai-code-3` | admis 0,9 et 1,1 s | maillage direct | 60 | 19 à 23 | 0,68 | 2 ms |
| `essai-main-2` | invitation prête en 3,3 s ; liés 5 ms après la réponse | directe | 58 | 19 à 23 | 1,25 | 143 ms |
| `essai-main-3` | invitation prête en 3,0 à 3,2 s ; liés 0,1 s après | maillage direct | 55,6 à 56,2 | 27 à 34 | 1,42 | 760 ms |
| `essai-sans-internet-3` | invitation en 0,2 à 0,4 s | maillage direct | 60 | 17 à 21 | 1,43 | 6 ms |
| `essai-tiers-3` | admis 0,9 et 1,5 s | A ↔ B par l'hôte | 60 | 17 à 25 | 0,64 | 4 ms |
| `essai-par-invite-3` | admis 1,8 et 1,9 s | B ↔ hôte par A | 59,7 à 59,9 | 18 à 19 | 0,33 | 104 ms |
| `essai-code-mqtt`, `-torrent`, `-nostr` | une seule nature : 2,2 s, 1,1 s, 1,2 s | directe | (sans course) | | | |

Aucune erreur ni exception dans les consoles des pages, sur aucun essai.

### 6.4 Constats

- **La mise en relation par le code prend environ 1 à 1,5 s** avec la page finale, et jusqu'à 2,4 s sous très forte charge. Cela comprend la dérivation de la clé, l'ouverture des relais, l'offre, la réponse et l'ouverture des canaux. Dans tous les essais avec les trois natures, l'offre est arrivée la première par Mosquitto, et les deux autres natures doublent chaque message.
- **La réponse d'un invité ne contenait souvent aucune adresse publique (srflx)** dans ces essais : premier invité de `final-main-3`, et la sonde `sonde-main-2` restée hors du dépôt. Sur une même machine, l'invité joint l'hôte par ses candidats locaux en quelques millisecondes. Chrome semble alors arrêter sa collecte avant la réponse du serveur STUN : dans la sonde du 18/11, la collecte de la réponse s'achève en 2 à 13 ms, sans adresse publique. La réponse du second invité de `final-main-3` a, elle, une adresse publique.
  - Sonde du 18/11 : dans une seule page, une réponse dont l'offre ne pouvait pas être jointe contenait bien son adresse publique. Entre deux réseaux réels, la liaison ne peut pas s'ouvrir aussi vite, donc la collecte devrait aller au bout.
  - **Point à confirmer** à l'essai sur deux réseaux.
- **Invitation prête en 1,3 et 1,5 s** (`final-main-3`) au lieu de 3,0 à 3,3 s (`essai-main-*`), grâce au réglage de la collecte (§ 3.5).
- **Accord de 2,72 m au 95e centile dans `final-tiers-3`** : seulement pour les voitures 0 et 5, toutes deux conduites par l'hôte, qui relayait A ↔ B. Leur médiane est de 0,03 m et leur maximum de 3,3 m. Les voitures de A et B, relayées entre elles, restent à 0,34 et 0,58 m.
  - La mesure compare les positions au même instant de l'horloge commune, avec une extrapolation en ligne droite sur 200 ms au plus. Un choc ou un freinage brusque entre ces deux voitures produirait ce genre d'écart pendant les 0,12 s de correction.
  - Ce n'est pas vérifié : les relevés bruts ne sont pas gardés.
- **`final-par-invite-3-sous-charge`** : la machine A, qui relayait B ↔ hôte, a envoyé ses propres états par à-coups. L'âge au 95e centile est de 594 ms, le maximum de 909 ms, avec 54 paquets/s au lieu de 59. Les états relayés par A sont restés à 17 à 24 ms.
  - Juste après cet essai, la charge du Mac était de 137 sur 10 cœurs, à cause d'autres travaux en parallèle.
  - Refait cinq minutes plus tard, charge à 16 au départ : 19 à 21 ms partout, 59,6 à 59,8 paquets/s. Ce rapport-là a été remplacé par celui de la page finale (`final-par-invite-3` : 23 à 27 ms partout, 58,7 à 59,6 paquets/s).
  - Explication la plus probable : le fil principal de A, privé de processeur, s'est arrêté par moments. Ce n'est pas démontré par une mesure directe. Le vérifier sur trois ordinateurs.
- **Les débits de 53 à 56 paquets/s** de `essai-main-3` et de `final-par-invite-3-sous-charge` viennent d'images moins régulières sous forte charge. La cadence de la simulation est restée à 1,000 (±0,003) dans tous les essais.

### 6.5 Ce que ces essais ne prouvent pas

- **Tous les navigateurs tournaient sur ce Mac.** Leurs liaisons passent par la boucle locale ou le réseau de la maison. Cela **ne prouve pas** la traversée de deux box différentes, ni un NAT symétrique, un réseau mobile ou un pare-feu d'entreprise.
- **Seul Chrome a été essayé.** Firefox, Safari et les téléphones ne l'ont pas été.
- **`sans-internet` coupe la résolution de noms dans Chrome**, pas le réseau. C'est l'équivalent d'un réseau local sans accès dehors pour les relais et STUN nommés, pas une box débranchée.
- **La disponibilité des relais publics le 18/11 ne promet rien pour la suite.**

## 7. Tests Node

Commande de la suite entière : `for t in verifications/*.test.mjs; do node "$t" > /dev/null 2>&1 || echo "ECHEC $t"; done`. Elle passe entièrement : 69 fichiers, en 181 s, le 18/11 au soir, avec le module de ce commit.

- `reseau-signalisation.test.mjs` (8 tests) :
  - code de partie : toute faute sur un caractère se voit ;
  - clés conformes à PBKDF2 et HKDF de Node ;
  - enveloppe chiffrée, authentifiée et liée à la salle ;
  - description compacte ;
  - invitation : coupée, abîmée, autre version ;
  - structure du code QR ;
  - BIP-340 : vecteurs officiels ;
  - événement Nostr : NIP-01.
- `reseau-relais.test.mjs` (9 tests, faux serveurs WebSocket) :
  - MQTT : trames coupées ou collées, QoS 1, identifiants ;
  - traqueur ;
  - Nostr : signatures vérifiées par le faux relais ;
  - les trois natures ensemble, une seule livraison par message ;
  - reconnexion et messages rejoués ;
  - refus et remplacement ;
  - limite de débit ;
  - trames étrangères écartées ;
  - deux machines par `creer` sur les trois natures, puis fermeture de tout.

  Les attentes vont jusqu'à 30 s et rendent la main dès que la condition est vraie. La vérification des signatures Nostr par le faux relais coûte une soixantaine de millisecondes chacune, ce qui ralentit beaucoup ces tests sur une machine chargée, sans les rendre faux.
- `reseau-maillage.test.mjs` (19 tests, faux WebRTC) :
  - 2 à 4 machines, cinquième refusée, quatre pilotes au plus ;
  - relais par l'hôte ou par un invité ;
  - départs propres ou brutaux ;
  - liaison perdue puis rétablie ;
  - liaison directe perdue, un instant sans chemin, puis relayée : « relayée » est signalé (§ 3.7, cas 1) ;
  - négociation plus lente que le délai des inconnus : l'invité entre quand même (§ 3.7, cas 2, avec 300 ms de latence simulée) ;
  - ordre des messages ;
  - invitations : réussite, échec signalé, trois machines, invitation qui porte le code, erreurs lisibles ;
  - code faux ou introuvable ;
  - autre version ;
  - ancien `jeu.js` (`creer({ url })`) par le vrai `serveur/salon.mjs`.
- `outils-reseau.mjs` : faux réseau WebRTC et faux bus partagés par ces tests.

Les deux tests du § 3.7 échouent avec l'ancienne règle et passent avec la nouvelle. Ils reproduisent le cas par construction (liaison bloquée, latence simulée), sans dépendre de la charge.

Séries sous forte charge, tests lancés par dizaines en parallèle (charge relevée à la fin de chaque série) :

| Série | Avant les corrections | Après |
|---|---|---|
| `reseau-maillage`, 30 instances | 1 échec sur 30 (cas 1 ; charge non relevée) | 0 sur 30, deux fois (charge 48, puis 31) |
| `reseau-relais` et `reseau-signalisation`, 30 ou 33 instances | 20 sur 30 (charge 58) : les 20 `reseau-relais`, au test des trois natures ensemble, par des attentes trop courtes, allongées ensuite. Puis, au test des deux machines par `creer`, jamais réunies en 30 s : 7 sur 30 (charge 41), 0 sur 30 (charge 32), 10 sur 33 et 3 sur 33 (charge 40). Les journaux de ces deux dernières séries montrent le cas 2 | 0 sur 66, en deux séries de 25 `reseau-relais` et 8 `reseau-signalisation` (charge 19, puis 27) |

Les séries « après » de `reseau-relais` ont tourné à une charge plus basse que les échecs : elles ne suffisent pas seules. Ce qui prouve la correction, c'est le test du cas 2, qui reproduit la négociation lente sans dépendre de la charge.

Toujours verts :
- `salon-protocole.test.mjs` (29 tests) ;
- `prets-enligne.test.mjs` (29 tests, « Avant le départ ») ;
- `conditions-integration.test.mjs` ;
- `navigation-menu.test.mjs`.

## 8. Intégration

Le commit de ce lot contient seulement :
- `src/reseau.js` ;
- les tests ;
- `tools/essai-enligne.mjs` ;
- ce document et ses preuves.

**Il ne touche ni `src/jeu.js`, ni `src/index.html`, ni `src/style.css`**, réécrits en parallèle par le lot fluidité.

- **Sans le correctif, rien ne change pour le joueur.** Le `jeu.js` actuel appelle `creer({ url: adresseSalon() })`, `creerSalon()` et `rejoindreSalon()`. Le nouveau `reseau.js` les fait passer par le salon comme avant (test « ancien jeu.js »). Le salon d'amiga doit donc rester en service jusqu'à l'intégration.
- **Le correctif** : `rapports/enligne-2026-11-18/integration.patch`, sur `jeu.js`, `index.html` et `style.css`, base `7033ced`. L'appliquer après le lot fluidité : `git apply -3 docs/reprise/rapports/enligne-2026-11-18/integration.patch`.

  Dans `jeu.js`, ce qu'il faut retrouver si le contexte a bougé :
  1. Région évaluée par les tests (de `const EL =` à `function envoyerEtats(`) :
     - `EL` gagne `main`, `statut` et `relais` ;
     - nouveaux `salonEssai`, `NOMS_RELAIS` et `texteRelais` ;
     - `quitterEnLigne`, `majSalon`, `surFermeture` et `nouvelleLiaison` sont adaptés : `creer(Object.assign(B.reseau.optionsPage(), …))` et les événements `liens`, `statut`, `signalisation`, `invitation` et `relais`.

     Cette région ne doit pas appeler `B.reseau` sans garde.
  2. Après `appliquerDistant` :
     - créer et rejoindre (`formerCode`, collage d'un lien, copie du code avec le lien) ;
     - l'invitation à la main : `dessinerQr`, `majMain`, `inviterMain`, `ouvrirMain`, `validerMain`, `surInvitation`, `fermerMain` ;
     - `ouvrirPartage`.
  3. Dans `demarrer()`, juste après `aller('titre')` : `ouvrirPartage();`.

  Nouveaux identifiants dans `index.html` : `l-inviter`, `l-coller`, `l-relais`, `l-main` (avec `l-main-titre`, `l-main-aide`, `l-main-envoi`, `l-qr`, `l-main-texte`, `l-main-copier`, `l-main-saisie-bloc`, `l-main-champ`, `l-main-saisie`, `l-main-valider`, `l-main-fermer`) et `l-inviter-plus`. Le champ `l-code` passe à 11 caractères.
- **Après application** :
  1. relancer `prets-enligne`, `conditions-integration`, `navigation-menu`, `salon-protocole` et `reseau-*` ;
  2. `python3 construire.py` ;
  3. `node tools/essai-enligne.mjs --scenario code --machines 2`, puis `--scenario main --machines 3` et `--scenario tiers --machines 3`.
- **`AGENTS.md` à mettre à jour par l'intégrateur** :
  - tableau des modules : `src/reseau.js` devient « Jeu en ligne de deux à quatre machines : code par relais publics chiffrés (MQTT, WebTorrent, Nostr), invitation à la main (texte, QR), liaisons WebRTC maillées, relais par une machine, horloge commune, paquets d'état, prolongation » ; `serveur/salon.mjs` devient « Salon d'essai (`?salon=ws://…`) » tant qu'il est gardé ;
  - le paragraphe du salon dans « Mettre en ligne » ;
  - une décision datée du 18/11. Ne pas réécrire celle du 16/11.

## 9. Retirer le salon d'amiga

À faire **seulement après** un essai réussi sur deux vrais réseaux, avec la page qui contient le correctif. Par exemple : le Mac sur la box de la maison, et david-pc ou un portable sur le partage de connexion d'un téléphone. Essayer le code, puis l'invitation à la main.

1. Mettre en ligne la page avec le correctif (`./deposer.sh`, à la demande de David), puis refaire l'essai sur deux réseaux depuis `https://bitume.estrasse.fr/`.
2. Couper le service : `ssh amiga 'systemctl --user disable --now bitume-salon'`.
3. Une fois David d'accord (suppression définitive) : `ssh amiga 'rm -rf ~/apps/bitume/salon ~/.config/systemd/user/bitume-salon.service && systemctl --user daemon-reload'`.
4. `deploiement/bitume.estrasse.fr.Caddyfile` : retirer le bloc `handle /salon* { … }` (lignes 9 à 13) et les lignes 5 et 6 du commentaire d'en-tête. `deposer.sh` repose le vhost, puisqu'il aura changé.
5. `deposer.sh` :
   - retirer les lignes 8 à 10 et 15 et 16 de l'en-tête ;
   - retirer le bloc « Salon du jeu en ligne » (lignes 54 à 66) ;
   - retirer la vérification `salon/sante` (lignes 82 à 88) : le script s'arrête après « EN LIGNE ».
6. Supprimer `deploiement/bitume-salon.service`. Garder ou supprimer `serveur/salon.mjs` et `verifications/salon-protocole.test.mjs` selon la question 2 (§ 10). S'il est supprimé, retirer aussi `adresseSalon`, `SALON` et l'option `?salon=` de `src/reseau.js`, et le test « ancien jeu.js ».
7. `AGENTS.md` : retirer la mention du salon dans « Mettre en ligne ».

Les anciennes versions gardées dans `releases/` (retour arrière) passent par le salon. Une fois celui-ci retiré, leur jeu en ligne ne marche plus.

## 10. Questions pour David

1. **Retirer le salon** dès l'essai réussi sur deux vrais réseaux, ou le garder un temps en secours ? Il coûte un service Node sur amiga, et le nouveau jeu ne s'en sert plus.
2. **`serveur/salon.mjs`** : le garder dans le dépôt comme salon d'essai (`?salon=`), ou le supprimer avec ses tests ?
3. **Adresses IP** : accepter que les relais publics voient l'adresse IP des joueurs pendant la mise en relation ? C'est le cas de tout site. Les autres joueurs la voient de toute façon, puisque la liaison est directe.
4. **TURN un jour ?** Pour les rares réseaux sans liaison directe possible à deux machines, il faudrait un relais à nous : `coturn`, donc un serveur à gérer, ou un service payant. Proposition : non, tant que personne ne bute dessus.
5. **L'essai sur deux réseaux** : quand, et avec quelles machines ? Par exemple le Mac à la maison et un portable sur le partage de connexion d'un téléphone.
