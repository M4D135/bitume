# BITUME — consignes pour les agents

Jeu de course de monoplaces dans le navigateur, original : circuits générés, onze rivaux, dérive et turbo.
Une seule page HTML, moteur FERRO (WebGL2), tout est calculé par le code.

## Règles du projet

- **Jeu original.** Rien du Vroom de Lankhor : ni tracé relevé, ni table ST ou Amiga, ni son extrait, ni dessin,
  ni nom, ni bandeau d'affichage, ni bannière. Les mécaniques inventées pour vroom-unreal (le projet Unreal de David)
  peuvent être reprises ; ce qui vient du jeu de 1991 ne l'est jamais. Dans le doute, demander à David.
- **Aucun fichier d'image ni de son**, aucune police chargée, aucun appel réseau. Le budget de la page est de
  1,4 Mo (`construire.py`).
- Textes du jeu en français. Interface et design : Claude. Le Spark écrit des premiers jets, relus avant intégration.
- Le moteur `src/moteur/renderer.js` ne se retouche qu'avec la marque « BITUME » et une ligne dans
  `src/moteur/PROVENANCE.md`.
- Commits limités aux fichiers de la tâche ; dépôt GitHub privé `M4D135/bitume`. Aucune mise en ligne sans demande.

## Structure

| Fichier | Rôle |
|---|---|
| `src/circuit.js` | Tracé généré par graine : arcs et droites, relief, dévers, vibreurs, glissières, trajectoire, vitesse de référence |
| `src/decor.js` | Décor tiré du circuit : nappes (chaussée, accotements, terrain, eau) et lots (arbres, tribunes, portique, glissières) |
| `src/conduite.js` | Conduite en repère de Frenet (s, d) : boîte, rupteur, adhérence, sous-virage, dérive, turbo, glissières, attitude |
| `src/course.js` | Grille, feux, IA, contacts, tours, drapeau, classement, fantôme du chrono |
| `src/son.js` | Synthèse Web Audio : moteur, rivaux, pneus, vibreur, herbe, chocs, signaux |
| `src/voiture.js` | Monoplace en primitives du moteur, cockpit vu du siège, fantôme translucide |
| `src/jeu.js` | Coque : boucle à pas fixe, commandes, caméras, rendu d'une image, affichage, menus, stockage local |
| `src/index.html`, `src/style.css` | Page (gabarit `/*STYLE*/`, `<!--MODULES-->`) et style, polices du système |
| `src/moteur/renderer.js` | FERRO METAL 0.6 par Point de rupture, retouches BITUME |
| `construire.py` | Assemble `dist/bitume.html` (versionnée), `dist/artefact.html` (non versionnée) et `SIZE.json` |
| `verifications/*.test.mjs` | Tests Node des modules de simulation et du son |

Chaque module s'écrit `(function (B) { … })(globalThis.BITUME = globalThis.BITUME || {})` et s'exécute aussi dans
Node pour les tests. Ordre de chargement : renderer, circuit, conduite, course, son, decor, voiture, jeu.

## Conventions

- y vers le haut. Un cap `a` a pour tangente (cos a, sin a) dans le plan (x, z) et pour droite (−sin a, cos a).
- Repère du circuit : abscisse `s`, décalage `d` (> 0 à droite). Courbure > 0 : virage à droite.
  Dévers > 0 : côté droit plus bas.
- `voiture.attitude(cap, tangage, roulis)` = Ry(−cap)·Rz(tangage)·Rx(roulis), tangage > 0 nez levé.
- Caméra FERRO : `yaw = cap + π/2`, `roll = −roulis`. Le champ (`fov`) est vertical, en degrés, borné de 10 à 110.
- Simulation déterministe au pas fixe de 1/120 s, hasard par mulberry32 à graine.

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
