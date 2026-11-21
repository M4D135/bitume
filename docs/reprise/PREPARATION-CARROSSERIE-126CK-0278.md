# Préparation carrosserie 126 CK — nez et pontons

21 novembre 2026. Branche `codex/bitume-0278-carrosserie-126ck-20261121`,
base locale `2aaa67f`. Petit lot de sources, **sans nouveau build ni publication main**.
Le poste .77 est développé séparément ; aucune pièce du poste n'est changée ici.

## Ce qui change

Le diff déjà préparé est conservé et complété : nez plus étroit à l'avant, épaules
séparées des pontons, bord avant des pontons placé derrière les pneus avant et
filets de couleur séparés pour éviter une corde suspendue entre ces deux volumes.
La version lointaine reprend les mêmes sections de silhouette.

Deux ouvertures frontales sont réellement découpées dans la peau des pontons.
Leurs quatre parois intérieures rejoignent un fond sombre en retrait ; six ailettes
par radiateur restent au détail complet. Les ouvertures et leur fond sont conservés
au détail moyen et simple. Aucune texture, aucun modèle ou fichier son n'est importé.

Références inspectées : vues RenderBlade **01, 09/29, 11 et 12**. La vue 29 filaire
permet de distinguer les épaules du nez et le départ rectiligne des pontons ; la
vue 12 montre les bouches frontales sous les plateaux. [Galerie et provenance](../references/ferrari-126ck-renderblade-2026-11-21/GALERIE.md).
Toutes les dimensions ajoutées sont des choix de modélisation adaptés au train
roulant actuel, pas des mesures constructeur déduites de ces rendus.

## Vérification réalisée

**91 contrôles ciblés réussis**, répartis dans huit suites : voiture 33, carène 14,
pilote commun 4, pilote extérieur 14, habitacle 12, eau/carrosserie 4,
préférences de pneus 6, nouvelle suite carrosserie 4.
[Résultats et journaux](preuves/CARROSSERIE-126CK-0278/suites.json).

La nouvelle suite sonde les vrais triangles : ouvertures traversables jusqu'au
fond en retrait, lèvre et plateau encore présents, objets de conduits rendus dans
les trois détails. **109 120 échantillons de sommets/centres de triangles**, à cinq
braquages de −0,60 à +0,60 radian, restent à plus de 15 mm du volume des pneus avant.
Cela documente l'échantillonnage testé, sans prétendre à une preuve continue de
non-intersection pour toute pose possible.

Le [comparatif de géométrie](preuves/CARROSSERIE-126CK-0278/invariants.json) donne
**238 formes inchangées**. Cinq changent (`fleche`, `pontons`, `bande`, `filet`,
`loin-caisse`), deux sont ajoutées (`pontons-conduits`, `pontons-radiateurs`).
Les yeux, assise, épaules, volant, planche, coudes, levier, roues et empattement
sont identiques à la base. Aucune copie FERRO, physique ni raccord `jeu.js` modifié.

## Inspection visuelle

[Rapport des captures et empreintes](preuves/CARROSSERIE-126CK-0278/rapport.json).
Six poses comparées avant/après, avec le **fallback Canvas2D livré par FERRO**,
exécuté sur une surface native : face, dessus, profil, trois-quarts, détail moyen,
détail simple. Les images ne valident ni WebGL2, ni les matières/reflets, ni le jeu
assemblé. Le poste antérieur reste visible dans ces témoins de carrosserie uniquement.

| Vue | Base historique | Préparation |
|---|---|---|
| Face : ouvertures | [Avant](preuves/CARROSSERIE-126CK-0278/reference/avant.png) | [Après](preuves/CARROSSERIE-126CK-0278/candidat/avant.png) |
| Dessus : silhouette | [Avant](preuves/CARROSSERIE-126CK-0278/reference/dessus.png) | [Après](preuves/CARROSSERIE-126CK-0278/candidat/dessus.png) |
| Trois-quarts | [Avant](preuves/CARROSSERIE-126CK-0278/reference/trois-quarts.png) | [Après](preuves/CARROSSERIE-126CK-0278/candidat/trois-quarts.png) |
| Profil | [Avant](preuves/CARROSSERIE-126CK-0278/reference/profil.png) | [Après](preuves/CARROSSERIE-126CK-0278/candidat/profil.png) |

