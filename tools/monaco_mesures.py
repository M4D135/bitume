"""Valide des observations Monaco sans convertir ni remplir les donnees du jeu.

Le caller controle les octets/empreintes des sources. Ici seuls leurs identifiants
sont resolus. Une observation eligible reste une entree de profil a confronter aux
autres references ; elle ne rend jamais le circuit jouable.
"""
from collections import Counter, defaultdict
from copy import deepcopy
from datetime import date
import math

UNITS = {'altitudeM': 'm', 'leftWidthM': 'm', 'rightWidthM': 'm', 'bankRadians': 'rad'}
KINDS = ('terrain', 'chaussee', 'estime')
REQUIRED = {'id', 'osmNodeId', 'quantity', 'value', 'unit', 'kind', 'sourceId',
            'locator', 'date', 'uncertainty'}
OPTIONAL = {'verticalDatum', 'widthReference', 'bankReference', 'tunnelRoadConfirmed'}


def text(value, field):
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise ValueError('Texte absent ou invalide : ' + field)
    return value


def number(value, field):
    try:
        valid = type(value) in (int, float) and math.isfinite(value)
    except OverflowError:
        valid = False
    if not valid:
        raise ValueError('Nombre fini attendu, hors booleen : ' + field)
    return value


def identifier(value, field):
    if type(value) is not int or value <= 0:
        raise ValueError('Identifiant entier positif attendu : ' + field)
    return value


