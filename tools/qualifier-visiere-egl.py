#!/usr/bin/env python3
"""Rastérise le vrai GLSL de visière sur une mire procédurale, avec Mesa sans fenêtre.

Usage : python3 tools/qualifier-visiere-egl.py --sortie /tmp/bitume-visiere
Nécessite Node, libEGL/libGL, NumPy et Pillow. Aucun navigateur ni FPS matériel qualifié.
Les états viennent de la simulation du jeu ; aucune image de référence n'est importée.
"""
import argparse
import ctypes as C
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys

import numpy as np
from PIL import Image

sys.dont_write_bytecode = True
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--sortie', type=Path, required=True)
parser.add_argument('--racine', type=Path, default=Path(__file__).resolve().parents[1])
args = parser.parse_args()
root, out = args.racine.resolve(), args.sortie.resolve()
out.mkdir(parents=True, exist_ok=True)
assert not (out / 'rapport.json').exists(), 'Choisir un dossier neuf pour éviter les images périmées.'
helper = root / 'docs/reprise/rapports/PHYSX-SOLS-PILOTES-2026-11-19/pilote-exterieur/egl-context-reference.py'
spec = importlib.util.spec_from_file_location('bitume_egl', helper)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
ctx = module.Context(960, 540)
source = (root / 'src/visiere-optique.js').read_text()
vertex = re.search(r'const VERTEX = `([\s\S]*?)`;', source).group(1)
fragment = re.search(r'const FRAGMENT = `([\s\S]*?)`;', source).group(1)
program = ctx.program(vertex, fragment, varyings=())

# La même simulation que le navigateur, y compris interpolation et plafonds du palier.
node = r'''
require(process.argv[1]+'/src/visiere-optique.js');require(process.argv[1]+'/src/vitre.js');
const O=BITUME.visiereOptique,fixtures=[];
function simuler(nom,ajout,secondes=24,graine=4){
 const e=O.creerEtat({graine}),c={qualite:'high',actif:true,pluie:1,neige:0,embruns:0,vitesse:0,intensite:1,
  cockpit:true,largeur:1280,hauteur:720,...ajout};
 for(let i=0;i<secondes*120;i++)O.avancerEtat(e,1/120,c);
 const f={nom,qualite:O.QUALITES[c.qualite],scene:c.qualite!=='low',uniformes:[...e.uniformes],
  gouttes:[...e.gouttesUniformes],trajets:[...e.trajetsUniformes],nombre:e.nbGouttes,stats:{...e.depots.stats}};
 fixtures.push(f);return {e,c,f};
}
simuler('grille-pluie',{});
simuler('pluie235',{vitesse:235/3.6});
simuler('pluie300',{vitesse:300/3.6});
simuler('sillage235',{vitesse:235/3.6,embruns:.8});
const {e,c,f}=simuler('sillage300',{pluie:0,vitesse:300/3.6,embruns:.8});
const avant=JSON.stringify(e);for(let i=0;i<240;i++)O.avancerEtat(e,1/60,{...c,pause:true});
if(JSON.stringify(e)!==avant)throw new Error('La pause modifie la simulation.');
fixtures.push({...f,nom:'sillage300-pause',uniformes:[...e.uniformes],gouttes:[...e.gouttesUniformes],trajets:[...e.trajetsUniformes]});
fixtures.push({...f,nom:'depots-sans-film',uniformes:[0,0,0,0,...f.uniformes.slice(4)]});
simuler('sillage300-poursuite',{pluie:0,vitesse:300/3.6,embruns:.8,cockpit:false});
simuler('neige45',{pluie:0,neige:1,vitesse:45/3.6},30);
simuler('legere',{qualite:'low',vitesse:235/3.6,embruns:.8});
simuler('sec',{pluie:0});
console.log(JSON.stringify(fixtures));
'''
fixtures = json.loads(subprocess.check_output(['node', '-e', node, str(root)], text=True))
(out / 'etats.json').write_text(json.dumps(fixtures, ensure_ascii=False, indent=2) + '\n')
g = ctx.gl
for name, res, arguments in [
    ('glGenTextures', None, [C.c_int, C.POINTER(C.c_uint)]),
    ('glBindTexture', None, [C.c_uint, C.c_uint]),
    ('glTexParameteri', None, [C.c_uint, C.c_uint, C.c_int]),
    ('glTexImage2D', None, [C.c_uint, C.c_int, C.c_int, C.c_int, C.c_int, C.c_int, C.c_uint, C.c_uint, C.c_void_p]),
    ('glGenFramebuffers', None, [C.c_int, C.POINTER(C.c_uint)]),
    ('glBindFramebuffer', None, [C.c_uint, C.c_uint]),
    ('glFramebufferTexture2D', None, [C.c_uint, C.c_uint, C.c_uint, C.c_uint, C.c_int]),
    ('glCheckFramebufferStatus', C.c_uint, [C.c_uint]),
    ('glViewport', None, [C.c_int, C.c_int, C.c_int, C.c_int]),
    ('glClearColor', None, [C.c_float, C.c_float, C.c_float, C.c_float]),
    ('glClear', None, [C.c_uint]),
    ('glReadPixels', None, [C.c_int, C.c_int, C.c_int, C.c_int, C.c_uint, C.c_uint, C.c_void_p]),
    ('glFinish', None, []), ('glActiveTexture', None, [C.c_uint])]:
    ctx.fn(name, res, *arguments)
