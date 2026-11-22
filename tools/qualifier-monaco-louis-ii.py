#!/usr/bin/env python3
"""Compare en plan les deux galeries voisines du tracé OSM, et examine leurs raccords IGN."""
import argparse
import importlib.util
import json
import math
from pathlib import Path
import sys

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('voirie', Path(__file__).with_name('preparer-monaco-voirie.py'))
voirie = importlib.util.module_from_spec(spec)
spec.loader.exec_module(voirie)
LOUIS_II = 'TRONROUT0000000074274447'
VOISIN = 'TRONROUT0000000074274448'
SORTIE = 'louis-ii-raccords.json'


def charger_axes(directory, project):
    manifest = json.loads(voirie.METRIC.local_path(directory, 'sources-louis-ii.json').read_bytes())
    if manifest['schema'] != 'bitume-monaco-louis-ii-sources-v1':
        raise ValueError('Manifeste Louis-II inconnu')
    axes = {}
    for source in manifest['sources']:
        capture = json.loads(voirie.METRIC.checked_bytes(directory, source))
        features = voirie.validate_collection(capture)
        if len(features) != source['numberMatched'] or capture['timeStamp'] != source['responseTimeStamp']:
            raise ValueError('Reçu incohérent pour ' + source['id'])
        for index, feature in enumerate(features):
            axis = voirie.inspect_axis(feature, source, index, project)
            key = axis['cleabs']
            if key in axes:
                if axis['vertices'] != axes[key]['vertices'] or axis['properties'] != axes[key]['properties']:
                    raise ValueError('Deux versions de la même voie dans les captures : ' + key)
                continue
            axes[key] = axis
    return axes


def raccords(axis, index, axes):
    sommet = axis['vertices'][index]
    r = []
    for voisin in axes.values():
        if voisin['cleabs'] == axis['cleabs']:
            continue
        for extremite in (voisin['vertices'][0], voisin['vertices'][-1]):
            if (sommet['lat'], sommet['lon']) != (extremite['lat'], extremite['lon']):
                continue
            z, zv = sommet['interpolationZM'], extremite['interpolationZM']
            ecart = None if z is None or zv is None else round(zv - z, 3)
            prop = voisin['properties']
            r.append({'cleabs': voisin['cleabs'], 'vertex': extremite['index'],
                      'name': prop['nom_collaboratif_gauche'], 'relativeLevel': prop['position_par_rapport_au_sol'],
                      'zSourceM': zv, 'deltaZSourceM': ecart})
    return {'vertex': sommet['index'], 'lon': sommet['lon'], 'lat': sommet['lat'],
            'zSourceM': sommet['interpolationZM'], 'coincidentEndpointsXY': sorted(r, key=lambda a: a['cleabs'])}


def comparer_arete(a, b, principal, concurrent):
    """Les distances aux polylignes sont 1-lipschitziennes dans le repère plan commun."""
    longueur = math.hypot(b['x'] - a['x'], b['z'] - a['z'])
    n = max(1, math.ceil(longueur))
    pas = longueur / n
    ecarts = []
    for k in range(n + 1):
        pos = {p: a[p] + (b[p] - a[p]) * k / n for p in ('x', 'z')}
        d_route = voirie.nearest_on_axis(pos, principal)['distanceM']
        d_voisin = voirie.nearest_on_axis(pos, concurrent)['distanceM']
        ecarts.append(d_voisin - d_route)
    # Tout point est à moins d'un demi-pas d'un échantillon de cette arête.
    # Leur différence peut donc perdre au plus un pas entre deux mesures.
    # Arrondir la borne vers le bas pour ne pas rendre une séparation plus favorable.
    return {'osmEdge': a['index'], 'intervals': n,
            'lowerBoundMarginM': math.floor((min(ecarts) - pas) * 1000) / 1000}


def qualifier(directory):
    _, data, _, _ = voirie.METRIC.load(directory)
    axes = charger_axes(directory, voirie.GEOMETRY.projection(data['origin']))
    principale, autre = axes[LOUIS_II], axes[VOISIN]
    section, = [s for s in data['tunnelTags'] if 4230891 in s['osmWayIds']]
    p = data['points']
    aretes = [comparer_arete(p[i], p[i + 1], principale, autre)
              for i in range(section['firstEdgeIndex'], section['lastEdgeIndex'] + 1)]
    return {'format': 'bitume-monaco-louis-ii-v1',
            'osmEdges': aretes, 'minimumLowerBoundMarginM': min(a['lowerBoundMarginM'] for a in aretes),
            'marginDefinition': 'dXY to neighbouring axis minus dXY to Louis II, along the OSM polyline',
            'axes': [{'cleabs': axe['cleabs'], 'endpointsInSourceOrder': [raccords(axe, i, axes) for i in (0, -1)],
                      # La projection ECEF dépend de libm. Publier les grandeurs
                      # dérivées avec une précision explicite, après le tri des
                      # segments. Les coordonnées et Z acquis restent intacts.
                      'sourceGradeSegmentsToReview': [
                          {**s, 'horizontalLengthM': round(s['horizontalLengthM'], 6),
                           'sourceGrade': round(s['sourceGrade'], 6)}
                          for s in axe['sourceGradeSegmentsToReview']]}
                     for axe in (principale, autre)],
            'uniqueRoadObjects': len(axes), 'readyForRuntime': False,
            'roadSurfaceSurveyDate': None, 'roadAltitudeDatum': None, 'measuredRacePortals': None}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--directory', type=Path, default=voirie.DIRECTORY)
    args = parser.parse_args()
    result = qualifier(args.directory)
    raw = voirie.encode(result).encode('utf-8')
    path = voirie.METRIC.local_path(args.directory, SORTIE)
    if args.check:
        if path.read_bytes() != raw:
            sys.exit('Résultat Louis-II différent')
    else:
        path.write_bytes(raw)
    print(f"{len(result['osmEdges'])} arêtes, marge minimale garantie dans le plan des sources : "
          f"{result['minimumLowerBoundMarginM']} m")
