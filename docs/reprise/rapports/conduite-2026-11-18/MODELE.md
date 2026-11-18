# Modèle de conduite de BITUME — description exacte (18/11/2026)

Demande de David (18/11) : une conduite « la plus fidèle et la plus logique et cohérente niveau physique »,
« réaliste et surtout ultra fun et arcade à la fois ». Avant de régler quoi que ce soit, ce document décrit le
modèle tel qu'il est, ligne par ligne, et dit franchement ce qui n'est pas physique. Les mesures sont dans
`BANC-BASE.md` (banc `tools/banc-conduite.mjs`, résultats bruts `banc-base.json`).

Sources décrites, identiques dans le dépôt principal et dans cet arbre au 18/11 :

| fichier | rôle | sha256 (16 premiers) |
|---|---|---|
| `src/conduite.js` (710 lignes) | `B.conduite` : état, pas, dérive, turbo, glissières, vol, recul | `8bfaef7957ee8698` |
| `src/ferro/vehicle-dynamics.js` (73 lignes) | équations partagées : pneu, charge, couple, direction | `cd67cf8a8d15250e` |
| `src/circuit.js` | échantillon de piste, vibreurs, glissières, profil de vitesse des rivaux | `c439a8124cd788e8` |
| `src/course.js` | commande des rivaux, aspiration, appel de `pas` | — |
| `src/jeu.js` | commandes du joueur (clavier, manette, souris, doigt) | — |
| `src/degats.js`, `src/contacts.js` | dégâts, contacts et sauts | — |

Le banc donne l'empreinte de ces trois premiers fichiers (`empreinteSources` 7dd27cbbaa1e…) et celle des
résultats : tant que l'arithmétique ne change pas, l'empreinte des résultats ne change pas.

Lecture : « (mesuré) » renvoie à une ligne de `BANC-BASE.md` ; « (code) » est une lecture du code, non mesurée.

---

## 1. Repères, conventions, variables d'état

