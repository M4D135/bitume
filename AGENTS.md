# BITUME — consignes pour les agents

Jeu de course de monoplaces dans le navigateur, original : circuits générés, onze rivaux, dérive et turbo.
Une seule page HTML, moteur FERRO (WebGL2), tout est calculé par le code.

## Règles du projet

- **Jeu original.** Rien n'est pris au Vroom de Lankhor :
  - ni tracé relevé, ni table ST ou Amiga, ni leurs valeurs ;
  - ni son extrait, ni dessin, ni nom ;
  - ni bandeau d'affichage, ni bannière, ni composition du cockpit Amiga.

  Les mécaniques de jeu peuvent être reprises si on les refait avec notre code et nos constantes :
  - celles inventées pour vroom-unreal, le projet Unreal de David ;
  - celles du genre que le jeu de 1991 avait déjà, quand David les demande : le saut roue contre roue, le
    12/11/2026.

  Dans le doute, demander à David. La règle détaillée est dans `FEUILLE-DE-ROUTE.md`.
- **Aucun fichier d'image ni de son**, aucune police chargée, aucun appel réseau. Le budget de la page est de
  1,4 Mo (`construire.py`).
- Textes du jeu en français. Interface et design : Claude. Le Spark écrit des premiers jets, relus avant intégration.
- Le moteur `src/moteur/renderer.js` ne se retouche qu'avec la marque « BITUME » et une ligne dans
  `src/moteur/PROVENANCE.md`.
- Commits limités aux fichiers de la tâche ; dépôt GitHub privé `M4D135/bitume`. Aucune mise en ligne sans demande
  de David (voir « Mettre en ligne »).

## Structure

| Fichier | Rôle |
|---|---|
| `src/circuit.js` | Tracé généré par graine : arcs et droites, relief, dévers, vibreurs, glissières, trajectoire, vitesse de référence |
| `src/decor.js` | Décor tiré du circuit : nappes (chaussée, accotements, terrain, eau) et lots (arbres, tribunes, portique, glissières) |
| `src/conduite.js` | Conduite en repère de Frenet (s, d) : boîte, rupteur, adhérence, sous-virage, dérive, turbo, glissières, attitude |
| `src/course.js` | Grille, feux, IA, contacts, tours, drapeau, classement, fantôme du chrono |
| `src/son.js` | Synthèse Web Audio : moteur, rivaux, pneus, vibreur, herbe, chocs, signaux |
| `src/carene.js` | Carènes (peau entre sections en superellipse) et tubes lisses, en triangles pour les formes libres du moteur |
| `src/voiture.js` | Monoplace en primitives du moteur, cockpit vu du siège, fantôme translucide |
| `src/realisateur.js` | Réalisateur de la démo : choix du plan (caméra et voiture filmée) d'après la course |
| `src/jeu.js` | Coque : boucle à pas fixe, commandes, caméras, rendu d'une image, affichage, menus, démo, stockage local |
| `src/index.html`, `src/style.css` | Page (gabarit `/*STYLE*/`, `<!--MODULES-->`) et style, polices du système |
| `src/moteur/renderer.js` | FERRO METAL 0.6 par Point de rupture, retouches BITUME |
| `construire.py` | Assemble `dist/bitume.html` (versionnée), `dist/artefact.html` (non versionnée) et `SIZE.json` |
| `verifications/*.test.mjs` | Tests Node des modules de simulation et du son |
| `deposer.sh`, `deploiement/` | Mise en ligne de la page du commit sur bitume.estrasse.fr, et son vhost Caddy |

Chaque module s'écrit `(function (B) { … })(globalThis.BITUME = globalThis.BITUME || {})` et s'exécute aussi dans
Node pour les tests. Ordre de chargement : renderer, circuit, conduite, course, son, decor, carene, voiture, realisateur, jeu.

Formes libres : `window.FRender.forme(nom, triangles)` enregistre une forme faite de triangles `[p0, p1, p2, n0, n1,
n2]` tenus dans le cube unité (`B.carene.normaliser`) ; l'instance porte la vraie taille dans `s`. À appeler avant
`FRender.create` : `voiture.js` le fait à son chargement.

## Conventions

