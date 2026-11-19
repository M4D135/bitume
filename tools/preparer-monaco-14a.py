#!/usr/bin/env python3
"""Reconstitue les references Monaco hors runtime, sans reseau ni ajustement du trace.

Les selections sont explicites dans topologie.json. Toute arete doit exister
dans une voie OSM figee et la boucle doit avoir exactement deux voisins par noeud.
Les hauteurs et largeurs inconnues restent null : ce fichier ne fabrique pas un
circuit jouable. Python standard uniquement ; --check ne modifie aucun fichier.
"""
import argparse
from collections import defaultdict
import hashlib
import html
import json
import math
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

REFERENCE = Path(__file__).resolve().parents[1] / 'docs/references/monaco-2026'
A = 6378137.0
F = 1 / 298.257223563
E2 = F * (2 - F)


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def encode(value):
    return json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n'


def load_sources(directory, manifest):
    nodes, ways, relation = {}, {}, None
    for source in manifest['sources']:
        if 'file' not in source:
            continue
        raw = (directory / source['file']).read_bytes()
        if len(raw) != source['bytes'] or hashlib.sha256(raw).hexdigest() != source['sha256']:
            raise ValueError('Empreinte source differente : ' + source['file'])
        if source['role'] != 'geometry':
            continue
        root = ET.fromstring(raw)
        for kind, registry in [('node', nodes), ('way', ways)]:
            for element in root.findall(kind):
                item = {
                    'id': int(element.attrib['id']),
                    'version': int(element.attrib['version']),
                    'timestamp': element.attrib['timestamp'],
                    'tags': {t.attrib['k']: t.attrib['v'] for t in element.findall('tag')},
                }
                if kind == 'node':
                    item.update(lat=float(element.attrib['lat']), lon=float(element.attrib['lon']))
                else:
                    item['nodeIds'] = [int(n.attrib['ref']) for n in element.findall('nd')]
                previous = registry.get(item['id'])
                if previous is not None:
                    if {k: v for k, v in previous.items() if k != 'sourceIds'} != item:
                        raise ValueError('Deux versions incompatibles pour ' + kind + ' ' + str(item['id']))
                    previous['sourceIds'].append(source['id'])
                else:
                    item['sourceIds'] = [source['id']]
                    registry[item['id']] = item
        if source['id'] == 'osm-relation':
            matches = root.findall('relation')
            if len(matches) != 1:
                raise ValueError('Une seule relation de reference attendue')
            relation = matches[0]
    if relation is None:
        raise ValueError('Relation de reference absente')
    return nodes, ways, relation


def subset(way, spec):
    refs = way['nodeIds']
    first, last = refs.index(spec['fromNodeId']), refs.index(spec['toNodeId'])
    step = 1 if last >= first else -1
    return [refs[i] for i in range(first, last + step, step)]


def select_ways(ways, relation, topology):
    if int(relation.attrib['id']) != topology['relationId'] or int(relation.attrib['version']) != topology['relationVersion']:
        raise ValueError('Relation ou version inattendue')
    excluded = {s['wayId'] for s in topology['excludedWays']}
    selected = {}
    members = []
    for member in relation.findall('member'):
        if member.attrib['type'] != 'way':
            continue
        wid = int(member.attrib['ref'])
        members.append({'wayId': wid, 'role': member.attrib['role']})
        if wid not in excluded:
            selected[wid] = ways[wid]['nodeIds'][:]
    for spec in topology['restrictedWays']:
        if spec['wayId'] not in selected:
            raise ValueError('Restriction sur une voie absente de la relation')
        selected[spec['wayId']] = subset(ways[spec['wayId']], spec)
    for spec in topology['addedWays']:
        if spec['wayId'] in selected:
            raise ValueError('Ajout duplique')
        selected[spec['wayId']] = subset(ways[spec['wayId']], spec)
    return selected, members


