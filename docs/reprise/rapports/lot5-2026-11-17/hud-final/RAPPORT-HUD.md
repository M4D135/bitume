# Qualification du HUD étroit — 17 novembre 2026

## Correctif

Seul `src/style.css` est modifié : sous 600 px, les quatre compteurs utilisent une grille qui tient dans la largeur disponible ; les chronos passent dessous. En tactile, le bouton Pause conserve sa cible de 44 × 44 px sur la deuxième ligne et la carte descend sous le HUD. Le paysage de 640 px et les deux dispositions duo à 960 px gardent leur mise en page antérieure. Aucun JavaScript, cadrage, rétroviseur ou comportement de jeu n'est modifié.

## Vérification réelle

Le vrai HTML `dist/bitume.html` est chargé dans Chrome Headless 157 avec WebGL2/SwiftShader. Sa feuille de style est remplacée en mémoire par le contenu exact de `src/style.css` ; aucun build n'est réalisé par cet essai. La séance utilise l'API de référence existante, une caméra cockpit et une horloge rAF commandée. Les captures sont donc des contrôles de rendu et de mise en page, pas des mesures de FPS.

Les scénarios tactiles utilisent **`is_mobile=true`, `has_touch=true` et un user-agent mobile**. Le jeu active lui-même sa classe tactile grâce à `maxTouchPoints` et au pointeur grossier. Le cas desktop 360 × 640 est vérifié séparément.

Chaque scénario est relevé avec l'état normal puis avec des libellés de contrainte : Position 12/12, Tour 99/99, Pneus Intermédiaires, Santé Service 12,3 s, chrono 9:59,999. Les limites du HUD, les intersections des textes entre compteurs et les croisements compteurs/chrono/pause/carte sont contrôlés par leurs rectangles réellement calculés par Chrome.

| Scénario | Tactile détecté | État normal + libellés longs | Erreurs JS / mise en page |
|---|---|---|---:|
| desktop-360x640 | Non | Reussi | 0 |
| touch-360x640 | Oui | Reussi | 0 |
| touch-390x844 | Oui | Reussi | 0 |
| touch-640x360 | Oui | Reussi | 0 |
| desktop-960x540 | Non | Reussi | 0 |
| duo-cote-960x540 | Non | Reussi | 0 |
| duo-haut-bas-960x540 | Non | Reussi | 0 |

**7/7 scénarios réussis, 14 captures, aucune erreur JavaScript.** Les captures desktop étroit, tactile portrait et tactile paysage ont aussi été inspectées visuellement. Le mot Santé, les pneus et le service sont entièrement lisibles ; le chrono ne couvre plus la carte.

## Preuves

- `hud-report.json` : paramètres, rectangles complets, empreintes, résultats.
- `verify_hud.py` : protocole reproductible, hors code du jeu.
- `desktop-360x640.png`, `touch-360x640.png`, `touch-390x844.png`, `touch-640x360.png` : états normaux.
- Les variantes `*-long.png` montrent les libellés longs.
- `desktop-960x540.png`, `duo-cote-960x540.png`, `duo-haut-bas-960x540.png` : contrôle des autres dispositions.

## Limites

Il s'agit d'émulation Chrome, pas d'un essai sur iPhone/Android réel. Les marges d'encoche ne sont pas simulées. Les rétroviseurs partiellement hors cadre en portrait sont historiques et restent inchangés. Dans la disposition duo côte à côte, le long nom Intermédiaires dépasse de 4,32 px le rectangle de sa case, dans l'espacement disponible ; il reste intégralement dans son HUD et ne recouvre aucun autre texte. Cette mise en page historique est signalée dans `cellOverhangs` et n'a pas été retouchée.

La vérification doit être rattachée au build final après reconstruction ; elle porte ici sur le HTML antérieur avec la CSS source injectée.

- SHA256 CSS qualifiée : `78fee941d2218baf3a50c0f71ad7f489705d99287676af8a6ad49d322291d890`
- SHA256 HTML chargé : `43473b8fb373480521a6b18d4906efcf28c6bc4086cc681379646fe92170eb5b`
