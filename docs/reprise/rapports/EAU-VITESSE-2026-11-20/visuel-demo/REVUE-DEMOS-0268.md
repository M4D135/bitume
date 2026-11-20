# Démos BITUME 0.2.68 — PR39

**Avis : accepté avec réserves de présentation conservées. Aucun blocage nouveau observé dans les démos de ce candidat.**

## Provenance et couverture

Le [run 44761148653](https://github.com/M4D135/bitume/actions/runs/44761148653) a terminé avec **7 jobs réussis sur 7**. Les sept archives ont été téléchargées, contrôlées contre leurs empreintes GitHub puis extraites avec contrôle des chemins et des liens symboliques. Leurs fichiers de provenance concordent avec les rapports de capture.

- Tête PR : `3daefb7c9d7decaf77beb94219abcf16d907bb38`.
- Commit CI : `4343db0e812b81c22ac79dd801d6f5328405c33d` ; arbre : `b84d8553d1a53de3258a56e2036b8b16669723f5`.
- Build 0.2.68 : **14 383 155 octets**, SHA-256 `60184ddf5226543ca3f912cc9415927989f14e4e20de3556767ced801e988aa2`.
- **48 PNG inspectés sur 48**, répartis en 16 passages et 16 planches à résolution native : **36 images candidat et 12 références historiques 0.2.62**.

L’identité du build est celle enregistrée par les sommes de contrôle CI et chaque rapport de passage ; les sept archives de captures sont vérifiées directement. Tous les passages candidat portent exactement cette empreinte et cette taille. Aucun nouveau build ni raster n’a été exécuté pendant cette lecture.

## Constats

| Groupe | PNG candidat / référence | Lecture des images |
|---|---:|---|
| Nature | 6 / 6 | Animaux plus lisibles que la référence, membres et ombres visibles ; relief très clair et bandeau gênant conservés comme réserves. |
| Volant | 6 / 0 | Braquages gauche/droite distincts, gants et volant présents ; aucune rupture visible dans les trois poses de chaque cas. |
| Gestes | 9 / 0 | Poing, doigt central et paume ouverte présents ; le haut de certains gestes reste partiellement couvert par la légende. Le majeur a aussi été revu dans son PNG individuel. |
| Sécurité de cadre | 6 / 6 | Les références montrent les obstructions historiques. Le candidat choisit une poursuite dégagée : voiture et piste visibles dans les six images. |
| Pluie cockpit | 3 / 0 | Perles et nappes composées, cockpit et rival lisibles sous les embruns ; aucune corruption nouvelle observée. |
| Pluie poursuite | 3 / 0 | Véhicule suivi, rival et panache visibles ; eau présente sur la lentille, avec des formes orientées vers les bords. |
| Pluie aérienne | 3 / 0 | Vue hélicoptère, pluie et piste mouillée visibles ; absence de perles ou nappes collées à l’écran. |

Les 36 observations candidat ne signalent ni erreur WebGL, ni perte de contexte, ni caméra imposée, ni obstruction, ni caméra de secours. Aucun groupe ne rapporte d’échec ; aucun passage ne rapporte d’erreur, d’alerte ou d’avertissement.

Les deux cas de pluie proches sont bien exercés à **235 km/h**, avec un rival unique et une exposition de lentille supérieure à 0,6 : **0,86569 en cockpit** et **0,66314 en poursuite**. Les rapports comptent **23–24 gouttes dans la simulation**, ainsi qu’une eau et des expulsions non nulles ; ce compteur ne dénombre pas tous les motifs de perles du shader. En aérien, les trois observations gardent l’overlay inactif et caché ; eau, neige, embruns, gouttes et dépôts restent à zéro. Les trois PNG aériens confirment visuellement cette séparation.

Une seconde lecture par le parent des PNG cockpit/poursuite `0001.png` confirme la présence des perles/nappes et la lisibilité de la piste et des véhicules. Elle conserve la réserve du bandeau et ne déduit pas de trajectoire à partir d’une image.

## Réserves et limites

Les bandeaux masquent encore une partie des sujets. Le terrain de montagne très clair, les motifs du sol et les proportions générales demeurent dans les lots de présentation prévus. Ces observations ne constituent pas une régression nouvelle attribuée à l’eau et ces travaux ne sont pas déclarés terminés par cette revue.

La campagne montre des démos mises en scène, à trois images par passage, rendues par Chromium/SwiftShader en 960×540. Elle ne qualifie ni toute la conduite libre, ni toutes les caméras, ni les performances sur GPU matériel. Le compteur 10 FPS est celui de la capture. Les formes de l’eau et leur variation sont compatibles avec le résultat attendu, mais **la preuve de trajectoire repose sur le banc temporel natif indépendant des uniformes et les tests CPU**, pas sur une inférence faite depuis ces poses composées.

## Reprise et preuves

`REVUE-DEMOS-0268.json` contient les identifiants, les sept empreintes d’archives, les constats et les limites. `INVENTAIRE-PNG-0268.json` donne l’empreinte, la taille, le rôle candidat/référence et la note de lecture de chaque PNG. `CI-FINAL.json` fixe l’état terminé du run. `CONTROLES-ARTEFACTS-0268.json` conserve les contrôles de provenance et la liste des passages. Les chemins de ces reçus sont relatifs aux artefacts, sans URL signée ni journal de machine.
