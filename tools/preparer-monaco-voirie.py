#!/usr/bin/env python3
"""Confronte les axes BD TOPO aux inconnues Monaco, hors reseau et sans runtime.

Les projections servent a examiner les candidats, jamais a choisir une voie,
un niveau ou une cote routiere. Les captures historiques sont seulement lues.
"""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import sys

sys.dont_write_bytecode = True
TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
spec = importlib.util.spec_from_file_location('monaco_revue_p05', TOOLS / 'preparer-monaco-revue.py')
REVIEW = importlib.util.module_from_spec(spec)
spec.loader.exec_module(REVIEW)
METRIC, GEOMETRY = REVIEW.METRIC, REVIEW.GEOMETRY
DIRECTORY = TOOLS.parent / 'docs/references/monaco-2026'
OUTPUTS = ('voirie-p05.json', 'voirie-p05.md')
MISSING_ACCURACY = 9999  # BD TOPO 3.5, precision: objet sans Z.
GRADE_REVIEW_THRESHOLD = 0.35  # Tri documentaire, aucune regle physique.


def encode(value):
    return json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n'


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def positive_or_none(value):
    return value if finite(value) and 0 < value < MISSING_ACCURACY else None


def validate_collection(document):
    if not isinstance(document, dict) or document.get('type') != 'FeatureCollection':
        raise ValueError('FeatureCollection attendue')
    features = document.get('features')
    if not isinstance(features, list):
        raise ValueError('Features absentes')
    for field in ('numberMatched', 'numberReturned'):
        if type(document.get(field)) is not int or document[field] != len(features):
            raise ValueError('Reponse incomplete ou compte inconnu : ' + field)
    crs = document.get('crs', {}).get('properties', {}).get('name')
    if crs != 'urn:ogc:def:crs:EPSG::4326':
        raise ValueError('CRS horizontal inattendu')
    ids = set()
    for feature in features:
        if not isinstance(feature, dict) or feature.get('type') != 'Feature':
            raise ValueError('Feature invalide')
        props = feature.get('properties')
        cleabs = props.get('cleabs') if isinstance(props, dict) else None
        if not isinstance(cleabs, str) or not cleabs or cleabs in ids:
            raise ValueError('Identifiant absent ou duplique')
        ids.add(cleabs)
    return features


