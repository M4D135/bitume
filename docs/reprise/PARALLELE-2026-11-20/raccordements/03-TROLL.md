# 03 → 01/00 — contrat des choix Troll

## Données du menu

Le raccord de 03 ajoute à `reglages` un tableau **deux entrées locales**, même quand un seul pilote joue :

```js
trollPilotes: [
  { geste: 'majeur', klaxon: 'classique' }, // joueur local 1
  { geste: 'majeur', klaxon: 'classique' }  // joueur local 2
]
```

| Champ | Valeurs stables | Défaut | Texte présenté |
|---|---|---|---|
| `geste` | `majeur`, `poing`, `salut` | `majeur` | Doigt d’honneur, Poing levé, Salut |
| `klaxon` | `classique`, `ancien`, `mariage` | `classique` | Classique, Ancien · rétro, Mariage · fête |

`B.menuArcade.normaliserTroll(source)` lit `source.trollPilotes` et rend une nouvelle paire de nouveaux objets.
Une entrée/champ absent ou inconnu reprend son défaut ; aucun objet mutable du stockage n’est conservé par
référence. Les choix sont sauvegardés avec `bitume.reglages`, sans nouvelle clé et sans modifier p15.

Les champs DOM existants restent `gestePilote0/1` et `klaxonPilote0/1` :
`p-geste-N` / `p-klaxon-N` pour la préparation, `pr-geste-N` / `pr-klaxon-N` pour les prêts en ligne.
Le deuxième choix est caché en solo et restauré intact au retour à deux. Les deux vues de préparation sont
synchronisées ; modifier un choix dans `prets` retire l’état prêt avant nouvelle confirmation.

## Consommation par 01 et raccord par 00

La coque proposée fournit `choixTrollLocaux()` (copie normalisée). Au départ, lire chaque paire locale et la
relier à **`session.locaux[n]`**, sans supposer que J1 est toujours la voiture 0 ni J2 la voiture 1 en ligne.

Le seul front de l’action `troll` doit demander la paire complète. Quand l’animation accepte le geste,
son début et le klaxon sélectionné doivent provenir du même événement accepté ; un refus/temps de repos
ne doit pas laisser jouer un klaxon isolé. Le maintien de la touche ne relance pas la combinaison. Le menu
ne choisit ni l’animation, ni le côté, ni les délais ; ces règles restent à 01.

Les identifiants de geste correspondent aux `GESTES` actuellement exportés par `expressions-pilote.js`.
La préparation `preparations/audio-troll.patch` expose `son.klaxon(type, {gain, pan})` et les trois identifiants
ci-dessus. Le bouton « Écouter » appelle cette API après activation audio par un vrai geste, avec gain 0,75.
Si cette API n’est pas encore intégrée, le bouton est désactivé et l’état indique « Aperçu sonore indisponible. ».
Ce bouton d’essai n’est pas une deuxième commande de klaxon en course.

Les IA ne lisent pas les préférences des joueurs : 01 tire leurs paires au hasard et contrôle la fréquence et
les réactions après dépassement. Le menu ne touche pas au générateur de hasard de conduite.

## Réseau : raccord restant explicitement à 00/01

Le menu sauvegarde les choix de chaque machine, mais `03-menu.patch` **n’étend pas** les messages de pneus,
les paquets de départ ou les états réseau. 00/01 doit transporter les paires par identité de machine puis
indice local, les valider avec les mêmes listes autorisées et les associer aux bonnes voitures avant course.
Les pneus, états prêt et règles d’autorité existants ne doivent pas être détournés pour encoder Troll.

Avant de déclarer Troll terminé : qualifier combinaison locale J1/J2, maintien et temporisation, essai audio,
réaction des IA, démo, puis les variantes un/deux pilotes par machine. Les essais du menu ne constituent
pas une qualification de ce déclenchement simultané ou de sa transmission entre machines.
