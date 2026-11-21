# Démarrage téléphone — 21 novembre 2026

## Demande et cause

David signale que les tests de performances font planter le navigateur sur
téléphone ; il demande une détection matérielle sans test de charge. Le chemin
automatique construisait une scène de douze voitures, agrandissait la toile à
l’écran entier puis enchaînait rendu et rétroviseurs en rafales.

## Correctif 0.2.80

- Le démarrage et « Appliquer le profil conseillé » ne lancent plus de banc.
- La recommandation lit les capacités déclarées : mobile/iPad, matériel modeste
  ou inconnu → Légère ; ordinateur suffisamment renseigné → au plus Moyenne.
- Les anciens résultats du banc migrent vers `capacites-declarees`. Une nouvelle
  version ne provoque plus de mesure de performances.
- Les réglages modifiés par le joueur sont conservés lors de la migration. Le
  bouton explicite applique le profil conseillé à tous les choix graphiques.
- Le profil est résolu avant la première application du rendu et avant la
  préparation normale de la vitrine ; aucune création de rétroviseurs en Légère.
- Les bancs restent accessibles aux outils de qualification explicitement lancés.

Ce lot conserve les mains et leur mémoire de la 0.2.79. Les nouvelles poses
sont qualifiées séparément. La conduite p15, FERRO 0.3.15 et les neuf circuits
restent identiques.

## Vérification

103 contrôles ciblés passent : détection passive 4, orchestration 14, ancien
algorithme réservé aux outils 31, chargement 9, graphismes 22, qualité 23.
L’orchestration exécute les fonctions de production et interdit tout appel aux
bancs de rendu. Elle couvre premier lancement iPhone/iPad/Android, nouvelle
version, ancien cache, choix manuels, bouton Image, orientation, visibilité,
arrivée au titre et erreur PhysX explicite.

Build reconstruit deux fois à l’identique. Le commit exact `6526493` est publié
sur `main` : **192 suites Node et 8 tests Python réussis** dans le workflow
[44922327402](https://github.com/M4D135/bitume/actions/runs/44922327402).
Le workflow [44922327560](https://github.com/M4D135/bitume/actions/runs/44922327560)
reçoit le vrai démarrage WebGL2/PhysX sur un profil iPhone vierge, puis la course
et le clic sur le bouton Image : **zéro appel à `autoconfig.executer` et à
`sceneBench.creer`**, profil Légère persisté et une seule recommandation passive
par demande. Les deux PNG ont été inspectés ; aucune erreur navigateur.

[Reçu et limites](rapports/DEMARRAGE-MOBILE-2026-11-21/PUBLICATION-0280.json).
Chrome émule les caractéristiques iPhone : aucun essai Safari/iOS physique ni
gain FPS matériel annoncé. Le site servi doit être vérifié après déploiement ;
la présence sur GitHub ne constitue pas ce déploiement.
