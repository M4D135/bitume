# Couverts et Route-des-Cimes — intégration du 20 novembre 2026

## Point de reprise

La base démos/pilotes/météo **0.2.64 / p15 / FERRO 0.3.15** est sauvegardée
en [PR #37](https://github.com/M4D135/bitume/pull/37), tête `80aa1e2`,
arbre `e015629469ca27ae5e8af4105c8b2b4a946f79aa`. Ses contrôles GitHub et
ses captures sont en cours. La livraison vérifiée sur `main` reste 0.2.62.

Le lot suivant rassemble la reconstruction métrique de Route-des-Cimes,
son raccord au catalogue après Baïkal, ses premiers ouvrages et le socle
multi-couverts. Les sources sont préparées ; le HTML de ce checkpoint reste
celui de la base 0.2.64. Ce checkpoint ne qualifie pas une nouvelle livraison.

## Défauts trouvés à l'intégration

- **Voûte courbe** : les dalles de tunnel calculées sur leur seule longueur
  centrale laissent des ouvertures côté extérieur au raccord. Les rayons
  peuvent atteindre la roche au-dessus, y compris depuis la chaussée.
  Le cas droit historique et ses 336 rayons ne détectaient pas ce défaut.
- **Entrée de galerie** : dans la vraie campagne à douze voitures, le
  châssis d'un rival rencontre `sol-galerie` avant le portail, puis un pilier
  et subit un replacement. La première preuve de roulage sans galerie
  construite ne couvrait pas cette situation.

Les corrections et leurs régressions sont en cours. Les échecs initiaux
doivent être conservés avec les reprises, sans déplacer les seuils ni
modifier les règles générales de conduite pour faire passer la géométrie.

## Contrôles visuels préparés

`tools/captures-couverts.mjs` prépare **six scènes et dix-huit images** :
les deux portails de Haut-Col et du Tunnel du Rocher, le second tunnel,
la galerie éclairée par le jour, la caméra au-dessus du toit et deux vues
simultanées tunnel/galerie. Les phases de portail sont des poses prescrites,
pas une conduite enregistrée. Elles contrôlent les vrais modules du HTML,
les flux d'eau entrants, la décroissance de l'eau résiduelle, la reprise
de pluie à la sortie, les rayons PhysX, les rétroviseurs et les erreurs GPU.

Les huit contrôles de l'outil passent, dont des mutations de visière absente,
de repli de rendu, d'eau constante, de galerie obscurcie et de vues contaminées.
Ils ne constituent pas des images du jeu. Chromium local échoue au démarrage
sur une création de socket refusée ; aucun PNG n'est attribué à cet essai.
Le workflow `visuel-couverts.yml` prépare les six groupes sur GitHub.

## Conditions avant fusion

1. Corriger et vérifier les raccords de voûte et de chaussée sur les vrais
   ouvrages courbes et inclinés, en conservant l'ancien tunnel droit.
2. Rejouer la campagne native de Route-des-Cimes sur les trois couverts et
   le pont effectivement construits, avec les douze voitures.
3. Construire un candidat exact, vérifier la reconstruction et sa CI.
4. Récupérer et inspecter les images du candidat, notamment entrée/sortie,
   jour sous galerie, pluie aux portails et absence de traversée des parois.

Les limites de performance matérielle, les réserves précédentes et les
17 destinations du programme restent ouvertes. Le lac, la cascade et
l'enrichissement complet des sept lieux ne sont pas déclarés terminés.
