# Lot 17 : conduite p10 — pneus, transferts, motricité, freins, aide et dérive

Demande de David, 18 novembre 2026 : « il faut aussi améliorer la réaction du véhicule sur la route, la sensation de
conduite doit être la plus fidèle et la plus logique et cohérente niveau physique. Regarde les meilleures infos,
forums etc. de fans de réglages de simulateurs de F1 pour comprendre les mécanismes, renseigne-toi un max pour rendre
le pilotage réaliste et surtout ultra fun et arcade à la fois ».

Statut : **plan**. Rien n'est appliqué au jeu. Base : branche `conduite/etude` (`912f17b`), banc de conduite v1,
empreinte **52a7484e7589dd23** (modèle p9). Le lot ne commence qu'après la fusion de 5B-7 (simulation sans
allocation, qui réécrit `conduite.js`, `course.js`, `circuit.js`, `contacts.js`) ; 17A peut passer dès cette fusion.

Lire avec : [MODELE.md](rapports/conduite-2026-11-18/MODELE.md) (le modèle actuel, ligne à ligne),
[BANC-BASE.md](rapports/conduite-2026-11-18/BANC-BASE.md) (ses mesures),
[RECHERCHE.md](rapports/conduite-2026-11-18/RECHERCHE.md) (les quatre recherches et leurs sources) et
[etude-17/](rapports/conduite-2026-11-18/etude-17/) (les calculs et mesures de ce plan, § 10).

## 1. Principes

1. **Une loi, des nombres, pas de cas particulier.** Chaque comportement vient d'une équation écrite ici, dont chaque
   paramètre a une valeur de départ et une plage de réglage. On règle des nombres, on n'ajoute pas de `if` pour une
   situation.
2. **La même voiture pour tous.** Joueur et onze rivaux roulent sur la même physique ; seuls le pilote et l'aide
   diffèrent. L'aide est une couche à part (contre-braquage simulé, stabilisateur, antipatinage, antiblocage), dosée
   par le réglage « Aide », qui rattrape et ne conduit jamais à la place du joueur.
3. **L'arcade par la clémence, pas par la triche.** Le jeu est indulgent par des moyens déclarés : plateau haut
   après le pic du pneu, fenêtre de rattrapage, contre-braquage simulé, compensation des appareils tout ou rien. Il
   n'invente pas de force qui tire la voiture vers la ligne (le seul écart restant, le turbo, est le pilier 2 de
   `CONCEPTION.md` et reste borné par l'adhérence).
4. **Toute perte d'adhérence s'annonce et se rattrape.** Trois signaux (son qui baisse de hauteur passé le pic,
   vibration, fumée) et une fenêtre : la force retombe en 0,15 s, pas au pas près, et jamais sous 80 % du pic.
5. **Les transferts ont un sens.** La sensibilité des pneus à la charge fait qu'un frein en entrée fait tourner, un
   lever de pied referme, des gaz élargissent ou font survirer selon l'équilibre. Pas de bascule : une glisse.
6. **La dérive chargée est une glisse.** Le bouton donne l'élan et relâche l'aide ; la charge vient de la glisse
   réelle de l'arrière tenue au contre-braquage et aux gaz ; le turbo s'en mérite, pour toutes les manettes.
7. **Chiffré au banc, jugé au volant.** Chaque sous-lot a ses mesures, ses cibles et ses tolérances, et garde les
   46 critères de la phase 2 ou dit lequel il change et pourquoi. Aucune qualité annoncée sans mesure ; le dernier mot
   est l'essai de David.
8. **Règles du lot 5B.** Aucune création d'objet par image en course, tout se prépare au chargement, rien ne se coupe
   à distance, coût mesuré, qualité « Légère » préservée. Simulation déterministe : un effet visuel ou sonore ne
   consomme jamais le hasard de la course.
9. **FERRO reste verrouillé.** La nouvelle loi de pneu vit dans un module BITUME (`src/pneu.js`, nouveau), chargé
   avant `conduite.js` ; `src/ferro/vehicle-dynamics.js` n'est pas modifié.

## 2. Ce que disent les mesures

Du banc (`BANC-BASE.md`) et de cette étude (§ 10) :

- **La voiture est limitée par l'avant** à tous les rayons, avec 5 à 8 % de réserve à l'arrière (calcul validé contre
  le banc à −2,0 / +3,5 % près). Le jeu proposé garde la même enveloppe d'adhérence (R 30 à R 180 à ±2 %
  « équivalent banc ») avec un peu plus de réserve arrière (8 à 11 %).
- **Le lacet est sous-amorti à 200 km/h** (dépassement 17 à 25 %). Mesuré sur le vrai modèle (E2) : abaisser l'angle
  du pic de 6,0 / 5,4° à 4,3 / 3,9° ramène le dépassement à 9,3 % **sans ralentir la réponse** (t90 81 ms contre 79) ;
  l'amortisseur de glisse amortit davantage mais ralentit (0,8 : 0,5 % de dépassement, t90 105 ms à 200 km/h et
  156 ms à 100) ; l'inertie ne change que la vitesse ; l'appui avant et le partage du roulis n'y font rien.
  Point de départ retenu : pic 4,9 / 4,4° et amortisseur 0,6 → 6,7 % / 10,5 % (mi / plein volant), t90 87 / 84 ms.
