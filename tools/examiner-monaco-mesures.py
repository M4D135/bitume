#!/usr/bin/env python3
"""Revue exhaustive des ecarts de terrain et tags tunnel Monaco, hors reseau.

Cette revue localise les mesures a acquerir ; elle ne qualifie ni une chaussee,
ni un portail. Les entrees sont reproduites depuis leurs captures verifiees.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
spec = importlib.util.spec_from_file_location('monaco_import', TOOLS / 'preparer-monaco-mesures.py')
IMPORT = importlib.util.module_from_spec(spec)
spec.loader.exec_module(IMPORT)
DIRECTORY = IMPORT.DIRECTORY
OUTPUTS = ('revue-mesures.json', 'revue-mesures.md')
ROAD_FIELDS = ('y', 'leftWidthM', 'rightWidthM', 'bankRadians')
DIFFERENCE_M = 1.0


def encode(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode('utf-8')


def cyclic_runs(indices, count):
    """Partition ordonnee sans dupliquer une composante qui traverse l'origine."""
    selected = set(indices)
    if type(count) is not int or count < 1 or any(type(i) is not int or not 0 <= i < count for i in selected):
        raise ValueError('Indices de boucle invalides')
    if len(selected) == count:
        return [list(range(count))]
    groups = []
    for start in sorted(i for i in selected if (i - 1) % count not in selected):
        run, i = [], start
        while i in selected:
            run.append(i)
            i = (i + 1) % count
        groups.append(run)
    return groups


def edge_span(first, last, count):
    if any(type(i) is not int or not 0 <= i < count for i in (first, last)):
        raise ValueError('Bornes de tunnel invalides')
    return [(first + step) % count for step in range((last - first) % count + 1)]


def neighboring_turns(data, s):
    turns = sorted(data['turns'], key=lambda t: t['sM'])
    before = max((t for t in turns if t['sM'] <= s), key=lambda t: t['sM'], default=turns[-1])
    after = min((t for t in turns if t['sM'] > s), key=lambda t: t['sM'], default=turns[0])
    fields = ('number', 'name', 'pointIndex', 'sM', 'locationStatus', 'horizontalAccuracyM')
    return {'before': {k: before[k] for k in fields}, 'after': {k: after[k] for k in fields}}


