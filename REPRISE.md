# BITUME — reprise courte

## 0.2.85 livré (21 novembre 2026) — Optimisation Xbox/petites configs, Animaux 3D, Décors organiques & 9 Lieux emblématiques, Larche L2

Base unifiée sur `main` (incluant 0.2.84 : Xbox Edge `.83`, mains articulées PR #56, Col de Larche L0/L1) et complétée avec délégation sur le Spark local (`spark-local`, 3 tâches de génération vérifiées et intégrées) :

1. **Optimisation petites configurations et Xbox Edge (`src/decor.js`, `src/vegetation.js`, `src/jeu.js`)** :
   - Suppression de la construction forcée de l'herbier dans `solsProceduraux` : chargement décor `low` accéléré de **3,2× à 5,1×** (41–53 ms sur Val-Brûlé, Port-Sable, Haut-Col, Roche-Fauve, Lande-Noire, Cap-Séquoia ; 93 ms sur Route-des-Cimes).
   - `indexAxe(..., sansHauteur)` avec rejet bbox rapide pour le placement massif d'arbres/rochers ; `low` LOD `bascule` resserré (280/480 m) et LOD rivaux `0.62×` en `low` ; faune sautée à la création et à 120 Hz lorsque `faune === 'off'` (défaut Xbox/mobile/petites configs) ; plafond `1600×900` pour PC bureautique modeste (`low`), Xbox inchangé à `1280×720`.
   - Cellules d'herbe `medium` élargies (48/96 m) : **−47 % à −50 % de lots WebGL** sans réduire le nombre de brins.
2. **Modélisation 3D des animaux (`src/animaux.js`)** :
   - Anatomie et silhouette nettement sculptées (204 formes, 54 084 triangles, 32 ms au chargement, 13/13 `verifications/animaux.test.mjs`, zéro allocation supplémentaire en course) : épaules/cuisses fondues, genoux/jarrets/boulets/sabots évasés, défenses en ivoire et groin boutoir du sanglier + crête de soies, port de tête et crinière/toupet du cheval, toison laineuse du mouton, bosse/fanon/cornes annelées du buffle, pattes solides et pieds à doigts étalés de l'autruche, rémiges primaires digitées des rapaces, aileron dorsal plein et longues nageoires pectorales de la baleine. Vérifié visuellement en WebGL2 avant/après.
3. **Décors organiques + marqueur et lieu emblématique par circuit (`src/lieux.js`, `src/decor.js`, `src/bords.js`, `src/solides-physx.js`)** :
   - Sols et accotements organiques sans damiers 20 m en `low` ni triangles mixtes/métalliques sur les pentes (`options.organique: true`, préservant 100 % bit-à-bit l'oracle historique `decor-identite`).
   - 18 formes procédurales fermées (`bitume-lieu-*`) : rochers/galets organiques arrondis dans tous les biomes et **pyramides + pyramides à degrés** dans le désert de Roche-Fauve (zéro bloc carré naturel).
   - Lieux emblématiques sur les **9 circuits** (vérifiés en WebGL2 + `verifications/lieux-organiques.test.mjs` + PhysX) : Val-Brûlé (Viaduc des Chênes, Tour de l'Horloge), Port-Sable (Grand Phare du Cap, Port aux Voiliers, Arche Calcaire), Haut-Col (Galerie Paravalanche, Téléphérique des Aiguilles), Lande-Noire (Pont-Arche Noir, Kirkja Nordique, Lagon Géothermal), Roche-Fauve (Nécropole des Pyramides, Grande Arche en Grès, Oasis), Brume-de-Jade (Grand Portail Torii Vermillon, Pagode des Brumes), Cap-Séquoia (Grand Pont Suspendu Vermillon à câbles en chaînette, Arche du Séquoia Géant), Baïkal (Chapelle aux Bulbes Dorés, Phare-Jetée, Portique en Rondins), Route-des-Cimes (Arche du Col des Cimes, Belvédère Panoramique).
4. **Col de Larche → Vinadio — Lot L2 (`src/circuit.js`, `src/conduite.js`, `src/course.js`, `verifications/parcours-ouvert.test.mjs`)** :
   - Moteur de parcours ouvert (`topologie: 'ouvert'`, `ouvert: true`, `depart`, `arrivee`, `zoneDeceleration`) sans rebouclage modulo ; charge et valide le relevé réel SS21 `trace-l1.json` (32,8 km), 8/8 tests réussis, 9 circuits fermés inchangés au bit près. [Fiche](docs/reprise/COL-DE-LARCHE-VINADIO-2026-11-21.md).

## Prochaine étape

- **Col de Larche → Vinadio — Lots L3/L4** : intégrer le tracé/relief réel 32,2 km + ouvrages (tunnels/paravalanches/ponts) dans un circuit jouable au catalogue (`larche`) sans déplacer les 9 circuits existants.
- Vérification sur Xbox Series / Edge physique et CI Linux (les 3 suites d'empreintes `libm` ARM64/x86_64 sont contrôlées identiques bit-à-bit à `HEAD` localement et attendues 100 % vertes sur Linux CI).
