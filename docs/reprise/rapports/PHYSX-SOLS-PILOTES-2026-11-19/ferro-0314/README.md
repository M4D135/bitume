# FERRO 0.3.14 — libération des vues PhysX

## Résultat

**210 tests canoniques réussis, aucun échec, un TODO hérité ; 25/25 tests du vrai PhysX WASM.** Le build officiel et les 43 fichiers du manifeste d’archive sont vérifiés. Les 34 modules correspondent au verrou.

Cette qualification est locale. La publication, la propagation finale dans BITUME et la vérification visuelle du jeu restent des opérations distinctes. Le reçu complet est dans [qualification.json](qualification.json).

## Composition et provenance

La base est le FERRO 0.3.13 publié par la PR #1 : commit `b09a4e82252dbcb43a363a19b3e43c0a90e9a41b`, arbre `4efb24f1cf2d8830b8f608cf859b2222ef08beca`. La copie locale a été comparée à cet arbre et l’objet du commit signé vérifié par son SHA. Les fichiers historiques non matérialisés du checkout sparse restent dans l’arbre Git ; ils ne sont ni supprimés ni remplacés.

Le checkpoint BITUME utilisait un autre candidat nommé 0.3.13, dont trois modules différaient du canon publié. Cette livraison reprend seulement `src/ferro/physx.js` et ses deux tests supplémentaires depuis le commit local `dca2753c38bcffe72469790b951840dac4964988`. Elle conserve exactement `renderer.js` et `webgpu-shaders.js` du canon publié : optimisation des brins, filtrage du grain et suppression de l’effet de pavage.

Seuls deux modules changent par rapport au canon publié : `physx` pour le correctif et `host` pour le numéro de version. Les 32 autres modules, le runtime WASM, les règles des hôtes et les anciennes archives restent identiques. La nouvelle archive est `dist/FERRO-0.3.14.zip` ; la 0.3.13 publiée est conservée.

## Correctif et contrôles

Les bindings WebIDL gardent des wrappers JavaScript en cache après libération des objets natifs. Le wrapper retire ces entrées et suit les vues empruntées par monde. Certaines vues temporaires partagent la même adresse entre deux scènes : elles restent en cache tant qu’un monde les utilise. Le nettoyage ne détruit jamais leur mémoire native empruntée.

- **PhysX : 25/25**, dont 72 créations/destructions de scènes avec contacts et maillages, et deux mondes simultanés. La libération du premier préserve les vues du second. Ces contrôles portent sur les wrappers JavaScript, sans mesure du tas natif.
- **Canon : 210 réussis, 0 échec, 1 TODO** historique sur le glissement d’un cube après basculement. Journal : [tests-canonical.log](tests-canonical.log).
- **EMPRISE : 10/12 sur la 0.3.13 publiée et sur la 0.3.14**, avec les deux journaux d’échec strictement identiques (`webgpu-renderer`, `renderer-overlay`). Les 89 fichiers contrôlés hors installation restent inchangés. Les modules sont installés par l’outil officiel. Comparaison : [emprise/comparison.json](emprise/comparison.json).
- **Rendu : sources GLSL/WGSL strictement identiques au canon 0.3.13.** Les preuves EGL et de compilation WGSL existantes restent applicables à ces mêmes octets ; elles n’ont pas été réexécutées ni présentées comme des captures du jeu.

Le build complet EMPRISE reste bloqué par son `src/city-data.js` indisponible, comme précédemment. Aucun rendu natif WebGPU, scène navigateur complète, FPS matériel ou déploiement n’est certifié ici.

## Reproduire

```sh
python3 tools/check-ferro-lock.py
python3 tools/build.py
node --test tests/ferro/physx-vehicles.test.mjs tests/ferro/physx.test.mjs
node --test tests/ferro/*.test.mjs tests/recipes.test.cjs
```

Le script `emprise/qualify.py` accepte `--host CHEMIN --phase baseline` ou `--phase candidate`. Exécuter la référence avant installation puis le candidat installé par `tools/install-ferro.py`. Les commandes et codes retour de cette qualification sont conservés dans `emprise/baseline.json` et `emprise/candidate.json`.