def build_review(data, terrain, bilan, provenance):
    points, samples, edges = data['points'], terrain['points'], data['edges']
    n = len(points)
    if not n or len(samples) != n or len(edges) != n or data['readyForRuntime'] is not False:
        raise ValueError('Boucle de reconnaissance incompatible')
    if any(p[k] is not None for p in points for k in ROAD_FIELDS):
        raise ValueError('Une cote routiere a ete ajoutee aux inconnues figees')
    tunnel_edges = {i for t in data['tunnelTags'] for i in edge_span(t['firstEdgeIndex'], t['lastEdgeIndex'], n)}
    tunnel_points = tunnel_edges | {(i + 1) % n for i in tunnel_edges}
    for i, (point, row, edge) in enumerate(zip(points, samples, edges)):
        if (point['index'] != i or row['index'] != i or edge['index'] != i
                or any(point[k] != row[k] for k in ('osmNodeId', 'lon', 'lat', 'sM'))
                or edge['fromNodeId'] != point['osmNodeId'] or edge['toNodeId'] != points[(i + 1) % n]['osmNodeId']
                or row['tunnelTagged'] != (i in tunnel_points)):
            raise ValueError('Association point/mesure/arete/tunnel incoherente')
        values = [row['samples'][did]['valueM'] for did in ('lidar', 'rge')]
        delta = None if None in values else round(values[0] - values[1], 6)
        if row['deltaLidarRgeM'] != delta:
            raise ValueError('Ecart de terrain incoherent')
    difference_indices = [i for i, p in enumerate(samples)
                          if p['deltaLidarRgeM'] is not None and abs(p['deltaLidarRgeM']) > DIFFERENCE_M]
    grades = []
    threshold = bilan['gradeReviewThreshold']
    if threshold != IMPORT.REVIEW_GRADE or bilan['gradeThresholdIsPhysicsLimit'] is not False:
        raise ValueError('Seuil de revue incompatible')
    for did in ('lidar', 'rge'):
        for i, edge in enumerate(edges):
            a, b = (samples[j]['samples'][did]['valueM'] for j in (i, (i + 1) % n))
            if a is not None and b is not None and abs((b - a) / edge['lengthM']) > threshold:
                grades.append({'dataset': did, 'edgeIndex': i, 'fromNodeId': edge['fromNodeId'],
                               'toNodeId': edge['toNodeId'], 'runM': edge['lengthM'], 'deltaM': round(b - a, 6),
                               'grade': round((b - a) / edge['lengthM'], 6),
                               'tunnelTouching': i in tunnel_points or (i + 1) % n in tunnel_points})
    if grades != bilan['segmentsToReview'] or len(tunnel_points) != bilan['tunnelTaggedPoints']:
        raise ValueError('Bilan des segments ou des tunnels incoherent')
    ways = {w['id']: w for w in data['wayProvenance']}

    def way(i):
        e = edges[i]
        return {'edgeIndex': i, 'osmWayId': e['osmWayId'], 'osmWayVersion': e['osmWayVersion'],
                'name': ways[e['osmWayId']]['tags'].get('name'), 'tunnelTagged': i in tunnel_edges}

    def position(i):
        return {k: points[i][k] for k in ('index', 'osmNodeId', 'sM', 'lon', 'lat')}

    def group(run):
        start, end = run[0], run[-1]
        return {'pointIndices': run, 'pointCount': len(run), 'start': position(start), 'end': position(end),
                'wrapsOrigin': any(b < a for a, b in zip(run, run[1:])),
                'spanM': round((points[end]['sM'] - points[start]['sM']) % data['lengthM'], 6),
                'startTurns': neighboring_turns(data, points[start]['sM']),
                'endTurns': neighboring_turns(data, points[end]['sM']),
                'osmWayIds': sorted({edges[j]['osmWayId'] for i in run for j in ((i - 1) % n, i)}),
                'maxAbsDifferenceM': max((abs(samples[i]['deltaLidarRgeM']) for i in run
                                         if samples[i]['deltaLidarRgeM'] is not None), default=None)}

    tunnel_runs = []
    for run in cyclic_runs(tunnel_edges, n):
        first, last = run[0], run[-1]
        end = (last + 1) % n
        boundaries = []
        # Une boucle entierement taguee n'a aucune transition, donc aucun portail candidat.
        for label, index in (() if len(run) == n else (('entry', first), ('exit', end))):
            boundaries.append({'transition': label, **position(index),
                               'previousEdge': way((index - 1) % n), 'nextEdge': way(index),
                               'status': 'osm_tag_transition_not_surveyed_portal',
                               'portalAccuracyM': None, 'clearanceM': None,
                               'neighboringTurns': neighboring_turns(data, points[index]['sM'])})
        tunnel_runs.append({'edgeIndices': run, 'pointIndices': list(dict.fromkeys([*run, end])),
                            'lengthM': round(sum(edges[i]['lengthM'] for i in run), 6),
                            'wrapsOrigin': any(b < a for a, b in zip(run, run[1:])),
                            'osmWayIds': sorted({edges[i]['osmWayId'] for i in run}),
                            'boundaries': boundaries})
    gaps = []
    if tunnel_edges and len(tunnel_edges) < n:
        for run in cyclic_runs(set(range(n)) - tunnel_edges, n):
            gaps.append({'edgeIndices': run, 'start': position(run[0]), 'end': position((run[-1] + 1) % n),
                         'lengthM': round(sum(edges[i]['lengthM'] for i in run), 6),
                         'wrapsOrigin': any(b < a for a, b in zip(run, run[1:])),
                         'status': 'absence_of_tunnel_tag_not_proof_of_open_air'})
    review_indices = set(difference_indices) | tunnel_points | {j for g in grades for j in (g['edgeIndex'], (g['edgeIndex'] + 1) % n)}
    records = []
    for i in sorted(review_indices):
        p = samples[i]
        records.append({**position(i), 'differenceOver1M': i in difference_indices,
                        'tunnelTagged': i in tunnel_points, 'deltaLidarRgeM': p['deltaLidarRgeM'],
                        'neighboringTurns': neighboring_turns(data, p['sM']),
                        'adjacentWays': [way((i - 1) % n), way(i)],
                        'terrain': {did: {k: p['samples'][did][k] for k in
                                         ('valueM', 'sourceId', 'locator', 'verticalDatum', 'date', 'acquisitionPeriod', 'tileIds')}
                                    for did in ('lidar', 'rge')},
                        'roadMeasurements': {k: None for k in ROAD_FIELDS}})
    for g in grades:
        i = g['edgeIndex']
        g.update(start=position(i), end=position((i + 1) % n), way=way(i),
                 neighboringTurns=neighboring_turns(data, points[i]['sM']),
                 sampleLocators=[samples[j]['samples'][g['dataset']]['locator'] for j in (i, (i + 1) % n)])
    return {'format': 'bitume-monaco-measurement-review', 'version': 1, 'readyForRuntime': False,
            'comparisonIsDiagnosticOnly': True, 'differenceThresholdM': DIFFERENCE_M,
            'gradeReviewThreshold': threshold, 'gradeThresholdIsPhysicsLimit': False,
            'sourceProvenance': provenance, 'summary': {
                'pointCount': n, 'differencePoints': len(difference_indices),
                'differencePointsTunnelTagged': len(set(difference_indices) & tunnel_points),
                'differencePointsWithoutTunnelTag': len(set(difference_indices) - tunnel_points),
                'differenceGroups': len(cyclic_runs(difference_indices, n)), 'tunnelPoints': len(tunnel_points),
                'tunnelEdges': len(tunnel_edges), 'tunnelGroups': len(tunnel_runs),
                'osmTagTransitions': sum(len(t['boundaries']) for t in tunnel_runs),
                'terrainGradeAlerts': len(grades), 'distinctGradeEdges': len({g['edgeIndex'] for g in grades}),
                'reviewedPoints': len(records), 'eligibleRoadMeasurements': 0,
                'unknownRoadMeasurements': {k: n for k in ROAD_FIELDS}},
            'differencePointIndices': difference_indices, 'tunnelPointIndices': sorted(tunnel_points),
            'differenceGroups': [group(run) for run in cyclic_runs(difference_indices, n)],
            'tunnelGroups': tunnel_runs, 'untaggedIntervals': gaps, 'points': records, 'gradeAlerts': grades,
            'acquisitionNeeds': [
                {'scope': 'all_415_points', 'need': 'altitudes de chaussee et limites gauche/droite localisees, datees, datum et incertitude documentes'},
                {'scope': 'tunnel_groups_and_tag_transitions', 'need': 'releve de la surface routiere sous ouvrage, position des vrais portails et hauteur libre ; ne pas interpoler le MNT'},
                {'scope': 'difference_groups_and_grade_alerts', 'need': 'identifier la surface echantillonnee, les niveaux superposes et les ruptures ; verifier les deux produits avant de choisir une cote'},
                {'scope': 'whole_circuit', 'need': 'largeurs de course, devers, lignes FIA et actualite 2026 ; aucun zero ou profil moyen par defaut'}],
            'limits': ['Les reperes de virages sont des ancrages OSM candidats, pas des apex releves.',
                       'Une transition de tag OSM ne mesure pas un portail ; un intervalle sans tag ne prouve pas le ciel ouvert.',
                       'Les differences inter-produits ne prouvent pas une erreur de chaussee : datum/date RGE et incertitudes individuelles restent inconnus.',
                       'La revue ne choisit, ne moyenne et ne corrige aucune altitude de chaussee.'],
            'attribution': terrain['attribution'], 'sourceLicenses': terrain['sourceLicenses']}


