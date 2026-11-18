# Le Spark au travail

David, 18 novembre 2026 : « fais bosser le spark pour economiser tes tokens ». Le Spark (LLM local de David, par
`~/bin/kbza ask`) écrit et relit ; Claude cadre, écrit les fiches, vérifie et intègre. Outils repris de Point de
rupture et de VOILE.

- `chaine.py` : une tâche de code menée de bout en bout. La fiche dit le titre, les extraits à envoyer et les tests ;
  le Spark rend des blocs AVANT / APRÈS ; la chaîne les applique, contrôle la syntaxe, lance les tests, valide par un
  commit « Spark : … » si c'est vert, sinon remet l'arbre et renvoie l'échec (jusqu'à `--tours`). Se lance depuis
  l'arbre de travail visé : `python3 /Users/david/Projects/bitume/tools/spark/chaine.py fiche.md --sortie DOSSIER`.
- `spark.py digerer` : lecture ou relecture d'un gros fichier ou d'un diff, par morceaux, avec des questions précises ;
  `spark.py demander` : une seule demande.

Limites mesurées : 12 000 caractères par demande, jamais plus de 30 000 ; une question par demande ; mode direct pour
le code (20 à 140 s). Ce qu'il rend est un brouillon : les tests de la fiche et la relecture de Claude décident. Sur
une relecture, la plupart de ses constats sont faux : chacun se vérifie dans le code.

Bon pour le Spark : modules purs, fonctions de géométrie et de mobilier, tables, tests, relecture d'un diff, résumé
d'un long compte rendu. À garder pour Claude : le cadrage, le branchement dans les fichiers partagés, l'image.
