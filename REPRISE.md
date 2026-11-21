# BITUME — reprise courte

## Intégration 0.2.84 : Xbox Edge (.83) + mains articulées (PR #56) + Larche L0/L1

Base unifiée sur `main` réunissant :
- **Xbox Edge et commandes manette (.83)** : manette prioritaire sur le pointeur, affectations boutons/axes par joueur, configuration accessible en solo, profil console prudent sans banc, plafond 1280×720 via `ferro/surface.js`, et correctif de conflit stick droit / regard arrière. [Fiche](docs/reprise/XBOX-EDGE-COMMANDES-2026-11-21.md).
- **Mains réalistes articulées (PR #56)** : doigts aux longueurs conservées, proportions corrigées, treize états et coordonnées immuables partagées. [Préparation](docs/reprise/rapports/MAINS-REALISME-2026-11-21/RECEPTION-MAINS-MEMOIRE.md).
- **Col de Larche → Vinadio (lots L0 + L1)** : sources réelles figées (OSM SS21, DTM 5 m Regione Piemonte, IGN RGE ALTI frontière) et tracé reconstruit 32,249 km + zone décélération 567 m. [Fiche](docs/reprise/COL-DE-LARCHE-VINADIO-2026-11-21.md).

## Lots actifs demandés par David (21 novembre 2026)

1. **Optimisation petites configurations et Xbox Edge** : réduire le temps de construction décor (<150 ms), le nombre de lots/triangles/objets en `low`/`medium`/console et la charge GPU/CPU.
2. **Modélisation 3D des animaux (`src/animaux.js`)** : grandement améliorer l'anatomie et la silhouette des quadrupèdes, oiseaux et baleine avec vérification WebGL2 avant/après.
3. **Décors organiques + marqueurs et lieux emblématiques par circuit** : supprimer les textures de sol carrées/triangulaires et formes géométriques brutes (sols arrondis/aléatoires naturels, pyramides dans le désert à la place de blocs carrés), et doter chaque circuit d'un marqueur typique et d'un lieu emblématique (bâtiment, pont, tunnel, route atypique).
4. **Col de Larche → Vinadio (lot L2)** : moteur de parcours ouvert (`topologie: 'ouvert'`) sans modifier le comportement bit-à-bit des 9 circuits fermés.

## Publication et acquis précédents

- **0.2.80 / p15 / FERRO 0.3.15** (`6526493`) : démarrage téléphone sans banc, **192 suites Node et 8 tests Python réussis** en CI. [Reçu](docs/reprise/rapports/DEMARRAGE-MOBILE-2026-11-21/PUBLICATION-0280.json).
- **0.2.79 / p15 / FERRO 0.3.15** (`d408124`) : 126 CK, poignets R4b corrigés, six caméras et compteurs du titre intégrés, déployé sur `https://bitume.estrasse.fr/`. [Reçu](docs/reprise/rapports/MAINS-REALISME-2026-11-21/BASE-0279.json).
- Préserver décor, PR 43, Monaco/Marseille et les 9 circuits existants.
