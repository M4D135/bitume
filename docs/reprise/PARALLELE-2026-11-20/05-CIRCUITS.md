# 05 — Sources et suite des circuits

## Prompt à copier

~~~text
Continue BITUME, discussion 05 « Sources des circuits ».
Dépôt : https://github.com/M4D135/bitume
Lis AGENTS.md, REPRISE.md, docs/reprise/PARALLELE-2026-11-20/README.md, 05-CIRCUITS.md et etat/05.json.
Complète les sources et mesures manquantes de Monaco, puis Marseille, en préservant les acquisitions closes. Qualifie chaussée, altitudes/niveaux, largeurs, dévers et portails avec provenance et incertitudes. Aucune valeur inventée ; Monaco reste non jouable tant que ses critères ne sont pas remplis.
Premier lot limité aux sources, outils de préparation et tests dédiés, sans runtime concurrent. Prépare la suite Cimes/Haut-Col et les autres circuits conservés. Commit/push chaque résultat utile et ton état ; transmets les besoins à 00/04.
~~~

## Premier périmètre

Lire les points ouverts de MONACO-REVUE-2026-11-20.md, MONACO-MESURES-2026-11-20.md et docs/references/monaco-2026/, puis 15-SPECIALE-MARSEILLE-RELIEF.md au jalon suivant.

Monaco : niveaux routiers de Mirabeau Bas, passages couverts et Tabac/quais ; datum, dates, largeur, dévers, portails. Un terrain sous la route n'est pas une mesure de chaussée. Conserver les inconnus/sentinelles sources et exclure les valeurs invalides des calculs ; pas de remise à l'échelle arbitraire pour rattraper une longueur cible. Ne pas refaire les acquisitions closes.

Marseille : provenance EMPRISE, corridor et relief cohérent avant reconstruction de route. Vérifier les nouvelles informations auprès de sources primaires et conserver leur provenance.

## Suite préparée

### Ajout du 21 novembre — col de Larche → Vinadio

Demande explicite ajoutée au programme : vrai tracé et vrai relief du **sommet du
col de Larche/Maddalena jusqu’à Vinadio**, dans le sens de la descente par la SS21.
La correction utilisateur supprime le départ de Barcelonnette : ne pas acquérir
la montée D900 pour la piste jouable. Environ 32 km, longueur finale à mesurer.

Lire [la fiche détaillée](../COL-DE-LARCHE-VINADIO-2026-11-21.md). Premier lot L0 :
sources et manifeste, deux lignes précisément situées, voie routière ordonnée,
DTM piémontais prioritaire, IGN seulement aux panoramas/frontière utiles. Préserver
les préparations Monaco/Marseille ; la coordination peut lancer cette acquisition
indépendante sans toucher au runtime partagé. Données et licences vérifiées,
inconnus conservés, pas de fermeture synthétique ni remise à l’échelle.

Un parcours ouvert est nécessaire : préparer le contrat et transmettre à 00 les
modifications de `circuit.js`/course/IA/menu/réseau. Aucun ajout jouable avant cette
qualification. La fiche donne les sous-lots L0–L6, fichiers proposés et preuves.

### Programme antérieur conservé

Route-des-Cimes est déjà le neuvième circuit ; poursuivre sept lieux, lac/cascade et relief. Haut-Col garde identifiant, graine et plan. Baïkal est le huitième. Préserver les 17 destinations et distinguer demandes, propositions et livraisons.

Passage au runtime après données suffisantes, raccords acceptés par 00 et libération du décor par 04 ; puis contrôles PhysX/IA/couverts et images. Aucun partage implicite de circuit.js ou route-des-cimes-decor.js.

Livrable du premier lot : mesures qualifiées, scripts/tests sources, inconnus restants, raccordements/05.md et etat/05.json. Aucun nouveau build du jeu n'est attendu de cette préparation.