La voiture vit dans le repère du circuit (Frenet) : abscisse curviligne `s` le long de l'axe de la piste et
décalage latéral `d`. La dynamique se calcule dans le repère de la caisse (u vers l'avant, w vers la droite), puis
la position se reporte dans le repère de Frenet. Conventions (`conduite.js` l. 20–22) : `d > 0` à droite ; `psi`,
`beta` et `omega` positifs vers la droite ; `v` est signée (recul < 0) ; le cap de la caisse vaut
`cap(s) + psi + beta`. Tangage > 0 nez levé, roulis > 0 côté droit plus bas.

| variable | unité | sens |
|---|---|---|
| `s`, `d` | m | abscisse sur l'axe, décalage (+ à droite) |
| `psi` | rad | cap de la **vitesse** par rapport à la tangente de la piste |
| `beta` | rad | cap de la caisse − cap de la vitesse (dérive de la caisse) |
| `v` | m/s | norme de la vitesse, signée en recul |
| `omega` | rad/s | lacet de la caisse |
| `rapport`, `regime` | —, tr/min | rapport engagé (−1 en recul), régime filtré |
| `volant` | −1…1 | consigne filtrée (part de l'adhérence avant, voir § 6) |
| `gaz`, `frein` | 0…1 | pédales du pas |
| `braquage` | rad | angle des roues avant réellement appliqué |
| `chargeX`, `chargeY` | m/s² | accélérations des pneus filtrées (τ 0,062 s) : transferts de charge |
| `alat`, `along` | m/s² | accélérations des pneus du pas (sans la traînée) |
| `capAv`, `capAr` | N | adhérence de chaque essieu au pas |
| `roues[i].charge` | N | charge des quatre roues (AvG, AvD, ArG, ArD) |
| `chargeAv` | — | part de la charge sur l'avant |
| `surface`, `vibreur` | — | `piste`, `vibreur` ou `herbe`, jugés au centre de gravité |
| `glisse*`, `deriveAv/Ar`, `patinage`, `blocage`, `sousVirage` | — / rad | indicateurs pour le son et les effets |
| `aspiration` | 0…1 | part de sillage, posée par `course.js` |
| `pente` | — | pente lue au pas |
| `pneus` | `slicks`/`inter`/`pluie` | posé par la course |
| `derive` {actif, sens, duree, charge, niveau, palier, fenetre, qualite, contre, perte, grace, amorce, melange, tirage, verrou, arme, relache} | | machine d'état de la dérive (§ 7) |
| `turbo` {reste, niveau, parfait, duree, ecoule, poussee} | s, m/s² | turbo en cours |
| `coupure`, `rupteurT` | s | coupure de passage de rapport, cadence du son de rupteur |
| `bond`, `bondT`, `y`, `tangage`, `roulis` | m, s, m, rad | attitude **visuelle** seulement |
| `choc`, `auRail` | s, — | contact de glissière |
| `saut`, `accident`, `recuperation`, `immunite`, `degats`, `reparation`, `stands`, `freinRecul`, `repositionnements` | | vol, accident, retour en piste, dégâts, recul (§ 9) |
| `distance` | m | distance parcourue |

## 2. Le pas `pas(etat, cmd, c, dt)` (l. 688–704), dans l'ordre

Appelé à 120 Hz pour chaque voiture (joueur et rivaux), `cmd = { gaz, frein, volant, derive, haut, bas, boite,
aide, guidage, marcheArriere }`.

1. **Immobilisation** : accident, réparation, casse ou roue perdue → `immobiliser` (v = 0, dérive et turbo
   annulés) ; tant que `recuperation` court, `recuperer` compte 0,65 s puis `replacer` remet une voiture neuve au
   même `s`, sur l'axe (`d = 0`), dégâts gardés mais réparés en urgence (adhérence ≥ 0,96), immunité 1 s. Décision
   de David du 16/11.
2. **Commandes bornées** : gaz, frein, aide, guidage dans [0, 1] ; le volant passe par `filtrerVolant` (§ 6.2).
3. Immunité décomptée.
4. **Vol** (`saut.actif`) : `voler` puis glissière en vol ; rien d'autre.
5. **Grille** (`retenue`) : `retenir` — la voiture ne bouge pas, le régime suit le gaz (cible 4 000 + 9 000·gaz,
   τ 0,09 s en montée, 0,22 s en descente, rebond de 380 tr/min sur le rupteur à 12 800).
6. **Recul** si `v < 0` ou rapport −1 (`reculer`, cinématique, ≤ 12 km/h) ; demande de recul du joueur : à
   l'arrêt, frein > 0,5 et gaz < 0,01 pendant 0,3 s.
7. Sinon **`rouler`** : toute la dynamique (§ 3).
8. **`poserAttitude`** : hauteur, tangage et roulis visuels (aucun effet sur la dynamique).

Le pas rend la liste de ses événements (`derive`, `niveau`, `fenetre`, `turbo`, `deriveAnnulee`, `turboCoupe`,
`rapport`, `rupteur`, `choc`, `roue`, `casse`, `reception`, `tonneau`, `retour`).

## 3. `rouler` (l. 308–531) : la dynamique, dans l'ordre du code

Notations : m = 600 kg, g = 9,81 m/s², L = 2,85 m, A = L·(1 − 0,44) = 1,596 m (CG → essieu avant),
BR = L·0,44 = 1,254 m (CG → essieu arrière), Iz = m·1,30² = 1 014 kg·m², `rampe(x, a, b)` = 0 sous a, 1 au-dessus
de b, linéaire entre ; `expTau(τ, dt) = 1 − exp(−dt/τ)` ; `lisse(x)` = x²(3 − 2x) borné à [0, 1].

### 3.1 Piste sous la voiture
`e = B.circuit.echantillon(c, s)` donne la courbure `k` (1/m), la pente et le dévers à l'abscisse `s`.

### 3.2 Surface et adhérence de base
```
demi = largeur/2 (6 m sur les circuits du jeu)
|d| ≤ demi                                   → piste,   mu = muPiste   = 1,72
demi < |d| ≤ demi + 1,2 et vibreur de ce côté → vibreur, mu = muVibreur = 1,58
au-delà                                       → herbe,   mu = muHerbe   = 0,94
mu ×= degats.adher                 (0,92 à 1)
mu ×= adherencePneus(pneus, eau)   (eau = 0 sous un tunnel ; § 8)
enPiste = |d| ≤ demi + 1,2
```
La surface est **une seule**, jugée au centre de gravité : la voiture entière passe d'un coup de 1,72 à 0,94.

### 3.3 Dérive au bouton
`piloterDerive` (§ 7) ; puis deux filtres en cascade font passer l'arrière en glisse et l'en sortir :
```
cible = actif ? 1 : 0 ;  kM = expTau(actif ? 0,10 : 0,16, dt)
amorce  += (cible − amorce)·kM ;   melange += (amorce − melange)·kM      → bd = melange
tirage  += (cible − tirage)·expTau(0,035, dt)                          → bt = tirage
sensD = actif ? sens : signe(beta)
```

### 3.4 Turbo
Coupé par le frein (≥ 0,05), l'herbe et la sortie de piste.
```
env    = min(lisse(ecoule/0,10), lisse(reste/0,16))
aTurbo = turboAcc[niveau]·env·borne((92 − v)/2, 0, 1)          m/s² ; turboAcc = 0 / 9 / 13 / 16
```

### 3.5 Boîte
```
regimeBrut(v, vPointe) = 4 000 + 8 800·v/vPointe                       (affine, pas proportionnel à v)
auto   : monte si regimeBrut(v, vp[r]) ≥ 12 300 ; descend si regimeBrut(v, vp[r−1]) < 11 000
manuel : monte à la demande ; descend si le rapport du dessous reste sous 13 000
passage : coupure de 0,08 s (aucune poussée)
```

### 3.6 Moteur
```
lance   = rapport 1 ? 4 000 + 9 000·0,70·gaz : 0                (embrayage qui patine au départ)
regime += (borne(max(brut, lance), 4 000, 13 000) − regime)·expTau(lance > brut ? 0,09 : 0,05, dt)
libre   = turbo et 6e ;   auRupteur = brut ≥ 12 800 et non libre
aMot    = gaz·POUSSEE[rapport]·couple(regime)                     m/s²
          0 pendant la coupure ou au rupteur ; × 0,65 dans l'herbe
POUSSEE = 13·(27/vPointe)^0,8 = 13,00 / 9,49 / 7,70 / 6,60 / 5,74 / 5,15 m/s²
couple  : 0,62 à 4 000, 0,86 à 7 000, 1,00 à 10 500, 0,88 à 12 800 tr/min (linéaire entre)
```
Puissance à la roue = m·aMot·v ; au régime maxi elle vaut m·POUSSEE·0,88·vPointe, de 185 kW en 1re à 234 kW en
6e (mesuré : 182 → 233 kW, 316 ch).

### 3.7 Vitesses dans le repère de la caisse
`u = v·cos beta`, `w = −v·sin beta`, `r = omega`.

### 3.8 Charges
```
appui = m·0,0016·v²                                          N (aero en m/s² par (m/s)²)
dx = m·chargeX·0,33/L ;   dy = m·chargeY·0,33/1,75
fzAv = max(0, m·g·0,44 + 0,45·appui − dx) ;   fzAr = max(0, m·g·0,56 + 0,55·appui + dx)
tAv = 0,54·dy ;   tAr = 0,46·dy
roues : AvG = fzAv/2 + tAv, AvD = fzAv/2 − tAv, ArG = fzAr/2 + tAr, ArD = fzAr/2 − tAr   (≥ 0)
muAr = mu·1,08·(1 − (1 − deriveMuAr)·bd)       (deriveMuAr = 1 : sans effet aujourd'hui)
adherence(mu, fz) = mu·borne(1 − 0,06·(fz/1 500 − 1), 0,6, 1,15)·fz
capAv = Σ adherence(mu, roues avant) ;   capAr = Σ adherence(muAr, roues arrière)
```
Les transferts utilisent les accélérations des pneus **du pas précédent**, filtrées à 0,062 s : il n'y a ni
suspension, ni roulis, ni tangage dans la dynamique.

### 3.9 Longitudinal
```
freinMoteur = u > 0,5 ? m·1,6·(1 − gaz) : 0                                N
fFrein      = frein·0,92·muPiste·(m·g + appui)   (si u > 0,05)              N  ← muPiste, pas mu
ua = max(|u|, 1)
angCG = atan2(w, ua) ;  angAv = atan2(w + A·r, ua) ;  angAr = atan2(w − BR·r, ua)
alphaAr = −angAr ;  xAr = alphaAr/0,095
capArG = capAr·(1 − (1 − retombee(xAr, 0,3, 2,0))·(1 − bd))        (l'arrière perd de l'adhérence au-delà du pic)
fAr    = forme(xAr) ;  en dérive : (1 − bd)·fAr + bd·tanh(alphaAr/0,12)
fMot   = m·aMot
fTurbo = min(m·aTurbo, max(0, capArG·(1 − fAr²) − max(0, fMot)))
demAr  = fMot + fTurbo − freinMoteur − 0,42·fFrein ;   demAv = −0,58·fFrein
fxAr = transmis(demAr, capArG) ;   fxAv = transmis(demAv, capAv)
transmis(fx, cap) : a = |fx|/cap ; a ≤ 0,85 → a·cap ; sinon (0,85 + 0,12·tanh((a − 0,85)/0,12))·cap
```
`patinage` et `blocage` ne sont que des indicateurs (son, traces) : une roue ne bloque ni ne patine jamais
vraiment, la force transmise plafonne à 0,97 fois l'adhérence.

### 3.10 Adhérence latérale restante
```
latAv = √(capAv² − fxAv²)
nM = 1,3 + 0,7·max(bd, envTurbo)
latAr = fxAr > 0 et nM < 2 ? capArG·(1 − (fxAr/capArG)^nM)^(1/nM) : √(capArG² − fxAr²)
```
Sous la poussée, l'arrière perd plus de latéral que ne le dit l'ellipse (exposant 1,3) ; en dérive au bouton et
sous turbo, l'ellipse redevient entière.

### 3.11 Direction (§ 6 pour le détail des aides)
```
rho = volant
guidage : rho = borne(rho + guidage·(1 − |rho|)·volantPour(k/max(1 − k·d, 0,3)), −1, 1)
aide    : si aide > 0 et bd < 0,5 …                                    (§ 6.4)
dérive  : rho += bt·sensD·1,4 ;   rho borné à ±2,4
amaxAv  = capAv·L/(m·BR)
lache   = rampe(|xAr|, 3,0, 3,5)·(1 − max(bd, envTurbo))
rho    −= suivi(v)·0,5·(1 − lache)·(1 − 0,75·bd)·(r − alat/ua)·max(v, 1)/max(amaxAv, 1)   (amortisseur de glisse)
delta   = suivi(v)·angCG + braquer(rho, v, amaxAv),  borné à ±0,38 rad
```
avec, dans `vehicle-dynamics.js` :
```
suivi(v)        = rampe(v, 2, 6)
geometrie(v, a) = min(0,38, A·a/max(v², 1))
consigne(rho)   = |rho| ≤ 1 ? asin(|rho|)·2/π·(1 + (marge − 1)·rho⁶) : marge + 2·(|rho| − 1)   (signe de rho ; marge = 1)
braquer(rho, v, a) = suivi·(rho·geometrie(v, a) + consigne(rho)·0,105) + (1 − suivi)·borne(rho, −1, 1)·0,38
volantPour(etat, kp) = borne(m·v²·kp·(BR/L)/capAv, −1, 1)
braquageMax(v)  = min(0,38, braquer(1, v, capaciteLaterale(v))),  capaciteLaterale(v) = 1,72·(g + 0,0016·v²)
```

### 3.12 Pneus
```
alphaAv = delta·signe(u) − angAv
fyAv = latAv·pneu(alphaAv/0,105) ;   fyAr = latAr·fAr
forme(x)    = sin(πx/2) pour |x| < 1, ±1 au-delà
retombee(x, c, l) = 1 pour |x| ≤ 1 ; sinon 1 − c·q/(q + l²), q = (|x| − 1)²
pneu(x)     = forme(x)·retombee(x, 0,15, 1,0)          (avant : 85 % du pic en pleine glisse)
```
Courbe en sinus jusqu'au pic (6,0° à l'avant, 5,4° à l'arrière), plateau qui retombe doucement ensuite. Pas de
relaxation (la force suit la dérive au pas près), pas de dérive au carrossage, pas de température.

### 3.13 Forces sur la caisse
```
fx = fxAv·cos δ − fyAv·sin δ + fxAr
fy = fxAv·sin δ + fyAv·cos δ + fyAr
mz = A·(fxAv·sin δ + fyAv·cos δ) − BR·fyAr
along = fx/m ; alat = fy/m          (avant résistances : ce sont elles qui transfèrent la charge)
```

### 3.14 Résistances, pente, dévers
```
resist = 0,00059·(1 − 0,35·aspiration)·v² + 0,25 (si v > 0,1)          m/s²
herbe  : + 2,5 + 0,05·v ;   dégâts : × degats.trainee (1 à 1,08), + 0,02·v avec une roue perdue
fx −= m·resist·u/v ;   fy −= m·resist·w/v
gT = −g·pente/√(1 + pente²) ;   gN = g·sin(devers) ;   θ = psi + beta
fx += m·(gT·cos θ + gN·sin θ) ;   fy += m·(−gT·sin θ + gN·cos θ)
```
Pente et dévers n'agissent que par la gravité dans le plan : ni la charge normale (cos de la pente, courbure
verticale des bosses et compressions) ni l'adhérence ne changent.

### 3.15 Intégration (Euler semi-implicite) et cinématique
```
u += (fx/m + w·r)·dt ;   w += (fy/m − u0·r)·dt ;   r += mz/Iz·dt
arrêt à zéro si u change de signe sans poussée ; au pas (1 à 4 m/s) mélange vers le roulement sans glisse
  (r → u·tan δ/L, w → BR·r) ; arrêt complet sous 0,02 m/s
v = |(u, w)| ;  beta = −atan2(w, u) (0 sous 0,05 m/s) ;  omega = r
chargeX, chargeY += (along, alat − chargeX, chargeY)·expTau(0,062, dt)
Frenet : den = max(1 − k·d, 0,1) ; ψV = θ − beta ; ṡ = v·cos ψV/den
         θN = θ + (r − k·ṡ)·dt ; psi = θN − beta ; s += v·cos psi/den·dt ; d += v·sin psi·dt
```
Puis `heurterGlissiere` (§ 9) et les indicateurs de glisse par essieu et par roue.

## 4. Paramètres (PARAMS, l. 25–92) : valeur, unité, rôle

« non lu » : le paramètre n'est lu par aucun fichier de `src/` (vérifié par recherche du nom).

**Châssis** (commentaire du code : « monoplace de 1990 »)

| paramètre | valeur | unité | rôle |
|---|---|---|---|
| masse | 600 | kg | pilote et essence compris |
| empattement | 2,85 | m | la 312 T5 du jeu en a 2,70 |
| repartition | 0,44 | — | part statique du poids sur l'avant |
| hauteurCG | 0,33 | m | transferts de charge |
| voie | 1,75 | m | transfert latéral |
| giration | 1,30 | m | rayon de giration en lacet : Iz = 1 014 kg·m² |
| roulisAvant | 0,54 | — | part du transfert latéral prise par l'avant |
| chargeTau | 0,062 | s | filtre des transferts |

**Air**

| paramètre | valeur | unité | rôle |
|---|---|---|---|
| aero | 0,0016 | m/s² par (m/s)² | appui : SCz = 2·m·aero/ρ = 1,57 m² ; appui = poids à 282 km/h |
| aeroAvant | 0,45 | — | part de l'appui sur l'avant |
| coeffTrainee | 0,00059 | m/s² par (m/s)² | traînée : SCx = 0,58 m² ; finesse SCz/SCx = 2,7 |
| roulement | 0,25 | m/s² | résistance au roulement |
| aspirationMax | 0,35 | — | part de la traînée ôtée en plein sillage |

**Pneus et surfaces**

| paramètre | valeur | unité | rôle |
|---|---|---|---|
| muPiste | 1,72 | — | adhérence au pic, piste sèche, slicks |
| muVibreur | 1,58 | — | vibreur (−8 %) |
| muHerbe | 0,94 | — | herbe (−45 %) |
| sensibilite | 0,06 | — | perte d'adhérence par charge nominale en plus |
| chargeNominale | 1 500 | N | par roue |
| gripArriere | 1,08 | — | arrière plus adhérent (pneus plus larges) |
| alphaAv / alphaAr | 0,105 / 0,095 | rad | dérive au pic (6,0° / 5,4°) |
| chute / chuteLargeur | 0,15 / 1,0 | — / x | retombée de l'avant après le pic |
| chuteAr / chuteArLargeur | 0,3 / 2,0 | — / x | retombée de l'adhérence totale arrière (x = dérive/dérive au pic) |
| glissement | 0,97 | — | part de l'adhérence transmise en glisse longitudinale |
| ellipseMotrice | 1,3 | — | exposant de l'ellipse arrière sous la poussée |
| largeurVibreur | 1,2 | m | bande de vibreur au-delà du bord |
| herbeResist / herbeResistV | 2,5 / 0,05 | m/s², 1/s | freinage de l'herbe |
| herbeMoteur | 0,65 | — | poussée gardée dans l'herbe |

**Moteur, boîte, freins**

| paramètre | valeur | unité | rôle |
|---|---|---|---|
| vitessePointe | 27 / 40 / 52 / 63 / 75 / 86 | m/s | pointe de chaque rapport à 12 800 tr/min (97 / 144 / 187 / 227 / 270 / 310 km/h) |
| ralenti / maxUtile / rupteur | 4 000 / 12 800 / 13 000 | tr/min | |
| monteeAuto / descenteAuto | 12 300 / 11 000 | tr/min | boîte automatique |
| couple | (4 000 ; 0,62) (7 000 ; 0,86) (10 500 ; 1) (12 800 ; 0,88) | tr/min ; — | courbe normalisée |
| coeffMoteur | 13 | m/s² | poussée de la 1re ; POUSSEE ∝ vPointe^−0,8 |
| freinMoteur | 1,6 | m/s² | frein moteur pied levé, constant |
| rapportDuree | 0,08 | s | coupure au passage |
| regimeTau | 0,05 | s | filtre du régime |
| lancement / lancementTau | 0,70 / 0,09 | — / s | régime tenu par l'embrayage en 1re |
| freinMax | 0,92 | — | part de muPiste·(poids + appui) à pleine pédale |
| freinAvant | 0,58 | — | répartition avant |

**Direction et aides**

| paramètre | valeur | unité | rôle |
|---|---|---|---|
| braquageMeca | 0,38 | rad | butée des roues (21,8°) |
| marge | 1,0 | — | plein volant = dérive au pic |
| vSuivi0 / vSuivi1 | 2 / 6 | m/s | la direction suit la vitesse du CG au-delà |
| amortGlisse | 0,5 | — | amortisseur de glisse |
| amortSeuil / amortPlage | 3,0 / 0,5 | x | il lâche entre 3 et 3,5 fois la dérive arrière au pic (16° à 19°) |
| volantMontee / volantMonteeV / volantRetour | 0,030 / 0,0002 / 0,026 | s, s par m/s, s | filtre du volant (§ 6.2) |
| aideSeuil / aidePlage | 0,062 / 0,118 | rad | l'aide entre à 3,55° de dérive de caisse, pleine à 10,3° |
| aideGain / aideLacet | 2,15 / 0,28 | —, s | force de l'aide |

**Dérive chargée et turbo** (§ 7)

| paramètre | valeur | unité | rôle |
|---|---|---|---|
| deriveVMin / deriveAnnulV | 12,2 / 10 | m/s | départ au-dessus de 44 km/h, fin sous 36 km/h |
| deriveCourbMin | 0,0015 | 1/m | virage de rayon ≤ 667 m |
| deriveVolantMin | 0,2 | — | volant minimal vers l'intérieur |
| deriveFreinMax | 0,05 | — | au-delà, le frein annule |
| deriveArmement / deriveRearmement / deriveAttente | 0,15 / 0,25 / 0,2 | s | appui trop tôt, délai entre deux dérives, attente avant la charge |
| deriveGrace / derivePerte | 0,18 / 0,38 | s | sortie de virage tolérée, perte de contrôle tolérée |
| deriveNiveaux / deriveChargeMax / deriveDecroit | 0,5 / 1,1 / 1,9 ; 2,2 ; 0,2 | s de qualité ; 1/s | paliers, plafond, décroissance |
| deriveFenDur | 0,22 | s | fenêtre « parfaite » après chaque palier |
| deriveEntree / deriveSortie | 0,10 / 0,16 | s | fondus de l'arrière |
| deriveTirage / deriveTirageTau | 1,4 / 0,035 | —, s | effort avant ajouté vers l'intérieur |
| deriveAlpha | 0,12 | rad | courbe adoucie de l'arrière en dérive |
| deriveMuAr | 1,0 | — | adhérence arrière en dérive (sans effet à 1) |
| deriveAmort | 0,25 | — | part de l'amortisseur gardée en dérive |
| deriveContreRetombee | 0,25 | s | contre-braquage retenu |
| deriveContreQ / deriveContreTrop | 0,10 / 0,22 / 0,78 ; 0,30 | volant ; — | qualité du contre-braquage |
| deriveAngleQ | 0,02 / 0,06 / 0,66 / 0,84 | rad | qualité de l'angle (1,1° / 3,4° / 37,8° / 48,1°) |
| deriveAngleMax | 0,85 | rad | au-delà de 48,7°, annulée |
| deriveBond / deriveBondDuree | 0,18 / 0,24 | m, s | petit bond visuel au départ |
| turboDurees / turboBonus | 0 / 0,6 / 1,1 / 1,6 ; 0,2 | s | durée par palier, bonus du lâcher parfait |
| turboAcc | 0 / 9 / 13 / 16 | m/s² | poussée par palier |
| turboMontee / turboDescente | 0,10 / 0,16 | s | fondus |
| turboVMax | 92 | m/s | 331 km/h |

**Glissières, attitude, vol, accident, recul**

| paramètre | valeur | unité | rôle |
|---|---|---|---|
| chocDuree | 0,4 | s | délai entre deux chocs signalés |
| caisseL / caissel | 4,95 / 2,02 | m | emprise de la caisse au rail |
| chocRebond, chocV, chocSeuil, frottementMur | 0,7 ; 0,85 ; 0,1 ; 6 | | **non lus** |
| glissRasant, glissAccident, glissVAccident, glissFrottementRasant | 0,14 rad ; 0,61 rad ; 27 m/s ; 2,2 m/s² | | **non lus** (le commentaire l. 271 les décrit pourtant) |
| tangageCoef / tangageMax / roulisCoef / roulisMax / attitudeTau | 0,0035 / 0,05 / 0,0025 / 0,04 / 0,1 | rad par m/s², rad, s | attitude visuelle |
| grilleMonteeTau / grilleDescenteTau / rupteurRebond / rupteurCadence | 0,09 / 0,22 / 380 / 0,1 | s, tr/min, s | grille |
| bondVMin / bondH / bondDuree | 0,65 / 0,22 / 0,34 | m/s, m, s | petit bond (contacts.js) |
| sautVMin / sautH / sautDuree | 6,5 / 1,8 / 1,0 | m/s, m, s | grand saut (contacts.js) |
| sautTangLim / sautRoulLim | 0,55 / 0,72 | rad | au-delà à la réception : tonneau |
| contreBon / contreMauvais | 0,4 / −0,4 | — | réception : 100 / 97 / 94 % de la vitesse |
| volBraquage / volTrainee | 0,15 / 0,0011 | rad/s, 1/m | en l'air |
| accidentDuree / accidentImm | 0,65 / 1 | s | retour en piste, immunité |
| accidentFrein, reparationDuree, rouePerdueBraquage/Traine/Lacet/Frein | 3,2 ; 0,65 ; 0,06/0,05/0,7/9 | | **non lus** (historiques) |
| reculAttente / reculMax / reculAcc / reculFrein | 0,3 / 3,33 / 3,5 / 8 | s, m/s, m/s², m/s² | recul |

## 5. Constantes tirées (calculées, banc « Voiture »)

| grandeur | valeur |
|---|---|
| SCx / SCz | 0,58 m² / 1,57 m² |
| appui / poids | 0,13 à 100 km/h, 0,50 à 200, 1,13 à 300 |
| capacité latérale nominale (`capaciteLaterale`) | 1,94 g à 100 km/h, 2,59 g à 200, 3,67 g à 300 |
| braquage maxi (`braquageMax`) | 14,3° à 50 km/h, 8,3° à 100, 6,8° à 200, 6,5° à 300 |
| pied levé (frein moteur + air + roulement) | 0,23 g à 100 km/h, 0,37 g à 200, 0,61 g à 300 |
| puissance à la roue, maxi par rapport | 182 / 196 / 206 / 214 / 221 / 233 kW (mesuré) |

## 6. Commandes et aides

### 6.1 Chaînes de commande (`src/jeu.js`, `commandesJoueur` l. 581–611, `lireManette` l. 395–424)

| appareil | volant | gaz, frein | `guidage` | `aide` |
|---|---|---|---|---|
| clavier | ±1 tout ou rien, sans rampe dans `jeu.js` | 0 ou 1 | 0,15 | réglage (défaut 0,35) |
| manette | manche : zone morte 0,06 puis exposant 1,22 | gâchettes progressives `b(7)`, `b(6)` | 0 | réglage |
| souris | position : (x − milieu)/(0,3·largeur), zone morte 0,03 | boutons, 0 ou 1 | 0 | réglage |
| doigt | glissé : Δx/70 px, borné à ±1 | boutons, 0 ou 1 | 0 | réglage |
| rivaux | `volantPour` vers leur ligne | continus | — | 0,35 (`AIDE_IA`), jamais de dérive |

`guidage = analogique ? 0 : 0,15` : `analogique` passe à vrai dès qu'une manette sert (> 0,05), que la souris est
active ou qu'un doigt touche la zone de volant ; une touche en course le remet à faux. Le commentaire de la ligne
607 (« guidage … au clavier et au doigt seulement ») ne correspond pas au code : au doigt, le guidage est nul.
Menu de l'aide : Aucune 0, Légère 0,35, Forte 0,7 (`index.html` l. 386–388).

### 6.2 Filtre du volant (`filtrerVolant`)
`volant += (cible − volant)·expTau(τ, dt)`, τ = 0,026 s quand on revient vers zéro ou qu'on contre-braque, sinon
0,030 + 0,0002·v s (0,046 s à 288 km/h). Au clavier, c'est la seule rampe du volant.

### 6.3 Direction par part d'adhérence
Le volant ne commande pas un angle : il commande une **part de l'adhérence avant**. Au-dessus de 6 m/s, les roues
sont orientées par rapport à la vitesse du centre de gravité (`suivi·angCG`), plus l'angle géométrique qu'il faut
pour tenir cette part (`geometrie`) et la dérive de pneu correspondante (`consigne`). Conséquences voulues
(commentaire l. 445) : le contre-braquage d'une glisse est en partie automatique, plein volant donne juste la
dérive au pic (marge 1,0) à toute vitesse, et l'avant ne peut pas être sur-braqué au-delà du pic par le volant.

### 6.4 Aide au volant (l. 435–442)
```
exces = rampe(|beta|, 0,062, 0,180)·aide·(1 − 2·bd)                (rien en dérive au bouton)
si exces > 0 :  sb = signe(beta) ;  lacetExces = r − alat/ua ;  rAide = 0,6·r + (lacetExces·sb > 0 ? lacetExces : 0)
                si rho·sb > 0 : rho ×= 1 − min(1, 2,15·exces)        (le volant vers l'intérieur s'efface)
                rho −= sb·exces·1,075 + 0,28·aide·rAide·(1 − 2·bd)  (contre-braquage et frein de lacet)
```
Elle se déclenche sur la **dérive de caisse** |β| > 3,55°, quelle qu'en soit la cause.

### 6.5 Guidage du clavier (l. 430)
`rho += 0,15·(1 − |rho|)·volantPour(courbure à ce décalage)` : touches relâchées, 15 % du volant qu'il faut
pour suivre l'axe ; nul à plein volant.

### 6.6 Amortisseur de glisse (l. 451–453), toujours actif
Retire au volant une part proportionnelle à l'excès de lacet `r − alat/u` (la caisse tourne plus vite que sa
trajectoire). Actif même avec l'aide à 0, réduit à 25 % en dérive au bouton, lâché quand l'arrière dépasse 3 à
3,5 fois sa dérive au pic (glisse franche).

