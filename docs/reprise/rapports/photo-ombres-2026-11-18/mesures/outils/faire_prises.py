#!/usr/bin/env python3
"""Écarts des onze vues, déterminisme des prises et provenance (mesures/ecarts.txt, mesures/prises.json) :
python3 faire_prises.py ecarts.txt prises.json"""
import hashlib, json, os, subprocess, sys
O = '/private/tmp/ombres-corr'
P = O + '/prises'
OUTILS = '/Users/david/Projects/bitume-wt/moteur/docs/reprise/rapports/photo-ombres-2026-11-18/mesures/outils'
COMPARER = OUTILS + '/comparer.mjs'
SORTIE_ECARTS, SORTIE_PRISES = sys.argv[1:3]
VUES = json.load(open(P + '/vues11.json'))
AV, AP, AV2, AP2 = 'avant5', 'fin5', 'avant6', 'fin6'
sha = lambda f: hashlib.sha256(open(f, 'rb').read()).hexdigest()


def comparer(a, b):
    return json.loads(subprocess.run(['node', COMPARER, a, b], capture_output=True, text=True, check=True).stdout)


def valeur(d, nom):
    return json.JSONDecoder().raw_decode(open(os.path.join(P, d, nom + '.json')).read())[0]['valeur']


lignes = ["# Écart de luminance par pixel, après (0.3.11 corrigé, fin2.html) − avant (0.3.10, a2.html), mêmes poses, 1280 × 720,",
          "# base fluidite/integration 4b994c4 ; prises du 19/11 (outils/prise.js : boucle menée à 1/60 s, hasard réamorcé, voile",
          "# de chargement caché et transitions CSS figées).",
          "# changes : pixels dont la luminance bouge de plus de 1,5 niveau (sur 255) ; part : leur proportion ;",
          "# partSombre : part de ceux qui s'assombrissent ; moyenne : écart moyen de ceux-là ; max : plus grand écart ; boite : rectangle qui les contient.",
          "# témoin : deux prises de la même page (avant contre avant, après contre après), mêmes réglages."]
bruit = {}
vues = []
for v in VUES:
    n = v['nom']
    e = comparer(f'{P}/{AV}/{n}.png', f'{P}/{AP}/{n}.png')
    ta = comparer(f'{P}/{AV}/{n}.png', f'{P}/{AV2}/{n}.png')
    tb = comparer(f'{P}/{AP}/{n}.png', f'{P}/{AP2}/{n}.png')
    lignes.append(f"{n:22s} {json.dumps(e)}")
    lignes.append(f"{'   témoin avant':22s} changes {ta['changes']} part {ta['part']} ; témoin après changes {tb['changes']} part {tb['part']}")
    bruit[n] = {'avant': {'changes': ta['changes'], 'part': ta['part'], 'max': ta['max']},
                'apres': {'changes': tb['changes'], 'part': tb['part'], 'max': tb['max']}}
    entree = {'nom': n, 'reference': v['ref'], 'images': v.get('n', 50)}
    if v.get('cam'): entree['camera'] = v['cam']
    for cle, d in (('avant', AV), ('apres', AP)):
        x = valeur(d, n)
        entree[cle] = {k: x.get(k) for k in ('moteur', 's', 'image', 'ombre', 'msaa', 'triangles', 'appels', 'photo')}
        entree[cle]['png_sha256'] = sha(f'{P}/{d}/{n}.png')
    vues.append(entree)
open(SORTIE_ECARTS, 'w').write('\n'.join(lignes) + '\n')
prises = {
    'outil': "tools/page-essai.mjs (Chrome sans fenêtre), 1280 × 720, densité 1 ; outils/prendre.py et outils/prise.js : séance de "
             "référence BITUME_JEU.reference, boucle du jeu menée à pas de 1/60 s, hasard à graine fixe, interface, voile de "
             "chargement cachés et transitions CSS figées (19/11), n images avant la prise ; JPEG par sips (outils/images.py), qualité 88",
    'avant': {'page': 'BITUME 0.2.41 sur FERRO 0.3.10 : fluidite/integration 4b994c4 telle quelle (a2.html)', 'sha256': sha(O + '/a2.html')},
    'apres': {'page': 'BITUME 0.2.41 sur FERRO 0.3.11 corrigé : dist/bitume.html de ce lot (fin2.html ; tuile 512², pénombre météo, sans PCSS)',
              'sha256': sha(O + '/fin2.html')},
    'vues': vues,
    'zooms': {'zoom-a-poursuite-ombre': '2-poursuite-fine, x 440, y 380, 360 × 200, ×2', 'zoom-b-cockpit-horizon': '1-cockpit-fine, x 0, y 262, 640 × 150, ×2',
              'zoom-c-legere-contact': '4-exterieur-legere, x 300, y 340, 460 × 180, ×2', 'zoom-d-arbres-loin': '7-vue-haute, x 0, y 280, 460 × 130, ×2',
              'zoom-e-grille': '5-depart-grille, x 290, y 380, 250 × 200, ×2', 'zoom-f-pluie-ombre': '8-poursuite-pluie, x 440, y 380, 360 × 200, ×2',
              'zoom-g-cockpit-bras': '9-cockpit-fine-volant, x 700, y 540, 320 × 180, ×3',
              'zoom-h-casquette': "prises du 18/11 sur l'ancienne base, gardées : 9-cockpit-fine-volant, x 430, y 470, 420 × 100, ×3 ; "
                                  "tuile1024 = essai écarté (tuile 1024², PCSS), tuile512 = réglage retenu",
              'zoom-i-poursuite': "poursuite, s 2300, rivaux écartés, 60 images en temps réel (même scène que poursuite-ombre de "
                                  "tools/controle-ombres.mjs), fin2.html avec et sans la tuile (fx.ombreProche retiré) ; x 500, y 400, 360 × 200, ×2",
              'foule-*': "6-tribune et 9-cockpit-fine-volant, 0.3.11 tel que relu (b02.html, même base) contre fin2.html : voir le point 9 de diagnostics.txt"},
    'bruit': dict(note="deux prises de la même page, même pose (avant5 contre avant6, fin5 contre fin6 dans le dossier de travail)", **bruit),
}
json.dump(prises, open(SORTIE_PRISES, 'w'), ensure_ascii=False, indent=1)
print('\n'.join(lignes))