def order_loop(selected, ways, topology):
    graph, sources = defaultdict(list), {}
    for wid, refs in selected.items():
        if len(refs) < 2:
            raise ValueError('Voie sans arete')
        original = ways[wid]['nodeIds']
        for a, b in zip(refs, refs[1:]):
            key = tuple(sorted((a, b)))
            if a == b or key in sources:
                raise ValueError('Arete degeneree ou dupliquee : ' + str(key))
            matches = [i for i in range(len(original) - 1) if {original[i], original[i + 1]} == {a, b}]
            if len(matches) != 1:
                raise ValueError('Arete sans provenance OSM unique : ' + str(key))
            sources[key] = (wid, matches[0])
            graph[a].append(b)
            graph[b].append(a)
    abnormal = {n: len(v) for n, v in graph.items() if len(v) != 2}
    if abnormal:
        raise ValueError('Boucle non simple, degres : ' + str(abnormal))
    start = topology['originNodeId']
    direction = ways[topology['directionWayId']]['nodeIds']
    step = 1 if topology['directionForward'] else -1
    nxt = direction[direction.index(start) + step]
    if nxt not in graph[start]:
        raise ValueError('Direction initiale absente du parcours')
    ordered, visited, edges = [start], {start}, []
    previous, current = start, nxt
    while True:
        wid, source_index = sources[tuple(sorted((previous, current)))]
        edges.append((previous, current, wid, source_index))
        if current == start:
            break
        if current in visited:
            raise ValueError('Cycle premature')
        visited.add(current)
        ordered.append(current)
        successor = next(n for n in graph[current] if n != previous)
        previous, current = current, successor
    if len(visited) != len(graph) or len(edges) != len(sources):
        raise ValueError('Composante deconnectee du tour')
    return ordered, edges


def ecef(lat, lon):
    phi, lam = math.radians(lat), math.radians(lon)
    n = A / math.sqrt(1 - E2 * math.sin(phi) ** 2)
    # h=0 est une convention de projection sur l'ellipsoide, jamais une altitude routiere.
    return (n * math.cos(phi) * math.cos(lam), n * math.cos(phi) * math.sin(lam), n * (1 - E2) * math.sin(phi))


def projection(origin):
    phi, lam = math.radians(origin['lat']), math.radians(origin['lon'])
    o = ecef(origin['lat'], origin['lon'])

    def local(node):
        q = [a - b for a, b in zip(ecef(node['lat'], node['lon']), o)]
        east = -math.sin(lam) * q[0] + math.cos(lam) * q[1]
        south = math.sin(phi) * math.cos(lam) * q[0] + math.sin(phi) * math.sin(lam) * q[1] - math.cos(phi) * q[2]
        return east, south

    return local


def distance(a, b):
    return math.hypot(b[0] - a[0], b[1] - a[1])


def bend(a, b, c):
    u = b[0] - a[0], b[1] - a[1]
    v = c[0] - b[0], c[1] - b[1]
    return math.degrees(math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]))


