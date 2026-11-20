# Revue indépendante de la visière — 0.2.68

**Reçus et sources concordants ; aucun défaut bloquant identifié dans le périmètre relu.**
La revue porte sur le code de mesure, les preuves déjà produites et quatre images natives.
Elle ne relance ni test, ni rendu, ni benchmark. Les empreintes et observations sont dans
[le reçu complémentaire](REVUE-INDEPENDANTE-VISIERE-0268.json).

## Preuves rapprochées

Les cinq reçus portables `DIRECTION-PNG`, `NEGATIFS-PNG`, `INVENTAIRE-VISIERE`,
`QUALIFICATION-VISIERE` et `EGL-INITIAL` de la 0.2.68 ont été rapprochés des originaux :
109 fichiers inventoriés, quatre fichiers de livraison, 36 PNG de direction et leurs états.
Les sources rastérisées sont identiques à celles incluses dans le HTML
`60184ddf5226543ca3f912cc9415927989f14e4e20de3556767ced801e988aa2`.

La réanalyse conserve **24/24 intervalles conformes et 2 076 mesures conformes**.
Les huit répétitions d’image, huit changements d’opacité seuls et huit inversions temporelles
sont refusés ; enlever le transport annoncé laisse huit résultats inchangés.
L’identité des motifs vient des pixels, avant le jugement de leur direction.
**L’échec initial est conservé : 18 intervalles conformes, six insuffisants.**
Le résultat final réanalyse les mêmes PNG ; il ne remplace pas cet historique.

## Inspection complémentaire de quatre images

Les mires `sillage300` cockpit et poursuite montrent des perles de tailles variées,
la réfraction des lignes et un voile central léger. Aucune rupture évidente de composition
n’apparaît dans ces deux images ; la grille appartient au banc de matière.
La paire `trajet-cockpit-300-perles` aux images 12 et 108 montre des positions différentes
et une répartition élargie. Les déplacements signés restent établis par les mesures temporelles.

Ces mires **ne montrent pas la course, le HUD ni le cockpit**. La gêne des grandes perles,
le réalisme pendant le mouvement et la lisibilité réelle restent à juger dans le jeu exact.
Microcouche 0, fines au repos, autres orientations et transitions ne sont pas toutes couvertes.
Les réserves de coût logiciel demeurent ; aucun FPS matériel n’est qualifié ici.
La CI et la revue des captures du candidat exact conditionnent encore la clôture.
