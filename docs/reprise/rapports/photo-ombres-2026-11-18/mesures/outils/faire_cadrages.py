#!/usr/bin/env python3
"""Compose mesures/cadrages-plan.txt : python3 faire_cadrages.py ancien.txt tableau.txt sortie.txt
ancien.txt : cadrages-plan.txt du 18/11 (on en garde le bruit de l'outil du plan) ; tableau.txt : sortie de
outils/ecarts_cadrages.py sur les prises du 19/11."""
import hashlib, json, os, re, subprocess, sys
ANCIEN, TABLEAU, SORTIE = sys.argv[1:4]
O = '/private/tmp/ombres-corr'
OUTILS = '/Users/david/Projects/bitume-wt/moteur/docs/reprise/rapports/photo-ombres-2026-11-18/mesures/outils'
PLAN = json.load(open(OUTILS + '/cadrages-plan.json'))
AV, AP, BIS = O + '/cadrages/avant', O + '/cadrages/apres', O + '/cadrages/avant-bis'
sha = lambda f: hashlib.sha256(open(f, 'rb').read()).hexdigest()
comparer = lambda a, b: json.loads(subprocess.run(['node', OUTILS + '/comparer.mjs', a, b], capture_output=True, text=True, check=True).stdout)

# déterminisme : deux passages sur 0.3.10
det = []
for c in PLAN:
    n = c['nom']
    r = comparer(f'{AV}/{n}.png', f'{BIS}/{n}.png')
    det.append((n, r['changes'], r['part'], r['max']))
identiques = [d for d in det if d[1] == 0]
autres = [d for d in det if d[1] != 0]

ancien = open(ANCIEN).read()
bruit_plan = ancien[ancien.index("Bruit de l'outil du plan : deux passages"):ancien.index('Empreintes des prises')].rstrip() + '\n'
tableau = open(TABLEAU).read().rstrip() + '\n'

import textwrap
fr = lambda x: f'{x:,}'.replace(',', '\u202f')
DETERMINISME = textwrap.fill(f"Deux passages complets sur la même page 0.3.10 (19/11) : {len(identiques)} cadrages sur 80 sont identiques au "
                             f"pixel près ; les autres : " + ', '.join(f"{n} {fr(c)} pixels" + (f" ({p * 100:.2f} %)".replace('.', ',') if p >= 0.0001 else '')
                             for n, c, p, _ in autres) + '.', width=118, initial_indent='- ', subsequent_indent='  ')