## 7. Dérive chargée et turbo (l. 147–239, 339–351)

**Départ** — bouton tenu, non verrouillé, et `possible` : v ≥ 12,2 m/s, ni herbe ni hors piste, frein < 0,05,
aucun turbo en cours, bouton relâché depuis ≥ 0,25 s ; plus : |k| ≥ 0,0015 (courbure **de la piste** à `s`),
|volant filtré| ≥ 0,2 et volant du côté du virage. Sinon, au bout de 0,15 s ou si `possible` est faux, le bouton se
verrouille jusqu'au relâchement. Au départ : `sens = signe(k)`, grâce 0,18 s, petit bond visuel de 0,24 s.

**En cours**, à chaque pas :
```
annulée (sans turbo, bouton à relâcher) si frein ≥ 0,05, herbe, hors piste, v < 10 m/s ou |beta| > 0,85 rad
grace = (|k| ≥ 0,0015 et k·sens > 0) ? 0,18 : grace − dt
cb = max(0, −sens·volant) ;  contre = cb ≥ contre ? cb : contre + (cb − contre)·expTau(0,25, dt)
qC = 0 (c ≤ 0,10) ; (c − 0,10)/0,12 (≤ 0,22) ; 1 (≤ 0,78) ; 1 − 0,30·(c − 0,78)/0,22 au-delà
qA = rampe(sens·beta, 0,02, 0,06)·(1 − rampe(sens·beta, 0,66, 0,84)) ;   qualite = qC·qA
après 0,2 s : bon = qualite ≥ 0,3
              perte  = bon ? max(0, perte − 2·dt) : perte + dt
              charge = bon et grace > 0 ? min(2,2, charge + qualite·dt) : max(0, charge − 0,2·dt)
              niveau = 3 si charge ≥ 1,9 ; 2 si ≥ 1,1 ; 1 si ≥ 0,5 ;  nouveau palier → fenêtre de 0,22 s
perte > 0,38 ou grace ≤ 0, bouton tenu → fin sans turbo
```
Qualité pleine : paliers à 0,7 / 1,3 / 2,1 s, exactement ce que mesure le banc.

