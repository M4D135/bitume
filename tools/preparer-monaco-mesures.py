#!/usr/bin/env python3
"""Importe les captures IGN figees, hors reseau et hors geometrie de course.

Un MNT renseigne le terrain, pas la chaussee d'un ouvrage ou d'un tunnel.
Les trois sorties historiques et les inconnues du trace restent intactes.
"""
import argparse
from collections import Counter
from datetime import date
import hashlib
import json
import math
from pathlib import Path
import sys
from urllib.parse import parse_qs, urlsplit

sys.dont_write_bytecode = True
from monaco_mesures import construire_registre

DIRECTORY = Path(__file__).resolve().parents[1] / 'docs/references/monaco-2026'
FROZEN = {'donnees.json', 'comparaison.json', 'plan.svg', 'sources.json', 'reperes.json', 'topologie.json'}
OUTPUTS = ('mesures-terrain.json', 'mesures-controlees.json', 'bilan-mesures.json')
REVIEW_GRADE = .35  # Seuil de relecture des captures, jamais une limite de physique.


def finite(value):
    try:
        return type(value) in (int, float) and math.isfinite(value)
    except OverflowError:
        return False


def local_path(directory, name):
    if not isinstance(name, str) or not name or '\\' in name:
        raise ValueError('Chemin local invalide')
    relative = Path(name)
    path = (directory / relative).resolve()
    if relative.is_absolute() or '..' in relative.parts or not path.is_relative_to(directory.resolve()):
        raise ValueError('Chemin hors du dossier : ' + name)
    return path


def checked_bytes(directory, entry):
    raw = local_path(directory, entry['file']).read_bytes()
    if (type(entry['bytes']) is not int or len(raw) != entry['bytes']
            or hashlib.sha256(raw).hexdigest() != entry['sha256']):
        raise ValueError('Empreinte source differente : ' + entry['file'])
    return raw


def load(directory):
    manifest = json.loads(local_path(directory, 'sources-mesures.json').read_bytes())
    if manifest.get('schema') != 'bitume-monaco-metric-sources-v1':
        raise ValueError('Schema de manifeste inconnu')
    frozen = manifest['frozenGeometry']
    if len(frozen) != 6 or {e['file'] for e in frozen} != FROZEN:
        raise ValueError('Six entrees de geometrie figee requises')
    geometry = {e['file']: checked_bytes(directory, e) for e in frozen}
    sources, documents, paths = {}, {}, {local_path(directory, p) for p in (*FROZEN, *OUTPUTS)}
    if len(manifest['sources']) != 5:
        raise ValueError('Cinq captures IGN requises')
    for source in manifest['sources']:
        sid = source['id']
        path = local_path(directory, source['file'])
        if not isinstance(sid, str) or not sid or sid in sources or path in paths:
            raise ValueError('Identifiant source ou chemin duplique/invalide')
        sources[sid] = source
        paths.add(path)
        documents[sid] = json.loads(checked_bytes(directory, source))
    data = json.loads(geometry['donnees.json'])
    if len(data['points']) != 415 or len(data['edges']) != 415:
        raise ValueError('Les 415 points/aretes de reference sont requis')
    datasets = manifest['datasets']
    if len(datasets) != 2 or {d['id'] for d in datasets} != {'lidar', 'rge'}:
        raise ValueError('Deux jeux distincts lidar/rge requis')
    return manifest, data, sources, documents


def ring_contains(x, y, ring):
    """Rayon pair/impair ; la limite exterieure est incluse, celle d'un trou exclue."""
    inside = False
    for a, b in zip(ring, ring[1:]):
        ax, ay = a; bx, by = b
        cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax)
        if abs(cross) <= 1e-14 and min(ax, bx) <= x <= max(ax, bx) and min(ay, by) <= y <= max(ay, by):
            return True
        if (ay > y) != (by > y) and x < ax + (y - ay) * (bx - ax) / (by - ay):
            inside = not inside
    return inside


