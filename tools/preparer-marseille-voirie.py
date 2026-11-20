#!/usr/bin/env python3
"""Sources Marseille : corridor ouvert et axes BD TOPO, hors reseau et sans route de jeu."""
import argparse
from collections import Counter
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import sys

sys.dont_write_bytecode = True
TOOLS = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('voirie_p05_shared', TOOLS / 'preparer-monaco-voirie.py')
ROAD = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ROAD)
DIRECTORY = TOOLS.parent / 'docs/references/marseille-2026'
OUTPUTS = ('voirie-corridor-p05.json', 'voirie-corridor-p05.md')
ROAD_NATURES = {'Route à 1 chaussée', 'Route à 2 chaussées', 'Type autoroutier', 'Bretelle', 'Rond-point'}


def load(directory, name):
    return json.loads(ROAD.METRIC.local_path(directory, name).read_text(encoding='utf-8'))


def projection(grille):
    """Repere EMPRISE local lineaire archive, PAS la projection ECEF de Monaco."""
    repere = grille['repere']
    origin, kx, kz = repere['origine'], repere['kx_m_par_degre'], repere['kz_m_par_degre']
    if not all(ROAD.finite(v) for v in (origin['lon'], origin['lat'], kx, kz)) or min(kx, kz) <= 0:
        raise ValueError('Repere Marseille invalide')
    return (lambda p: ((p['lon'] - origin['lon']) * kx, -(p['lat'] - origin['lat']) * kz)), repere


def corridor(coeur, selection, grid, query):
    if not isinstance(selection, list) or not selection:
        raise ValueError('Selection de voies absente')
    seen, segments, points, total = set(), [], [], 0
    for item in selection:
        if (not isinstance(item, list) or len(item) != 2 or type(item[0]) is not int
                or type(item[1]) is not int or item[1] not in (-1, 1) or item[0] in seen
                or not 0 <= item[0] < len(coeur['rues'])):
            raise ValueError('Selection de voie invalide ou repetee')
        index, direction = item
        seen.add(index)
        street = coeur['rues'][index]
        flat = street['points']
        if len(flat) < 4 or len(flat) % 2 or not all(ROAD.finite(v) for v in flat):
            raise ValueError('Polyligne EMPRISE invalide')
        if direction == -1 and street['sens'] != 0:
            raise ValueError('Inversion contredit sens source')
        line = [flat[i:i + 2] for i in range(0, len(flat), 2)][::direction]
        if points and line[0] != points[-1]:
            raise ValueError('Raccord X/Z absent : aucune liaison inventee')
        length = sum(math.dist(a, b) for a, b in zip(line, line[1:]))
        total += length
        segments.append({'indexRue': index, 'sourceLocator': f'coeur.json#/donnees/rues/{index}',
                         'sourceName': street['nom'], 'sourceClass': street['classe'],
                         'sourceDirection': street['sens'], 'orientation': direction,
                         'sourceLevel': street['niveau'], 'sourceBridge': street['pont'],
                         'pointsXZ': line, 'sourcePolylineLengthM': length,
                         'selectedRoadAxisId': None, 'roadAltitudeM': None,
                         'leftWidthM': None, 'rightWidthM': None, 'bankRadians': None})
        points.extend(line if not points else line[1:])
    if points[0] == points[-1]:
        raise ValueError('Cette proposition doit rester ouverte')
    margin = query['marginM']
    if not ROAD.finite(margin) or margin < 0 or query.get('marginIsSurveyAccuracy') is not False:
        raise ValueError('Marge documentaire invalide')
    _, repere = projection(grid)
    o, kx, kz = repere['origine'], repere['kx_m_par_degre'], repere['kz_m_par_degre']
    bounds = [min(p[0] for p in points) - margin, min(p[1] for p in points) - margin,
              max(p[0] for p in points) + margin, max(p[1] for p in points) + margin]
    bbox = [round(o['lon'] + bounds[0] / kx, 9), round(o['lat'] - bounds[3] / kz, 9),
            round(o['lon'] + bounds[2] / kx, 9), round(o['lat'] - bounds[1] / kz, 9)]
    if bbox != query['bboxLonLat'] or bounds != query['localBoundsXZ']:
        raise ValueError('Emprise de requete non reproductible depuis le corridor')
    return {'status': 'proposition_reconnaissance_non_choisie_comme_course', 'closed': False,
            'exactXZJoins': len(segments) - 1, 'startXZ': points[0], 'endXZ': points[-1],
            'sourcePolylineLengthM': total, 'lengthIsCertifiedCourseLength': False,
            'roadLevelsConfirmed': False, 'raceDirectionSelected': False,
            'segments': segments, 'queryBboxLonLat': bbox}