def markdown(report):
    s = report['summary']
    lines = ['# Monaco — revue des mesures de terrain', '',
             '**Diagnostic de préparation : Monaco reste non jouable. Aucune cote routière ajoutée.**', '',
             f"La revue couvre les **{s['differencePoints']} écarts strictement supérieurs à 1 m**, les **{s['tunnelPoints']} points touchant un tag tunnel** et les **{s['terrainGradeAlerts']} alertes de pente du terrain**.",
             f"Les écarts concernent {s['differencePointsTunnelTagged']} points tagués tunnel et {s['differencePointsWithoutTunnelTag']} autres points ; {s['reviewedPoints']} points distincts sont détaillés dans `revue-mesures.json`.", '',
             '`sM` suit la reconnaissance OSM, depuis son origine propre ; ce ne sont pas des chaînages FIA. Les noms de virages sont des repères candidats.', '',
             '## Groupes contigus d’écarts > 1 m', '',
             '| Points (indices) | s début → fin (m) | Nombre | Maximum absolu (m) | Repères voisins du début |',
             '|---|---:|---:|---:|---|']
    for g in report['differenceGroups']:
        t = g['startTurns']
        lines.append(f"| {g['start']['index']} → {g['end']['index']} | {g['start']['sM']:.3f} → {g['end']['sM']:.3f} | {g['pointCount']} | {g['maxAbsDifferenceM']:.2f} | T{t['before']['number']} {t['before']['name']} → T{t['after']['number']} {t['after']['name']} |")
    lines += ['', '## Passages portant un tag tunnel', '',
              'Les bornes ci-dessous sont des transitions de tags OSM, **pas des portails mesurés**. Leur précision et la hauteur libre restent inconnues.', '',
              '| Arêtes | Longueur OSM (m) | Points d’entrée → sortie | Voies OSM |', '|---|---:|---|---|']
    for g in report['tunnelGroups']:
        lines.append(f"| {g['edgeIndices'][0]} → {g['edgeIndices'][-1]} | {g['lengthM']:.3f} | {g['pointIndices'][0]} → {g['pointIndices'][-1]} | {', '.join(map(str, g['osmWayIds']))} |")
    lines += ['', 'Les intervalles sans tag sont conservés séparément. Ils ne sont pas fusionnés avec les passages couverts et ne prouvent pas une exposition à ciel ouvert.', '']
    for g in report['untaggedIntervals']:
        suffix = ' (passage par l’origine)' if g['wrapsOrigin'] else ''
        lines.append(f"- Arêtes {g['edgeIndices'][0]} → {g['edgeIndices'][-1]} : {g['lengthM']:.3f} m{suffix}.")
    lines += ['', '## Points avec écart > 1 m ou tag tunnel', '',
              '| Index / nœud OSM | s (m) | LiDAR (m) | RGE (m) | LiDAR − RGE (m) | Tag tunnel |', '|---|---:|---:|---:|---:|---|']
    for p in report['points']:
        if not (p['differenceOver1M'] or p['tunnelTagged']):
            continue
        val = lambda v: 'inconnu' if v is None else f'{v:.2f}'
        lines.append(f"| {p['index']} / {p['osmNodeId']} | {p['sM']:.3f} | {val(p['terrain']['lidar']['valueM'])} | {val(p['terrain']['rge']['valueM'])} | {val(p['deltaLidarRgeM'])} | {'oui' if p['tunnelTagged'] else 'non'} |")
    lines += ['', '## Variations du terrain à examiner', '',
              'Seuil de tri : 0,35 m/m. Ce seuil n’est pas une limite de la physique et les valeurs ne sont pas des pentes de chaussée qualifiées.', '',
              '| Produit | Arête | s début → fin (m) | Distance (m) | Variation (m) | Pente terrain (m/m) |',
              '|---|---:|---:|---:|---:|---:|']
    for g in report['gradeAlerts']:
        lines.append(f"| {g['dataset']} | {g['edgeIndex']} | {g['start']['sM']:.3f} → {g['end']['sM']:.3f} | {g['runM']:.3f} | {g['deltaM']:.2f} | {g['grade']:.6f} |")
    lines += ['', '## Mesures encore nécessaires', '']
    lines.extend('- ' + n['need'] + '.' for n in report['acquisitionNeeds'])
    lines += ['', '## Provenance et reproduction', '',
              'Les captures IGN et les six fichiers géométriques sont contrôlés par leur manifeste ; les trois sorties du préparateur sont reproduites et comparées avant cette revue. Les SHA-256 de toutes les entrées sont consignés dans le JSON. Le programme ne fait aucun appel réseau.', '',
              '```sh', 'python3 tools/examiner-monaco-mesures.py', 'python3 tools/examiner-monaco-mesures.py --check',
              'node --test verifications/monaco-revue.test.mjs', '```', '',
              'Coordonnées, sélection et repères : © les contributeurs d’OpenStreetMap, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Observations de terrain IGN : [Licence Ouverte 2.0](https://www.etalab.gouv.fr/licence-ouverte-open-licence/).', '',
              'Les 415 altitudes de chaussée, largeurs gauche/droite et dévers restent `null`. `readyForRuntime` reste faux ; cette revue n’établit ni profil routier ni validation de course.', '']
    return '\n'.join(lines).encode('utf-8')