def inspect_axis(feature, source, feature_index, project):
    geometry, props = feature.get('geometry', {}), feature['properties']
    if geometry.get('type') != 'LineString':
        raise ValueError('Axe LineString attendu : ' + props['cleabs'])
    coordinates = geometry.get('coordinates')
    if not isinstance(coordinates, list) or len(coordinates) < 2:
        raise ValueError('Axe insuffisant')
    no_data = source.get('noDataZValues', [])
    if not isinstance(no_data, list) or not all(finite(n) for n in no_data):
        raise ValueError('Sentinelles declarees invalides')
    accuracy = positive_or_none(props.get('precision_altimetrique'))
    method = props.get('methode_d_acquisition_altimetrique')
    no_z_method = isinstance(method, str) and method.casefold().strip() == 'pas de z'
    vertices = []
    for i, coordinate in enumerate(coordinates):
        if (not isinstance(coordinate, list) or len(coordinate) not in (2, 3)
                or not all(finite(n) for n in coordinate[:2])
                or not -180 <= coordinate[0] <= 180 or not -90 <= coordinate[1] <= 90):
            raise ValueError('Coordonnee horizontale invalide')
        raw_z = coordinate[2] if len(coordinate) == 3 else None
        if raw_z is not None and not finite(raw_z):
            raise ValueError('Z source non fini ou non numerique')
        reasons = []
        if raw_z is None:
            reasons.append('z_missing')
        if raw_z in no_data:
            reasons.append('declared_z_no_data')
        if props.get('precision_altimetrique') == MISSING_ACCURACY or no_z_method:
            reasons.append('source_has_no_z')
        if accuracy is None:
            reasons.append('source_z_accuracy_unknown')
        x, z = project({'lon': coordinate[0], 'lat': coordinate[1]})
        vertices.append({'index': i, 'lon': coordinate[0], 'lat': coordinate[1],
                         'x': x, 'z': z, 'sourceZM': raw_z,
                         'interpolationZM': raw_z if not reasons else None,
                         'exclusions': reasons})
    usable = [v['interpolationZM'] for v in vertices if v['interpolationZM'] is not None]
    abrupt = []
    for i, (a, b) in enumerate(zip(vertices, vertices[1:])):
        if a['interpolationZM'] is None or b['interpolationZM'] is None:
            continue
        length = math.hypot(b['x'] - a['x'], b['z'] - a['z'])
        delta = b['interpolationZM'] - a['interpolationZM']
        if length <= 1e-9 and delta != 0:
            abrupt.append({'segmentIndex': i, 'horizontalLengthM': length, 'sourceDeltaZM': delta,
                           'sourceGrade': None, 'cause': 'unknown',
                           'reason': 'horizontal_length_zero_with_z_change',
                           'isQualifiedRoadGrade': False})
        elif length > 1e-9 and abs(delta / length) > GRADE_REVIEW_THRESHOLD:
            abrupt.append({'segmentIndex': i, 'horizontalLengthM': length, 'sourceDeltaZM': delta,
                           'sourceGrade': delta / length, 'cause': 'unknown', 'reason': 'abrupt_source_grade',
                           'isQualifiedRoadGrade': False})
    return {'id': source['id'] + ':' + props['cleabs'], 'sourceId': source['id'],
            'sourceFeatureId': feature.get('id'), 'cleabs': props['cleabs'],
            'locator': 'features[' + str(feature_index) + ']',
            'kind': source['featureKind'], 'properties': props,
            'individualMeasurementDate': source['individualMeasurementDate'],
            'verticalDatum': source['verticalDatum'],
            'metadataDatesAreMeasurementDates': False,
            'reportedAccuracyM': {'horizontal': positive_or_none(props.get('precision_planimetrique')),
                                  'vertical': accuracy},
            'accuracyMeaning': 'source_estimate_not_a_confidence_bound',
            'raceWidthM': None, 'bankRadians': None,
            'indicativeCarriagewayWidthM': positive_or_none(props.get('largeur_de_chaussee')),
            'widthIsRaceBoundary': False, 'surfaceAndLevelConfirmedForCircuit': False,
            'eligibleForRoadProfile': False, 'vertices': vertices,
            'sourceGradeSegmentsToReview': abrupt,
            'validSourceZRangeM': [min(usable), max(usable)] if usable else None}


def nearest_on_axis(point, axis):
    """Projection orthogonale bornee en plan ; interpolation Z explicitement derivee."""
    candidates = []
    for i, (a, b) in enumerate(zip(axis['vertices'], axis['vertices'][1:])):
        dx, dz = b['x'] - a['x'], b['z'] - a['z']
        squared = dx * dx + dz * dz
        if squared <= 1e-18:
            continue  # Aucun choix vertical sur un segment de longueur horizontale nulle.
        t = max(0, min(1, ((point['x'] - a['x']) * dx + (point['z'] - a['z']) * dz) / squared))
        x, z = a['x'] + t * dx, a['z'] + t * dz
        za, zb = a['interpolationZM'], b['interpolationZM']
        height = None if za is None or zb is None else za + t * (zb - za)
        candidates.append({'distanceM': math.hypot(x - point['x'], z - point['z']),
                           'segmentIndex': i, 'fraction': t, 'projectedX': x, 'projectedZ': z,
                           'sourceAxisZInterpolatedM': height})
    if not candidates:
        return None
    result = min(candidates, key=lambda c: (c['distanceM'], c['segmentIndex']))
    result.update(axisId=axis['id'], cleabs=axis['cleabs'], sourceId=axis['sourceId'],
                  sourceLocator=axis['locator'] + '.geometry.coordinates',
                  kind=axis['kind'], positionRelativeToGround=axis['properties'].get('position_par_rapport_au_sol'),
                  nature=axis['properties'].get('nature'),
                  sourceSegmentNeedsGradeReview=any(s['segmentIndex'] == result['segmentIndex']
                                                    for s in axis['sourceGradeSegmentsToReview']),
                  association='horizontal_screening_only', roadAltitudeM=None,
                  isMeasuredAtOsmPoint=False, eligibleForRoadProfile=False)
    return result


