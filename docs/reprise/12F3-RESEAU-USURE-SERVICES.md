# BITUME — 12F3 : usure et services en réseau

## Point de départ et périmètre

19 novembre 2026. Base publiée **0.2.49**, suivi main `56086ecc` ; 12F2 est fusionné.
Branche de travail : `codex/bitume-12f3-20261119`. Lot en cours, aucune nouvelle version qualifiée à ce checkpoint.

Transmettre le type et les quatre états de pneus, les remplacements terminés et le transfert vers l’IA.
Activer ensuite le choix de la prochaine monte en ligne. Garder les commandes locales, la physique **p11**,
les positions à quinze flottants et les modules FERRO inchangés. Le site et WebGL restent non validés.

## Contrat retenu

- Module pur `pneus-reseau.js` : version 1, identité de séance, voiture, révision de service,
  séquence et génération d’autorité. Quatre roues complètes ; usure/saleté/grainage quantifiés sur 16 bits,
  compteurs au centième et graines conservées. Rejet avant mutation des messages mal formés.
- Instantanés fiables séparés à **2 Hz maximum**, plus émission immédiate après service et synchronisation.
  Le paquet de position existant n’est pas élargi.
- Chaque machine calcule ses humains ; l’hôte calcule les rivaux et reprend les machines parties.
  Les invités adressent les pneus à l’hôte, qui valide puis relaie le contenu reçu. Ce relais garantit que
  l’hôte dispose de tout service déjà montré aux autres pairs avant de reprendre une voiture.
- Les invités acceptent uniquement l’hôte comme relais ; le propriétaire d’origine reste vérifié.
  Les voitures conduites localement ne sont jamais écrasées par un message reçu.
- Un service reçu est un état complet, appliqué une fois ; aucun appel au remplacement local en réception.
  Ancienne séance, ancien service, doublon et séquence dépassée sont ignorés. Une usure ne baisse pas
  dans un même service. Le transfert vers l’hôte change la génération d’autorité et conserve les pneus.
- Le rendu distant interpole sa copie visuelle ; les états physiques reçus restent distincts.
  Les voitures distantes ne recalculent pas une usure concurrente.
- La préparation vérifie le protocole et le couple identifiant de circuit/empreinte complète des sources, calculé au build.
  Cette compatibilité conservatrice inclut le générateur, les limites et les collisions issues des autres modules.
  Un départ dupliqué ne crée pas une nouvelle course. La fin de chargement demande un instantané.
  Une machine absente de la grille attend toujours la prochaine course ; ce lot n’ajoute pas d’entrée en pleine course.

## Jalons et preuves

1. Protocole pur : validation, quantification, ordre, autorité, reprise et atomicité.
2. Intégration réelle : 2+2, 2+1, 1+2 ; service du deuxième pilote ; relais et arrivée tardive de la liaison ;
   changement de séance, déconnexion et absence de remise à neuf cachée.
3. Régressions ciblées, puis qualification globale sur sources figées, sans régénérer p11.
   Deux builds identiques ; contrôler le verrou FERRO et publier sources, build et preuves.

Réserve de base : 102/103 suites en 12F2, seul `traces.test.mjs` déjà en échec.
La stratégie de stands des rivaux et les circuits restent des lots suivants.
