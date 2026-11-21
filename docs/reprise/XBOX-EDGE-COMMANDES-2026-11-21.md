# Xbox Edge — commandes et charge graphique, 21 novembre 2026

## Demande prioritaire

David signale un jeu très lent dans Edge sur Xbox, une manette en conflit avec le pointeur du navigateur, l'impossibilité d'accélérer et de configurer les commandes. Ce correctif passe avant l'intégration des nouvelles mains. Base : main `44e7682`, version 0.2.80, physique p15 et FERRO 0.3.15.

## Défauts établis dans le code

- Auto autorisait un clic souris global en course à activer le pilotage au pointeur. La priorité de la manette disparaissait au neutre.
- Le tableau de configuration n'écoutait que les touches du clavier, même avec « Manette » sélectionnée. Son accès depuis la préparation était masqué en solo.
- La détection passive ne reconnaissait pas Xbox. Des capacités déclarées comparables à celles d'un PC pouvaient choisir Moyenne fixe, anticrénelage 4× et rétroviseurs réels.
- La résolution numérique du profil ne plafonnait pas le nombre de pixels : sur un viewport 3840×2160 à DPR 1, Moyenne pouvait rendre 8 294 400 pixels ; même Légère en rendait 5 308 416.

## Correctif candidat 0.2.81

La console est reconnue par sa plate-forme déclarée, jamais par le nom d'une manette branchée sur PC. Elle reçoit un profil Légère prudent sans test de charge. La migration revoit les anciennes recommandations automatiques et conserve les options déjà modifiées par le joueur.

Le raccord utilise le module canonique `ferro/surface.js`, déjà verrouillé, désormais chargé par le build. La scène Xbox est plafonnée à 921 600 pixels, soit 1280×720 en 16:9, avant allocation des cibles WebGL. Le budget persiste après redimensionnement. Les textes et menus restent à la définition CSS de l'écran. Les qualités manuelles agissent sur les effets tout en conservant ce plafond console. Aucun fichier FERRO ni la physique ne change.

En Auto, un contrôleur affecté reste prioritaire au neutre. Sur Xbox, le pointeur du navigateur n'est jamais interprété comme un volant en Auto ; le choix explicite Souris reste disponible. Les clics sur les commandes de l'interface n'activent plus le pilotage. Un clic navigateur concomitant à une entrée manette est filtré pour préserver le focus ; les activations internes du menu à la manette sont conservées.

Chaque joueur dispose d'affectations manette persistantes distinctes des touches clavier. Boutons et axes peuvent être choisis ; l'ouverture d'une capture attend le retour au neutre, puis une nouvelle entrée. B/Menu annule sans quitter les réglages. Les fronts sont consommés pour éviter une action fantôme après capture ou reconnexion. Une affectation remplace cette même entrée sur les autres actions du joueur, sans modifier celles de l'autre joueur. Le panneau montre les niveaux de gaz, frein et volant reçus. Il est accessible avant une course solo comme à deux.

## Mode de commandes Edge

Microsoft documente le maintien du bouton Menu pour basculer entre manette et pointeur :
https://www.microsoft.com/en-us/edge/learning-center/how-to-use-microsoft-edge-on-xbox

Le jeu affiche cette aide et l'état des entrées reçues. Il ne peut pas promettre de forcer un mode propre au navigateur. L'absence de RT/LT sur la console du joueur n'a pas été reproduite sur un appareil physique : les indices standard 7/6 étaient déjà corrects si Edge les transmet.

## Qualification et limites

Contrôles ciblés des entrées, réaffectations, captures, reconnexions, duo, menus, profil passif et véritable FSurface. Les anciennes assertions de conduite restent conservées. La qualification navigateur prescrit une UA Xbox, un écran 4K et une Gamepad API virtuelle dans Chrome ; elle observe le vrai jeu et les commandes reçues par la conduite.

Chromium local est bloqué avant chargement par `socket() failed: Operation not permitted`. Les captures du vrai HTML passent donc par GitHub Actions, workflow `qualification-xbox.yml`, marqueur `[capture-xbox]`. La CI du candidat et ces images doivent réussir avant fusion. Une mesure de taille de framebuffer ne prouve pas un gain de FPS Xbox. Aucun essai Xbox matériel ni déploiement du site n'est annoncé.

## Travaux conservés

La PR #56, `codex/bitume-mains-0281-20261121`, conserve le candidat mains `9a8d6088`, HTML `eeccabb9`. Ses 48 images ont été inspectées : les doigts gardent mieux leur longueur ; la prise au pommeau reste cachée dans la capture prescrite. Une caméra extérieure plus haute doit encore recevoir ce contact, puis le lot doit être rebasé et renuméroté après la publication console. Les manches, Larche → Vinadio, les circuits, PR #43 et les travaux décor restent prévus.