def contains_point(lon, lat, geometry):
    return any(ring_contains(lon, lat, polygon[0]) and not any(
        ring_contains(lon, lat, hole) for hole in polygon[1:]) for polygon in geometry['coordinates'])


def tile_date(value):
    if not isinstance(value, str):
        raise ValueError('Date de dalle absente')
    value = value[:-1] if value.endswith('Z') else value
    if len(value) != 10 or date.fromisoformat(value).isoformat() != value:
        raise ValueError('Date de dalle ISO invalide')
    return value


def read_tiles(manifest, source, document):
    contract = manifest['tileCoordinates']
    query = {k.lower(): v for k, v in parse_qs(urlsplit(source['url']).query).items()}
    if (contract['sourceId'] != source['id'] or source['method'] != 'GET'
            or query.get('srsname') != ['urn:ogc:def:crs:OGC::CRS84']
            or contract['requestedCrs'] != query['srsname'][0]
            or contract['observedCoordinateOrder'] != ['longitude', 'latitude']
            or document.get('crs', {}).get('properties', {}).get('name') != contract['responseCrsLabel']
            or document.get('type') != 'FeatureCollection'):
        raise ValueError('Contrat CRS84 longitude/latitude des dalles invalide')
    tiles, ids = [], set()
    for i, feature in enumerate(document['features']):
        geom, props, tid = feature['geometry'], feature['properties'], feature['id']
        if not isinstance(tid, str) or tid in ids or geom['type'] != 'MultiPolygon' or not geom['coordinates']:
            raise ValueError('Identifiant ou geometrie de dalle invalide')
        ids.add(tid)
        for polygon in geom['coordinates']:
            if not polygon:
                raise ValueError('Polygone de dalle vide')
            for ring in polygon:
                if len(ring) < 4 or ring[0] != ring[-1]:
                    raise ValueError('Anneau de dalle non ferme')
                if any(len(p) != 2 or not all(finite(v) for v in p) or not (-180 <= p[0] <= 180 and -90 <= p[1] <= 90) for p in ring):
                    raise ValueError('Coordonnees de dalle invalides')
        start, end = tile_date(props['date_debut_acquisition']), tile_date(props['date_fin_acquisition'])
        if start > end:
            raise ValueError('Intervalle acquisition inverse')
        tiles.append({'id': tid, 'sourceId': source['id'], 'locator': f'features[{i}]',
                      'verticalDatum': props.get('systeme_altimetrique'),
                      'acquisitionPeriod': {'start': start, 'end': end},
                      'editionDate': props.get('date_edition'), 'geometry': geom})
    return tiles


def coverage(point, tiles):
    matches = [t for t in tiles if contains_point(point['lon'], point['lat'], t['geometry'])]
    datums = {t['verticalDatum'] for t in matches}
    period = None
    if matches:
        period = {'start': min(t['acquisitionPeriod']['start'] for t in matches),
                  'end': max(t['acquisitionPeriod']['end'] for t in matches)}
    return {'tileIds': [t['id'] for t in matches],
            'verticalDatum': 'IGN69' if datums == {'IGN69'} else None,
            'acquisitionPeriod': period,
            'date': period['start'] if period and period['start'] == period['end'] else None}