texte = f"""Cadrages du plan (§ 7.3) : les mêmes vues avant et après
=========================================================

Pages comparées (prises du 19/11)
- avant : BITUME 0.2.41 sur FERRO 0.3.10, la base fluidite/integration 4b994c4 telle quelle (sha256 {sha(O + '/a2.html')[:16]}…).
- après : BITUME 0.2.41 sur FERRO 0.3.11 corrigé, page de ce lot (dist/bitume.html, sha256 {sha(O + '/fin2.html')[:16]}…).
- Chrome 157 sans fenêtre, 1280 × 720, densité 1, Mac M5.

D'où viennent les cadrages
- Le plan cite outils/lot1.py à lot3.py. Ces scripts sont dans le rapport photo du 18/11, dans l'arbre
  bitume-wt/photo (docs/reprise/rapports/photo-2026-11-18/outils/). Ils donnent 80 cadrages :
  - lot 1 : 21 vues de jour, une vue cockpit, une vue de bord de piste et une vue haute sur chacun des 7 circuits ;
  - lot 2 : 32 vues de crépuscule, de nuit, de pluie et de saisons ;
  - lot 3 : 27 vues de sujets : eau, falaises, ombres d'arbres, voitures de près, portiques, piste mouillée, tunnel.
- outils/cadrages-plan.json reprend ces 80 cadrages tels quels. Seul change le nombre d'images rendues avant la
  prise des 22 vues de crépuscule et de nuit : 240 au lieu de 45 à 70 (voir plus bas).

Pourquoi un autre outil de prise
- L'outil du plan (lancer.py et modele.js) fait tourner la course en temps réel. Deux passages sur la même
  construction 0.3.10 ne donnent pas la même image (tableau « Bruit de l'outil du plan » plus bas) : jusqu'à 51 %
  des pixels changent en cockpit. Ses écarts avant/après ne prouvent donc rien.
- outils/prise.js (lancé par outils/prendre.py) avance le jeu de 1/60 s par image, avec un hasard à graine fixe. Depuis
  le 19/11, il cache aussi le voile de chargement et fige les transitions CSS de la page : la vue de course apparaît en
  0,3 s de temps réel, et une prise pouvait tomber pendant ce fondu (diagnostics.txt, point 10).
{DETERMINISME}
- Au crépuscule et la nuit, il faut environ 240 images pour que l'éclairage du décor se règle sur l'heure. Prises
  à 45 images, ces vues sortaient encore en plein jour. Elles sont prises à 240 images, avant et après.

Ce que montrent les 80 paires
- Aucune erreur de page dans les 160 prises.
- Vues de jour en cockpit et en bord de piste, sur les sept circuits : de 0,7 à 4,9 % des pixels changent, et
  tous s'assombrissent (100 % à l'arrondi). On y voit le contact sous les voitures, l'ombre nette de la voiture
  filmée et de son habitacle (la tuile), et les ombres des arbres lointains.
- Vues hautes : de 0 à 2,2 %, à cause des ombres lointaines.
- Crépuscule et nuit, sans pluie (17 vues) : les mêmes effets, de 0,03 à 2,8 % des pixels, de 98,9 à 100 % plus
  sombres. En bord de piste, les voitures sont déjà passées à 240 images : seules les ombres lointaines changent.
- Pluie et piste mouillée (11 vues) : de 0,6 à 6 % des pixels changent, mais seulement de 18 à 89 % s'assombrissent.
  La part météo éclaircit les ombres sous un ciel couvert, alors que le contact et la tuile assombrissent.
- Saisons (printemps, automne, hiver ; 6 vues) : de 2 à 5,9 %, 100 % plus sombres.
- Eau (5 vues, dont pluie et nuit) et falaises au-dessus de la mer (3 vues) : aucun pixel ne bouge de plus de
  1,5 niveau (au plus 1,3).
- Tunnel (5 vues, dont nuit) : de 1 à 11 pixels sur 921 600 bougent, de 6 niveaux au plus.
- Ombre d'un arbre proche (c0-ombre-arbre) : aucun pixel ne change. Ombre d'un arbre lointain (c0-ombre-arbre-loin) :
  0,16 % des pixels, tous plus sombres, grâce à la carte lointaine.
- Portiques : de 0,06 à 0,08 %.
- Voitures vues de près (5 vues) : de 11 à 19 % des pixels, de 76 à 89 % plus sombres. L'ombre nette de la tuile
  remplace la tache floue ; une partie de l'ancienne tache s'éclaircit donc (paires 10 et 11 du dossier images/).

Colonnes : n = images rendues avant la prise ; changés = pixels dont la luminance bouge de plus de 1,5 niveau sur
255 ; sombres = part de ces pixels qui s'assombrissent ; moyen et max = écart de luminance (après moins avant) ;
err = erreurs de page des deux prises.
Commande : python3 outils/ecarts_cadrages.py outils/cadrages-plan.json <dossier avant> <dossier après>

{tableau}
{bruit_plan}
Empreintes des prises du 19/11 (16 premiers caractères du sha256 des PNG ; les PNG ne sont pas gardés, une reprise
avec outils/prendre.py sur les mêmes pages doit retrouver les mêmes empreintes, aux écarts de déterminisme près)

cadrage                    avant (0.3.10)   après (0.3.11)
"""
for c in PLAN:
    n = c['nom']
    texte += f"{n:26s} {sha(f'{AV}/{n}.png')[:16]} {sha(f'{AP}/{n}.png')[:16]}\n"
open(SORTIE, 'w').write(texte)
print(len(identiques), 'identiques ;', autres)
