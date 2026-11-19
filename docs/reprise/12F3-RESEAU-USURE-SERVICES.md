# BITUME — 12F3 : usure et services en réseau

## Point de départ et périmètre

19 novembre 2026. Base du lot : **0.2.49 / `56086ecc`**. **12F3 livré en 0.2.50 sur main `9857f627`**.
PR n°4 fermée, fusionnée et non brouillon à **13 h 01 (Paris)** ; tree de fusion identique à la tête revue `baeea490`.
Checkpoint sources `7c908b17` conservé ; publication sources/tests/build/preuves vérifiée.

Le type et les quatre états de pneus, les remplacements terminés et le transfert vers l’IA sont transmis.
Le choix de la prochaine monte est actif en ligne. Commandes locales, physique **p11**, positions à quinze
flottants et modules FERRO inchangés. Le site et WebGL restent non validés.

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

## Qualification et publication

- **104/105 suites** réussies sur sources figées. Seul `traces.test.mjs` reste en échec hérité identique,
  confirmé par `rapports/12F3-2026-11-19/reserve-traces.json`.
- **20 scénarios / 1 300 empreintes p11** identiques ; fixtures p9/p10/p11 intactes, sans régénération.
- Deux builds **0.2.50** identiques, **14 042 272 octets**, SHA-256
  `b1154b9b8a03641f2b166c44bd7cd191589e2375a9cc490733edd90934d5dc21`.
  **52 scripts valides**, **34 modules FERRO 0.3.11 inchangés**.
- Tests avec les vrais contrôleurs et un **transport simulé** : 2+2, 2+1, 1+2, deuxième pilote,
  service perdu, liaison tardive, séance, annulation, incompatibilité et reprise sans pneus neufs.
  **Parties réelles entre navigateurs non validées.** WebGL, performances matérielles et déploiement non validés.
- Rapport : `rapports/12F3-2026-11-19/qualification-execution.json` ; synthèse `VALIDATION.md` dans le même dossier.
  Charges utiles mesurées et débits théoriques dans `transport-mesure.json` ; aucune mesure réseau matérielle.

Reçu de publication vérifié : `rapports/12F3-2026-11-19/PUBLICATION-0250.json`.
Deux CI finales terminées : **104/105 chacune**, seul échec traces hérité identique, runs `44519375789` et `44519295768`.
La fusion est terminée ; ne pas la redemander. Build identique à celui qualifié.
**Prochain sous-lot : stratégie de stands IA**, non commencé, à borner séparément avant les courses longues.
Russie, Monaco, Marseille, huitième circuit de montagne et six propositions restent conservés.