def samples(dataset, points, sources, documents, manifest):
    sid, mid = dataset['samplesSourceId'], dataset['metadataSourceId']
    source, metadata = sources[sid], documents[mid]
    request = source['request']
    if (source['method'] != 'POST' or request.get('resource') != metadata['_id']
            or request.get('measures') != 'true' or request.get('delimiter') != '|'):
        raise ValueError('Requete des mesures incompatible avec les metadonnees')
    for key in ('lon', 'lat'):
        coords = [float(v) for v in request[key].split('|')]
        if coords != [p[key] for p in points] or not all(finite(v) for v in coords):
            raise ValueError('Ordre/coordonnees de requete differents du trace')
    title = dataset['measureTitle']
    specs = [s for s in metadata['data'] if s.get('title') == title]
    if len(specs) != 1:
        raise ValueError('Titre de mesure absent ou ambigu dans les metadonnees')
    definition = specs[0]['source']
    allowed = {definition['value']} if 'value' in definition else set(definition['mapping'].values())
    elevations = documents[sid]['elevations']
    if len(elevations) != len(points):
        raise ValueError('Nombre de mesures different des points')
    tile_id = dataset['tileMetadataSourceId']
    tiles = read_tiles(manifest, sources[tile_id], documents[tile_id]) if tile_id else []
    output, observations = [], []
    for i, (point, row) in enumerate(zip(points, elevations)):
        if any(not finite(row.get(k)) or row[k] != point[k] for k in ('lon', 'lat')):
            raise ValueError('Ordre/coordonnees de reponse differents du trace')
        chosen = [(j, m) for j, m in enumerate(row['measures']) if m.get('title') == title]
        if len(chosen) != 1:
            raise ValueError('Titre de mesure absent ou ambigu dans la reponse')
        j, measure = chosen[0]
        value, name = measure.get('z'), measure.get('source_name')
        reasons = []
        if not finite(value): reasons.append('non_finite_or_non_numeric')
        elif value == -99999: reasons.append('nodata_sentinel')
        if isinstance(name, str) and any(s in name.casefold() for s in ('pas de données', 'source mapping not found')):
            reasons.append('nodata_source')
        elif not isinstance(name, str) or name not in allowed:
            reasons.append('unknown_source_name')
        sample = {'sourceId': sid, 'metadataSourceId': mid, 'locator': f'elevations[{i}].measures[{j}]',
                  'measureTitle': title, 'sourceName': name if isinstance(name, str) else None,
                  'reportedAccuracy': measure.get('acc'), 'status': 'rejected' if reasons else 'observed_terrain',
                  'reasons': reasons, 'valueM': None if reasons else value, **coverage(point, tiles)}
        output.append(sample)
        if not reasons:
            observations.append({'id': f'{dataset["id"]}-{point["osmNodeId"]}', 'osmNodeId': point['osmNodeId'],
                                 'quantity': 'altitudeM', 'value': value, 'unit': 'm', 'kind': 'terrain',
                                 'sourceId': sid, 'locator': sample['locator'], 'date': sample['date'],
                                 'verticalDatum': sample['verticalDatum'], 'uncertainty': None})
    return output, observations, tiles


