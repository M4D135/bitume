#!/usr/bin/env python3
"""Revue localisee des MNT de Monaco, hors reseau et sans profil de chaussee.

Reconstruit les entrees depuis les captures figees avant de comparer les derives.
Les seules sorties sont revue-chaussee.json et revue-chaussee.svg.
"""
import argparse
from collections import defaultdict
import hashlib
import html
import importlib.util
import json
import math
from pathlib import Path
import sys

sys.dont_write_bytecode = True
TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
DIRECTORY = TOOLS.parent / 'docs/references/monaco-2026'
OUTPUTS = ('revue-chaussee.json', 'revue-chaussee.svg')
DIFFERENCE_M = 1.0


def module(name):
    spec = importlib.util.spec_from_file_location(name, TOOLS / (name + '.py'))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


METRIC = module('preparer-monaco-mesures')
GEOMETRY = module('preparer-monaco-14a')


def encode(value):
    return json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n'


def circular_groups(indices, size):
    """Groupes maximaux sur une boucle ; une jonction fin/debut reste un groupe."""
    chosen = set(indices)
    if not chosen:
        return []
    if any(type(i) is not int or not 0 <= i < size for i in chosen):
        raise ValueError('Indice de groupe hors du parcours')
    if len(chosen) == size:
        return [list(range(size))]
    starts = sorted(i for i in chosen if (i - 1) % size not in chosen)
    groups = []
    for start in starts:
        group, i = [], start
        while i in chosen:
            group.append(i)
            i = (i + 1) % size
        groups.append(group)
    return groups


