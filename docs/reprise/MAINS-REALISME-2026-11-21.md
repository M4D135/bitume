# Personnages et mains — reprise après Gemini, 21 novembre 2026

## Base vérifiée

David demande de poursuivre les personnages, surtout les mains, et précise que
Gemini a avancé sur `main`. La reprise part du commit `d4081241`, **0.2.79 / p15 /
FERRO 0.3.15**, et non des anciennes copies .77. [Reçu de l'audit](rapports/MAINS-REALISME-2026-11-21/BASE-0279.json).

La 126 CK, son implantation commune, les poignets R4b corrigés, les six caméras et
les compteurs du titre sont intégrés. Les deux anciens défauts R4b (allocation du
cockpit et contact manche/pommeau) sont clos sur cette base. La CI du commit exact
réussit **190 suites Node et 8 tests Python**. La fin du checkpoint modèle décrit
les captures WebGL2 reçues par Gemini ; la présente reprise distingue ce reçu
historique de ses propres images. Le déploiement du site n'est pas établi par la CI.

## Diagnostic du réalisme restant

`src/main.js` construit les doigts autour de la jante. L'ouverture réduit leurs
angles autour du tube : elle raccourcit fortement leur développement avant que
le salut les déploie. La polyligne de contrôle jointure→bout de l'index mesure
73,1 mm en prise, 25,6 mm ouverte puis 72,2 mm au salut ; pour le majeur,
56,9 / 20,7 / 81,5 mm. Ce sont des mesures de construction, pas des os anatomiques
mesurés sur un humain ou dans une image.

Le runtime sélectionne aussi six maillages par ouverture/geste avec `Math.floor`.
La pose du poignet est continue, mais la forme des doigts change par paliers.
Les doigts et leurs raccords sont des tubes, la paume une carène, le raccord du
pouce une ellipsoïde ; les manches restent constituées de segments arrondis.
Une amélioration des matières seule ne corrige pas cette articulation.

## Sous-lots

1. **M1 — doigts :** remplacer leur contraction par une flexion construite avec
   des longueurs conservées ; préserver la prise fermée qualifiée et le rig R4b.
   Améliorer les volumes sans déplacer volant, siège, épaules ou yeux.
2. **M2 — transitions :** rendre le déploiement plus progressif, avec coût
   mémoire et distance entre états mesurés. Ne pas appeler « interpolation
   continue » une simple augmentation du nombre de formes préchauffées.
3. **M3 — réception :** contrôler les vrais maillages contre jante, branches,
   pommeau, buste et coque, y compris passage de rapport interrompant un geste,
   deux mains et trois niveaux de détail. Puis comparer des captures WebGL du
   même jeu, même caméra et même phase, entre la .79 et le candidat.
4. **M4 — corps et manches :** après les mains, affiner les raccords de manchette,
   le volume des avant-bras, coudes, épaules et combinaison, toujours dans le
   modèle commun. Préserver le bassin assis, le dossier et les bras dégagés.

La vue extérieure est prioritaire pour l'examen ; le cockpit doit montrer la
même anatomie. Les petits PC, les rivaux et le duo conservent leurs budgets.
Les ressources sont préparées avant la course ; aucune allocation nouvelle par
pose ne doit être masquée par un seuil relâché. Aucun module FERRO n'est modifié.

## Ordre et état de cette reprise

M1–M3 sont le lot actif. M4 suit après réception. Le parcours réel **sommet du
col de Larche → Vinadio**, ses lots L0–L6, Monaco, Marseille, PR 43 et les
travaux décor/performance restent prévus et conservés. La priorité aux mains
complète le programme sans réappliquer les changements déjà livrés par Gemini.

Les résultats du candidat et les limites visuelles doivent être consignés dans
`rapports/MAINS-REALISME-2026-11-21/` avant sa publication. Un test géométrique
réussi ne remplace pas la comparaison visuelle des doigts, pouces et manchettes.