def prepare(directory):
    manifest, data, sources, documents = load(directory)
    points, observations, all_tiles = [], [], []
    tunnel_indices = {i % len(data['points']) for t in data['tunnelTags']
                      for i in range(t['firstEdgeIndex'], t['lastEdgeIndex'] + 2)}
    values = {}
    for dataset in manifest['datasets']:
        rows, obs, tiles = samples(dataset, data['points'], sources, documents, manifest)
        values[dataset['id']] = rows; observations.extend(obs); all_tiles.extend(tiles)
    for i, point in enumerate(data['points']):
        lidar, rge = values['lidar'][i], values['rge'][i]
        delta = None if any(s['valueM'] is None for s in (lidar, rge)) else round(lidar['valueM'] - rge['valueM'], 6)
        points.append({k: point[k] for k in ('index', 'osmNodeId', 'lon', 'lat', 'sM')})
        points[-1].update(tunnelTagged=i in tunnel_indices, samples={'lidar': lidar, 'rge': rge}, deltaLidarRgeM=delta)
    terrain = {'format': 'bitume-monaco-terrain-samples', 'version': 1, 'readyForRuntime': False,
               'comparisonIsDiagnosticOnly': True, 'tileCoordinates': manifest['tileCoordinates'],
               'tiles': [{k: v for k, v in t.items() if k != 'geometry'} for t in all_tiles], 'points': points}
    checked = construire_registre(data, manifest, {'format': 'bitume-monaco-measurements', 'version': 1, 'observations': observations})
    checked['importProvenance'] = {'sourceIntegrityVerified': True, 'sources': [
        {'id': s['id'], 'file': s['file'], 'sha256': s['sha256'], 'bytes': s['bytes']} for s in manifest['sources']],
        'frozenGeometry': manifest['frozenGeometry'], 'coordinateOrderVerified': True, 'networkUsed': False}
    differences = [{'index': p['index'], 'osmNodeId': p['osmNodeId'], 'deltaM': p['deltaLidarRgeM'],
                    'tunnelTagged': p['tunnelTagged']} for p in points if p['deltaLidarRgeM'] is not None]
    segments = []
    for did, rows in values.items():
        for i, edge in enumerate(data['edges']):
            a, b = rows[i]['valueM'], rows[(i + 1) % len(rows)]['valueM']
            if a is not None and b is not None and abs((b - a) / edge['lengthM']) > REVIEW_GRADE:
                segments.append({'dataset': did, 'edgeIndex': i, 'fromNodeId': edge['fromNodeId'],
                                 'toNodeId': edge['toNodeId'], 'runM': edge['lengthM'], 'deltaM': round(b - a, 6),
                                 'grade': round((b - a) / edge['lengthM'], 6),
                                 'tunnelTouching': i in tunnel_indices or (i + 1) % len(rows) in tunnel_indices})
    report = {'format': 'bitume-monaco-terrain-review', 'version': 1, 'readyForRuntime': False,
              'pointCount': len(points), 'tunnelTaggedPoints': len(tunnel_indices), 'observations': checked['summary'],
              'datasets': {did: {'observed': sum(r['status'] == 'observed_terrain' for r in rows),
                                'rejected': sum(r['status'] == 'rejected' for r in rows),
                                'rejectedByReason': dict(sorted(Counter(reason for r in rows for reason in r['reasons']).items())),
                                'unknownDatum': sum(r['verticalDatum'] is None for r in rows),
                                'unknownExactDate': sum(r['date'] is None for r in rows)} for did, rows in values.items()},
              'unknownRoadMeasurements': {k: sum(p[k] is None for p in data['points']) for k in ('y', 'leftWidthM', 'rightWidthM', 'bankRadians')},
              'comparisonIsDiagnosticOnly': True, 'comparisonCount': len(differences),
              'maxAbsDifferenceM': max((abs(p['deltaM']) for p in differences), default=None),
              'top20AbsoluteDifferences': sorted(differences, key=lambda p: (-abs(p['deltaM']), p['index']))[:20],
              'gradeReviewThreshold': REVIEW_GRADE, 'gradeThresholdIsPhysicsLimit': False, 'segmentsToReview': segments}
    results = dict(zip(OUTPUTS, (terrain, checked, report)))
    for value in results.values():
        value.update(sourcesManifest='sources-mesures.json',
                     attribution={'geometry': data['attribution'], 'terrain': 'IGN — MNT LiDAR HD et RGE ALTI'},
                     sourceLicenses={'geometry': 'https://opendatacommons.org/licenses/odbl/1-0/',
                                     'terrain': 'https://www.etalab.gouv.fr/licence-ouverte-open-licence/'})
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, default=DIRECTORY)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    results = prepare(args.directory)
    encoded = {name: (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode('utf-8')
               for name, value in results.items()}
    if any((args.directory / name).is_symlink() for name in encoded):
        raise ValueError('Une sortie ne peut pas etre un lien symbolique')
    paths = {name: local_path(args.directory, name) for name in encoded}
    if args.check:
        drift = [name for name, path in paths.items() if not path.is_file() or path.read_bytes() != encoded[name]]
        if drift: raise ValueError('Sorties differentes ou absentes : ' + ', '.join(drift))
    else:
        for name, path in paths.items(): path.write_bytes(encoded[name])
    report = results['bilan-mesures.json']
    print(json.dumps({'points': report['pointCount'], 'observations': report['observations']['total'],
                      'eligibleForRoadProfile': report['observations']['eligibleForRoadProfile'],
                      'maxAbsDifferenceM': report['maxAbsDifferenceM'], 'check': args.check}, ensure_ascii=False))


if __name__ == '__main__':
    try: main()
    except (OSError, ValueError, KeyError, TypeError, OverflowError) as error:
        print('Monaco mesures : ' + str(error), file=sys.stderr)
        raise SystemExit(1)