def prepare(directory):
    canonical = IMPORT.prepare(directory)
    for name, value in canonical.items():
        if IMPORT.local_path(directory, name).read_bytes() != encode(value):
            raise ValueError('Entree derivee differente des captures verifiees : ' + name)
    data = json.loads(IMPORT.local_path(directory, 'donnees.json').read_bytes())
    manifest = json.loads(IMPORT.local_path(directory, 'sources-mesures.json').read_bytes())
    names = sorted({'sources-mesures.json', *canonical, *(e['file'] for e in manifest['frozenGeometry']),
                    *(e['file'] for e in manifest['sources'])})
    inputs = []
    for name in names:
        raw = IMPORT.local_path(directory, name).read_bytes()
        inputs.append({'file': name, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
    provenance = {'networkUsed': False, 'rawSourcesVerified': True, 'derivedInputsReproduced': True, 'inputs': inputs}
    return build_review(data, canonical['mesures-terrain.json'], canonical['bilan-mesures.json'], provenance)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, default=DIRECTORY)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    report = prepare(args.directory)
    outputs = {OUTPUTS[0]: encode(report), OUTPUTS[1]: markdown(report)}
    if any((args.directory / name).is_symlink() for name in outputs):
        raise ValueError('Une sortie ne peut pas etre un lien symbolique')
    paths = {name: IMPORT.local_path(args.directory, name) for name in outputs}
    if args.check:
        drift = [name for name, path in paths.items() if not path.is_file() or path.read_bytes() != outputs[name]]
        if drift:
            raise ValueError('Sorties differentes ou absentes : ' + ', '.join(drift))
    else:
        for name, path in paths.items():
            path.write_bytes(outputs[name])
    print(json.dumps({**report['summary'], 'check': args.check}, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError, TypeError, OverflowError, ZeroDivisionError) as error:
        print('Monaco revue : ' + str(error), file=sys.stderr)
        raise SystemExit(1)