def prepare(directory):
    data, terrain, bilan, inputs = REVIEW.verified_inputs(directory)
    manifest_path = METRIC.local_path(directory, 'sources-voirie-p05.json')
    manifest_raw = manifest_path.read_bytes()
    manifest = json.loads(manifest_raw)
    if (manifest.get('format') != 'bitume-monaco-road-sources' or manifest.get('version') != 1
            or manifest.get('readyForRuntime') is not False):
        raise ValueError('Manifeste voirie inattendu')
    sources = manifest.get('sources')
    radius = manifest.get('screening', {}).get('radiusM')
    if not isinstance(sources, list) or not sources or not finite(radius) or radius <= 0:
        raise ValueError('Sources ou rayon invalides')
    if manifest['screening'].get('radiusIsSurveyAccuracy') is not False:
        raise ValueError('Rayon de recherche confondu avec une precision')
    project = GEOMETRY.projection(data['origin'])
    axes, excluded, seen_ids, seen_paths = [], [], set(), set()
    inputs = [*inputs, {'file': 'sources-voirie-p05.json', 'bytes': len(manifest_raw),
                        'sha256': hashlib.sha256(manifest_raw).hexdigest()}]
    for source in sources:
        sid = source.get('id')
        if not isinstance(sid, str) or not sid or sid in seen_ids:
            raise ValueError('Identifiant source absent ou duplique')
        seen_ids.add(sid)
        path = METRIC.local_path(directory, source['file'])
        if path in seen_paths or source.get('horizontalCoordinateOrder') != 'longitude,latitude':
            raise ValueError('Chemin source duplique ou ordre horizontal inconnu')
        seen_paths.add(path)
        if (source.get('featureKind') not in ('road_axis', 'tunnel_axis')
                or 'individualMeasurementDate' not in source or 'verticalDatum' not in source):
            raise ValueError('Semantique source incomplete')
        # Ce lot ne sait pas valider une preuve individuelle de date/datum.
        if source['individualMeasurementDate'] is not None or source['verticalDatum'] is not None:
            raise ValueError('Date/datum individuel non qualifies par ce preparateur')
        raw = METRIC.checked_bytes(directory, source)
        features = validate_collection(json.loads(raw))
        if any(source.get(k) != len(features) for k in ('numberMatched', 'numberReturned')):
            raise ValueError('Compte du manifeste incoherent')
        inputs.append({'file': source['file'], 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
        for i, feature in enumerate(features):
            if source['featureKind'] == 'tunnel_axis' and feature['properties']['nature'] != 'Tunnel':
                excluded.append({'sourceId': sid, 'locator': 'features[' + str(i) + ']',
                                 'cleabs': feature['properties']['cleabs'], 'reason': 'not_tunnel'})
            else:
                axes.append(inspect_axis(feature, source, i, project))
    review = REVIEW.make_review(data, terrain, bilan, inputs=[])
    priority = {p['index'] for p in review['differencePoints']}
    for edge in review['terrainGradeSegments']:
        priority.update((edge['edgeIndex'], (edge['edgeIndex'] + 1) % len(data['points'])))
    for tunnel in review['tunnelRuns']:
        priority.update(tunnel['pointIndices'])
    gaps = {i for gap in review['untaggedIntervals'] for i in gap['strictInteriorPointIndices']}
    points = []
    for i in sorted(priority | gaps):
        point = data['points'][i]
        matches = [m for axis in axes if (m := nearest_on_axis(point, axis)) is not None and m['distanceM'] <= radius]
        matches.sort(key=lambda m: (m['distanceM'], m['axisId']))
        points.append({'index': i, 'osmNodeId': point['osmNodeId'], 'sM': point['sM'],
                       'lon': point['lon'], 'lat': point['lat'],
                       'priorityReview': i in priority, 'untaggedGapInterior': i in gaps,
                       'selectedAxisId': None, 'roadAltitudeM': None,
                       'leftWidthM': None, 'rightWidthM': None, 'bankRadians': None,
                       'candidates': matches})
    portals = []
    for axis in axes:
        if axis['kind'] != 'tunnel_axis':
            continue
        for v in (axis['vertices'][0], axis['vertices'][-1]):
            adjacent = 0 if v['index'] == 0 else v['index'] - 1
            warnings = [s for s in axis['sourceGradeSegmentsToReview'] if s['segmentIndex'] == adjacent]
            portals.append({'axisId': axis['id'], 'cleabs': axis['cleabs'], 'sourceId': axis['sourceId'],
                            'sourceLocator': axis['locator'] + '.geometry.coordinates[' + str(v['index']) + ']',
                            'vertexIndex': v['index'], 'lon': v['lon'], 'lat': v['lat'],
                            'x': v['x'], 'z': v['z'], 'sourceZM': v['sourceZM'],
                            'usableSourceZM': v['interpolationZM'],
                            'adjacentSourceSegmentNeedsReview': bool(warnings),
                            'adjacentSourceSegmentWarnings': warnings,
                            'interpretation': 'gallery_endpoint_from_source_class',
                            'isIndependentRoadSurvey': False, 'confirmedCircuitPortal': False,
                            'individualMeasurementDate': None, 'verticalDatum': None,
                            'circuitClearanceM': None, 'circuitWidthM': None})
    portal_reviews = []
    for tunnel in review['tunnelRuns']:
        for end in ('entryCandidate', 'exitCandidate'):
            point = tunnel[end]
            ranked = [{**p, 'horizontalDistanceM': math.hypot(p['x'] - point['x'], p['z'] - point['z'])} for p in portals]
            ranked.sort(key=lambda p: (p['horizontalDistanceM'], p['axisId'], p['vertexIndex']))
            portal_reviews.append({'osmTunnelRunId': tunnel['id'], 'osmTransition': end,
                                   'osmPointIndex': point['index'], 'osmNodeId': point['osmNodeId'],
                                   'nearestSourceEndpoints': ranked[:3], 'selectedPortal': None,
                                   'geometricPortalConfirmed': False})
    identical = []
    roads = [a for a in axes if a['kind'] == 'road_axis']
    for tunnel in [a for a in axes if a['kind'] == 'tunnel_axis']:
        tc = [[v['lon'], v['lat'], v['sourceZM']] for v in tunnel['vertices']]
        for road in roads:
            rc = [[v['lon'], v['lat'], v['sourceZM']] for v in road['vertices']]
            if tc == rc or tc == rc[::-1]:
                identical.append({'tunnelAxisId': tunnel['id'], 'roadAxisId': road['id'],
                                  'reversed': tc != rc, 'independentCorroboration': False})
    result = {'format': 'bitume-monaco-road-screening', 'version': 1, 'readyForRuntime': False,
              'generator': 'tools/preparer-monaco-voirie.py', 'networkUsed': False,
              'inputs': sorted(inputs, key=lambda e: e['file']), 'screening': manifest['screening'],
              'interpretationReferences': manifest['interpretationReferences'],
              'lengthMUnmodified': data['lengthM'], 'scaleApplied': 1,
              'sourceGradeReview': {'threshold': GRADE_REVIEW_THRESHOLD, 'thresholdIsPhysicsLimit': False},
              'summary': {'sourceCount': len(sources), 'sourceFeatureCount': len(axes) + len(excluded),
                          'axisRecords': len(axes), 'uniqueAxisIds': len({a['cleabs'] for a in axes}),
                          'roadAxisRecords': len(roads), 'tunnelAxisRecords': len(axes) - len(roads),
                          'reviewPriorityPoints': len(priority), 'reviewedPointsWithGaps': len(points),
                          'pointsWithCandidates': sum(bool(p['candidates']) for p in points),
                          'galleryEndpointCandidates': len(portals), 'osmTransitionsReviewed': len(portal_reviews),
                          'roadMeasurementsQualified': 0, 'circuitPortalsQualified': 0,
                          'sourceGradeSegmentsToReview': sum(len(a['sourceGradeSegmentsToReview']) for a in axes),
                          'unknownRoadFields': {k: sum(p[k] is None for p in data['points'])
                                               for k in ('y', 'leftWidthM', 'rightWidthM', 'bankRadians')}},
              'axes': axes, 'excludedFeatures': excluded, 'points': points,
              'galleryEndpoints': portals, 'portalReview': portal_reviews,
              'identicalGeometryAcrossClasses': identical,
              'limits': manifest['unresolved'],
              'attribution': ['IGN, BD TOPO, Licence Ouverte 2.0',
                              '© les contributeurs OpenStreetMap, ODbL 1.0']}
    return result


def markdown(result):
    s = result['summary']
    lines = ['# Monaco — axes de voirie et portails candidats (P05)', '',
             'Reproduction hors réseau ; aucune cote ni limite de piste remplie.', '',
             f"{s['sourceCount']} captures, {s['roadAxisRecords']} observations d’axes routiers et "
             f"{s['tunnelAxisRecords']} axes de galerie. {s['reviewedPointsWithGaps']} points examinés, "
             f"dont {s['reviewPriorityPoints']} prioritaires. {s['pointsWithCandidates']} ont un candidat en plan.", '',
             'Les Z interpolés sont des calculs sur les axes sources, sans identification de la voie de course. '
             'Les précisions annoncées décrivent la source, pas une borne garantie. Date de mesure et datum '
             'individuels restent inconnus. Largeur indicative ≠ limites FIA ; dévers inconnu.', '',
             '## Transitions OSM et extrémité de galerie la plus proche', '',
             '| Point OSM | Objet BD TOPO candidat | Sommet | Distance en plan calculée (m) | Z source (m) |',
             '|---|---|---:|---:|---:|']
    for p in result['portalReview']:
        nearest = p['nearestSourceEndpoints']
        if nearest:
            a = nearest[0]
            lines.append(f"| {p['osmPointIndex']} | {a['cleabs']} | {a['vertexIndex']} | "
                         f"{a['horizontalDistanceM']:.3f} | {a['sourceZM']} |")
        else:
            lines.append(f"| {p['osmPointIndex']} | Aucun | — | — | — |")
    lines += ['', 'La proximité ne sélectionne aucun portail. Les extrémités de galerie décrites par la '
              'classe BD TOPO doivent encore être confrontées au parcours et à ses niveaux. Une absence '
              'd’objet Tunnel ne prouve pas une absence de couvert sous dalle/bâtiment.', '',
              f"{len(result['identicalGeometryAcrossClasses'])} correspondances géométriques exactes entre "
              'classes sont conservées : elles ne sont pas des mesures indépendantes.', '',
              '## Variations des axes sources à examiner', '',
              'Le seuil de variation verticale / distance horizontale de 0,35 sert uniquement au tri. '
              'La cause des variations reste inconnue ; elles ne deviennent pas des pentes de chaussée.', '',
              '| Objet source | Segment | Distance horizontale (m) | Variation Z source (m) |',
              '|---|---:|---:|---:|']
    displayed = set()
    for axis in result['axes']:
        for s in axis['sourceGradeSegmentsToReview']:
            key = (axis['cleabs'], s['segmentIndex'])
            if key in displayed:
                continue
            displayed.add(key)
            lines.append(f"| {axis['cleabs']} | {s['segmentIndex']} | {s['horizontalLengthM']:.3f} | {s['sourceDeltaZM']:.3f} |")
    lines += ['',
              '## Inconnus conservés', '',
              '415 altitudes, 415 largeurs gauches, 415 largeurs droites et 415 dévers restent null. '
              f"Longueur OSM conservée : {result['lengthMUnmodified']:.6f} m, sans remise à l’échelle. "
              'Monaco reste non jouable.', '',
              'Registre complet, localisateurs, coordonnées, calculs et empreintes : [voirie-p05.json](voirie-p05.json).',
              'Reçu des sources : [sources-voirie-p05.json](sources-voirie-p05.json).', '',
              'Attribution : IGN, Licence Ouverte 2.0 ; © les contributeurs OpenStreetMap, ODbL 1.0.', '']
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, default=DIRECTORY)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    result = prepare(args.directory)
    outputs = {OUTPUTS[0]: encode(result), OUTPUTS[1]: markdown(result)}
    paths = {name: METRIC.local_path(args.directory, name) for name in outputs}
    if args.check:
        for name, content in outputs.items():
            if not paths[name].exists() or paths[name].read_bytes() != content.encode('utf-8'):
                raise ValueError('Sortie differente : ' + name)
    else:
        for name, content in outputs.items():
            paths[name].write_text(content, encoding='utf-8')
    print(encode(result['summary']).strip())


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, TypeError, OSError) as exc:
        print('ERREUR : ' + str(exc), file=sys.stderr)
        sys.exit(1)
