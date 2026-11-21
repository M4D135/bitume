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

Build reconstruit deux fois à l’identique. Réception WebGL et CI du commit exact
en cours ; leurs reçus seront ajoutés avant clôture. Aucun essai sur téléphone
physique ni gain FPS matériel annoncé. Le site servi doit être vérifié après
déploiement ; la présence sur GitHub ne constitue pas ce déploiement.
