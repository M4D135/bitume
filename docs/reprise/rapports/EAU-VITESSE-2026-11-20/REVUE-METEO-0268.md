# Revue météo BITUME 0.2.68 — run 44761148719

**41/41 PNG inspectés, 20/20 rapports et contraste humide/sec rejoués sans erreur.** Conclusion favorable limitée à l’intégration visuelle des scènes capturées. Aucune fusion ni publication effectuée.

[Campagne GitHub](https://github.com/M4D135/bitume/actions/runs/44761148719).

## Provenance vérifiée

- 7 archives ZIP : SHA-256 recalculés identiques aux digests téléchargés ; tous les fichiers extraits identiques aux octets ZIP.
- 7 `COMMIT.txt` concordants : `4343db0e812b81c22ac79dd801d6f5328405c33d`. **Ce workflow ne produit pas `TREE.txt`.** L’arbre `b84d8553d1a53de3258a56e2036b8b16669723f5` est attribué par l’API GitHub consultée côté root, avec parents `092a00b` et `3daefb7`. Aucun recalcul local de l’arbre n’est revendiqué.
- Après : **0.2.68**, 14 383 155 octets, SHA-256 `60184ddf5226543ca3f912cc9415927989f14e4e20de3556767ced801e988aa2`.
- Avant : **0.2.62**, 14 268 457 octets, SHA-256 `439bea3969ab4651fbebb87d8403f5a54968917ca6bdecede40e7d9140403297` ; référence issue de `f41614e1f3887a79ebbd633df3fde754534f202e`.
- Les 20 rapports identifient le checkout de capture et le build propre à leur variante ; seule modification signalée : `?? qualification/`. Versions, tailles et empreintes concordent avec les identités des archives.
- 7 campagnes, 20 scènes : **29 PNG candidat + 12 référence**. Zéro erreur ou avertissement. Les **3 alertes `identique` de pause sont attendues** (scène et deux glaces), sans autre alerte. Raster SwiftShader/WebGL2, 960×540, DPR 1.

## Inspection visuelle

33 PNG ont été vus en pleine résolution ; les 8 PNG faune sont examinés sur des planches donnant 480×270 par image.

| Groupe | PNG | Constat |
|---|---:|---|
| Pluie grille | 4 | Accumulation candidate dense à l’arrêt ; piste, cockpit et deux rétroviseurs lisibles. |
| Pluie + spray à 235 km/h | 4 | Dépôts et brume autour du rival, instruments et rétroviseurs composés sans rupture. |
| Tunnel | 2 | Parois/plafond lisibles ; dépôts résiduels conservés, contexte `abri=true` dans les deux images. |
| Neige à 45 km/h | 4 | Flocons et givre périphérique distincts de la pluie liquide ; piste/cockpit/rétros lisibles. |
| Pause/reprise | 3 | Deux PNG de pause strictement identiques, puis retour à la course humide. |
| Qualité légère | 2 | Dépôts et scène simplifiée visibles ; glaces peintes, sans toiles arrière, selon le profil `low`. WebGL2 actif. |
| Duo historique | 2 | Deux cockpits séparés à mi-écran, dépôts distincts, quatre rétroviseurs présents ; instruments 162 et 45 km/h. |
| Sec | 2 | Lentille propre, piste et cockpit sans effet humide résiduel. |
| Faune été/hiver | 8 | Bouquetins candidat plus grands et lisibles, appuis cohérents sur pente, variantes saisonnières distinctes. |
| Sillage cockpit humide/sec | 6 | Dépôts marqués à 300 km/h sans pluie ambiante ; lentille du témoin candidat propre avec même caméra et même rival. |
| Sillage poursuite/hélico | 4 | Poursuite humide sans pluie ambiante ; hélico dégagé sous pluie monde, sans gouttes de lentille. |

## Contrôles déterminants

**Pause :** les deux premiers PNG portent la même empreinte `ddea06c2b9672f5c751a9504e67c61a94164124dfe104a05bb54c9f450692de7`. L’horloge météo reste à 8,841666… puis passe à 8,941666… à la reprise ; l’eau reprend également son évolution.

**Contraste sillage :** `verifierContrasteSillage` confirme positions, vitesses, caméra et horloge identiques. À 300 km/h et pluie ambiante nulle, le cockpit humide mesure des embruns de **0,93777 puis 0,93755**, 24 gouttes et **46 puis 47 expulsions cumulées**. Le témoin sec mesure eau/embruns/gouttes à zéro et masque la toile. **Chaussée et monte de pneus changent aussi avec le sec** : on ne peut pas attribuer toute différence de pixels à la seule visière.

**Hélico :** la pluie monde reste visible, mais la visière est inactive/masquée et les compteurs eau, embruns, gouttes et neige sont nuls. La vue aérienne réelle est lisible dans les deux PNG.

## Réserves maintenues

- Poses prescrites et raster logiciel : aucune qualification de conduite, collision ou FPS matériel.
- Les PNG ne démontrent pas seuls la direction du ruissellement ; les mesures natives distinctes restent nécessaires.
- Habitacle/bras/buste/assise **H1+B2 restent hors clôture** de cette revue.
- Faune météo sur caméra d’inspection issue de l’API cinéma ; le réalisateur réel est couvert par le reçu démo séparé.
- Duo historique cockpit/cockpit ; complément E3 portrait et vues différentes traité séparément.
- La comparaison avant porte sur 0.2.62, jamais appelée 0.2.66.

`REVUE-METEO-0268.json` conserve les 41 empreintes, méthodes et chemins relatifs, les observables utiles, les contrôles ZIP et le résultat du contraste. Les originaux et rapports complets restent dans les sept artefacts de la campagne.