def assemble(directory):
    manifest = read_json(directory / 'sources.json')
    topology = read_json(directory / 'topologie.json')
    controls = read_json(directory / 'reperes.json')
    nodes, ways, relation = load_sources(directory, manifest)
    selected, members = select_ways(ways, relation, topology)
    ordered, chain = order_loop(selected, ways, topology)
    project = projection(nodes[ordered[0]])
    xy = {n: project(nodes[n]) for n in nodes}
    point_index = {n: i for i, n in enumerate(ordered)}
    points, edges, s = [], [], 0.0
    for i, (a, b, wid, source_index) in enumerate(chain):
        node, way = nodes[a], ways[wid]
        length = distance(xy[a], xy[b])
        points.append({
            'index': i, 'osmNodeId': a, 'osmNodeVersion': node['version'],
            'sourceTimestamp': node['timestamp'], 'sourceIds': node['sourceIds'],
            'lat': node['lat'], 'lon': node['lon'],
            'x': round(xy[a][0], 3), 'y': None, 'z': round(xy[a][1], 3),
            'sM': round(s, 6), 'leftWidthM': None, 'rightWidthM': None, 'bankRadians': None,
        })
        edges.append({
            'index': i, 'fromNodeId': a, 'toNodeId': b,
            'osmWayId': wid, 'osmWayVersion': way['version'],
            'originalEdgeIndex': source_index, 'originalForward': way['nodeIds'][source_index] == a,
            'sourceIds': way['sourceIds'], 'sourceTimestamp': way['timestamp'],
            'lengthM': round(length, 6),
        })
        s += length
    turns = []
    previous_exit = -1
    for marker in controls['turns']:
        lo, at, hi = [point_index[marker[k]] for k in ('approachNodeId', 'representativeNodeId', 'exitNodeId')]
        if not previous_exit <= lo < at < hi:
            raise ValueError('Reperes de virages desordonnes')
        angle = sum(bend(xy[ordered[i - 1]], xy[ordered[i]], xy[ordered[i + 1]]) for i in range(lo + 1, hi))
        if angle * (1 if marker['direction'] == 'right' else -1) <= 0:
            raise ValueError('Sens OSM contraire au repere FIA T' + str(marker['number']))
        previous_exit = hi
        turns.append({**marker, 'pointIndex': at, 'sM': points[at]['sM'],
                      'osmWindowBendDegrees': round(angle, 3),
                      'locationStatus': controls['locationStatus'], 'horizontalAccuracyM': None})
    auxiliary = []
    for decision in topology['excludedWays']:
        wid = decision['wayId']
        way = ways[wid]
        auxiliary.append({
            'osmWayId': wid, 'osmWayVersion': way['version'], 'name': way['tags'].get('name'),
            'sourceIds': way['sourceIds'], 'role': next(m['role'] for m in members if m['wayId'] == wid),
            'orderedNodeIds': way['nodeIds'],
            'points': [{'osmNodeId': n, 'lat': nodes[n]['lat'], 'lon': nodes[n]['lon'],
                        'x': round(xy[n][0], 3), 'y': None, 'z': round(xy[n][1], 3)} for n in way['nodeIds']],
            'sharedNodesWithMain': [n for n in way['nodeIds'] if n in point_index],
            'raceConnectionValidated': False, 'widthM': None,
        })
    tunnels = []
    for i, edge in enumerate(edges):
        wid = edge['osmWayId']
        if ways[wid]['tags'].get('tunnel') != 'yes':
            continue
        if tunnels and tunnels[-1]['lastEdgeIndex'] == i - 1:
            segment = tunnels[-1]
            segment['lastEdgeIndex'] = i
            segment['toNodeId'] = edge['toNodeId']
            if wid not in segment['osmWayIds']:
                segment['osmWayIds'].append(wid)
        else:
            tunnels.append({'firstEdgeIndex': i, 'lastEdgeIndex': i,
                            'fromNodeId': edge['fromNodeId'], 'toNodeId': edge['toNodeId'],
                            'osmWayIds': [wid], 'portalAccuracyM': None, 'clearanceM': None})
    def path_length(refs):
        return sum(distance(xy[a], xy[b]) for a, b in zip(refs, refs[1:]))
    original_main_length = sum(path_length(ways[m['wayId']]['nodeIds']) for m in members if m['wayId'] not in {d['wayId'] for d in topology['excludedWays']})
    added = sum(path_length(subset(ways[d['wayId']], d)) for d in topology['addedWays'])
    removed = sum(path_length(ways[d['wayId']]['nodeIds']) - path_length(subset(ways[d['wayId']], d)) for d in topology['restrictedWays'])
    alt = topology['alternateGapPath']
    alternative = {wid: refs for wid, refs in selected.items() if wid not in alt['replaceWays']}
    for spec in alt['ranges']:
        alternative[spec['wayId']] = subset(ways[spec['wayId']], spec)
    alternate_nodes, alternate_edges = order_loop(alternative, ways, topology)
    alternative_length = sum(distance(xy[a], xy[b]) for a, b, _, _ in alternate_edges)
    official = controls['official']
    delta = s - official['centrelineLengthM']
    dataset = {
        'format': 'bitume-monaco-osm-reference', 'version': 1, 'referenceYear': 2026,
        'status': 'source_preparation_not_playable', 'closed': True, 'readyForRuntime': False,
        'attribution': manifest['geometryAttribution'], 'license': manifest['geometryLicense'],
        'origin': {'osmNodeId': ordered[0], 'lat': nodes[ordered[0]]['lat'], 'lon': nodes[ordered[0]]['lon'],
                   'status': 'osm_start_finish_marker_not_fia_start_or_control_survey'},
        'coordinates': {'method': 'WGS84 ECEF at ellipsoid h=0, local east/south tangent projection',
                        'ellipsoidA': A, 'ellipsoidInverseFlattening': 1 / F,
                        'axes': ['x east', 'y up, unknown', 'z south'], 'unit': 'metre',
                        'numericRoundingM': 0.001, 'horizontalAccuracyM': None,
                        'heightIsNotEllipsoidProjection': True, 'scaleApplied': 1, 'closureCorrectionApplied': False},
        'lengthM': round(s, 6), 'points': points, 'edges': edges, 'turns': turns,
        'wayProvenance': [{**ways[w], 'selectedNodeIds': refs} for w, refs in selected.items()],
        'auxiliaryWays': auxiliary, 'tunnelTags': tunnels,
        'official': official, 'missingMeasurements': controls['missingMeasurements'],
        'seasonPolicy': controls['seasonPolicy'],
        'inputs': {n: hashlib.sha256((directory / n).read_bytes()).hexdigest() for n in ['sources.json', 'topologie.json', 'reperes.json']},
    }
    comparison = {
        'status': 'topology_resolved_metric_fidelity_not_qualified',
        'relationId': topology['relationId'], 'relationVersion': topology['relationVersion'],
        'points': len(points), 'edges': len(edges), 'selectedWays': len(selected),
        'closedByExistingEdges': True, 'syntheticEdges': 0, 'movedSourceNodes': 0,
        'lengthConvention': dataset['coordinates']['method'] + ', sum of projected OSM segments; road height unknown',
        'osmLengthM': round(s, 6), 'officialCentrelineLengthM': official['centrelineLengthM'],
        'differenceM': round(delta, 6), 'differencePercent': round(delta / official['centrelineLengthM'] * 100, 6),
        'targetMaxAbsoluteDifferenceM': 1, 'lengthTargetMet': abs(delta) <= 1,
        'unclosedMemberSumM': round(original_main_length, 6), 'addedGapM': round(added, 6), 'removedBranchM': round(removed, 6),
        'alternateGapLoopLengthM': round(alternative_length, 6),
        'alternateGapLoopPoints': len(alternate_nodes),
        'alternateGapOfficialStatus': 'not_selected_not_surveyed_as_race_centreline',
        'officialTurnCount': official['turnCount'], 'orderedCandidateTurnCount': len(turns),
        'candidateDirectionsMatch': True, 'surveyedApexCount': 0,
        'officialSectorLengthsM': official['sectorLengthsM'], 'officialSectorSumM': sum(official['sectorLengthsM']),
        'sectorLinesGeoreferenced': False, 'scaleApplied': 1,
        'sourceWidthTagsOnSelectedWays': sum(any(k in ways[w]['tags'] for k in ['width', 'width:lanes']) for w in selected),
        'sourceElevationTagsOnMainNodes': sum('ele' in nodes[n]['tags'] for n in ordered),
        'missingAltitudes': len(points), 'missingLeftWidths': len(points), 'missingRightWidths': len(points),
        'tunnelTagRuns': len(tunnels), 'auxiliaryWays': len(auxiliary),
        'geometryLicense': manifest['geometryLicense'], 'excludedRestrictedTopography': True,
    }
    return dataset, comparison, manifest, topology, nodes, ways, xy