- **Les 46 critères sont un ajustement fin** (E3) : l'empattement seul (2,85 → 2,70 m) en casse quatre (S4
  contre-braquage, S5 clavier en dérive) ; avec l'inertie mise à l'échelle (giration 1,23), trois (S5). L'amortisseur
  à 0,7 en casse douze (la dérive ne s'arme plus). Chaque sous-lot devra donc régler à nouveau aide et dérive, et S5
  est le critère le plus fragile.
- **Freins** (E1) : avec 44 % de masse sur l'avant, 2,3 à 2,6 g de décélération, le frein moteur sur l'arrière et la
  sensibilité à la charge, **l'arrière bloque le premier en dessous de 70 % de répartition** à pédale pleine ; à 70 %
  l'avant bloque le premier dans les quatre freinages essayés. C'est plus en avant que les 55 à 62 % des sources (voir
  `RECHERCHE.md` § 5) : à revérifier sur le vrai modèle en 17D.
- **Puissance** (E1) : deux jeux cohérents, la traînée suivant la puissance pour garder la pointe vers 300 km/h :
  niveau actuel (233 kW à la roue, SCx 0,58 m²) et niveau fidèle (moteur de 521 ch, 345 kW à la roue, SCx 0,88 m²).
  Le calculateur gagne 0,8 s sur 0-200 face au banc : lire les écarts entre jeux (1,5 s de moins au fidèle), pas les
  temps.
- **Le reste vient de `MODELE.md` § 13** : 25 points non physiques ou incohérents, repris un à un au § 4.

## 3. Le modèle cible p10, équation par équation

Notations de `MODELE.md` § 1 : u vitesse longitudinale de la caisse (m/s), v_y latérale, r lacet, β dérive de caisse,
δ braquage des roues avant, a = L·(1 − rep) (centre de gravité → essieu avant), b = L·rep (→ essieu arrière). Roues
dans l'ordre du contrat de 12A : AVG, AVD, ARG, ARD. « p9 » : valeur actuelle ; « départ » : première valeur à
mesurer ; « plage » : où le réglage a le droit d'aller sans revenir au plan.

### 3.1 Châssis et charges

| Paramètre | p9 | Départ | Plage | Pourquoi |
|---|---|---|---|---|
| masse m | 600 kg | **665 kg** | 600–730 | 595 kg (fiche T5) + 70 kg de pilote ; carburant non modélisé (plein : environ 130 kg de plus) |
| empattement L | 2,85 m | **2,70 m** | fixe | cote de la T5 et de la voiture dessinée (12-PLAN-MAITRE § 1) |
| voies t_av / t_ar | 1,75 / 1,75 m | **1,70 / 1,615 m** | fixes | fiche T5 |
| répartition statique rep | 0,44 | 0,44 | 0,40–0,46 | inchangée |
| hauteur du CG h | 0,33 m | 0,33 m | 0,28–0,36 | inchangée |
| giration k (I_z = m·k²) | 1,30 m (1 014 kg·m²) | **1,23 m** (1 006 kg·m²) | 1,10–1,35 | garde l'indice dynamique k²/(a·b) = 0,84 ; E3 : rend S4 à 2,70 m |
| part du roulis sur l'avant (TLLTD) | 0,54 | 0,54 | 0,45–0,62 | sources 50–60 % ; E2 : sans effet sur le lacet |
| part géométrique du transfert γ | 0 | **0,3** | 0–0,5 | part immédiate (centres de roulis), le reste élastique et retardé |
| retard du transfert τ_ch | 0,062 s | 0,062 s | 0,05–0,12 | sources 0,05–0,15 s |
| lissage de la courbure verticale | — | **6 m** | 0–12 m | bosses, crêtes, compressions |

```
a* = γ·a + (1 − γ)·a_f,      a_f ← a_f + (a − a_f)·(1 − e^(−dt/τ_ch))        (pour a_x et a_y)
F_N  = m·(g·cos θ_pente·cos θ_dévers + u²·κ_v)          κ_v = dθ_pente/ds lissée (> 0 en compression)
F_z,av = F_N·rep + F_aéro,av − m·a_x*·h/L ;     F_z,ar = F_N·(1 − rep) + F_aéro,ar + m·a_x*·h/L
F_z,AVG/AVD = F_z,av/2 ± TLLTD·m·a_y*·h/t_av ;   F_z,ARG/ARD = F_z,ar/2 ± (1 − TLLTD)·m·a_y*·h/t_ar   (≥ 0)
```

Changement : p9 utilise une voie de 1,75 m aux deux essieux, aucune part immédiate, ni pente ni bosse dans la
charge (`MODELE.md` § 13, point 7). Une crête allège la voiture, une compression la plaque : c'est ce qui manque au
circuit de montagne.

### 3.2 Pneu : force latérale d'une roue (`src/pneu.js`)

```
μ_i     = μ_s · σ_surface,i · σ_pneu(eau, neige) · g_essieu · (F_z,i / F_z0,essieu)^(−q)
F_max,i = μ_i · F_z,i                       F_z0,essieu = charge statique d'une roue de l'essieu (calculée)
α_pic,i = α_pic0,essieu · (F_z,i / F_z0,essieu)^p
x = α / α_pic ;   f(x) = sin(π·x/2) si |x| ≤ 1,   sinon  signe(x)·[1 − c·(|x| − 1)² / ((|x| − 1)² + l²)]
F_y,i   = F_max,i · f(x)                    (glissement pur ; combiné au § 3.3)
```

Normer la charge sur la charge statique de chaque essieu garde μ_s·g pour l'adhérence statique, quel que soit q : on
règle la sensibilité sans déplacer l'adhérence de base.

| Paramètre | p9 | Départ | Plage | Pourquoi |
|---|---|---|---|---|
| μ_s (piste sèche, slicks) | 1,72 | **1,85** | 1,75–1,95 | même enveloppe que p9 avec la nouvelle loi (E1) |
| sensibilité q | linéaire 0,06 autour de 1 500 N | **0,18** | 0,10–0,25 | Milliken : 2 × la charge → 1,76 × la force |
| g_ar (adhérence arrière) | 1,08 | **1,04** | 1,00–1,10 | réserve arrière de 8 à 11 % (E1) ; 1,08 en donnerait 13 à 16 % |
| α_pic0 avant / arrière | 6,0 / 5,4° | **4,9 / 4,4°** | 4,0–6,0 / 3,6–5,4° | E2 : amortit le lacet sans ralentir ; radiaux 3,5–4,5° (sources) |
| exposant de l'angle p | 0 | **0,25** | 0–0,35 | Milliken : 5,6 → 6,7° pour 2 × la charge |
| retombée avant c, l | 0,15, 1,0 | 0,15, 1,0 | 0,10–0,20, 0,6–1,5 | plateau 85 % ; déjà la bonne forme |
| retombée arrière c, l | sur l'adhérence totale, 0,30, 2,0 | **0,20, 1,0** | 0,12–0,28, 0,6–2,0 | plateau 80 % (86 % à 2,5 × le pic) : jamais de falaise |
| mémoire du pic τ_pic | — | **0,15 s** | 0–0,25 | 100 à 200 ms au-dessus de la courbe après une rupture (recherche 3) |

Mémoire du pic, par roue : la chute après le pic, `c·(|x| − 1)²/((|x| − 1)² + l²)` (nulle sous le pic), n'est
atteinte qu'avec un retard : `chute ← chute + (cible − chute)·(1 − e^(−dt/τ_pic))` quand elle croît, immédiatement
quand elle décroît (l'adhérence revient tout de suite). C'est un choix de jeu déclaré : il donne au joueur le temps de
rattraper sans changer la limite.

Température et usure : hors de ce lot (12D, 12E) ; `pneu.js` prévoit un facteur par roue, à 1.

### 3.3 Glissement combiné (normalisation de Beckman)

```
s_α = α/α_pic,   s_κ = κ/κ_pic,   ρ = √(s_α² + s_κ²)
F = F_max·f(ρ) ;   F_y = F·s_α/ρ ;   F_x = e_x·F·s_κ/ρ
```

| Paramètre | p9 | Départ | Plage |
|---|---|---|---|
| κ_pic (glissement au pic) | — | **0,08** | 0,06–0,12 |
| e_x (capacité longitudinale / latérale) | — | **1,05** | 1,00–1,20 |

Remplace, dès que la roue tourne vraiment (17C, 17D) : l'exposant de motricité 1,3, la retombée séparée de l'adhérence
arrière (`capArG`), le plafond `transmis` à 0,97, `glissement` 0,97. Une roue bloquée (κ → −1) a s_κ ≫ s_α : sa force
latérale s'effondre d'elle-même, d'où le sous-virage d'un avant bloqué, sans règle ajoutée. Avant 17C, le couplage
p9 (ellipse 1,3 et `transmis`) reste en place : changer les deux à la fois casserait S3.

### 3.4 Relaxation (option, essayée en 17B)

```
α_eff ← α_eff + (α − α_eff)·(1 − e^(−max(|u|, u_r)·dt/σ))          σ 0,3 m (0–0,5) ; u_r 5 m/s
```

τ = σ/u : 60 ms au pas, 18 ms à 60 km/h, 5 ms à 200 km/h. Elle ne peut donc rien contre le dépassement à 200 km/h ;
elle peut adoucir S8 à basse vitesse. La phase 2 a vu un retard fixe de 30 à 80 ms casser S4, S5, S7, S9 et diverger
au-delà de 40 ms : elle n'est gardée que si elle améliore S8 sans rien casser.

### 3.5 Moteur, boîte, roues motrices, différentiel

```
n     = NMAX·(ω_ar·R_ar)/vPointe_k                       (le régime suit la roue : il s'emballe au patinage)
T_mot = gaz·T_max·τ(n) − (1 − gaz)·(c0 + c1·n)           τ : (4000 ; 0,62) (7000 ; 0,80) (8500 ; 0,95) (10500 ; 1) (12300 ; 0,93) (12800 ; 0,80)
F_roue = T_mot·η·NMAX·2π/(60·vPointe_k)                 ∝ 1/vPointe : même puissance sur tous les rapports
J_eff,ar·dω_ar/dt = T_roue − T_frein,ar − R_ar·F_x,ar   (un état de rotation par essieu ; l'avant en 17D)
κ = (ω·R − u)/max(|u|, 3 m/s)
```

| Paramètre | p9 | Départ | Plage | Pourquoi |
|---|---|---|---|---|
| couple maxi T_max | (POUSSEE ∝ vPointe^−0,8) | **216 N·m** (niveau actuel, 233 kW à la roue) | 190–330 | **question 1** : 320 N·m = niveau fidèle (521 ch, 345 kW à la roue) |
| rendement η | — | 0,90 | 0,85–0,93 | hypothèse de BANC-BASE § 3 |
| frein moteur c0 + c1·n | 1,6 m/s² constant | **15 N·m + 0,0030·n** (45 N·m à 10 000 tr/min) | × 0,5 à × 1,3 | sources 40–70 N·m ; plus fort, il impose une répartition plus avant (E1) |
| inertie moteur J_mot | — | 0,15 kg·m² | 0,08–0,25 | masse équivalente arrière ≈ 387 kg en 1re, ≈ 55 kg en 6e |
| inertie d'une roue J_roue | — | 1,0 kg·m² | 0,6–1,4 | masse équivalente avant ≈ 24 kg |
| coupure au passage | 0,08 s | 0,08 s | 0,04–0,08 | sources 40–80 ms |
| boîte, rupteur, lancement | 12 300 / 11 000 / 13 000, 0,70 | inchangés | — | S3 départ (≥ 9 000 tr/min) |
| différentiel (option) : précharge, rampe gaz, rampe frein moteur | — | 40 N·m, 0,40, 0,25 | 20–60, 0,25–0,60, 0,10–0,35 | moment de lacet par la différence gauche-droite |
| traînée SCx | 0,58 m² | **0,58** (niveau actuel) ou **0,88** (fidèle) | 0,55–1,00 | va avec T_max : pointe vers 300 km/h |

- Intégration de la roue : Euler implicite linéarisé (pente ∂F_x/∂κ au pas), ou quatre sous-pas de 1/480 s pour la
  roue seule ; l'avant, à 24 kg équivalents, diverge en explicite à 120 Hz. Rien n'est créé par pas.
- Différentiel : les deux roues arrière reçoivent des forces qui ne diffèrent que de T_blocage/R_ar au plus, avec
  T_blocage = précharge + rampe·|T_entrée| ; chacune reste bornée par sa propre capacité (la roue intérieure délestée
  patine la première sans blocage) ; moment de lacet (F_x,ext − F_x,int)·t_ar/2. Aux gaz : motricité et un peu de
  survirage ; pied levé : stabilité en entrée. Retiré s'il ne paie pas au banc.
- Repli si l'état de roue ne tient pas S3, S5 ou le coût : saturation quasi statique avec hystérésis (patinage quand
  la demande dépasse e_x·F_max, force au plateau, retour sous 0,9 fois la capacité).

### 3.6 Freins

```
T_f,av = p·b·F_b·R_av ;   T_f,ar = p·(1 − b)·F_b·R_ar ;   F_b = F_b,max·m·g        (p : pédale, 0 à 1)
```

| Paramètre | p9 | Départ | Plage | Pourquoi |
|---|---|---|---|---|
| force de pédale F_b,max | demande = 0,92·μ·(poids + appui) | **2,3 g** | 2,0–2,6 | la pédale est une force, plus une part de l'adhérence |
| répartition b | 0,58 | **0,70** | 0,62–0,76 (menu 0,60–0,76) | E1 : l'avant bloque le premier à pédale pleine |
| montée de pédale, appareils tout ou rien | — | 0,15 s | 0,10–0,25 | le transfert n'est pas là au premier pas |
| plateau de glisse roue bloquée | — | f(ρ) au-delà du pic (≈ 0,82) | 0,75–0,88 | sources −15 à −20 % roue bloquée |

- Blocage : naturel avec l'état de roue (§ 3.3). Repli : état « bloquée » quand la demande dépasse e_x·F_max, force
  au plateau, latéral × 0,3, levé quand la demande repasse sous 0,9 fois la capacité.
- Rétrogradage automatique avec coup de gaz : pas de blocage arrière au rétrogradage.
- Calcul E1 (ABS idéal, jeu fidèle) : 200-0 en 69 m, 300-100 en 119 m, 100-0 en 20,5 m ; pédale pleine tenue : 4 à
  16 % plus long, l'avant bloquant en fin de freinage, quand l'appui tombe (à 100 km/h, l'avant ne prend plus que
  81 % de la pédale, 75 % à 60 km/h).

### 3.7 Aérodynamique et sillage

```
F_aéro = ½·ρ_air·SCz·u² ;   part avant = aeroAvant − k_t·a_x,f/g        (le nez plonge au freinage : plus d'avant)
derrière une voiture : F_aéro,av × (1 − 0,20·part_a),  F_aéro,ar × (1 − 0,08·part_a),  traînée × (1 − 0,25·part)
part = (1 − ds/30)·(1 − |Δd|/2) (course.js, `aspirer`) ;  part_a : même forme sur 40 m (l'air sale porte plus loin)
```

| Paramètre | p9 | Départ | Plage | Pourquoi |
|---|---|---|---|---|
| SCz | 1,567 m² (600 kg) | **1,9 m²** (665 kg) | 1,6–2,4 | 9 % d'appui de plus par kilo, que la loi de charge reprend : même enveloppe d'adhérence (E1) |
| aeroAvant | 0,45 | **0,42** | 0,38–0,46 | équilibre 2 points vers l'arrière de la masse (HP Academy) |
| sensibilité au tangage k_t | — | 0,015 par g | 0–0,03 | rotation en entrée, sous-virage aux gaz en sortie |
| aspiration (traînée) | 0,35 | **0,25** | 0,15–0,35 | sources −23 % ; plafond recommandé −20 % |
| perte d'appui dans le sillage av / ar | 0 / 0 | **0,20 / 0,08** | 0,10–0,30 / 0–0,15 | sources −36 % d'appui ; plafond recommandé −25 % à l'avant |
| perte d'étanchéité sur vibreur (option) | — | −12 % d'appui de l'essieu, 0,25 s | 0–0,2, 0,1–0,4 s | **question 6** |

### 3.8 Direction

```
δ   = κ_P·suivi(v)·angCG + braquer(ρ_c, v, a_max,av)                     (borné à ±0,38 rad, comme p9)
ρ_c = ρ_volant + ρ_guidage + ρ_aide − κ_D(u)·(r − a_y/u)·u/a_max,av·(1 − lâché)·(1 − 0,75·b_d)
κ_D(u) = κ_D0 + (κ_D1 − κ_D0)·rampe(u, 30, 60 m/s)
```

La direction par part d'adhérence de p9 est gardée : le volant commande une part de l'adhérence avant et plein volant
tombe au pic (marge 1). Elle remplace le retour de force qu'un clavier ou une manette n'ont pas. Elle contient un
contre-braquage automatique de gain 1 (`suivi·angCG`) et un amortisseur de glisse toujours actif ; p10 les nomme
κ_P et κ_D et les dose par l'Aide (§ 3.9).

| Paramètre | p9 | Départ | Plage | Pourquoi |
|---|---|---|---|---|
| κ_D0 (≤ 108 km/h) | 0,5 | 0,5 | 0,4–0,6 | garde la réponse à 100 km/h (t90 113 ms) |
| κ_D1 (≥ 216 km/h) | 0,5 | **0,62** | 0,5–0,7 | E2b : 0,6 avec le pic 4,9 / 4,4° → 6,7 % de dépassement à 200 km/h |
| filtre du volant | 0,026 / 0,030 + 0,0002·v s | inchangé | — | S9 (clavier 0 → 90 % en 120 ms au plus) |
| rampe clavier à haute vitesse (option) | — | + 0,08 s × rampe(v, 28, 83 m/s) | 0–0,12 s | **question 4** (S8) ; clavier seulement, jamais au contre-braquage |
| zone morte, exposant de la manette | 0,06, 1,22 | inchangés | — | FEUILLE-DE-ROUTE.md (0,07 et 1,3) à corriger, pas le code |

### 3.9 Aide (Aucune, Légère, Forte) et compensation des appareils

| Élément | Aucune | Légère (défaut) | Forte | Plage |
|---|---|---|---|---|
| κ_P, contre-braquage simulé | **0,85** | 1,0 | 1,0 | 0,7–1,0 en Aucune |
| κ_D, facteur | 0,6 | 1,0 | 1,2 | — |
| marge (plein volant / pic) | **1,15** (l'avant peut passer le pic : sous-virage) | 1,0 | 1,0 | 1,0–1,3 |
| stabilisateur : seuil de glisse arrière x_ar = \|α_ar\|/α_pic,ar | — | 1,6 | 1,2 | 1,0–1,8 |
| antipatinage : glissement visé / κ_pic | — | 1,5 | 1,1 | 1,0–2,0 |
| antiblocage : glissement visé / κ_pic | — | 1,5 | 1,1 | 1,0–2,0 |
| en dérive au bouton | rien | stabilisateur × 0,2 | × 0,4 | — |

- Le stabilisateur se déclenche sur la **glisse de l'arrière** (et l'excès de lacet r − a_y/u), plus sur |β| > 3,55° :
  à la limite d'un grand rayon propre, β vaut 3,5 à 3,9° (BANC-BASE § 2.3) et l'aide y écrêtait 1,7 à 3,4 % de
  vitesse. Même action que p9 sur ρ (`aideGain` 2,15 et `aideLacet` 0,28 à régler à nouveau, plage 1,5–3 et 0,1–0,4).
- Glisse de puissance (κ_ar > κ_pic) : l'antipatinage agit d'abord, le volant ensuite.
- **Compensation des appareils tout ou rien** (clavier, souris, doigt), indépendante de l'Aide : montée du gaz en
  0,25 s (0,15–0,35), relâche immédiate ; frein monté en 0,15 s et plafonné au seuil de blocage (un antiblocage
  d'appareil) ; volant : filtre actuel et guidage 0,15. Elle se lit dans `cmd.pedales` (`'touches'` ou
  `'continu'`), posé par `jeu.js` comme `guidage` aujourd'hui, et que le banc connaît déjà.
- Rivaux : niveau Légère (`AIDE_IA` 0,35 correspond à Légère), jamais de dérive.

### 3.10 Dérive chargée et turbo

| Étape | p9 | p10 |
|---|---|---|
| Départ | bouton, v ≥ 12,2 m/s, volant ≥ 0,2 vers l'intérieur, **courbure de la piste ≥ 0,0015** | mêmes conditions sans la courbure de la piste |
| Effet du départ | la loi de l'arrière change (plus de retombée, tanh, ellipse entière), effort avant de 1,4 × l'adhérence, aide coupée | **impulsion** : adhérence arrière × (1 − 0,35·cloche(t/0,20 s)) ; stabilisateur × 0,2 et κ_D × 0,25 tant que le bouton est tenu ; aucune autre loi ne change |
| Charge | qualité du contre-braquage × angle de caisse (1,1° à 38–48°), liée à la courbure de la piste | q = qA·qC·qG : qA = rampe(x_ar, 1,3, 2,0)·(1 − rampe(\|β\|, 0,66, 0,84)) ; qC du contre-braquage comme p9 ; qG = rampe(gaz, 0,2, 0,5) |
| Paliers | 0,5 / 1,1 / 1,9 (0,70 / 1,31 / 2,11 s à qualité pleine) | inchangés (S6) |
| Rattrapage | perte tolérée 0,38 s | inchangé (0,25–0,5) |
| Coût | aucun (tenue 10 s gratuite) | glisse réelle qui freine ; au-delà de 1,0 s (0,5–2,0) passé le palier III, charge −0,25/s (0,1–0,5) |
| Lâcher | turbo 0,6 / 1,1 / 1,6 s, + 0,2 s « parfait » dans les 0,22 s du palier | idem, « parfait » seulement si q ≥ 0,8 au lâcher (un vrai geste) |
| Turbo | 9 / 13 / 16 m/s², borné par l'adhérence arrière libre, passe le rupteur de 6e (331 km/h) | idem, borné aussi par le rupteur du rapport |

Paramètres de l'impulsion : force 0,35 (0,2–0,5), durée 0,20 s (0,15–0,25). Repli déclaré si la dérive purement
physique ne tient pas S6 au clavier : un tirage avant réduit, au plus 0,6 fois l'adhérence (p9 : 1,4), dosé par
l'Aide et écrit comme une aide de jeu.

### 3.11 Surfaces et météo

| Élément | p9 | Départ | Plage |
|---|---|---|---|
| surface | unique, au centre de gravité, en un pas | **par roue**, transition linéaire sur 0,15 m | 0,05–0,3 m |
| vibreur | μ × 0,92 (au CG) | μ × 0,92 sur la roue, impulsion de charge −15 % pendant 0,06 s à chaque bande, signal | 0,85–0,97 ; 0–25 % |
| herbe | μ 0,94 (× 0,55), freinage 2,5 + 0,05·u m/s², poussée × 0,65 | μ × 0,55 par roue (× 0,75 mouillée) ; freinage par roue ¼·(2,0 + 0,04·u) ; motricité bornée par l'herbe (plus de × 0,65) | 0,45–0,65 ; 1,5–3,5 |
| eau, pneus | slicks 1 − 0,30·eau, inter 0,96 − 0,10·eau, pluie 0,88 + 0,07·eau | inchangés (croisements 0,2 et 0,47) | — |
| aquaplanage | — | σ × (1 − 0,35·eau_locale²·rampe(u, v_aq, v_aq + 25 m/s)) ; v_aq slicks 45, inter 58, pluie 70 m/s | ±10 m/s ; 0,2–0,5 |
| flaques | — | eau_locale = min(1, 1,6·eau) sur 8 à 20 m, placées au chargement depuis la graine du circuit | jamais le hasard de la course |
| neige | ignorée | σ × (1 − 0,45·n) slicks et inter, × (1 − 0,30·n) pluie ; le pneu neige de 12E s'y branche | 0,3–0,6 |

### 3.12 Sensations (lisent l'état, ne le changent pas)

- **Son** (`son.js`) : crissement par essieu, gain selon (x − 0,8)/0,4 et la vitesse de glisse ; hauteur qui baisse de
  20 % (10–30 %) entre x = 1 et x = 3 (le crissement descend passé le pic) ; voix avant plus grave ; blocage et
  patinage dans une bande à part ; régime qui s'emballe au patinage (il vient de la roue).
- **Vibration** (en course seulement, réglages existants) : moteur lourd = vibreurs, herbe, chocs, avant au pic
  (x_av de 0,9 à 1,3) ; moteur léger = patinage, blocage, arrière en glisse, rupteur.
- **Fumée** : puissance de glisse F·v_glisse par roue (`traces.js`, `sillage.js`), sans hasard de course.
- **Tête du pilote** : inchangée (a_y/26, a_x/22, k = 1 − e^(−7·dt)), plus une composante verticale u²·κ_v/30 bornée
  à 2 cm. **Champ** : +5 % à v/85 gardé.

### 3.13 Rivaux

- Même physique, niveau Légère, sans dérive.
- Profil de référence tiré de la voiture : v = √(μ_eq·g/(k − μ_eq·A_eq)), (μ_eq, A_eq) ajustés sur les vitesses
  d'adhérence du banc de R 20 à R 400 (au lieu de MU 1,55 et AERO 0,00155, qui donnent 94 à 113 % de la voiture) ;
  enveloppe de poussée et plan de freinage (aujourd'hui 0,8·(14 + 0,15·v)) refaits sur le banc.
- `hab` (0,90 / 0,955 / 0,99 ± 0,015) et l'élastique ne bougent que si `course.test.mjs` l'exige.

### 3.14 Version

`PHYSIQUE` passe de `p9` à `p10` (records `bitume.records.p10`, fantômes `bitume.fantome.p10.<id>`), une fois, à la
publication du lot. Une publication intermédiaire qui change la physique prend `p10` et la fin du lot `p11`.

## 4. Ce qui change par rapport à `MODELE.md`

| MODELE § 13 | Aujourd'hui | p10 | Sous-lot |
|---|---|---|---|
| 1. Puissance qui croît avec le rapport | 182 → 233 kW | constante (∝ 1/vPointe) | 17C |
| 2. Régime affine | 4 000 + 8 800·v/vPointe | régime de la roue | 17C |
| 3. Freinage sans adhérence, ABS parfait, 58 % | l'arrière sature, tête-à-queue en appui | pédale = force, vrai blocage, 70 %, ABS dans l'Aide | 17D |
| 4. Frein moteur constant | 1,6 m/s² | c0 + c1·n par le rapport | 17C |
| 5. Pas de roue, ellipse 1,3 | `transmis`, exposant posé pour S3 | état de rotation par essieu, Beckman | 17C, 17D |
| 6. Direction par part d'adhérence | contre-braquage de gain 1, toujours | gardée ; κ_P et κ_D dosés par l'Aide ; marge 1,15 en Aucune | 17F |
| 7. Charge sans suspension | ni pente, ni bosse, ni part immédiate | courbure verticale, part géométrique | 17B |
| 8. Pneus sans état | — | relaxation en option, mémoire du pic ; température et usure au lot 12 | 17B |
| 9. Appui constant | aspiration sur la traînée seule | perte d'appui dans le sillage, tangage, vibreurs en option | 17E |
| 10. Eau douce, neige absente | facteur sur μ | aquaplanage, flaques, neige | 17H |
| 11. Remise en piste instantanée | décision de David | inchangée | — |
| 12. Surface binaire au CG | −45 % en un pas | par roue, transition 0,15 m | 17H |
| 13. Glissière sans frottement | vitesse tangentielle gardée | hors lot (glissières, lot 02) | — |
| 14. Rupteur de 6e comme mur | pointe 307 km/h au rupteur | pointe vers 300 km/h par la traînée | 17C |
| 15. Dérive = mode | loi de l'arrière changée, tirage 1,4 | impulsion, glisse réelle | 17G |
| 16. Aide sur \|β\| > 3,55° | écrête les grands rayons | glisse arrière et excès de lacet | 17F |
| 17. Amortisseur toujours là | même aide à 0 | dosé par l'Aide (× 0,6 en Aucune) | 17F |
| 18. Charge liée à la courbure de la piste | tenue 10 s gratuite | glisse réelle, coût | 17G |
| 19. Turbo sans cause | 9 à 16 m/s², passe le rupteur | gardé (pilier 2), borné au rupteur | 17G |
| 20. Gain selon l'appareil | manette +0,025 s, clavier +0,175 à +0,85 s (R 80, R 40) | 0,1 à 0,3 s pour toutes | 17G |
| 21. Empattement 2,85, « monoplace de 1990 » | — | 2,70 m, commentaire de 1980 | 17B |
| 22. Rivaux sur l'essai 0.1 | 94 à 113 % de la voiture | profil tiré de la voiture | 17J |
| 23. Guidage du doigt, zone morte documentée | commentaire faux | commentaire et FEUILLE-DE-ROUTE corrigés | 17F |
| 24. Paramètres morts | quinze (liste de MODELE) | retirés, sauf ceux des glissières, laissés à leur lot | 17J |
| 25. `Math.exp` au dernier bit | 1e-13 entre Node et Chrome | inchangé ; risque suivi (§ 8) | — |

Hors de `MODELE.md` : masse 665 kg, voies de la T5, loi de charge en puissance normée par essieu, angle du pic selon
la charge, plateau arrière à 80 % au lieu de 70 %, amortisseur selon la vitesse, antipatinage et antiblocage,
compensation des appareils, différentiel, signaux par essieu.

## 5. Sous-lots

Dans l'ordre. Chacun se livre seul : suite verte, critères tenus ou changés avec leur raison, mesures avant et après
dans un rapport `docs/reprise/rapports/conduite-17X-…/`, empreinte du banc notée. **Règle d'arrêt** : si un critère
obligatoire reste rouge après dix variantes mesurées, le sous-lot s'arrête et les nombres vont à David.

| Sous-lot | Contenu | Fichiers |
|---|---|---|
| 17A outillage | `pneu.js` (loi p10 et loi p9 à l'identique), essais ajoutés au banc, critères p10 en mesure, outil de profil des rivaux ; **aucun changement de conduite** | `src/pneu.js` (nouveau), `construire.py`, `tools/banc-conduite.mjs`, `verifications/pneu.test.mjs`, `verifications/conduite-p10.test.mjs` (nouveaux) |
| 17B châssis et pneus | § 3.1, 3.2, 3.4 (option), κ_D selon la vitesse ; aide et dérive p9 réglées à nouveau | `conduite.js`, `pneu.js`, `circuit.js` si `course.test` l'exige |
| 17C motricité | § 3.3 à l'arrière, 3.5, antipatinage, compensation du gaz | `conduite.js`, `pneu.js`, `jeu.js` (`cmd.pedales`) |
| 17D freins | § 3.3 à l'avant, 3.6, antiblocage, répartition au menu | `conduite.js`, `jeu.js`, `index.html` |
| 17E aéro | § 3.7 | `conduite.js`, `course.js` (`aspirer`) |
| 17F direction et Aide | § 3.8, 3.9 | `conduite.js`, `jeu.js`, `index.html`, `FEUILLE-DE-ROUTE.md` |
| 17G dérive | § 3.10 | `conduite.js` |
| 17H surfaces et météo | § 3.11 | `conduite.js`, `circuit.js`, lecture de `meteo.js` |
| 17I sensations | § 3.12 | `son.js`, `jeu.js`, `traces.js`, `sillage.js` |
| 17J rivaux et p10 | § 3.13, 3.14, en ligne, ménage, documents | `circuit.js`, `course.js`, `jeu.js`, `reseau.js`, docs |

Dans les tableaux, « banc » renvoie aux essais de `tools/banc-conduite.mjs` (ceux de BANC-BASE.md et ceux ajoutés en
17A) ; les valeurs p9 sont celles de BANC-BASE.md.

### 17A — Outillage et loi de pneu isolée

- `src/pneu.js` : fonctions pures, sans création d'objet (sorties dans un tableau préparé) : μ(F_z), α_pic(F_z),
  f(x) avec plateau, combiné de Beckman, relaxation, mémoire du pic ; plus la loi p9 (`adherence`, `pneu`,
  `retombee` de FERRO) appelée à l'identique, pour que `conduite.js` passe par `pneu.js` sans rien changer.
- Banc : essais ajoutés — freinage pédale pleine (premier essieu bloqué, vitesse du blocage), départ sans aide
  (glissement arrière maxi, durée du patinage), échelons à 150 et 250 km/h, deux roues dans l'herbe, passage de
  vibreur, tenue en sillage, distribution de x_ar en dérive, profil des rivaux (`--rivaux` : vitesses d'adhérence de
  R 20 à R 400 et ajustement μ_eq, A_eq).
- `verifications/conduite-p10.test.mjs` : les cibles de 17B à 17J, toutes en « mesure » (non obligatoires), avec les
  valeurs p9 ; chaque sous-lot rend obligatoires les siennes.

| Mesure | Cible |
|---|---|
| empreinte du banc complet / court | **52a7484e7589dd23 / 6dc495a68695aec5 inchangées** (ou celles que 5B-7 aura gardées, identiques par sa règle) |
| `conduite-criteres.test.mjs` | 46/46, S8 ouverte |
| `pneu.test.mjs` | f(1) = 1 ; plateau avant 0,85 ± 0,005 à x = 50 ; 2 × la charge → force × 1,76 ± 0,01 ; angle du pic × 2^0,25 ± 0,5 % ; en glissement pur, Beckman rend la loi pure ; continuité au pic ; deux mutants échouent |
| suite complète | verte |

### 17B — Châssis, charges et pneus latéraux

Contenu : § 3.1, § 3.2, relaxation en option (§ 3.4), κ_D selon la vitesse ; couplage longitudinal p9 gardé. Réglages
autorisés pour rendre les critères : `aideSeuil`, `aideGain`, fenêtres de qualité de la dérive, giration.

| Mesure (banc) | p9 | Cible | Tolérance |
|---|---|---|---|
| vitesse d'adhérence R 30 / 60 / 120 / 180 | 84,9 / 121,7 / 185,9 / 249,8 km/h | les mêmes | ±3 % |
| limité par | l'avant partout | l'avant partout, réserve arrière 6 à 13 % (calcul) | — |
| gradient K, R 30 à R 180 | 0,43 à 0,21 °/g | positif partout, 0,1 à 0,6 °/g | — |
| β à la limite, R 30 à R 180 | 2,0 à 3,9° | 1,5 à 3,5° | — |
| échelon 200 km/h mi-volant : dépassement | 17,1 % | ≤ 10 % | +2 points |
| échelon 200 km/h plein volant, voiture seule / manette | 21,1 / 24,5 % | ≤ 15 / ≤ 18 % | +2 points |
| t90 du lacet, 200 / 100 km/h mi-volant | 79 / 113 ms | ≤ 90 / ≤ 125 ms | +5 ms |
| lever de pied R 120 (S3, lacet après / avant) | 1,13 | 1,05 à 1,20 | — |
| frein 0,3 en entrée de R 120 (S11, courbure après / avant) | 1,53 | ≥ 1,15 | — |
| clavier R 30 / R 120 (part de la voiture seule) | 90 / 95 % | pas moins | — |
| critères de la phase 2 | 46/46 | 46/46 ; S3 « plein gaz » exprimé en fois le pic arrière (≥ 1,25 × α_pic,ar au lieu de ≥ 6°) | — |
| `course`, `ia`, `ia-reprise` | verts | verts | — |

### 17C — Moteur, boîte et roues motrices

Contenu : § 3.5, § 3.3 à l'arrière (fin de l'ellipse 1,3 et de `transmis`), antipatinage (§ 3.9), montée du gaz des
appareils tout ou rien. Puissance au niveau actuel (216 N·m, SCx 0,58) ; le niveau fidèle se mesure sur le même code
en changeant T_max et SCx, puis David choisit en roulant (question 1).

| Mesure (banc) | p9 | Cible | Tolérance |
|---|---|---|---|
| puissance à la roue, 1re à 6e | 182 → 233 kW | constante : 233 kW (fidèle : 345) | ±4 % |
| régime × vPointe / v | affine | 12 800 | ±1 % |
| 0-100 / 0-200 | 2,53 / 7,30 s | 2,2 à 2,9 / 6,8 à 7,8 s (fidèle : 5,6 à 6,4 s) | — |
| pointe | 307,1 km/h (rupteur) | 295 à 310 km/h, sous le rupteur | — |
| pied levé à 290 km/h | 0,58 g | 0,45 à 0,60 g (fidèle : 0,65 à 0,80) | — |
| frein moteur à 10 000 tr/min, 2e / 6e | identique | rapport ≥ 2 | — |
| départ plein gaz sans aide | — | κ_ar > κ_pic pendant 0,2 à 1,0 s ; régime ≥ 9 000 tr/min dans les 0,5 s (S3) | — |
| départ, Légère | — | 0-100 au plus 3 % plus long que le meilleur départ dosé | — |
| plein gaz en 2e, R 60, 0,92 × limite, aide 0 | — | x_ar ≥ 1,25 : l'arrière passe le pic (S3) | — |
| remise des gaz à 45° de la sortie, R 30 et R 60, Légère | herbe, 8 à 19 m dehors | ≤ 4 m dehors, sans tête-à-queue | — |
| remise des gaz à 15°, voiture seule | passe (β 13,4°) | passe | — |
| aide seule R 120 / R 180 | −1,7 / −3,4 % | ≥ −0,5 % | — |
| clavier R 120 / slalom | 95 % / −13 % | ≥ 97 % / ≥ −9 % | — |
| 100 000 pas aléatoires (`conduite.test`) | aucun NaN | aucun NaN, roue comprise | — |
| coût d'un pas, 12 voitures | mesure 5B | ≤ +30 % | — |

### 17D — Freins et blocage

| Mesure (banc) | p9 | Cible | Tolérance |
|---|---|---|---|
| 200-0 / 300-100 / 100-0 au mieux (antiblocage Forte ou appareil tout ou rien) | 75,6 / 116,2 / 22,3 m | 66–76 / 112–126 / 19–23 m | — |
| pédale pleine sans aide (manette, Aucune), 300-0 | ABS parfait | l'avant bloque le premier, entre 140 et 200 km/h ; distance ≤ 1,12 × au mieux | — |
| répartition 60 % (réglage) | — | l'arrière bloque le premier : la voiture pivote | — |
| freinage plein en appui, R 120, 0,9 × limite, aide 0 | β +75° (tête-à-queue) | β ≤ 20° : l'avant glisse, la voiture élargit | — |
| même essai, Légère | β +7,9°, 4,5 m dehors | β ≤ 8°, ≤ 3 m | — |
| frein 0,3 en entrée de R 120 (S11) | × 1,53 | ≥ 1,15 | — |
| clavier, 200-0 | — | ≤ 1,03 × au mieux | — |
| S10, charge avant à −3 g | 0,614 / 0,601 | ≥ 0,60 | — |

### 17E — Aérodynamique et sillage

| Mesure (banc) | p9 | Cible | Tolérance |
|---|---|---|---|
| aspiration S3 (gain à 10 m en 4 s) | 4,06 m | ≥ 3 m | — |
| pointe en plein sillage | +0,8 % | +2 à +4 % | — |
| R 120 derrière une voiture à 10 m | — | vitesse d'adhérence −2 à −5 % (l'avant s'allège) | — |
| gradient K à R 500 | 0,10 °/g | ≥ 0,05 °/g | — |
| échelon 200 km/h | celui de 17B | pas plus de 2 points de plus | — |

### 17F — Direction et Aide

| Mesure (banc) | p9 | Cible | Tolérance |
|---|---|---|---|
| aide seule (manette, Légère) R 30 / R 120 / R 180 | 100 / 98,3 / 96,6 % | ≥ 99 % | — |
| remise des gaz à 45°, R 30, Légère | dans l'herbe | ≤ 4 m dehors, sans tête-à-queue | — |
| S4 : témoin, contre-braquage, forte glisse | tenus | tenus : Aucune en tête-à-queue, Légère et Forte β ≤ 5° | — |
| échelon 200 km/h plein volant, Aucune | — | ≤ 18 % | — |
| S9 plein braquage (lacet / limite) | 1,161 | ≤ 1,2, Aucune compris | — |
| S9 clavier 0 → 90 % | 75 à 117 ms | ≤ 120 ms | — |
| S8 | 1 031 °/s², ouverte | selon la réponse de David | — |

### 17G — Dérive chargée physique

| Mesure (banc) | p9 | Cible | Tolérance |
|---|---|---|---|
| S6 paliers à qualité pleine | 0,70 / 1,31 / 2,11 s | les mêmes | ±0,05 s |
| S6 tenue manette R 40 / 120 / 250 / 400 | 2,4 / 1,1 / 0,3 / 1,1 m | < 5,5 m pendant 3 s | — |
| S5 clavier (162 pilotes, 30 / 60 / 120 Hz) | au moins un | au moins un par cadence | — |
| gain d'une dérive avec turbo III, R 80, référence du banc : manette / clavier / souris | +0,025 / +0,175 / +0,425 s | 0,10 à 0,30 s chacune | — |
| gain au clavier, R 40 | +0,85 s | ≤ +0,40 s | — |
| gain, R 250 | −0,075 à +0,017 s | ≥ −0,05 s | — |
| tenue 10 s | gratuite | turbo au plus II après 10 s ; −3 à −8 km/h sur 3 s en R 80 | — |
| « parfait » des pilotes scriptés | 100 % | ≤ 70 % | — |
| tirage de l'avant | 1,4 × l'adhérence | 0 (repli déclaré ≤ 0,6) | — |
| S7 : turbo coupé par frein, herbe, choc, contact ; IA même loi | tenus | tenus | — |
| slicks mouillés, R 80, clavier | annulée à 48,8° | annulée proprement, ou palier I | — |

### 17H — Surfaces et météo

| Mesure (banc) | p9 | Cible | Tolérance |
|---|---|---|---|
| herbe, centre 3 m dedans pendant 1,5 s, à 100 / 200 km/h | 0,05 / 0,35 s perdues | 0,3 à 0,6 / 0,6 à 1,0 s | — |
| deux roues dans l'herbe, R 120 (bord + 0,5 m) | tout ou rien au CG | capacité −8 à −15 %, β transitoire ≤ 4° | — |
| vibreur à 150 km/h | −8 % au CG | −5 à −10 % sur les roues qui le touchent, impulsion de charge, signal | — |
| croisements des pneus selon l'eau | 0,2 et 0,47 | 0,2 et 0,47 | ±0,05 |
| aquaplanage, eau 1, R 500 | — | au-delà de 200 km/h, slicks ≥ 25 % sous les pneus pluie | — |
| neige 1, R 120, slicks | ignorée | −30 à −45 % ; pneus pluie meilleurs | — |
| flaques | — | même suite du hasard de course avec ou sans flaques (test) | — |

### 17I — Sensations

| Mesure (test) | Cible |
|---|---|
| hauteur du crissement | 1 à x = 1, 0,80 ± 0,05 à x = 3 |
| bande de blocage | seulement si κ < −κ_pic |
| vibration lourde / légère | monte avec x_av de 0,9 à 1,3 / avec le patinage et la glisse arrière |
| hasard de course | même suite avec son et vibration coupés ou non |
| créations d'objets en course | zéro (compteur de 5B) |
| vibration | en course seulement (inchangé) |

### 17J — Rivaux, version p10, en ligne

| Mesure | p9 | Cible |
|---|---|---|
| référence des rivaux / vitesse d'adhérence de la voiture, R 30 à R 250 | 0,94 à 1,13 | 0,97 à 1,03 |
| `course.test` : tour des rivaux ≥ 0,9 × somme du profil ; tour seul 0,9 à 1,25 × référence | tenus | tenus |
| difficultés 1 / 2 / 3 : tour des rivaux face au pilote scripté | mesure p9 | mêmes rapports ±2 % |
| `PHYSIQUE` | p9 | p10 ; anciennes clés laissées en place, non lues |
| en ligne | aucune version échangée | `PHYSIQUE` dans l'annonce de course ; deux versions différentes : refus avec message (test) |
| empreinte du banc ; page contre Node | 52a7484e… | nouvelle empreinte notée ; écart relatif ≤ 1e-12 sur le sous-ensemble court |
| documents | MODELE p9 | `MODELE-P10.md` et `BANC-P10.md` dans un nouveau dossier de rapports ; paramètres morts retirés |

## 6. Non-régression

- **Les 46 critères** à chaque sous-lot. Changements annoncés : S3 « plein gaz » exprimé en fois le pic arrière dès
  que le pic change (17B) ; S4 et S5 réglés à nouveau en 17B puis refaits en 17G (la dérive change) ; S7 mesuré pour
  chaque chaîne de commande (17G) ; S8 selon David ; S9 gardé. Rien d'autre ne bouge sans être écrit dans le rapport
  du sous-lot.
- **Déterminisme** : deux passages du banc rendent la même empreinte ; la nouvelle empreinte est notée à chaque
  sous-lot ; comparaison page contre Node (sous-ensemble court, écart relatif ≤ 1e-12) en 17B, 17C et 17J ;
  `conduite.test` (100 000 pas aléatoires sans valeur non finie) ; aucun son, aucune image, aucune flaque ne tire le
  hasard de la course (test en 17H et 17I).
- **Rivaux** : `course`, `ia`, `ia-reprise`, `ia-attaque`, `ia-epaves`, `obstacles`, `contacts`,
  `collisions-orientees`, `crash`, `glissiere-etats`, `glissiere-rebond`, `stands`, `tunnel`, `traces`, `troncs`,
  `voiture`, `relectures-phase2`, `reprise-recul`, `prets-enligne` verts à chaque sous-lot. Si `course.test` tombe
  avant 17J, le profil des rivaux est refait avec l'outil de 17A, pas à la main.
- **En ligne** : chaque machine conduit ses humains et l'hôte les rivaux (`reseau.js`), sans rejeu pas à pas : un
  écart au dernier bit entre navigateurs ne se cumule pas. Ce qui doit être pareil, c'est la version de physique :
  17J l'ajoute à l'annonce de course.
- **Records et fantômes** : clés p10 neuves ; un fantôme est une suite de positions enregistrées, pas un rejeu, donc
  un fantôme p9 n'est jamais montré sur p10 (sa clé diffère).
- **Lot 5B** : compteur de créations en course à zéro, coût d'un pas pour 12 voitures mesuré avant et après chaque
  sous-lot (au plus +30 % au total), qualité « Légère » inchangée.
- **Fidélité du banc** : `banc-conduite.test.mjs` lit des lignes exactes de `jeu.js` (`guidage: analogique ? 0 : .15`,
  `if (appuieSur(0, 'gaz')) gaz = 1;`, `gaz = Math.max(gaz, doigt.gaz ? 1 : 0)`, `pad.gaz = b(7); pad.frein = b(6)`,
  `aide` par défaut) : les changer, c'est changer le banc dans le même commit.

## 7. Réglages exposés au joueur

| Réglage | État | Contenu p10 |
|---|---|---|
| Aide au volant : Aucune / Légère / Forte | existe (`index.html`) | redéfinie (§ 3.9) ; textes : « Aucune : contre-braquage partiel, ni antipatinage ni antiblocage » ; « Légère : rattrape les glisses, dose gaz et frein » ; « Forte : rattrape tôt » |
| Répartition de freinage | **nouveau** | 60 à 76 % par pas de 2, défaut 70 % ; « vers l'avant : l'avant bloque, la voiture tire tout droit ; vers l'arrière : elle pivote au freinage » ; réglage de chaque machine, comme la boîte et l'aide |
| Vibrations, force | existe | inchangé (sources de vibration, § 3.12) |
| Boîte auto / manuelle, pneus | existent | inchangés (pneu neige : 12E) |
| Appui faible / moyen / fort | proposé pour plus tard | SCz ± 20 % avec la traînée, comme les préréglages de la Lotus 79 d'iRacing ; hors de 17A–17J |

Non exposés : différentiel, carrossage, pressions, barres, hauteurs. Les sources de joueurs conseillent de fondre
carrossage et pincement dans la loi du pneu, ce que fait le plan.

## 8. Risques

1. **Conflit avec le lot 5B** : `conduite.js`, `course.js`, `circuit.js`, `contacts.js`, `jeu.js` sont en réécriture.
   Parade : rien avant la fusion de 5B-7 ; 17A d'abord, à empreinte identique.
2. **Les critères sont un ajustement fin** (E3) : chaque changement physique demande de régler à nouveau aide et
   dérive ; boucle de réglage longue. Parade : règle d'arrêt (§ 5), un levier à la fois, banc avant le volant.
3. **La dérive physique peut perdre le plaisir de la dérive actuelle**, qui est facile parce qu'elle est un mode.
   Parade : repli déclaré (tirage ≤ 0,6), essai de David avant toute publication de 17G.
4. **Stabilité de la roue** à 120 Hz (24 kg équivalents à l'avant). Parade : intégration implicite ou sous-pas, test
   des 100 000 pas, cas raide ajouté ; repli quasi statique.
5. **Clavier** : plus de physique, c'est plus dur au clavier. Parade : compensation des appareils, chaînes de
   commande mesurées à chaque sous-lot (clavier R 120 ≥ 95 %).
6. **Rivaux** : temps au tour et difficultés qui glissent, surtout sur la montagne. Parade : profil tiré du banc,
   rapports de difficulté mesurés avant et après.
7. **Coût** : quatre surfaces au lieu d'une, état de roue, sous-pas. Parade : mesure 5B à chaque sous-lot, plafond
   +30 %.
8. **Répartition de freinage** : le calcul (70 %) contredit les sources (55 à 62 %). Parade : 17D la remesure sur le
   vrai modèle ; si elle tombe plus bas, tant mieux.
9. **Sources de jeu** : beaucoup de chiffres viennent de forums ou d'estimations (`RECHERCHE.md`). Parade : ils ne
   fixent que des points de départ ; les cibles viennent du banc.
10. **Records remis à zéro** par p10 (attendu, une seule fois).

## 9. Questions pour David

1. **Puissance** : garder le niveau actuel (233 kW à la roue, 0-200 vers 7,5 s, pied levé doux) ou passer au niveau
   fidèle de la 312 T5 (521 ch, 345 kW à la roue, 0-200 vers 6 s, pointe vers 300 km/h par plus de traînée, pied
   levé franc) ? Estimations du calcul E1 corrigées de son optimisme (0,8 s sur 0-200). Proposition : fidèle,
   décidé en roulant après 17C (le code est le même).
2. **Aide « Aucune »** : la rendre plus « simulation » (contre-braquage automatique à 85 %, l'avant peut passer le pic
   et sous-virer, ni antipatinage ni antiblocage) ? Légère reste le défaut. Proposition : oui.
3. **Dérive** : d'accord pour une dérive physique (le bouton donne l'élan et relâche l'aide, la charge vient de la
   glisse réelle, plus d'effort avant de 1,4 fois l'adhérence, turbo borné au rupteur, un coût si on la tient trop,
   « parfait » qui demande une glisse propre) ?
4. **S8, volant au clavier** : accepter le lacet vif actuel (S8 reste ouverte) ou ralentir le volant clavier à haute
   vitesse seulement (jusqu'à +0,08 s de rampe à 300 km/h, S9 gardé) ?
5. **Freins** : pas d'antiblocage en Aucune (blocage possible à la manette), léger en Légère, complet en Forte, et
   toujours plafonné au clavier ; répartition exposée au menu (60 à 76 %) : d'accord ?
6. **Vibreurs et effet de sol** : une perte d'appui brève sur les vibreurs (−12 % pendant 0,25 s, la T5 étant surtout à
   ailerons) ou rien ?
7. **Ordre des lots** : 17 après 5B et 12A (contrat des quatre roues), avant 12B à 12E (l'usure et la neige
   s'appuieront sur `pneu.js`) ?

## 10. Preuves de cette étude

Dossier [etude-17/](rapports/conduite-2026-11-18/etude-17/) ; sorties dans `etude-17/resultats/`. Aucune source du jeu
n'est modifiée : E2 passe par les copies temporaires du banc, E3 travaille sur une copie de l'arbre.

| Étude | Fichier | Ce qu'elle établit |
|---|---|---|
| E1 virages | `etude-regime.mjs` (calculateur `regime-etabli.mjs`) | validation contre le banc (−2,0 / +0,9 / +2,4 / +3,5 % de R 30 à R 180) ; sensibilité μ, q, SCz, aeroAvant, masse, TLLTD ; jeu p10 et son équilibre |
| E1 ligne droite et freins | `etude-ligne.mjs` (calculateur `longitudinal.mjs`) | jeux niveau actuel et fidèle ; grilles force × répartition ; premier essieu bloqué selon le frein moteur ; jeu de freins retenu |
| E2 lacet | `etude-lacet.mjs` (banc, vrai modèle p9) | effet de chaque levier sur l'échelon à 200 et 100 km/h ; grille angle du pic × amortisseur à 2,70 m |
| E3 critères | `etude-criteres.sh` (copie de l'arbre) | ce que coûtent l'empattement, l'inertie, l'angle du pic et l'amortisseur aux 46 critères |

```
cd docs/reprise/rapports/conduite-2026-11-18/etude-17
node etude-regime.mjs resultats/regime.json
node etude-ligne.mjs resultats/ligne.json
node etude-lacet.mjs resultats/lacet.json
rsync -a --exclude .git --exclude dist --exclude docs <arbre>/ <copie>/ && mkdir -p <copie>/docs
./etude-criteres.sh <copie> 'empattement=2.70' 'empattement=2.70 giration=1.23' …
```

`verifications/etude-conduite-17.test.mjs` refait les calculs que ce plan cite (validation, jeu p10, puissance,
freins) et échoue s'ils s'en écartent (deux mutants vérifiés : répartition 0,62, cible de 0-200 resserrée).

Limites : les calculateurs ne remplacent pas le banc (régime établi à −2,0 / +3,5 % près, ligne droite optimiste de
0,8 s sur 0-200) ; E2 et E3 mesurent le modèle p9 avec quelques paramètres changés, pas le modèle p10 ; aucune mesure
ici n'a été jouée par un humain.
