# Raccord PhysX du réseau

Les deux commandes ont été exécutées après modification de `src/reseau.js`, avec sortie 0 : **11/11 tests dédiés** et **77/77 résultats Node** des trois suites réseau existantes. Le fichier historique de pneus contient lui-même 17 contrôles et apparaît comme un résultat dans le total Node. Les sorties terminal déjà obtenues sont retranscrites ici avec leurs résultats et leurs durées totales ; les durées individuelles de chaque contrôle sont omises. Aucun test n'a été relancé pour ce rangement. Ces durées n'ont pas valeur de mesure réseau ou de FPS.

```sh
node --test verifications/physx-reseau.test.mjs
node --test verifications/pneus-reseau.test.mjs verifications/pneus-reseau-integration.test.mjs verifications/prets-enligne.test.mjs
```

Le champ facultatif transporte `[vx, vy, vz, wx, wy, wz, offset0, offset1, offset2, offset3, groundCount]`, lu dans `etat._physx`. Vitesses monde en m/s et rad/s, offsets en mètres. `prolonger` rend `physx: null` si le champ est absent/invalide ; sinon, un `Float64Array(11)` réutilisé par objet de sortie. L'hôte doit copier ce tableau pour chaque voiture.

La prédiction conserve l'horizon +350/−100 ms et l'intégration historique de `s/d/psi`. `y` suit `vy`, avec gravité seulement sans appui ; le tableau de sortie contient aussi `vy` au temps prédit. Tangage et roulis suivent la rotation monde projetée sur les axes de la voiture, sans singularité de division près de la verticale. Les quatre offsets sont conservés entre paquets.

Les onze valeurs sont strictement validées : finies et numériques, composantes linéaires ±500 m/s, angulaires ±100 rad/s, courses [−0,18 ; +0,14] m avec bornes float32 exactes, appuis entiers 0..4. Les données malformées, queues tronquées et indices ambigus retombent sur le paquet historique. L'extension coûte trois octets puis 45 octets par voiture ; le préfixe, les quinze `CHAMPS` et le contrat des pneus restent inchangés.

Les empreintes, commandes, résultats et provenance des journaux sont dans `qualification.json`. Les tests natifs du raccord hôte, la reprise d'autorité et le build final sont consignés séparément par l'intégrateur.
