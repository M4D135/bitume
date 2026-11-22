#!/usr/bin/env python3
"""Compare la voirie, les MNT et l'ortho à la limite du couvert Louis-II, hors ligne."""
import argparse
import importlib.util
import json
import math
from pathlib import Path
import sys
from urllib.parse import parse_qs, urlparse

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('louis', Path(__file__).with_name('qualifier-monaco-louis-ii.py'))
louis = importlib.util.module_from_spec(spec)
spec.loader.exec_module(louis)
metric = louis.voirie.METRIC
DEFAUT = Path(__file__).resolve().parents[1] / 'docs/references/monaco-2026'
OFFSETS = (-5, -2, 0, 2, 5)
RUE = 'TRONROUT0000000074274460'


def stations(axes):
    tunnel, exterieur = axes[louis.LOUIS_II]['vertices'], axes[RUE]['vertices']
    if (tunnel[0]['lon'], tunnel[0]['lat']) != (exterieur[-1]['lon'], exterieur[-1]['lat']):
        raise ValueError('Les extrémités publiées ne se raccordent pas')
    a, b = tunnel[:2]
    # Même conversion locale que la requête archivée. Ces déports sont approximatifs.
    est, nord = 80545, 111111
    dx, dy = (b['lon'] - a['lon']) * est, (b['lat'] - a['lat']) * nord
    longueur = math.hypot(dx, dy)
    lignes = [('E2', exterieur[-3]), ('E1', exterieur[-2])]
    lignes += [(f'T{k}', p) for k, p in enumerate(tunnel[:7])]
    for nom, pt in lignes:
        xy = [(round(pt['lon'] - dy / longueur * d / est, 8),
               round(pt['lat'] + dx / longueur * d / nord, 8)) for d in OFFSETS]
        yield nom, pt, xy


def observations(document, echantillons, titre):
    valeurs = document.get('elevations', [])
    if len(valeurs) != len(echantillons):
        raise ValueError('Nombre de mesures différent du nombre de points demandés')
    resultat = []
    for v, xy in zip(valeurs, echantillons):
        if (v['lon'], v['lat']) != xy:
            raise ValueError('Coordonnées de réponse incohérentes avec la coupe')
        terres = [m for m in v['measures'] if m.get('title') == titre and m['z'] != -99999]
        if len(terres) != 1 or not math.isfinite(terres[0]['z']) or terres[0]['z'] != v['z']:
            raise ValueError('Mesure valide du territoire métropolitain introuvable')
        resultat.append(terres[0]['z'])
    return resultat


def qualifier(directory):
    _, data, _, _ = metric.load(directory)
    proj = louis.voirie.GEOMETRY.projection(data['origin'])
    axes = louis.charger_axes(directory, proj)
    lignes = list(stations(axes))
    xy = [p for _, _, coupe in lignes for p in coupe]
    manifest = json.loads((directory / 'sources-portail.json').read_bytes())
    pieces = {s['id']: s for s in manifest['sources']}
    raw = {k: metric.checked_bytes(directory, s) for k, s in pieces.items()}
    terrain = {k: observations(json.loads(raw[k]), xy, titre) for k, titre in [
        ('lidar', 'IGN - LIDAR HD - MNT - France Métropolitaine (dont Corse)- sans interpolation'),
        ('rge', 'RGE Alti 1m : France métropolitaine + Corse')]}
    q = parse_qs(urlparse(pieces['ortho']['url']).query)
    if q['CRS'] != ['CRS:84'] or q['LAYERS'] != ['ORTHOIMAGERY.ORTHOPHOTOS'] or not raw['ortho'].startswith(b'\xff\xd8'):
        raise ValueError('Image ou référentiel inattendu')
    xmin, ymin, xmax, ymax = map(float, q['BBOX'][0].split(','))
    w, h = int(q['WIDTH'][0]), int(q['HEIGHT'][0])
    coupes = []
    for k, (nom, pt, _) in enumerate(lignes):
        intervalle = slice(k * len(OFFSETS), (k + 1) * len(OFFSETS))
        px = ((pt['lon'] - xmin) * w / (xmax - xmin), (ymax - pt['lat']) * h / (ymax - ymin))
        coupes.append({'id': nom, 'crs84': [pt['lon'], pt['lat']], 'zVoirieM': pt['sourceZM'],
                       'indicesReponses': [intervalle.start, intervalle.stop - 1],
                       'pixelOrthoDepuisBordHautGauche': [round(p, 2) for p in px]
                       if 0 <= px[0] < w and 0 <= px[1] < h else None,
                       'mntLidarM': terrain['lidar'][intervalle], 'rgeAltiM': terrain['rge'][intervalle]})
    graphe = json.loads(raw['graphe'])
    rn = json.loads(raw['rn'])
    for doc in (graphe, rn):
        if not len(doc['features']) == doc['numberMatched'] == doc['numberReturned']:
            raise ValueError('Emprise IGN incomplète')
    t0 = axes[louis.LOUIS_II]['vertices'][0]
    niveaux = []
    for f in rn['features']:
        p = f['properties']
        if p['id'] not in {d['id'] for d in manifest['fichesDeNivellement']}:
            continue
        lon, lat = f['geometry']['coordinates']
        horizontal = math.dist(proj({'lon': lon, 'lat': lat}), (t0['x'], t0['z']))
        niveaux.append({'id': p['id'], 'matricule': p['nom'], 'altitudeDuRepereM': float(p['altitude']),
                        'crs84LocalisationIndicative': [lon, lat], 'distanceIndicativeAuRaccordM': round(horizontal)})
    return {'format': 'bitume-monaco-portail-v1', 'readyForRuntime': False, 'altitudeCourse2026M': None,
            'distanceHorizontaleT0T1M': round(math.dist((t0['x'], t0['z']),
               (axes[louis.LOUIS_II]['vertices'][1]['x'], axes[louis.LOUIS_II]['vertices'][1]['z'])), 3),
            'deportsApproximatifsM': list(OFFSETS), 'coupes': coupes,
            'datesVolDansEmprise': sorted({f['properties']['date_vol'] for f in graphe['features']}),
            'reperesDeNivellementDistincts': sorted(niveaux, key=lambda n: n['id'])}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, default=DEFAUT)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    sortie = args.directory / 'louis-ii-portail.json'
    brut = (json.dumps(qualifier(args.directory), ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode()
    if args.check:
        if sortie.read_bytes() != brut:
            sys.exit('Résultat du portail différent des acquisitions figées')
    else:
        sortie.write_bytes(brut)
    print('Louis-II : neuf coupes de cinq points, deux MNT, orthophoto et repères de nivellement.')