w, h = ctx.width, ctx.height
yy, xx = np.mgrid[0:h, 0:w]
scene = np.empty((h, w, 4), dtype=np.uint8)
scene[:, :, 0] = 50 + xx * 55 // w
scene[:, :, 1] = 70 + yy * 80 // h
scene[:, :, 2] = 95 + xx * 40 // w
scene[:, :, 3] = 255
scene[(xx % 83 < 3) | (yy % 59 < 3), :3] = [214, 211, 168]
# Les lignes révèlent la réfraction ; un fond uniforme révélerait seulement l'opacité.
pixels_source = np.ascontiguousarray(scene[::-1])
textures = (C.c_uint * 2)()
g.glGenTextures(2, textures)
for i in range(2):
    g.glBindTexture(0x0DE1, textures[i])
    g.glTexParameteri(0x0DE1, 0x2801, 0x2601)
    g.glTexParameteri(0x0DE1, 0x2800, 0x2601)
    g.glTexParameteri(0x0DE1, 0x2802, 0x812F)
    g.glTexParameteri(0x0DE1, 0x2803, 0x812F)
    g.glTexImage2D(0x0DE1, 0, 0x8058, w, h, 0, 0x1908, 0x1401, pixels_source.ctypes.data if i == 0 else None)
fbo = C.c_uint()
g.glGenFramebuffers(1, C.byref(fbo))
g.glBindFramebuffer(0x8D40, fbo.value)
g.glFramebufferTexture2D(0x8D40, 0x8CE0, 0x0DE1, textures[1], 0)
assert g.glCheckFramebufferStatus(0x8D40) == 0x8CD5


def uniforme4(nom, valeurs):
    data = (C.c_float * len(valeurs))(*valeurs)
    g.glUniform4fv(g.glGetUniformLocation(program, nom.encode()), len(valeurs) // 4, data)


report = {
    'source': 'GLSL ES 3.00 exact de src/visiere-optique.js et états de la simulation réelle ; mire procédurale.',
    'sourceSha256': hashlib.sha256(source.encode()).hexdigest(), 'contexte': ctx.info, 'compilation': True,
    'limites': ['Mire de matière, pas capture de course.', 'Raster logiciel Mesa, ni WebGL navigateur ni FPS matériel qualifiés.'],
    'cas': [],
}
for f in fixtures:
    loc = lambda nom: g.glGetUniformLocation(program, nom.encode())
    g.glUseProgram(program)
    g.glViewport(0, 0, w, h)
    g.glDisable(0x0B71)
    g.glDisable(0x0BE2)
    g.glClearColor(0, 0, 0, 0)
    g.glClear(0x4000)
    g.glActiveTexture(0x84C0)
    g.glBindTexture(0x0DE1, textures[0])
    g.glUniform1i(loc('uScene'), 0)
    uniforme4('uMeteo', f['uniformes'][:4])
    uniforme4('uMouvement', f['uniformes'][4:8])
    uniforme4('uVue', f['uniformes'][8:12])
    g.glUniform2f(loc('uTexel'), 1 / w, 1 / h)
    g.glUniform1i(loc('uQualite'), f['qualite'])
    g.glUniform1i(loc('uAvecScene'), f['scene'])
    g.glUniform1i(loc('uNbGouttes'), f['nombre'])
    uniforme4('uGouttes', f['gouttes'])
    uniforme4('uTrajets', f['trajets'])
    g.glDrawArrays(0x0004, 0, 3)
    g.glFinish()
    error = g.glGetError()
    assert error == 0, (f['nom'], hex(error))
    pixels = np.empty((h, w, 4), dtype=np.uint8)
    g.glReadPixels(0, 0, w, h, 0x1908, 0x1401, pixels.ctypes.data)
    assert g.glGetError() == 0
    pixels = np.ascontiguousarray(pixels[::-1])
    alpha = pixels[:, :, 3]
    if f['nom'] == 'sec':
        assert np.count_nonzero(pixels) == 0, 'Un résidu reste au sec.'
    else:
        assert np.count_nonzero(alpha) > 300 and np.std(pixels[:, :, :3]) > 1, f['nom']
    overlay = Image.fromarray(pixels)
    overlay.save(out / (f['nom'] + '-overlay.png'))
    Image.alpha_composite(Image.fromarray(scene), overlay).save(out / (f['nom'] + '.png'))
    border = (xx < w * .08) | (xx > w * .92) | (yy < h * .08) | (yy > h * .92)
    report['cas'].append({
        'nom': f['nom'], 'qualite': f['qualite'], 'gouttesMobiles': f['nombre'], 'erreurGL': error,
        'pixelsAlphaNonNul': int(np.count_nonzero(alpha)), 'alphaMoyen': float(np.mean(alpha) / 255),
        'fractionAlphaDemi': float(np.mean(alpha > 127)), 'alphaBords': float(np.mean(alpha[border]) / 255),
        'alphaCentre': float(np.mean(alpha[~border]) / 255), 'pixelsSha256': hashlib.sha256(pixels.tobytes()).hexdigest(),
    })
cases = {c['nom']: c for c in report['cas']}
assert cases['sillage300']['alphaMoyen'] > cases['pluie300']['alphaMoyen'] * 2
assert cases['sillage300-poursuite']['alphaMoyen'] > .1
assert cases['sillage300-pause']['pixelsSha256'] == cases['sillage300']['pixelsSha256']
assert cases['neige45']['alphaBords'] > cases['neige45']['alphaCentre'] * 1.5
assert cases['depots-sans-film']['pixelsAlphaNonNul'] > 300
report['reussi'] = True
(out / 'rapport.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'sortie': str(out), 'cas': len(report['cas']), 'reussi': True, 'contexte': ctx.info}, ensure_ascii=False))