def verified_inputs(directory):
    manifest, data, _, _ = METRIC.load(directory)
    source_manifest = json.loads(METRIC.local_path(directory, 'sources.json').read_bytes())
    # Le preparateur historique lit les fichiers OSM ; verifier aussi leur confinement.
    for source in source_manifest['sources']:
        if 'file' in source:
            METRIC.checked_bytes(directory, source)
    rebuilt, comparison, _, topology, _, ways, xy = GEOMETRY.assemble(directory)
    historical = {'donnees.json': GEOMETRY.encode(rebuilt),
                  'comparaison.json': GEOMETRY.encode(comparison),
                  'plan.svg': GEOMETRY.make_svg(rebuilt, comparison, topology, xy, ways)}
    for name, expected in historical.items():
        if METRIC.local_path(directory, name).read_bytes() != expected.encode('utf-8'):
            raise ValueError('Geometrie derivee differente des sources : ' + name)
    results = METRIC.prepare(directory)
    for name, expected in results.items():
        if METRIC.local_path(directory, name).read_bytes() != encode(expected).encode('utf-8'):
            raise ValueError('Mesures derivees differentes des sources : ' + name)
    if data.get('readyForRuntime') is not False or any(
            p[k] is not None for p in data['points']
            for k in ('y', 'leftWidthM', 'rightWidthM', 'bankRadians')):
        raise ValueError('Cette revue exige les inconnues de chaussee intactes')
    names = {'sources-mesures.json', *METRIC.FROZEN, *METRIC.OUTPUTS}
    names.update(s['file'] for s in manifest['sources'])
    names.update(s['file'] for s in source_manifest['sources'] if 'file' in s)
    inputs = []
    for name in sorted(names):
        raw = METRIC.local_path(directory, name).read_bytes()
        inputs.append({'file': name, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
    return data, results['mesures-terrain.json'], results['bilan-mesures.json'], inputs


def make_review(data, terrain, bilan, inputs):
    points, edges, samples = data['points'], data['edges'], terrain['points']
    size, length = len(points), data['lengthM']
    ways = {w['id']: w for w in data['wayProvenance']}
    used_tiles = {tid for p in samples for tid in p['samples']['lidar']['tileIds']}

    def sample_ref(sample):
        # Les dates de dalle de l'import historique ne datent pas chaque cellule MNT.
        return {**{k: v for k, v in sample.items() if k not in ('date', 'acquisitionPeriod')},
                'tileAcquisitionPeriod': sample['acquisitionPeriod'],
                'tileSingleDayIfKnown': sample['date'],
                'individualMeasurementDate': None,
                'individualMeasurementDateStatus': 'not_confirmed_for_mnt_cell',
                'tileDateIsIndividualMeasurementDate': False, 'uncertaintyM': None}

    def edge_ref(i):
        e, w = edges[i], ways[edges[i]['osmWayId']]
        return {**e, 'wayName': w['tags'].get('name'),
                'tunnelTag': w['tags'].get('tunnel')}

    def turn_ref(s):
        choices = [((s - t['sM'] + length / 2) % length - length / 2, t) for t in data['turns']]
        delta, t = min(choices, key=lambda item: (abs(item[0]), item[1]['number']))
        return {'number': t['number'], 'name': t['name'], 'pointIndex': t['pointIndex'],
                'signedRouteDistanceM': round(delta, 6),
                'relationship': 'nearest_candidate_anchor_by_route_distance',
                'locationStatus': t['locationStatus'], 'horizontalAccuracyM': t['horizontalAccuracyM']}

    def point_ref(i):
        p, t = points[i], samples[i]
        return {'index': i, 'osmNodeId': p['osmNodeId'], 'sM': p['sM'],
                'lat': p['lat'], 'lon': p['lon'], 'x': p['x'], 'z': p['z'],
                'osmNodeVersion': p['osmNodeVersion'], 'sourceTimestamp': p['sourceTimestamp'],
                'sourceIds': p['sourceIds'], 'nearestTurnCandidate': turn_ref(p['sM']),
                'incomingEdge': edge_ref((i - 1) % size), 'outgoingEdge': edge_ref(i),
                'tunnelTagged': t['tunnelTagged'],
                'roadMeasurements': {k: p[k] for k in ('y', 'leftWidthM', 'rightWidthM', 'bankRadians')},
                'terrainSamples': {did: sample_ref(sample) for did, sample in t['samples'].items()},
                'deltaLidarRgeM': t['deltaLidarRgeM']}

    flagged = [p['index'] for p in samples if p['deltaLidarRgeM'] is not None
               and abs(p['deltaLidarRgeM']) > DIFFERENCE_M]
    groups = []
    for n, indices in enumerate(circular_groups(flagged, size), 1):
        deltas = [samples[i]['deltaLidarRgeM'] for i in indices]
        way_ids = sorted({edges[i]['osmWayId'] for i in indices}
                         | {edges[(i - 1) % size]['osmWayId'] for i in indices})
        wraps = indices[-1] < indices[0]
        groups.append({'id': 'G' + str(n), 'pointIndices': indices, 'pointCount': len(indices),
                       'wrapsOrigin': wraps, 'startSM': points[indices[0]]['sM'],
                       'endSM': points[indices[-1]]['sM'],
                       'sampleSpanM': round(points[indices[-1]]['sM'] - points[indices[0]]['sM']
                                            + (length if wraps else 0), 6),
                       'deltaMinM': min(deltas), 'deltaMaxM': max(deltas),
                       'maxAbsDifferenceM': max(map(abs, deltas)),
                       'tunnelTaggedPointCount': sum(samples[i]['tunnelTagged'] for i in indices),
                       'wayReferences': [{'id': wid, 'version': ways[wid]['version'],
                                          'name': ways[wid]['tags'].get('name'),
                                          'sourceIds': ways[wid]['sourceIds']} for wid in way_ids],
                       'nearestTurnCandidate': turn_ref(points[indices[len(indices) // 2]]['sM']),
                       'interpretation': 'terrain_difference_to_review_not_road_correction'})
    grade_by_edge = defaultdict(list)
    for observation in bilan['segmentsToReview']:
        i, did = observation['edgeIndex'], observation['dataset']
        grade_by_edge[i].append({**observation,
                                'fromSample': sample_ref(samples[i]['samples'][did]),
                                'toSample': sample_ref(samples[(i + 1) % size]['samples'][did])})
    grades = [{'edgeIndex': i, 'edge': edge_ref(i), 'startSM': points[i]['sM'],
               'endSM': points[(i + 1) % size]['sM'], 'wrapsOrigin': i == size - 1,
               'nearestTurnCandidate': turn_ref(points[i]['sM']),
               'observations': sorted(rows, key=lambda r: r['dataset'])}
              for i, rows in sorted(grade_by_edge.items())]
    tunnels = []
    for n, tag in enumerate(data['tunnelTags'], 1):
        first, last = tag['firstEdgeIndex'], tag['lastEdgeIndex']
        indices = list(range(first, last + 1))
        wraps = last == size - 1
        tunnels.append({'id': 'T' + str(n), 'source': 'OSM tunnel tag on selected ways',
                        'edgeIndices': indices, 'pointIndices': [i % size for i in range(first, last + 2)],
                        'wrapsOrigin': wraps,
                        'osmWayIds': tag['osmWayIds'],
                        'lengthM': round(sum(edges[i]['lengthM'] for i in indices), 6),
                        'lengthConvention': 'sum_of_already_rounded_osm_edge_lengths',
                        'chainageSpanM': round(points[(last + 1) % size]['sM'] - points[first]['sM']
                                               + (length if wraps else 0), 6),
                        'entryCandidate': point_ref(first), 'exitCandidate': point_ref((last + 1) % size),
                        'portalStatus': 'osm_tag_boundary_not_surveyed_portal',
                        'portalAccuracyM': tag['portalAccuracyM'], 'clearanceM': tag['clearanceM'],
                        'roadSurfaceConfirmed': False, 'portalsSurveyed': False})
    gaps = []
    for left, right in zip(tunnels, tunnels[1:]):
        first, last = left['edgeIndices'][-1] + 1, right['edgeIndices'][0] - 1
        indices = list(range(first, last + 1))
        if indices:
            gaps.append({'between': [left['id'], right['id']], 'edgeIndices': indices,
                         'strictInteriorPointIndices': list(range(first + 1, last + 1)),
                         'startSM': points[first]['sM'], 'endSM': points[last + 1]['sM'],
                         'lengthM': round(sum(edges[i]['lengthM'] for i in indices), 6),
                         'lengthConvention': 'sum_of_already_rounded_osm_edge_lengths',
                         'edges': [edge_ref(i) for i in indices],
                         'osmTunnelTagPresent': False, 'physicalCoverage': 'unknown',
                         'inferredTunnelConnection': False})
    return {'format': 'bitume-monaco-road-review', 'version': 1,
            'status': 'terrain_diagnostics_only_road_survey_pending', 'readyForRuntime': False,
            'generator': 'tools/preparer-monaco-revue.py', 'networkUsed': False,
            'inputIntegrityVerified': True, 'geometryRebuiltFromOsmSources': True,
            'terrainRebuiltFromCapturedResponses': True, 'existingDerivedFilesVerified': True,
            'inputs': inputs, 'coordinates': data['coordinates'], 'lengthM': length,
            'numericRoundingToleranceM': 0.00001,
            'roundingToleranceIsSurveyAccuracy': False,
            'temporalProvenance': {
                'tileAcquisitionPeriods': [tile for tile in terrain['tiles'] if tile['id'] in used_tiles],
                'tileSingleDayPointCount': sum(p['samples']['lidar']['date'] is not None for p in samples),
                'tilePeriodOnlyPointCount': sum(p['samples']['lidar']['date'] is None
                                               and p['samples']['lidar']['acquisitionPeriod'] is not None for p in samples),
                'individualMntCellDatesConfirmed': False,
                'rule': 'Dates de dalle conservees ; date individuelle de cellule MNT non confirmee, y compris si une seule journee de dalle est indiquee.'},
            'interpretationReferences': [{
                'id': 'ign-lidar-hd-description-202607',
                'url': 'https://data.geopf.fr/annexes/ressources/documentation/DC_LiDAR_HD_1-0.pdf',
                'version': '1.0', 'revision': '2026-07',
                'sections': [
                    {'section': '2.2.8.2', 'pdfPage': 16, 'subject': 'Classe Sol'},
                    {'section': '2.2.8.6', 'pdfPage': 18, 'subject': 'Tablier et sommet de tunnel classe Sol'},
                    {'section': '2.2.15', 'pdfPage': 22, 'subject': 'Attribut Origin, acquisition ou source exogene'},
                    {'section': '4.1.1', 'pdfPage': 44, 'subject': 'Dates de dalle excluant points virtuels et points Sol d autres campagnes'}],
                'use': 'Distinguer dates de dalle, origine des points et surface routiere ; aucune classification individuelle deduite du seul MNT.'}],
            'thresholds': {'absoluteDifferenceM': DIFFERENCE_M, 'differenceComparison': 'strictly_greater',
                           'absoluteTerrainGrade': METRIC.REVIEW_GRADE, 'gradeThresholdIsPhysicsLimit': False},
            'summary': {'pointCount': size, 'terrainObservations': bilan['observations']['total'],
                        'eligibleRoadObservations': bilan['observations']['eligibleForRoadProfile'],
                        'differencePointCount': len(flagged), 'differenceGroupCount': len(groups),
                        'positiveDifferences': sum(samples[i]['deltaLidarRgeM'] > 0 for i in flagged),
                        'negativeDifferences': sum(samples[i]['deltaLidarRgeM'] < 0 for i in flagged),
                        'differencePointsTaggedTunnel': sum(samples[i]['tunnelTagged'] for i in flagged),
                        'gradeObservations': len(bilan['segmentsToReview']), 'distinctGradeEdges': len(grades),
                        'gradeByDataset': {did: sum(o['dataset'] == did for o in bilan['segmentsToReview'])
                                           for did in ('lidar', 'rge')},
                        'tunnelTaggedPoints': bilan['tunnelTaggedPoints'], 'tunnelRuns': len(tunnels),
                        'candidatePortals': len(tunnels) * 2, 'surveyedPortals': 0,
                        'unknownRoadMeasurements': bilan['unknownRoadMeasurements']},
            'differenceGroups': groups, 'differencePoints': [point_ref(i) for i in flagged],
            'terrainGradeSegments': grades, 'tunnelRuns': tunnels, 'untaggedIntervals': gaps,
            'untaggedIntervalsScope': 'Between successive tag runs in increasing route index, not the complete complement of all tunnel tags.',
            'limitations': [
                'Les deux MNT renseignent le terrain ; aucune observation ne qualifie la chaussee.',
                'Le datum et la date individuels du RGE restent inconnus ; les ecarts sont diagnostiques.',
                'Les periodes LiDAR sont celles des dalles, pas des dates individuelles confirmees de cellules MNT.',
                'Un accord des deux MNT ne confirme pas la surface routiere, notamment sous ouvrage.',
                'Aucune cause ni correction de datum, de profil ou de longueur n est deduite.',
                'Les tags et leurs extremites OSM ne mesurent pas les portails physiques.',
                'Le troncon sans tag tunnel n est ni fusionne ni declare a ciel ouvert.',
                'Les reperes de virages sont des ancres candidates, pas des apex FIA releves.',
                'Les courbes relient les echantillons pour la lecture ; aucune interpolation routiere.',
                'Arrondis numeriques et resolutions des produits ne constituent pas des incertitudes verifiees.'],
            'attribution': terrain['attribution'], 'sourceLicenses': terrain['sourceLicenses']}


def make_svg(data, terrain, review):
    summary = review['summary']
    difference_limit = review['thresholds']['absoluteDifferenceM']
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1240 1480" role="img" aria-labelledby="title desc">',
             '<title id="title">Monaco 14A : revue du terrain, chaussée non qualifiée</title>',
             f'<desc id="desc">{summary["differencePointCount"]} écarts dans {summary["differenceGroupCount"]} groupes, '
             f'{summary["distinctGradeEdges"]} segments de pente du terrain et {summary["tunnelRuns"]} ensembles de tunnel OSM distincts. '
             'Les profils de MNT ne sont pas des profils routiers.</desc>',
             '<rect width="1240" height="1480" fill="#f6f7f4"/>',
             '<style>text{font-family:system-ui,sans-serif;fill:#243a46}.small{font-size:15px}.body{font-size:18px}.label{font-size:16px;font-weight:650;paint-order:stroke;stroke:#f6f7f4;stroke-width:5px;stroke-linejoin:round}.muted{fill:#586c73}</style>']

    def text(x, y, value, css='body', extra=''):
        parts.append(f'<text x="{x:.2f}" y="{y:.2f}" class="{css}" {extra}>{html.escape(str(value))}</text>')

    def line(x1, y1, x2, y2, colour, width=1, extra=''):
        parts.append(f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="{colour}" stroke-width="{width}" {extra}/>')

    def polyline(coords, colour, width, extra=''):
        points = ' '.join(f'{x:.2f},{y:.2f}' for x, y in coords)
        parts.append(f'<polyline points="{points}" fill="none" stroke="{colour}" stroke-width="{width}" stroke-linejoin="round" stroke-linecap="round" {extra}/>')

    text(40, 42, 'MONACO 2026 / REVUE MÉTRIQUE 14A', 'small')
    text(40, 86, 'Des écarts localisés, une chaussée encore à mesurer', extra='style="font-size:30px;font-weight:700"')
    parts.append('<rect x="40" y="112" width="1160" height="80" rx="10" fill="#fff0cf"/>')
    text(58, 144, 'MNT ≠ chaussée : aucune altitude, largeur ou valeur de dévers ajoutée au tracé.')
    text(58, 173, f'{summary["pointCount"]} points OSM · {summary["terrainObservations"]} observations terrain · '
         f'{summary["differencePointCount"]} écarts > {difference_limit:g} m · {summary["differenceGroupCount"]} groupes · '
         f'{summary["distinctGradeEdges"]} segments de pente à relire', 'small')
    text(50, 230, 'CARTE DE RECONNAISSANCE', 'small')
    pts = data['points']
    xmin, xmax = min(p['x'] for p in pts), max(p['x'] for p in pts)
    zmin, zmax = min(p['z'] for p in pts), max(p['z'] for p in pts)
    scale = min(620 / (xmax - xmin), 580 / (zmax - zmin))
    project = lambda i: (110 + (pts[i]['x'] - xmin) * scale, 260 + (pts[i]['z'] - zmin) * scale)
    polyline([project(i) for i in range(len(pts))] + [project(0)], '#91a1a7', 4)
    for tunnel in review['tunnelRuns']:
        polyline([project(i) for i in tunnel['pointIndices']], '#8064a3', 8)
    for gap in review['untaggedIntervals']:
        polyline([project(i) for i in range(gap['edgeIndices'][0], gap['edgeIndices'][-1] + 2)], '#b88122', 5, 'stroke-dasharray="5 6"')
    for p in review['differencePoints']:
        x, y = project(p['index'])
        parts.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="4.5" fill="#bb443a"/>')
    for tunnel in review['tunnelRuns']:
        for role in ('entryCandidate', 'exitCandidate'):
            x, y = project(tunnel[role]['index'])
            parts.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="7" fill="none" stroke="#513871" stroke-width="2"/>')
    used_y = []
    for group in review['differenceGroups']:
        coordinates = [project(i) for i in group['pointIndices']]
        x, y = (sum(c[j] for c in coordinates) / len(coordinates) for j in (0, 1))
        label_y = y
        while any(abs(label_y - old) < 25 for old in used_y):
            label_y += 25
        used_y.append(label_y)
        line(x + 6, y, 680, label_y - 5, '#a8b3b8')
        text(688, label_y, group['id'], 'label')
    x, y = project(0)
    parts.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="5" fill="#243a46"/>')
    text(x + 12, y + 5, 's = 0 OSM', 'small')
    line(75, 320, 75, 275, '#243a46', 2)
    polyline([(69, 285), (75, 275), (81, 285)], '#243a46', 2)
    text(69, 261, 'N', 'small')
    line(110, 867, 110 + 100 * scale, 867, '#243a46', 3)
    text(110, 889, '100 m · projection locale est/sud', 'small')

    text(790, 230, f'GROUPES D’ÉCARTS > {difference_limit:g} m', 'small')
    for j, group in enumerate(review['differenceGroups']):
        top = 267 + j * 69
        indices = group['pointIndices']
        interval = str(indices[0]) if len(indices) == 1 else f'{indices[0]}–{indices[-1]}'
        point_word = 'point' if len(indices) == 1 else 'points'
        observation_word = 'observation' if len(indices) == 1 else 'observations'
        text(790, top, f"{group['id']} · {point_word} {interval} · {len(indices)} {observation_word}", 'label')
        anchor = group['nearestTurnCandidate']
        text(790, top + 22, f"Près de T{anchor['number']} : {anchor['name']}", 'small')
        text(790, top + 43, f"s {group['startSM']:.1f}–{group['endSM']:.1f} m · |écart| max {group['maxAbsDifferenceM']:.2f} m", 'small')
    gap_length = sum(gap['lengthM'] for gap in review['untaggedIntervals'])
    for j, (colour, label, dash) in enumerate([
            ('#bb443a', f'Échantillon : écart absolu > {difference_limit:g} m', ''),
            ('#8064a3', f'{summary["tunnelRuns"]} ensembles tagués tunnel dans OSM', ''),
            ('#b88122', f'{gap_length:.3f} m non tagués entre les ensembles', 'stroke-dasharray="5 6"')]):
        y = 790 + j * 29
        line(790, y - 5, 824, y - 5, colour, 4, dash)
        text(837, y, label, 'small')
    text(790, 884, 'Cercles : limites du tag, portails non mesurés.', 'small')
    text(50, 937, 'PROFILS DES ÉCHANTILLONS DE TERRAIN — AUCUN PROFIL ROUTIER QUALIFIÉ', 'small')
    values = [p['samples'][did]['valueM'] for p in terrain['points'] for did in ('lidar', 'rge')
              if p['samples'][did]['valueM'] is not None]
    low, high = math.floor(min(values) / 10) * 10, math.ceil(max(values) / 10) * 10
    if high == low:
        high += 10
    px = lambda s: 90 + 1080 * s / data['lengthM']
    py = lambda h: 1255 - 260 * (h - low) / (high - low)
    for tunnel in review['tunnelRuns']:
        start, end = (tunnel[k]['sM'] for k in ('entryCandidate', 'exitCandidate'))
        spans = [(start, data['lengthM']), (0, end)] if tunnel['wrapsOrigin'] else [(start, end)]
        for a, b in spans:
            if b > a:
                parts.append(f'<rect x="{px(a):.2f}" y="995" width="{px(b)-px(a):.2f}" height="260" fill="#e4ddef"/>')
    for value in range(int(low), int(high) + 1, 10):
        line(90, py(value), 1170, py(value), '#d1dadd')
        text(76, py(value) + 5, value, 'small', 'text-anchor="end"')
    for s in range(0, int(data['lengthM']) + 1, 500):
        line(px(s), 995, px(s), 1255, '#e0e5e5')
        text(px(s), 1282, s, 'small', 'text-anchor="middle"')
    for did, colour in (('lidar', '#197a91'), ('rge', '#c07a1d')):
        run = []
        for p in terrain['points'] + [{**terrain['points'][0], 'sM': data['lengthM']}]:
            value = p['samples'][did]['valueM']
            if value is None:
                if run:
                    polyline(run, colour, 2.3)
                run = []
            else:
                run.append((px(p['sM']), py(value)))
        if run:
            polyline(run, colour, 2.3)
    text(90, 981, 'Altitude MNT (m)', 'small')
    text(1170, 1310, 'Abscisse de reconnaissance OSM (m)', 'small', 'text-anchor="end"')
    line(275, 977, 306, 977, '#197a91', 3)
    years = sorted({period[key][:4] for p in terrain['points']
                    if (period := p['samples']['lidar']['acquisitionPeriod'])
                    for key in ('start', 'end')})
    year_label = years[0] if len(years) == 1 else '–'.join((years[0], years[-1])) if years else 'inconnue'
    datums = {p['samples']['lidar']['verticalDatum'] for p in terrain['points']}
    datum_label = next(iter(datums)) if len(datums) == 1 and None not in datums else 'datum à vérifier'
    text(315, 982, 'LiDAR HD MNT · ' + datum_label + ' · dalles : ' + year_label, 'small')
    line(710, 977, 741, 977, '#c07a1d', 3)
    text(750, 982, 'RGE ALTI · datum/date individuels inconnus', 'small')
    parts.append('<rect x="40" y="1333" width="1160" height="88" rx="10" fill="#e9eeed"/>')
    text(58, 1363, 'Les courbes relient les échantillons pour lecture ; aucun lissage ou raccord de chaussée déduit.', 'small')
    text(58, 1388, 'L’accord des MNT ne prouve pas une route. Les écarts ne démontrent ni une cause ni une correction de datum.', 'small')
    text(58, 1412, 'Périodes de dalle conservées ; date individuelle des cellules MNT non confirmée.', 'small')
    text(40, 1452, '© contributeurs OpenStreetMap — ODbL 1.0 · IGN MNT LiDAR HD et RGE ALTI — Licence Ouverte 2.0', 'small')
    parts.append('</svg>')
    return '\n'.join(parts) + '\n'


def prepare(directory):
    data, terrain, bilan, inputs = verified_inputs(directory)
    review = make_review(data, terrain, bilan, inputs)
    return {OUTPUTS[0]: encode(review), OUTPUTS[1]: make_svg(data, terrain, review)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, default=DIRECTORY)
    parser.add_argument('--check', action='store_true', help='Comparer les deux sorties sans ecrire.')
    args = parser.parse_args()
    outputs = prepare(args.directory)
    paths = {}
    for name in outputs:
        if (args.directory / name).is_symlink():
            raise ValueError('Une sortie ne peut pas etre un lien symbolique')
        paths[name] = METRIC.local_path(args.directory, name)
    if args.check:
        drift = [name for name, path in paths.items()
                 if not path.is_file() or path.read_bytes() != outputs[name].encode('utf-8')]
        if drift:
            raise ValueError('Revue differente ou absente : ' + ', '.join(drift))
    else:
        for name, path in paths.items():
            path.write_text(outputs[name], encoding='utf-8')
    review = json.loads(outputs[OUTPUTS[0]])
    print(encode({'check': args.check, 'readyForRuntime': False, **review['summary']}), end='')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError, OverflowError) as error:
        print('Monaco revue : ' + str(error), file=sys.stderr)
        raise SystemExit(1)