def make_svg(data, comparison, topology, xy, ways):
    # Carte documentaire generee depuis les seules coordonnees, jamais embarquee au runtime.
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1320" role="img" aria-labelledby="title desc">',
             '<title id="title">Monaco 2026 : reconnaissance OSM, 19 reperes candidats</title>',
             '<desc id="desc">Boucle OSM fermee sans deplacement ni changement d echelle. Reperes FIA interpretes, altitudes et largeurs absentes.</desc>',
             '<rect width="1200" height="1320" fill="#f5f6f3"/>',
             '<style>text{font-family:system-ui,sans-serif;fill:#263b49} .small{font-size:14px} .body{font-size:17px} .num{font-size:15px;font-weight:700;fill:#166a7b;paint-order:stroke;stroke:#f5f6f3;stroke-width:5px;stroke-linejoin:round}</style>']
    def text(x, y, value, css='body'):
        parts.append(f'<text x="{x}" y="{y}" class="{css}">{html.escape(str(value))}</text>')
    text(44, 43, 'MONACO 2026 / DOSSIER 14A')
    parts.append('<text x="44" y="82" font-size="30" font-weight="650">Une boucle source, pas encore un circuit qualifie</text>')
    text(44, 113, 'Coordonnees OSM conservees. Altitudes, largeurs, murs et apex FIA non mesures.', 'small')
    scale = 1.05
    transform = lambda n: (55 + xy[n][0] * scale, 180 + (xy[n][1] + 676.3) * scale)
    def polyline(refs, color, width=3, dashed=False, convert=transform):
        coords = ' '.join(f'{convert(n)[0]:.3f},{convert(n)[1]:.3f}' for n in refs)
        parts.append(f'<polyline points="{coords}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linejoin="round" stroke-linecap="round"' + (' stroke-dasharray="6 5"' if dashed else '') + '/>')
    for auxiliary in data['auxiliaryWays']:
        polyline(auxiliary['orderedNodeIds'], '#9faab1', 2, True)
    refs = [p['osmNodeId'] for p in data['points']]
    polyline(refs + refs[:1], '#166a7b', 4)
    for addition in topology['addedWays']:
        polyline(subset(ways[addition['wayId']], addition), '#c7792c', 5)
    for marker in data['turns']:
        x, y = transform(marker['representativeNodeId'])
        parts.append(f'<circle cx="{x:.3f}" cy="{y:.3f}" r="3" fill="#166a7b"/>')
        dx, dy = marker['labelOffsetPx']
        text(round(x + dx, 3), round(y + dy, 3), marker['number'], 'num')
    x, y = transform(data['origin']['osmNodeId'])
    parts.append(f'<circle cx="{x}" cy="{y}" r="5" fill="#a34238"/>')
    text(x + 13, y + 5, 'OSM s=0', 'small')
    text(880, 190, 'COMPARAISON')
    for i, line in enumerate([f"OSM : {comparison['osmLengthM']:.2f} m", 'FIA : 3 337 m',
                               f"Ecart : {comparison['differenceM']:+.2f} m", 'Cible de 1 m non atteinte',
                               f"{len(data['points'])} points / {len(data['edges'])} aretes", 'Aucune arete inventee', 'Aucune cote Y disponible',
                               '19 reperes de lecture', '0 apex mesure']):
        text(880, 225 + i * 28, line, 'small')
    text(880, 515, 'RACCORD OSTENDE')
    inset = lambda n: (870 + (xy[n][0] - 405) * 4, 575 + (xy[n][1] + 330) * 4)
    chosen = [918118157, 14109303021, 1737326309, 12571844664, 14109303023, 21912962]
    polyline(chosen, '#166a7b', 3, convert=inset)
    polyline(chosen[:4], '#c7792c', 4, convert=inset)
    polyline([12571844664, 14109303022, 14109303023], '#b46d69', 2, True, inset)
    text(875, 710, 'Orange : voie 35092475', 'small')
    text(875, 735, 'Pointille : autre branche', 'small')
    text(875, 760, 'Les deux sont conservees', 'small')
    text(875, 785, 'dans le dossier de sources.', 'small')
    text(875, 855, 'SOURCES ET LIMITES')
    for i, line in enumerate(['Relation OSM 148194 v61', 'FIA : plan du 31 mai 2026', 'Repere local : est / sud',
                              'Pas de recalage du plan FIA', 'Pas de ligne de course mesuree', 'Stands : pointilles gris',
                              'Le schema ne valide pas', 'les largeurs ni le relief.']):
        text(875, 890 + i * 25, line, 'small')
    text(44, 1270, '© les contributeurs d’OpenStreetMap — ODbL 1.0 — openstreetmap.org/copyright', 'small')
    text(44, 1294, 'Schema genere par preparer-monaco-14a.py ; donnees de reconnaissance hors runtime.', 'small')
    parts.append('</svg>')
    return '\n'.join(parts) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, default=REFERENCE)
    parser.add_argument('--check', action='store_true', help='compare les sorties attendues, sans ecrire')
    args = parser.parse_args()
    data, comparison, _, topology, _, ways, xy = assemble(args.directory)
    outputs = {'donnees.json': encode(data), 'comparaison.json': encode(comparison),
               'plan.svg': make_svg(data, comparison, topology, xy, ways)}
    for name, content in outputs.items():
        path = args.directory / name
        if args.check:
            if not path.exists() or path.read_text(encoding='utf-8') != content:
                raise ValueError('Sortie a regenerer : ' + name)
        else:
            path.write_text(content, encoding='utf-8')
    print(f"Monaco sources : {len(data['points'])} points, {len(data['edges'])} aretes OSM, "
          f"{data['lengthM']:.3f} m, ecart FIA {comparison['differenceM']:+.3f} m ; non jouable.")


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, OSError) as error:
        print('Erreur de preparation Monaco : ' + str(error), file=sys.stderr)
        sys.exit(1)
