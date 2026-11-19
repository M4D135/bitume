# Roues et pneus 12A–12C — validation 0.2.45

La reprise du 19 novembre conserve les résultats réels de la session interrompue. Les 166 empreintes de sources/tests ont été vérifiées avant modification : toutes correspondaient à la qualification récupérée. Deux fichiers seulement ont ensuite changé : `src/voiture.js` et `verifications/roues-detail.test.mjs`, pour rabattre les types de pneus invalides sur les slicks au lieu de planter. Les six suites pertinentes ont été rejouées et réussissent.

## Résultats

- **88 suites réussies sur 90** ; aucune nouvelle régression observée. Les deux échecs, `determinisme-simulation` et `traces`, sont présents sur la base publiée `e47fb22` avec les mêmes résultats. Ils ne sont pas masqués par une réécriture de leurs références.
- Comparaison directe de la physique p9 : **19 scénarios, 1 259 empreintes identiques**. Seules les trois nouvelles métadonnées de pneus sont exclues ; le type historique `pneus` reste comparé. Les deux exports complets sont conservés ici.
- Roues : géométrie/normales/dimensions, jantes creuses, sculptures, rotation/braquage, détails et stabilité des objets vérifiés. Les six suites relancées comprennent pneus, roues-detail, voiture, voiture-permanents, voiture-identite et formes-libres.
- Raccords caméra relus : hystérésis séparée pour chaque joueur et chaque miroir ; détail calculé avec la hauteur réelle de leur toile. Le banc utilise les mêmes formes.
- **FERRO 0.3.11 : 34 modules identiques au verrou.** Deux constructions finales identiques ; empreinte dans `build-final.json`.
- **WebGL non validé dans cet environnement.** Chromium échoue avant chargement de la page, y compris sur la référence, car la création de socket AF_UNIX est refusée. L’aperçu CPU a été inspecté ; il ne prouve ni le rendu WebGL ni la fluidité. Safari reste clos, conformément à la confirmation de David.
- Aucune mise en ligne effectuée par cette session. Le reçu GitHub est distinct du site public.

## Reproduction ciblée

```bash
node verifications/pneus.test.mjs
node verifications/roues-detail.test.mjs
node verifications/voiture.test.mjs
node verifications/voiture-permanents.test.mjs
node verifications/voiture-identite.test.mjs
node verifications/formes-libres.test.mjs
python3 construire.py
```

`qualification-finale.json` est la synthèse courante. Les fichiers préfixés `qualification-0245-` sont les résultats récupérés avant le dernier correctif ; leurs chemins scratch indiquent leur environnement d’origine. Les logs `base-*` et `0245-*` prouvent les deux échecs hérités ; les logs `final-*` couvrent le correctif ciblé. `source-hashes-final.json` identifie les sources effectivement livrées.