- y vers le haut. Un cap `a` a pour tangente (cos a, sin a) dans le plan (x, z) et pour droite (−sin a, cos a).
- Repère du circuit : abscisse `s`, décalage `d` (> 0 à droite). Courbure > 0 : virage à droite.
  Dévers > 0 : côté droit plus bas.
- `voiture.attitude(cap, tangage, roulis)` = Ry(−cap)·Rz(tangage)·Rx(roulis), tangage > 0 nez levé.
- Caméra FERRO : `yaw = cap + π/2`, `roll = −roulis`. Le champ (`fov`) est vertical, en degrés, borné de 10 à 110.
- Simulation déterministe au pas fixe de 1/120 s, hasard par mulberry32 à graine.

## Décisions de David à tenir (12/11/2026)

- **Musique** : « pas de musique sauf à l'écran titre ». `son.musique(oui)` ne joue que le thème du titre
  (`B.son.THEME`) ; il se coupe sur tout autre écran, démo comprise. Un signal de course tient sur une seule hauteur :
  ni mélodie ni accord (`verifications/son.test.mjs` le vérifie).
- **Cockpit** : cadrage de vroom-unreal 0.35 (`docs/images/cockpit-035-neutral.png` de ce dépôt-là). Le volant est gros
  et bas, 16° sous l'horizon, le bas de sa jante sort de l'image ; on voit les mains, pas les bras. Les gants sont
  articulés (trois phalanges par doigt, pouce, sangle au poignet), construits en code : le maillage des gants de
  vroom-unreal vient de Valve et ne se copie pas. Volant, planche et mains se règlent dans `VOLANT`, `PLANCHE`,
  `COUDE` et `LEVIER` de `src/voiture.js` ; `verifications/voiture.test.mjs` tient le cadrage.
- **Clipping** : rien ne se coupe à distance. Plan lointain `PORTEE_VUE` (6 000 m), lots sans portée propre, bascule
  de détail à 520 m, ombres du soleil sur tout l'atlas (`sunOnly`, carré de 200 m). Ne pas réintroduire de coupe à
  distance sans fondu.
- **Démo** : « comme dans Point de rupture » et « qui dure ». Elle part après 5 s sans geste sur le titre, enchaîne les
  courses sans fin et ne revient au titre que sur un geste.
- **Voiture** : les cotes et la silhouette de la 312 T5, sans le nom Ferrari, sans cheval cabré, sans commanditaire.

## Construire, tester, vérifier

```bash
python3 construire.py
```

```bash
for t in verifications/*.test.mjs; do node "$t" | tail -1; done
```

Dans le navigateur, servir `dist/` en local (`.claude/launch.json`, port 8781, 127.0.0.1) puis ouvrir `bitume.html`.
Dans la console, `BITUME_JEU.avancer(secondes, true)` fait avancer la séance en confiant la voiture du joueur à l'IA,
et `BITUME_JEU.session` donne l'état. Un volet de navigateur caché bride les images par seconde : ne mesurer les
performances que volet visible.

Autres outils d'essai de `BITUME_JEU` :
- `pauseAuto = false` : la course ne se met plus en pause quand la page perd le focus (captures, banc) ;
- `camera = (pose, camera) => ({ pos, yaw, pitch, fov })` : vue libre, par exemple un gros plan sur le volant ;
  `camera = null` rend la vue du jeu ;
- `demo(i)` : lance la démo sur le circuit `i` sans attendre les cinq secondes ; `session.planVu` donne le plan ;
- `son` : `{ actif, voix, musique }`.

Le son ne démarre qu'après un vrai geste (clic ou touche), jamais sur un clic simulé par script.

## Mettre en ligne

Seulement à la demande de David : `./deposer.sh`, depuis le Mac. Le script refuse de partir si `src/`,
`construire.py`, `dist/`, `SIZE.json`, `deploiement/` ou lui-même ne sont pas commités, ou si la page reconstruite
diffère de celle du commit. Sur amiga (compte `ddd`, sans root), il dépose `~/apps/bitume/releases/<commit>/index.html`,
contrôle l'empreinte, bascule le lien `current` d'un coup et garde 3 versions. Il repose le vhost dans
`~/apps/caddy-shared/vhosts.d/` si `deploiement/bitume.estrasse.fr.Caddyfile` a changé, puis vérifie que la page
servie a la même empreinte. Aucun timer : le VPS n'a pas accès au dépôt privé. Le retour arrière est en tête du script.