Reproduction :

```sh
node tools/captures-carrosserie.mjs --sortie /tmp/bitume-carrosserie-126ck --reference 2aaa67f
node verifications/carrosserie-126ck.test.mjs
```

## Raccord à la suite de .77

Appliquer les seuls changements de carrosserie de `src/voiture.js` après le poste
.77 ; préserver ses modifications du volant, de la planche et des miroirs. Le lot
ajoute son outil, sa suite et ses preuves sans changer `VERSION.json`, `SIZE.json`,
`dist/`, `REPRISE.md`, `ETAT.json`, ni les fichiers d'intégration partagés.
La fixture globale `voiture-identite.json` n'est pas renouvelée ici : la refaire
sur l'assemblage exact après .77, en conservant les empreintes de roues et du poste.
Ensuite construire, vérifier et capturer le HTML exact avant toute intégration main.

La voiture complète n'est pas déclarée fidèle : capot arrière, plateau moteur,
flancs ajourés, prises secondaires, quille, ailes et arceau restent à reprendre.
Les cotes de collision et la motorisation historiques restent inchangées ; une
évolution de leur comportement relève d'un lot de physique distinct. Aucun gain
FPS matériel annoncé et aucun déploiement.

## Raccord sur le poste .77 — candidat 0.2.78

Le lot `f004cf1` est repris sans conflit sur le poste exact
`f596ac442e99f754c9b0d420f8c21a644a86da3e`, dans
`codex/bitume-0278-integration-20261121`. Le runtime ne change que
`src/voiture.js` ; aucune caméra, commande, physique p15 ni copie FERRO n'est modifiée.

Avant de renouveler la fixture globale, la comparaison avec .77 confirme
**239 formes identiques**, les cinq formes de carrosserie attendues modifiées et
les deux conduits/radiateurs ajoutés. Les **16 constantes exportées** restent
identiques, notamment le poste, les roues/maillages de pneus et jantes, l'assise et
l'empattement. Sur **240 poses**, les instances hors carrosserie restent exactes
avec une livrée sans numéro ; **240 autres comparaisons** vérifient les roues avec
le numéro 27, qui détermine leur phase de rotation.

Le numéro du nez suit automatiquement la nouvelle peau : sa pose change aussi.
La fixture renouvelée modifie **117 des 134 groupes dans chacune des deux
configurations**, en conservant leurs appels, les groupes de glaces, l'arrondi
à 1e-9 et les assertions du test. [Rapport reproductible](preuves/CARROSSERIE-126CK-0278/assemblage/invariants.json),
outil `tools/qualification/raccord-carrosserie-126ck.mjs`.

Deux constructions donnent le même HTML **0.2.78**, 14 516 062 octets,
SHA256 `0319f220105e10cc1b629514519128512f9ab6d9d9beca7eaa45d8d587e4a760`.
Les 34 copies FERRO 0.3.15 sont conformes au verrou.
[Reconstruction](preuves/CARROSSERIE-126CK-0278/assemblage/reconstruction.json).
Les **13 suites ciblées passent**, couvrant carrosserie, carène, identité/permanence,
pilote, habitacle, mécanique/visibilité du cockpit, reflets des miroirs, eau et pneus.
[Journaux et résultats](preuves/CARROSSERIE-126CK-0278/assemblage/suites.json).

Les images Canvas2D plus haut restent les témoins du lot isolé avant raccord du
poste .77. **Elles ne sont pas les captures de ce HTML .78**. La qualification
WebGL du jeu assemblé et sa publication sont laissées au coordinateur ; aucun
résultat de fidélité complète à la 126 CK ni aucun déploiement n'est déclaré ici.