def construire_registre(donnees, manifeste, registre):
    """Retourne une copie annotee ; aucun argument ni fichier n'est modifie."""
    if not all(isinstance(v, dict) for v in (donnees, manifeste, registre)):
        raise ValueError('Donnees, manifeste et registre doivent etre des objets')
    if (registre.get('format') != 'bitume-monaco-measurements'
            or type(registre.get('version')) is not int or registre['version'] != 1
            or not isinstance(registre.get('observations'), list)):
        raise ValueError('Format de registre inconnu')
    source_rows, tunnel_rows = manifeste.get('sources'), donnees.get('tunnelTags', [])
    if not isinstance(source_rows, list) or not isinstance(tunnel_rows, list):
        raise ValueError('Sources et tunnels doivent etre des listes')
    sources, nodes, tunnels = set(), set(), set()
    for source in source_rows:
        if not isinstance(source, dict):
            raise ValueError('Source invalide')
        sid = text(source.get('id'), 'source.id')
        if sid in sources:
            raise ValueError('Identifiant source duplique : ' + sid)
        sources.add(sid)
    points = donnees.get('points')
    if not isinstance(points, list) or not points:
        raise ValueError('Points de reference absents')
    for point in points:
        if not isinstance(point, dict):
            raise ValueError('Point invalide')
        nid = identifier(point.get('osmNodeId'), 'point.osmNodeId')
        if nid in nodes:
            raise ValueError('Noeud de reference duplique')
        nodes.add(nid)
    for tunnel in tunnel_rows:
        if not isinstance(tunnel, dict):
            raise ValueError('Tunnel invalide')
        lo, hi = tunnel.get('firstEdgeIndex'), tunnel.get('lastEdgeIndex')
        if any(type(i) is not int for i in (lo, hi)) or not 0 <= lo <= hi < len(points):
            raise ValueError('Intervalle tunnel invalide')
        tunnels.update(points[i % len(points)]['osmNodeId'] for i in range(lo, hi + 2))
    observations, ids, groups = [], set(), defaultdict(list)
    for raw in registre['observations']:
        if not isinstance(raw, dict) or REQUIRED - raw.keys() or raw.keys() - REQUIRED - OPTIONAL:
            raise ValueError('Champs observation incomplets ou inconnus')
        obs = deepcopy(raw)
        oid = text(obs['id'], 'id')
        if oid in ids:
            raise ValueError('Identifiant observation duplique : ' + oid)
        ids.add(oid)
        nid = identifier(obs['osmNodeId'], 'osmNodeId')
        if nid not in nodes:
            raise ValueError('Noeud absent du parcours : ' + str(nid))
        quantity = text(obs['quantity'], 'quantity')
        if quantity not in UNITS or obs['unit'] != UNITS[quantity]:
            raise ValueError('Grandeur ou unite invalide')
        value = number(obs['value'], 'value')
        kind = text(obs['kind'], 'kind')
        if kind not in KINDS:
            raise ValueError('Nature observation invalide')
        if text(obs['sourceId'], 'sourceId') not in sources:
            raise ValueError('Source inconnue : ' + obs['sourceId'])
        text(obs['locator'], 'locator')
        if obs['date'] is not None:
            stamp = text(obs['date'], 'date')
            if len(stamp) != 10 or date.fromisoformat(stamp).isoformat() != stamp:
                raise ValueError('Date ISO YYYY-MM-DD attendue')
        uncertainty = obs['uncertainty']
        if uncertainty is not None and number(uncertainty, 'uncertainty') < 0:
            raise ValueError('Incertitude negative')
        datum = obs.get('verticalDatum')
        if datum is not None:
            text(datum, 'verticalDatum')
        if 'tunnelRoadConfirmed' in obs and type(obs['tunnelRoadConfirmed']) is not bool:
            raise ValueError('Confirmation tunnel booleenne attendue')
        if quantity in ('leftWidthM', 'rightWidthM'):
            if value <= 0 or obs.get('widthReference') != 'track-direction':
                raise ValueError('Largeur positive et reference track-direction requises')
        if quantity == 'bankRadians':
            if obs.get('bankReference') != 'right-edge-down-positive':
                raise ValueError('Reference devers right-edge-down-positive requise')
            if abs(value) >= math.pi / 2:
                raise ValueError('Devers hors intervalle ouvert -pi/2, pi/2')
        reasons = []
        if kind != 'chaussee':
            reasons.append('terrain_not_road' if kind == 'terrain' else 'estimated_not_surveyed_road')
        if uncertainty is None:
            reasons.append('uncertainty_unknown')
        if obs['date'] is None:
            reasons.append('measurement_date_unknown')
        if quantity == 'altitudeM':
            if datum is None:
                reasons.append('vertical_datum_unknown')
            if nid in tunnels and not obs.get('tunnelRoadConfirmed', False):
                reasons.append('tunnel_road_unconfirmed')
        obs['reasons'] = reasons
        observations.append(obs)
        groups[(nid, quantity, kind)].append(obs)
    conflicts = []
    for (nid, quantity, kind), group in groups.items():
        datums = {o.get('verticalDatum') for o in group if o.get('verticalDatum') is not None}
        reason = 'vertical_datum_mismatch' if quantity == 'altitudeM' and len(datums) > 1 else None
        for i, a in enumerate(group):
            for b in group[i + 1:]:
                comparable = quantity != 'altitudeM' or a.get('verticalDatum') == b.get('verticalDatum')
                if (comparable and a['uncertainty'] is not None and b['uncertainty'] is not None
                        and abs(a['value'] - b['value']) > a['uncertainty'] + b['uncertainty']):
                    reason = 'contradictory_observations'
        if reason:
            conflicts.append({'osmNodeId': nid, 'quantity': quantity, 'kind': kind,
                              'observationIds': [o['id'] for o in group], 'reason': reason})
            for obs in group:
                obs['reasons'].append(reason)
    for obs in observations:
        obs['eligibleForRoadProfile'] = not obs['reasons']
    eligible = sum(o['eligibleForRoadProfile'] for o in observations)
    counts = Counter(o['kind'] for o in observations)
    return {'format': 'bitume-monaco-measurements-checked', 'version': 1,
            'readyForRuntime': False, 'sourceIntegrityCheckedHere': False,
            'observations': observations,
            'summary': {'total': len(observations), 'eligibleForRoadProfile': eligible,
                        'ineligibleForRoadProfile': len(observations) - eligible,
                        'byKind': {kind: counts[kind] for kind in KINDS}, 'contradictionGroups': conflicts}}
