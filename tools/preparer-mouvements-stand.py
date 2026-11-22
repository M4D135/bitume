#!/usr/bin/env python3
"""Extrait les angles sagittaux du squelette CMU/CodePawl. Python standard, hors jeu."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import struct
import urllib.request

REVISION = 'acfbd6e18d3f928a83767fa677de1b390f52291d'
SOURCE = 'https://huggingface.co/datasets/codepawl/cmu-mocap-glb/resolve/' + REVISION
MARCHE = '07_01-walk'
SQUAT = '22_14-alternating-squats-2-subjects-subject-a'
EMPREINTES = {
    MARCHE: '4893dbc7ef5fc1efb7912e62b27d22dabd3dacbf4bdb11c0c209e3fdc65fd4fa',
    SQUAT: '919ea2eb2328db09cea2389eab490d263506f70631a1901e81571247dcace4ea',
}
IDENTITE = (0., 0., 0., 1.)


def produit(q, r):
    x, y, z, w = q
    a, b, c, d = r
    return (w*a+x*d+y*c-z*b, w*b-x*c+y*d+z*a, w*c+x*b-y*a+z*d, w*d-x*a-y*b-z*c)


def tourner(q, v):
    x, y, z, w = q
    return produit(produit(q, (*v, 0.)), (-x, -y, -z, w))[:3]


def difference(a, b):
    return tuple(x-y for x, y in zip(a, b))


def lire_fichier(dossier, nom, url):
    if dossier and (dossier / nom).is_file():
        return (dossier / nom).read_bytes()
    with urllib.request.urlopen(url, timeout=30) as reponse:
        data = reponse.read()
    if dossier:
        dossier.mkdir(exist_ok=True, parents=True)
        (dossier / nom).write_bytes(data)
    return data


def clip(dossier, identifiant):
    if not re.fullmatch(r'[0-9]+_[0-9]+-[a-zA-Z0-9_-]+', identifiant):
        raise ValueError('Utiliser un identifiant de la colonne id du catalogue.')
    nom = identifiant + '_skeleton.glb'
    data = lire_fichier(dossier, nom, f'{SOURCE}/skeleton/{identifiant}/{nom}')
    if identifiant in EMPREINTES and hashlib.sha256(data).hexdigest() != EMPREINTES[identifiant]:
        raise ValueError('Empreinte inattendue pour ' + identifiant)
    if struct.unpack_from('<4sII', data) != (b'glTF', 2, len(data)):
        raise ValueError('GLB 2.0 attendu')
    taille, nature = struct.unpack_from('<I4s', data, 12)
    if nature != b'JSON' or data[24+taille:28+taille] != b'BIN\0':
        raise ValueError('GLB JSON/BIN attendu')
    doc = json.loads(data[20:20+taille])
    base = 28+taille

    def lire(accessor):
        a = doc['accessors'][accessor]
        v = doc['bufferViews'][a['bufferView']]
        n = {'SCALAR': 1, 'VEC3': 3, 'VEC4': 4}[a['type']]
        if a['componentType'] != 5126 or v['buffer'] != 0 or a.get('sparse'):
            raise ValueError('Canaux glTF flottants non comprimés attendus')
        at = base + v.get('byteOffset', 0) + a.get('byteOffset', 0)
        return [struct.unpack_from('<'+'f'*n, data, at+i*v.get('byteStride', n*4)) for i in range(a['count'])]

    nodes = doc['nodes']
    animation = doc['animations'][0]
    tracks = {}
    time_input = animation['samplers'][0]['input']
    temps = [v[0] for v in lire(time_input)]
    for channel in animation['channels']:
        sampler = animation['samplers'][channel['sampler']]
        if sampler['input'] != time_input or sampler.get('interpolation', 'LINEAR') != 'LINEAR':
            raise ValueError('Ce squelette demande un rééchantillonnage de ses canaux.')
        tag = channel['target']
        tracks[tag['node'], tag['path']] = lire(sampler['output'])
    racines = doc['scenes'][doc.get('scene', 0)]['nodes']

    def frame(i):
        points = {}

        def monde(j, origin, orientation):
            node = nodes[j]
            r = tracks.get((j, 'rotation'))
            t = tracks.get((j, 'translation'))
            if 'matrix' in node or 'scale' in node or (j, 'scale') in tracks:
                raise ValueError('Squelette rigide avec transformations TR attendu.')
            offset = tourner(orientation, t[i] if t else node.get('translation', (0., 0., 0.)))
            p = tuple(a+b for a, b in zip(origin, offset))
            q = produit(orientation, r[i] if r else node.get('rotation', IDENTITE))
            points[node['name']] = p
            for child in node.get('children', []):
                monde(child, p, q)

        for root in racines:
            monde(root, (0., 0., 0.), IDENTITE)
        return points
    return temps, [frame(i) for i in range(len(temps))]


def articulations(points):
    # Dans la pose CMU, +X va vers la hanche gauche et +Z vers l'avant.
    gauche = difference(points['lfemur'], points['rfemur'])
    norme = math.hypot(gauche[0], gauche[2])
    fx, fz = -gauche[2]/norme, gauche[0]/norme
    valeurs = []
    for racine, milieu, bout in [('femur', 'tibia', 'foot'), ('humerus', 'radius', 'wrist')]:
        for cote in 'lr':
            a = difference(points[cote+milieu], points[cote+racine])
            b = difference(points[cote+bout], points[cote+milieu])
            sagittal = math.atan2(fx*a[0]+fz*a[2], -a[1])
            cosinus = sum(x*y for x,y in zip(a,b))/(math.hypot(*a)*math.hypot(*b))
            valeurs.extend((sagittal, math.acos(max(-1., min(1., cosinus)))))
    return valeurs


def poids_appui(temps, points, debut, fin, pas):
    # La cote du plateau monte légèrement dans la capture de marche. Estimer la
    # ligne du sol entre deux phases homologues avant de comparer chaque pointe.
    duree = temps[fin]-temps[debut]
    poids = []
    for cote in 'lr':
        pointe = cote+'toes'
        derive = points[fin][pointe][1]-points[debut][pointe][1]
        hauteurs = [points[i][pointe][1]-derive*(temps[i]-temps[debut])/duree for i in range(debut, fin+1)]
        sol = min(hauteurs)
        valeurs = []
        for i in range(debut, fin+1, pas):
            a, b = max(0,i-1), min(len(temps)-1,i+1)
            # L'appui peut pivoter du talon à l'avant-pied.
            vitesse = min(math.hypot(*(points[b][j][axe]-points[a][j][axe] for axe in (0,2)))
                          for j in (pointe, cote+'foot'))/(temps[b]-temps[a])
            vitesse_appui = max(0., min(1., (.55-vitesse)/.35))
            sol_appui = max(0., min(1., (.085-(hauteurs[i-debut]-sol))/.05))
            valeurs.append(round(255*vitesse_appui*sol_appui))
        valeurs[0] = valeurs[-1] = round((valeurs[0]+valeurs[-1])/2)
        poids.append(valeurs)
    return list(zip(*poids))


def extraire(temps, points, debut, fin, pas, boucle):
    if debut < 0 or fin <= debut or fin >= len(temps) or pas < 1 or (fin-debut) % pas:
        raise ValueError('Intervalle inclusif invalide ou incompatible avec le pas.')
    poses = [articulations(p) for p in points[debut:fin+1:pas]]
    if boucle:
        # Répartir uniquement le petit écart de raccord sur les deux bords du cycle.
        # Le centre de la capture reste intact, le dernier échantillon répète le premier.
        taille = min(3, (len(poses)-1)//2)
        for j in range(8):
            ecart = (poses[-1][j]-poses[0][j])*.5
            for k in range(taille):
                poids = (1-k/taille)**2
                poses[k][j] += poids*ecart
                poses[-1-k][j] -= poids*ecart
    depart, arrivee = points[debut]['root'], points[fin]['root']
    extrait = {'duree':round(temps[fin]-temps[debut], 6),
               'distance':round(math.hypot(arrivee[0]-depart[0], arrivee[2]-depart[2]), 5),
               'angles':[round(v*1000) for p in poses for v in p]}
    if boucle:
        extrait['appuis'] = [v for paire in poids_appui(temps,points,debut,fin,pas) for v in paire]
    return extrait


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    groupe = parser.add_mutually_exclusive_group(required=True)
    groupe.add_argument('--catalogue', nargs='?', const='', metavar='RECHERCHE')
    groupe.add_argument('--clip', metavar='ID')
    groupe.add_argument('--jeu', action='store_true')
    parser.add_argument('--dossier', type=Path, help='Cache des sources, utilisable hors ligne une fois rempli')
    parser.add_argument('--debut', type=int, default=0, help='Indice de trame source, origine zéro')
    parser.add_argument('--fin', type=int)
    parser.add_argument('--pas', type=int, default=1)
    parser.add_argument('--boucle', action='store_true')
    parser.add_argument('--sortie', type=Path)
    opt = parser.parse_args()
    if opt.catalogue is not None:
        catalogue = lire_fichier(opt.dossier, 'metadata.jsonl', SOURCE+'/metadata.jsonl')
        for line in catalogue.splitlines():
            item = json.loads(line)
            libelles = [item.get(k) or '' for k in ('id', 'title', 'category', 'subcategory', 'subject_summary')]
            if opt.catalogue.casefold() in ' '.join(libelles).casefold():
                print(item['id'], item['seconds'], item.get('title') or '', sep='\t')
        return
    if opt.clip:
        t, p = clip(opt.dossier, opt.clip)
        rendu = extraire(t,p,opt.debut,opt.fin if opt.fin is not None else len(p)-1,opt.pas,opt.boucle)
        texte = json.dumps(rendu, separators=(',', ':'))+'\n'
    else:
        if not opt.sortie:
            parser.error('--jeu nécessite --sortie')
        valeurs = {}
        for cle, identifiant, debut, fin, pas, boucle in SELECTION:
            t, p = clip(opt.dossier, identifiant)
            valeurs[cle] = extraire(t,p,debut,fin,pas,boucle)
        texte = '/* Données de mouvement CMU adaptées par BITUME. Générées par tools/preparer-mouvements-stand.py. */\n'
        texte += 'globalThis.BITUME = globalThis.BITUME || {};\nBITUME.donneesMouvementsStand = '+json.dumps(valeurs,separators=(',',':'))+';\n'
    if opt.sortie:
        opt.sortie.write_text(texte, encoding='utf-8')
    else:
        print(texte, end='')


# Indices 0-based à 60 Hz. Marche : milieu d'appui gauche à milieu d'appui
# gauche suivant. Squat : départ debout jusqu'à la profondeur de travail du cric.
SELECTION = [('marche', MARCHE, 35, 100, 1, True), ('accroupissement', SQUAT, 42, 90, 2, False)]
if __name__ == '__main__':
    main()