def prepare(directory):
    m = load(directory, 'sources-voirie-corridor-p05.json')
    if (m.get('format') != 'bitume-marseille-road-sources' or m.get('version') != 1
            or m.get('readyForRuntime') is not False):
        raise ValueError('Manifeste Marseille inattendu')
    for dep in m['preparationDependencies']['tools']:
        path = ROAD.METRIC.local_path(TOOLS, dep['file'])
        if hashlib.sha256(path.read_bytes()).hexdigest() != dep['sha256']:
            raise ValueError('Dependance de preparation modifiee : ' + dep['file'])
    inputs = m['historicInputs']
    if {e['file'] for e in inputs} != {'sources.json', 'coeur.json', 'inventaire.json', 'grille.json', 'qualification.json'}:
        raise ValueError('Entrees historiques incompletes')
    for e in inputs:
        ROAD.METRIC.checked_bytes(directory, e)
    for e in load(directory, 'sources.json')['fichiers']:
        ROAD.METRIC.checked_bytes(directory, {'file': e['fichier'], 'bytes': e['octets'], 'sha256': e['sha256']})
    coeur, grid = load(directory, 'coeur.json'), load(directory, 'grille.json')
    if coeur['provenance']['commit'] != m['sourceEmpriseCommit'] or coeur['donnees']['centre'] != grid['repere']['origine']:
        raise ValueError('Provenance ou origine Marseille incoherente')
    c = corridor(coeur['donnees'], m['corridorSelection'], grid, m['query'])
    project, repere = projection(grid)
    axes, endpoints, sources, seen_ids, seen_paths, geometries = [], [], [], set(), set(), {}
    for source in m['sources']:
        if source['id'] in seen_ids or source['file'] in seen_paths:
            raise ValueError('Source dupliquee')
        seen_ids.add(source['id']); seen_paths.add(source['file'])
        if (source.get('horizontalCoordinateOrder') != 'longitude,latitude'
                or source.get('featureKind') not in ('road_axis', 'linear_construction_axis')
                or source.get('individualMeasurementDate', 'missing') is not None
                or source.get('verticalDatum', 'missing') is not None):
            raise ValueError('Semantique date/datum/axes non qualifiee')
        if source['bbox'] != c['queryBboxLonLat'] or source['httpStatus'] != 200:
            raise ValueError('Acquisition hors emprise ou non reussie')
        raw = ROAD.METRIC.checked_bytes(directory, source)
        features = ROAD.validate_collection(json.loads(raw))
        if any(source.get(k) != len(features) for k in ('numberMatched', 'numberReturned', 'featureCount')):
            raise ValueError('Comptes source incoherents')
        sources.append({'file': source['file'], 'sha256': source['sha256'], 'bytes': len(raw), 'count': len(features)})
        for i, feature in enumerate(features):
            a = ROAD.inspect_axis(feature, source, i, project)
            vertices, p = a.pop('vertices'), a['properties']
            reasons = []
            if source['featureKind'] == 'road_axis' and p.get('nature') not in ROAD_NATURES:
                reasons.append('not_motor_road_class')
            if p.get('fictif') is True:
                reasons.append('fictitious_source_axis')
            a.update(sourceFile=source['file'], sourceVertexCount=len(vertices),
                     excludedFromRoadReview=bool(reasons), roadExclusions=reasons,
                     sourceZExcludedVertexIndices=[v['index'] for v in vertices if v['exclusions']],
                     sourceZExclusionReasons=sorted({r for v in vertices for r in v['exclusions']}),
                     sourceWidthRaw=p.get('largeur_de_chaussee'), roadAltitudeM=None,
                     leftWidthM=None, rightWidthM=None)
            if reasons:
                a['validSourceZRangeM'] = None
            axes.append(a)
            key = json.dumps(feature['geometry']['coordinates'], separators=(',', ':'))
            geometries.setdefault(key, []).append(a['id'])
            if source['featureKind'] == 'linear_construction_axis' and p['nature'] == 'Tunnel':
                for v in (vertices[0], vertices[-1]):
                    adjacent = 0 if v['index'] == 0 else v['index'] - 1
                    endpoints.append({'axisId': a['id'], 'sourceLocator': a['locator'] + f'.geometry.coordinates[{v["index"]}]',
                                      'sourceFile': source['file'], 'vertexIndex': v['index'],
                                      'lon': v['lon'], 'lat': v['lat'], 'sourceZM': v['sourceZM'],
                                      'usableSourceZM': v['interpolationZM'], 'x': v['x'], 'z': v['z'],
                                      'confirmedCircuitPortal': False, 'circuitClearanceM': None,
                                      'adjacentSourceSegmentWarnings': [s for s in a['sourceGradeSegmentsToReview'] if s['segmentIndex'] == adjacent]})
    endpoint_counts = Counter((e['lon'], e['lat'], e['sourceZM']) for e in endpoints)
    for e in endpoints:
        e['sameXYZEndpointOccurrences'] = endpoint_counts[e['lon'], e['lat'], e['sourceZM']]
    roads = [a for a in axes if a['kind'] == 'road_axis']
    report = {'format': 'bitume-marseille-road-review', 'version': 1, 'readyForRuntime': False, 'networkUsed': False,
              'sourceEmpriseCommit': m['sourceEmpriseCommit'], 'historicInputs': inputs, 'sources': sources,
              'projection': repere, 'corridor': c,
              'summary': {'sourceFeatures': len(axes), 'roadAxes': len(roads), 'constructionAxes': len(axes) - len(roads),
                          'roadAxesWithExcludedZ': sum(bool(a['sourceZExcludedVertexIndices']) for a in roads),
                          'excludedNonRoadOrFictitiousAxes': sum(a['excludedFromRoadReview'] for a in roads),
                          'sourceLevelsRoads': dict(Counter(str(a['properties'].get('position_par_rapport_au_sol')) for a in roads)),
                          'tunnelEndpointRecords': len(endpoints), 'confirmedPortals': 0},
              'axes': axes, 'tunnelSourceEndpoints': endpoints,
              'sameGeometryRecords': [{'axisIds': ids, 'independentCorroboration': False} for ids in geometries.values() if len(ids) > 1],
              'sourceGradeReview': {'threshold': ROAD.GRADE_REVIEW_THRESHOLD, 'thresholdIsPhysicsLimit': False,
                                    'purpose': 'Variations numeriques des axes, aucune pente de jeu ni correction.'},
              'unknowns': m['unknowns'], 'attribution': m['attribution']}
    s = report['summary']
    md = f'''# Marseille — corridor ouvert et voirie BD TOPO

Sous-lot sources uniquement. EMPRISE `{m['sourceEmpriseCommit']}` reste la carte de référence.
Le corridor est une proposition de reconnaissance : **{len(c['segments'])} polylignes**, **{c['exactXZJoins']} raccords X/Z exacts**,
**{c['sourcePolylineLengthM']:.3f} m de géométrie 2D source**. Cette longueur n'est pas une mesure de course.
Les deux extrémités touchent x = −610 m ; aucune fermeture ni liaison nouvelle n'est inventée.

## Acquisition et inventaire

Les captures WFS sont complètes : **{s['roadAxes']} tronçons routiers**, **{s['constructionAxes']} constructions linéaires**.
L'emprise est calculée depuis les voies sélectionnées avec une marge documentaire de {m['query']['marginM']} m ;
cette marge ne mesure aucune précision. Les objets source complets peuvent sortir de cette emprise.
URLs, paramètres, heures HTTP, tailles et empreintes : `sources-voirie-corridor-p05.json`.
Les sources déjà closes et les dérivés historiques sont vérifiés mais jamais réécrits.

**{s['roadAxesWithExcludedZ']} axes routiers portent des Z exclus** par précision absente/9999 ou méthode « Pas de Z ».
**{s['excludedNonRoadOrFictitiousAxes']} axes** sont écartés de la revue de chaussée : sentiers, escaliers, liaisons maritimes ou axes fictifs.
Les attributs bruts et localisateurs restent dans `voirie-corridor-p05.json` ; aucune valeur absente ne devient zéro.
Les largeurs BD TOPO restent indicatives ; aucune division par deux ne crée des limites gauche/droite.
Le niveau `position_par_rapport_au_sol` reste ordinal, sans conversion en mètres.

Les {s['tunnelEndpointRecords']} extrémités de segments Tunnel sont des objets à examiner, **zéro portail confirmé**.
Les extrémités communes sont comptées explicitement : une coupure d'objet ne devient pas automatiquement un portail.
Les variations Z fortes sont signalées dans `sourceGradeSegmentsToReview`, sans correction ni sélection de niveau.
Il n'y a pas encore de rapprochement axe/corridor : aucune altitude n'est interpolée sur la proposition EMPRISE.
Date de mesure, datum individuel, dévers, limites de course et gabarits restent inconnus.

## Reproduction

```sh
python3 tools/preparer-marseille-voirie.py --check
node --test verifications/marseille-voirie.test.mjs
```

Le préparateur réemploie le validateur de propriétés BD TOPO du lot Monaco, **avec le repère linéaire Marseille archivé**.
Il n'utilise ni la projection ECEF Monaco ni une fonction de hauteur de terrain.
**Dépendance : intégrer 05A (`466afcd`, arbre `836336ed`) avant ce sous-lot.** Les cinq outils lus sont épinglés par empreinte.
Suite : identifier les voies/niveaux correspondants, confirmer les surfaces et limites puis rechercher une fermeture sourcée.
Raccords 00/04 uniquement après données suffisantes ; aucun runtime ou build modifié.

Attributions : © IGN, BD TOPO, Licence Ouverte 2.0 ; © les contributeurs d'OpenStreetMap, ODbL 1.0.
Référence de classe : descriptif officiel BD TOPO 3.5, juillet 2026, sections et URL dans le manifeste.
'''
    return {OUTPUTS[0]: ROAD.encode(report), OUTPUTS[1]: md}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, default=DIRECTORY)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    outputs = prepare(args.directory)
    paths = {name: ROAD.METRIC.local_path(args.directory, name) for name in outputs}
    for name, content in outputs.items():
        if args.check:
            if paths[name].read_text(encoding='utf-8') != content:
                raise ValueError('Sortie differente : ' + name)
        else:
            paths[name].write_text(content, encoding='utf-8')
    print('Marseille : corridor ouvert et inventaire voirie verifies hors reseau ; aucune route de jeu produite.')


if __name__ == '__main__':
    main()
