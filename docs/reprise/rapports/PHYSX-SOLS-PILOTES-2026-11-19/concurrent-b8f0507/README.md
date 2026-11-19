# Provenance du checkpoint concurrent b8f0507

Sources originales conservées octet pour octet ; à reproduire dans le checkout du commit
`b8f050745c68e2c7a9e482611cfdc980efe1ada3`, pas depuis ce dossier d’archive.
Les journaux `../final/` et `../livraison/` concernent ce checkpoint et ses précurseurs.
Son build 0.2.55 (`c9e0c3d9…`, 14 153 917 octets), son bilan 117/119 et son déterminisme
141 empreintes / huit scénarios ne sont pas ceux du regroupement final 0.2.56.

Le protocole historique 120 s est gardé avec ses preuves. L’outil
`tools/qualification/physx-courses-qualifier.mjs` refuse une provenance différente ;
il ne faut pas lui donner les observations 200 s du protocole final.
La fixture p14 active vient des deux processus indépendants du checkpoint62c9461
(54 empreintes exactes) et n’est pas remplacée par l’autre format concurrent.