**Lâcher** — en piste, niveau ≥ 1 et perte < 0,38 : turbo de `turboDurees[niveau]` s, + 0,2 s si le lâcher tombe
dans la fenêtre du palier atteint (« parfait »).

**Effets physiques de la dérive** (par `bd`, `bt`) : l'arrière ne retombe plus après le pic (`capArG`), suit une
courbe adoucie `tanh(α/0,12)`, garde l'ellipse entière ; l'avant reçoit un effort ajouté vers l'intérieur jusqu'à
1,4 fois son adhérence (`tirage`) ; l'amortisseur de glisse tombe à 25 % ; l'aide se tait.

**Turbo** : `aTurbo` (§ 3.4) borné par l'adhérence arrière que le virage et le moteur laissent libre ; coupé par
le frein, l'herbe, la sortie de piste, un contact (`annulerDerive`) et un vol ; en 6e, le rupteur ne coupe plus
(jusqu'à 331 km/h).

## 8. Surfaces, pneus, eau

- Surface unique au centre de gravité (§ 3.2) ; dans l'herbe : mu 0,94, résistance 2,5 + 0,05·v m/s², poussée
  × 0,65. Le vibreur n'est qu'une adhérence (−8 %) et une hauteur visuelle (+5 cm au bord), sans vibration
  dynamique ; le battement des roues, plus fort sur vibreur (× 2,2) et dans l'herbe (× 3), est dessiné par
  `jeu.js` (l. 1631–1640), hors du modèle.
- Eau sur la piste : `eau = borne(max(pluie, 0,6·mouille), 0, 1)` (`meteo.actuel`) ; 0 sous un tunnel. La neige
  (`meteo.actuel.neige`) n'est pas lue par la conduite.
- Pneus, adhérence relative `a0 + a1·eau` : slicks 1 − 0,30·eau, inter 0,96 − 0,10·eau, pluie 0,88 + 0,07·eau ;
  meilleur choix : slicks sous 0,2, inter jusqu'à 0,47, pluie au-delà (`pneusConseilles`). Le facteur multiplie
  mu partout (piste, vibreur, herbe) — mais pas la demande de freinage (§ 3.9).
- Rien d'autre ne dépend de l'eau : ni l'appui, ni la traînée, ni l'aquaplanage, ni une trajectoire sèche.

## 9. Glissières, dégâts, vol, accident

- **Glissière** (`heurterGlissiere`, l. 268–306) : emprise `1,01·|cos| + 2,475·|sin|` du cap relatif ; au-delà de
  `limite − emprise` (≥ 0,2 m), la voiture est replacée au bord ; la vitesse normale v·sin ψ est renvoyée à 5 %
  (`vz − 1,05·normale`), la vitesse tangentielle est **gardée entière**, le lacet × 0,65 ; dérive et turbo annulés ;
  événement `choc` au premier contact à ≥ 2 m/s ; dégâts au premier contact ou au-delà de 20 m/s normaux.
- **Dégâts** (`degats.js`) : par choc de `force` m/s, adhérence −0,0025·force (plancher 0,92), traînée
  +0,002·force (plafond 1,08) ; une roue part à ≥ 20 m/s, casse à ≥ 30 m/s → immobilisation, retour à 0,65 s.
- **Vol** (`voler`, l. 628–663) : déclenché par `contacts.js` (roue contre roue) ; arc parabolique, lacet qui tend
  vers 0,075·volant rad/s (τ 0,5 s), traînée 0,0011·v² ; réception : vitesse × 1 / 0,97 / 0,94 selon le
  contre-braquage moyen, tonneau au-delà de 0,55 rad de tangage ou 0,72 rad de roulis.
- **Accident** : immobilisation puis remise sur l'axe au même `s` en 0,65 s, immunité 1 s (décision du 16/11).

## 10. Aspiration (`course.js`, `aspirer` l. 474–488)
Pour chaque voiture, part = max sur les voitures devant à moins de 30 m et 2 m de côté de
(1 − ds/30)·(1 − |Δd|/2) ; la traînée est multipliée par 1 − 0,35·part. Ni perte d'appui dans le sillage, ni air
sale, ni effet sur la voiture de tête.

## 11. Rivaux : même loi, autre pilote
- Même `B.conduite.pas`, aide 0,35, sans guidage, sans dérive au bouton.
- Profil de vitesse de référence (`circuit.js`, `vitesses` l. 202–219) : v = √(1,55·g/(k − 1,55·0,00155)), plafond
  86 m/s, passe arrière à 16 m/s², passe avant sur une enveloppe de poussée mesurée
  (15,59 − 0,2592·v + 0,000899·v²). MU 1,55 et AERO 0,00155 sont les constantes de l'essai 0.1 ; la voiture a
  aujourd'hui muPiste 1,72 et aero 0,0016.
- Allure `hab` = 0,90 / 0,955 / 0,99 selon la difficulté (± 0,015), × √(adhérence des pneus sous la pluie),
  élastique ±2 % aux difficultés faciles ; freinage planifié à `0,8·(14 + 0,15·v)·adh` m/s² (1,5 g à 100 km/h,
  1,8 g à 200, 2,2 g à 300), frein dès que le besoin dépasse 70 % de ce plan.

## 12. Ce que les tests figent

- `verifications/conduite.test.mjs` (18 vérifications) : départ arrêté, freinage, cercle sans et avec volant,
  retenue, paliers de dérive, annulations (fond, frein, ligne droite), herbe, glissière (trois cas dont le
  dégagement d'une caisse collée au rail), 100 000 pas aléatoires sans valeur non finie, boîte manuelle et rupteur,
  turbo, rupteur de grille, déterminisme.
- `verifications/conduite-criteres.test.mjs` (46 critères obligatoires tenus, S8 en mesure ouverte), valeurs du
  18/11 : 0-100 km/h 2,533 s (2,2 à 3,4) ; régime 10 309 tr/min dans les 0,5 s du vert (≥ 9 000) ; pente 6 % ;
  aspiration 4,061 m gagnés en 4 s à 10 m (≥ 3) ; lever de pied R 120 lacet × 1,126 (≥ 1,05) ; plein gaz en 2e
  7,8° de dérive arrière (≥ 6°) ; coup de glisse : témoin en tête-à-queue, rattrapé au contre-braquage en 0,3 s ;
  forte glisse sans aide : tête-à-queue, avec aide 0,35 et 0,7 : 3,10° ; clavier 0 → 90 % en 75 à 117 ms (≤ 120) ;
  plein braquage 1,161 fois le lacet limite (≤ 1,2) ; paliers 0,70 / 1,31 / 2,11 s ; tenue manette R 40 à 400 ;
  gain R 80 dérive + turbo III 0,283 s (0,1 à 0,3) ; turbo coupé par frein, herbe, choc, contact ; IA même loi ;
  charge avant à −3 g 0,614 / 0,601 (≥ 0,60) ; frein 0,3 en entrée de R 120 courbure × 1,532 ; S8 lissage de β
  1 031 °/s² pour une cible de 300 (ouverte : SUIVI-PHASE-2.md, 14/11, explique pourquoi).
- `verifications/phase2/` : scripts de mesure de la phase 2 (S3 à S11), sans seuils propres.
- `verifications/banc-conduite.test.mjs` (nouveau) : le banc est déterministe, ses ordres de grandeur sont ceux
  d'une monoplace, il voit une variante de PARAMS, et ses chaînes de commande suivent `jeu.js`.

Tout réglage de la conduite devra garder ces 46 critères ou dire lequel il change et pourquoi.

## 13. Ce qui n'est pas physique ou pas cohérent (liste franche)

Classé par nature. Les nombres viennent de `BANC-BASE.md` (empreinte 52a7484e7589dd23).

### Raccourcis (une loi simple à la place d'un mécanisme)
1. **Puissance qui croît avec le rapport** : POUSSEE ∝ vPointe^−0,8 au lieu de ∝ 1/vPointe, donc la puissance à
   la roue monte de 182 kW en 1re à 233 kW en 6e (mesuré). Une boîte ne crée pas de puissance.
2. **Régime affine** : régime = 4 000 + 8 800·v/vPointe, pas v·rapport : au passage de 1re en 2e à 12 300 tr/min,
   le régime retombe à 9 600 au lieu de 8 300. La boîte garde le moteur dans sa plage, la voiture ne « tombe »
   jamais hors du couple.
3. **Freinage sans adhérence** : la demande vaut 0,92·muPiste·(poids + appui) quelle que soit la surface, l'eau
   ou les pneus ; la force est ensuite plafonnée à 0,97 fois l'adhérence. Résultat : un ABS parfait partout, aucune
   roue ne bloque (l'indicateur `blocage` vaut 1 à pleine pédale, mais l'avant garde 24 % de latéral). Répartition
   fixe à 58 % sur l'avant, plus le frein moteur sur l'arrière, alors que l'avant porte 63 % de la charge au
   freinage : à pleine pédale, l'arrière demande 1,11 à 1,17 fois son adhérence et l'avant 0,86 à 0,92 (calculé pas
   à pas sur 200-0 et 300-100). C'est l'arrière qui sature, l'avant n'est pas tout employé, et un freinage plein en
   appui sans aide finit en tête-à-queue (mesuré).
4. **Frein moteur constant** : 1,6 m/s² pied levé, quel que soit le rapport ou le régime.
5. **Pas de dynamique de roue** : ni patinage ni blocage réels, ni différentiel ; le départ est borné par
   `transmis`, pas par une roue qui patine. À la place, l'ellipse de motricité est exagérée (exposant 1,3, voulu
   pour le critère S3 « plein gaz en 2e fait glisser l'arrière ») : à 30 % de motricité, l'arrière perd 16 % de son
   latéral au lieu de 5 % avec l'ellipse. Dans les grands virages tenus à fond contre la traînée, elle coûte peu
   (voiture seule : R 180 242,3 km/h contre 244,1 avec l'ellipse entière, R 250 272,9 contre 275,2 ; variante C
   de `BANC-BASE.md`, `--regler ellipseMotrice=2`) ; elle pèse surtout sur les petits rapports, où elle fait le
   tête-à-queue de la remise des gaz : avec l'ellipse entière, la voiture seule ne part plus en tête-à-queue en
   sortie de R 30 et de R 60 sur le sec (β 3 à 7°) ; le critère S3, pour lequel l'exposant a été posé en phase 2,
   n'a pas été repassé avec l'ellipse entière.
6. **Direction par part d'adhérence** (§ 6.3) : contre-braquage en partie automatique ; plein volant = pic du pneu
   à toute vitesse, impossible de sur-braquer l'avant. C'est un choix arcade, pas un angle de volant.
7. **Charge sans suspension** : transferts filtrés à 62 ms, sans roulis ni tangage dynamiques ; la pente, le
   dévers, les bosses et les compressions ne changent pas la charge (rien pour le circuit de montagne à 20–30 %).
8. **Pneus sans état** : ni température, ni usure, ni pression, ni relaxation ; la force latérale suit la dérive au
   pas près (S8 vient en partie de là, SUIVI-PHASE-2.md).
9. **Appui constant** : SCz fixe, sans hauteur de caisse ni effet de sol (jupes de 1980), sans perte dans le
   sillage ; l'aspiration n'ôte que de la traînée.
10. **Eau linéaire et douce** : un facteur sur mu, sans aquaplanage, sans flaques, sans trajectoire sèche ; la
    neige n'existe pas pour la conduite.
11. **Remise en piste instantanée** : 0,65 s, même abscisse (décision de David, pas une faute ; à garder en tête
    pour la cohérence).

### Saturations et bascules
12. **Surface binaire au centre de gravité** : la voiture entière passe de 1,72 à 0,94 en un pas quand le CG
    franchit le bord (−45 % d'un coup, quatre roues à la fois).
13. **Glissière sans frottement** (code, non mesuré) : la vitesse tangentielle est gardée entière, seule la
    normale est tuée ; un frôlement rasant ne coûte que sa vitesse normale. Huit paramètres prévus pour cela ne
    sont pas lus (§ 4), et le
    commentaire l. 271 annonce un accident « au-delà de 35° et 100 km/h » que le code ne fait pas (l'accident vient
    seulement des seuils de `degats.js`, 20 et 30 m/s normaux).
14. **Rupteur de 6e comme mur** : à 86 m/s le moteur coupe (pointe 307 km/h, 309,6 en plein sillage) ; le turbo
    passe ce mur jusqu'à 331 km/h.
15. **Dérive au bouton = mode** : elle change la loi de l'arrière (plus de retombée, ellipse entière), ajoute un
    effort avant de 1,4 fois l'adhérence et coupe l'aide. C'est assumé (pilier 2 de CONCEPTION.md), mais c'est
    une bascule, pas une glisse.
16. **Aide déclenchée sur |β| > 3,55°** : la dérive de caisse naturelle à la limite est de 2 à 3,9° (mesuré, R 30
    à R 180). L'aide entre donc dans un virage propre à la limite des grands rayons et l'écrête : aide seule, même
    pilote, 182,9 → 179,7 km/h en R 120 (−1,7 %) et 243,0 → 234,8 km/h en R 180 (−3,4 %), rien en R 30 (mesuré).
    À la remise des gaz et au freinage appuyé, elle efface la rotation et pousse la voiture tout droit vers l'herbe
    (6,9 m dehors en R 30, mesuré).
17. **Amortisseur de glisse toujours là** : même aide à 0, un contrôle de lacet invisible reste actif.

### Effets sans cause physique
18. **Charge de dérive liée à la courbure de la piste** (`k` à l'abscisse), pas à la trajectoire ni au lacet réel
    de la voiture ; elle se tient indéfiniment (10 s tenues à tous les rayons, mesuré) sans aucun coût (ni usure,
    ni perte de vitesse propre).
19. **Turbo de 9 à 16 m/s²** : jusqu'à 1,6 g de poussée en plus du moteur (0,5 g en 6e), soit 17 à 46 km/h gagnés
    en 1 s (mesuré) ; borné par l'adhérence arrière, sans cause mécanique (choix de jeu, pilier 2).
20. **Gain de la dérive selon l'appareil** : à la manette, la dérive et son turbo ne font pas gagner de temps
    (−0,22 à +0,03 s) ; au clavier, +0,85 s en R 40 et +0,18 s en R 80, −0,08 s en R 250. Le turbo corrige
    surtout la faiblesse du clavier en adhérence.

### Incohérences entre code, documents et jeu
21. Empattement 2,85 m (la 312 T5 du jeu en a 2,70) ; commentaire « monoplace de 1990 » pour une voiture de 1980.
22. Rivaux sur l'adhérence de l'essai 0.1 (MU 1,55, AERO 0,00155) : leur vitesse de référence vaut 94 % de la
    voiture en R 30, 100 % en R 120 et 113 % en R 250 (où la voiture plafonne à la puissance).
23. Guidage du doigt : nul, contre le commentaire l. 607 ; manette : zone morte 0,06 et exposant 1,22 dans le
    code, 0,07 et 1,3 dans FEUILLE-DE-ROUTE.md.
24. Paramètres morts : `chocRebond`, `chocV`, `chocSeuil`, `frottementMur`, `glissRasant`, `glissAccident`,
    `glissVAccident`, `glissFrottementRasant`, `accidentFrein`, `reparationDuree`, `rouePerdue*`, et
    `deriveMuAr` à 1 (sans effet).
25. Déterminisme entre moteurs JavaScript : `Math.exp` ne rend pas toujours le même dernier bit sous Node 24 et
    Chrome 157 (exp(−2,9) par exemple). Même modèle, nombres égaux à 1e-13 près, pas au bit (preuve dans
    `BANC-BASE.md`). Aucun effet sur le jeu n'est affirmé ici : il faudrait le chercher là où deux navigateurs
    doivent rester d'accord (réseau, fantôme).
