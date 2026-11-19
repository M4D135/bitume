# Qualification CPU — BITUME 0.2.52 / p13

**107/108 suites réussies**. L’unique échec, `traces.test.mjs`, a exactement la signature héritée de la base.
Neuf scénarios de sortie de file, 17 trajets du lot 12F4 et 6 contrôles de décision sont réussis.
Le jeu est reconstruit deux fois à l’identique : **14 060 666 octets**, SHA-256 `4c8f43204fa79323d652202d12c534570b67fa85a2980fdbc4f589559e94f976`.
53 scripts extraits du build ont une syntaxe valide ; les 34 modules FERRO 0.3.11 sont inchangés.

## Ce que les nouveaux tests démontrent

File serrée à 8 et 10 m ; attente puis passage quand une voiture recule derrière ; approche naturelle ; sortie après
un service complet ; pluie ; neige ; Haut-Col ; joueur qui redémarre. Pour chaque cas : vraie restitution à la
conduite de course, aucun contact/choc/rail/accident/replacement et conservation des quatre pneus hors service.
Le rapport `sortie-file-final.json` contient les résultats et les empreintes des sources de ce passage.
Les parcours physiques détaillés sont archivés dans `parcours-physiques.tar.gz`, avec index dans `PARCOURS.json`.

## Déterminisme et limites

**22 scénarios / 1 415 empreintes p13**. La nouvelle référence a été créée après qualification comportementale,
puis vérifiée, y compris après la correction du bloqueur mobile, sans régénération. Les archives p9–p12 restent
identiques. Le premier passage complet a été interrompu avant la correction finale et reste dans
`passage-interrompu-1/` ; seuls `qualification-execution.json` et `suites.json` font autorité pour la livraison.

Ces résultats couvrent les simulations CPU. WebGL, FPS matériel, parties entre navigateurs réels, déploiement
et page servie ne sont pas validés par ce lot. Publication GitHub vérifiée dans le reçu ; deux CI terminées à 107/108 chacune, avec le même unique échec hérité. Voir `github/RECU-CI.json`.
