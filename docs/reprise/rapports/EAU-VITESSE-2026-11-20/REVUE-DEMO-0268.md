# Revue démo BITUME 0.2.68 — run 44761148653

**48/48 PNG inspectés, 16/16 rapports rejoués sans erreur.** Conclusion favorable limitée à l’intégration visuelle des scènes capturées. Aucune fusion ni publication effectuée.

## Provenance vérifiée

- 7 archives ZIP : SHA-256 recalculés identiques aux digests téléchargés, tous fichiers extraits identiques au contenu ZIP.
- Identités concordantes dans les 7 archives : commit `4343db0e812b81c22ac79dd801d6f5328405c33d`, arbre `b84d8553d1a53de3258a56e2036b8b16669723f5`. L’arbre a également été confirmé par l’API GitHub côté root (parents `092a00b` et `3daefb7`). L’objet git de ce commit n’est pas présent dans le clone inspecteur : arbre non recalculé localement.
- Après : **0.2.68**, 14 383 155 octets, SHA-256 `60184ddf5226543ca3f912cc9415927989f14e4e20de3556767ced801e988aa2`. Empreinte identique au HTML local.
- Avant : **0.2.62**, 14 268 457 octets, SHA-256 `439bea3969ab4651fbebb87d8403f5a54968917ca6bdecede40e7d9140403297` ; le HTML du commit `f41614e1f3887a79ebbd633df3fde754534f202e` a été relu et haché.
- Les 16 rapports désignent le même checkout de capture, avec seulement `?? qualification/` ; le build propre à chaque variante est identifié séparément.
- 7 campagnes, 16 scènes × 3 images : 36 candidat + 12 référence. Zéro alerte, erreur ou avertissement dans les rapports ; contrôles `verifierRapport` : zéro erreur. SwiftShader/WebGL2, 960×540, DPR 1.

## Inspection visuelle

| Groupe | PNG | Méthode | Constat |
|---|---:|---|---|
| Nature été/hiver | 12 | Planches, chaque image visible à 480×270 | Bouquetins candidat plus grands et lisibles, appuis cohérents sur la pente ; saisons distinctes. Un animal éloigné chevauché par le bandeau en été. |
| Sécurité télé/hélico montagne | 12 | Planches | Référence bouchée par le relief ; candidat en poursuite avec voiture/piste dégagées dans les 6 images après. |
| Gestes | 9 | Planches + 1 original par geste | Majeur, poing et salut distinguables ; réalisateur cadre le pilote pour le salut. Bandeau proche du casque et des doigts. |
| Volant gauche/droite | 6 | Tous les originaux en pleine résolution | Volant extérieur et mains visibles, positions distinctes ; aucune disparition entre les trois instants. |
| Pluie cockpit/poursuite | 6 | Tous les originaux en pleine résolution | Dépôts sur lentille et panache présents, scène composée sans écran noir ni rupture visible. Cockpit fortement brumeux mais reconnaissable. |
| Pluie hélico | 3 | Tous les originaux en pleine résolution | Pluie monde et panache présents ; aucune goutte de lentille. |

Les diagnostics rapprochent l’image du vrai rendu : entrée `BITUME_JEU.demo`, aucune caméra imposée ; tous les plans candidat ont une visée finale dégagée. Les plans montagne sont explicitement coupés avec motif `cadre`.

À 235 km/h, l’exposition mesurée de la lentille vaut **0,86569 cockpit** et **0,66314 poursuite** avec un seul rival proche ; les expulsions cumulées passent de **44 à 46** et de **49 à 50**. En hélico, vitrage inactif, DOM masqué et compteurs eau/gouttes/embruns/neige à zéro. Ces valeurs attestent l’exercice des raccords, pas une direction déduite visuellement.

## Réserves maintenues

- Poses prescrites, pas d’essai de conduite ou de FPS matériel ; le compteur affiché 10 FPS ne qualifie pas la machine.
- Les captures seules ne qualifient ni la direction du ruissellement ni la géométrie du pilote.
- Le lot habitacle/bras/buste/assise **H1+B2 reste ouvert**, y compris malgré la présence visible du volant et des gestes.
- Cadrage HUD perfectible autour de la tête et des mains ; relief lointain facetté.
- Comparaison avant effectuée contre 0.2.62, jamais appelée 0.2.66.

## Reçu et originaux

`REVUE-DEMO-0268.json` contient chaque PNG inspecté avec son empreinte, son chemin relatif dans les artefacts et sa méthode d’inspection ; les sept contrôles d’archives et les identités y sont également conservés. Les originaux et rapports complets sont dans les sept artefacts GitHub du run `44761148653`.
