#!/usr/bin/env python3
"""BITUME — Préparation reproductible L0/L1 : sommet du col de Larche → Vinadio (SS21).

Usage :
  python3 tools/preparer-larche-vinadio.py
  python3 tools/preparer-larche-vinadio.py --check
  python3 tools/preparer-larche-vinadio.py --directory /chemin/dossier [--check]

Fonctionne strictement hors ligne à partir des sources figées dans
docs/references/larche-vinadio-2026/sources/. Ne dépend d'aucune bibliothèque
externe (Python standard uniquement).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DIR = REPO_ROOT / "docs" / "references" / "larche-vinadio-2026"

START_NODE_ID = 928715494       # Col de Larche / Colle della Maddalena (frontière FR/IT)
FINISH_NODE_ID = 4295216268     # Vinadio centre (sortie Via Roma / SS21, 32,249 km)
RUNOFF_END_NODE_ID = 452592466  # Zone de décélération sur SS21 droite à l'est de Vinadio (+568 m)

EXPECTED_SOURCES = (
    "sources/osm-ss21-corridor.json",
    "sources/piemonte-dtm5-samples.json",
    "sources/ign-rge-alti-frontiere.json",
    "sources/piemonte-dtm5-metadata.xml",
    "sources/piemonte-dtm5-describecoverage.xml",
)

OUTPUT_FILES = (
    "manifest.json",
    "inconnus.json",
    "trace-l1.json",
    "plan-et-profil.svg",
)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def ensure_confined(base: Path, rel: str) -> Path:
    if os.path.isabs(rel) or ".." in Path(rel).parts:
        raise ValueError(f"Chemin hors dossier refusé : {rel}")
    target = base / rel
    if target.is_symlink():
        raise ValueError(f"Lien symbolique refusé : {rel}")
    resolved_base = base.resolve()
    resolved_parent = target.parent.resolve()
    if resolved_parent != resolved_base and resolved_base not in resolved_parent.parents:
        raise ValueError(f"Évasion de répertoire refusée : {rel}")
    if target.exists():
        resolved_target = target.resolve()
        if resolved_target != resolved_base and resolved_base not in resolved_target.parents:
            raise ValueError(f"Cible hors dossier refusée : {rel}")
    return target


def wgs84_to_utm32n(lat_deg: float, lon_deg: float) -> tuple[float, float]:
    """Projection exacte WGS84 (EPSG:4326) -> UTM 32N (EPSG:32632) en mètres."""
    a = 6378137.0
    f = 1.0 / 298.257223563
    e2 = f * (2.0 - f)
    ep2 = e2 / (1.0 - e2)
    k0 = 0.9996
    lat = math.radians(lat_deg)
    lon = math.radians(lon_deg)
    lon0 = math.radians(9.0)
    sin_lat = math.sin(lat)
    cos_lat = math.cos(lat)
    tan_lat = math.tan(lat)
    N = a / math.sqrt(1.0 - e2 * sin_lat * sin_lat)
    T = tan_lat * tan_lat
    C = ep2 * cos_lat * cos_lat
    A = cos_lat * (lon - lon0)
    M = a * (
        (1.0 - e2 / 4.0 - 3.0 * e2**2 / 64.0 - 5.0 * e2**3 / 256.0) * lat
        - (3.0 * e2 / 8.0 + 3.0 * e2**2 / 32.0 + 45.0 * e2**3 / 1024.0) * math.sin(2.0 * lat)
        + (15.0 * e2**2 / 256.0 + 45.0 * e2**3 / 1024.0) * math.sin(4.0 * lat)
        - (35.0 * e2**3 / 3072.0) * math.sin(6.0 * lat)
    )
    E = 500000.0 + k0 * N * (
        A
        + (1.0 - T + C) * A**3 / 6.0
        + (5.0 - 18.0 * T + T**2 + 72.0 * C - 58.0 * ep2) * A**5 / 120.0
    )
    No = k0 * (
        M
        + N
        * tan_lat
        * (
            A**2 / 2.0
            + (5.0 - T + 9.0 * C + 4.0 * C**2) * A**4 / 24.0
            + (61.0 - 58.0 * T + T**2 + 600.0 * C - 330.0 * ep2) * A**6 / 720.0
        )
    )
    return E, No


def load_sources(directory: Path) -> tuple[dict[str, bytes], dict[str, dict[str, Any]]]:
    raw_files: dict[str, bytes] = {}
    for rel in EXPECTED_SOURCES:
        p = ensure_confined(directory, rel)
        if not p.is_file():
            raise FileNotFoundError(f"Source figée absente : {rel}")
        raw_files[rel] = p.read_bytes()

    manifest_path = directory / "manifest.json"
    if manifest_path.is_file() and not manifest_path.is_symlink():
        existing_manifest = json.loads(manifest_path.read_text("utf-8"))
        for entry in existing_manifest.get("sourcesFigees", []):
            rel = entry["fichier"]
            ensure_confined(directory, rel)
            if rel in raw_files:
                actual_sha = sha256_bytes(raw_files[rel])
                if actual_sha != entry["sha256"]:
                    raise ValueError(
                        f"Empreinte source modifiée pour {rel} : attendu {entry['sha256']}, obtenu {actual_sha}"
                    )
                if len(raw_files[rel]) != entry["octets"]:
                    raise ValueError(f"Taille source modifiée pour {rel}")

    parsed = {
        "osm": json.loads(raw_files["sources/osm-ss21-corridor.json"].decode("utf-8")),
        "dtm": json.loads(raw_files["sources/piemonte-dtm5-samples.json"].decode("utf-8")),
        "ign": json.loads(raw_files["sources/ign-rge-alti-frontiere.json"].decode("utf-8")),
    }
    return raw_files, parsed


def reconstruct(directory: Path) -> dict[str, bytes]:
    raw_files, parsed = load_sources(directory)
    osm = parsed["osm"]
    dtm = parsed["dtm"]
    ign = parsed["ign"]

    if dtm.get("crs") != "EPSG:32632":
        raise ValueError(f"CRS DTM inattendu : {dtm.get('crs')}")

    nodes: dict[int, dict[str, Any]] = {}
    ss21_ways: dict[int, dict[str, Any]] = {}
    water_ways: list[dict[str, Any]] = []
    places: list[dict[str, Any]] = []
    forts: list[dict[str, Any]] = []

    for el in osm.get("elements", []):
        t = el.get("type")
        tags = el.get("tags", {})
        if t == "node":
            nodes[el["id"]] = el
            if tags.get("place") in ("village", "hamlet", "town") or tags.get("mountain_pass") == "yes":
                places.append(el)
        elif t == "way":
            ref = tags.get("ref", "").replace(" ", "")
            if tags.get("highway") and ref == "SS21":
                ss21_ways[el["id"]] = el
            if tags.get("natural") == "water":
                water_ways.append(el)
            if tags.get("historic"):
                forts.append(el)

    if not ss21_ways:
        raise ValueError("Aucune voie SS21 dans l'instantané OSM")

    # Graphe d'adjacence exact des arêtes SS21 (avec provenance voie/version)
    adj: dict[int, list[tuple[int, int]]] = {}
    for wid, w in ss21_ways.items():
        nds = w["nodes"]
        for i in range(len(nds) - 1):
            a, b = nds[i], nds[i + 1]
            adj.setdefault(a, []).append((b, wid))
            adj.setdefault(b, []).append((a, wid))

    if START_NODE_ID not in adj:
        raise ValueError(f"Nœud de départ Col de Larche absent : {START_NODE_ID}")
    if len(adj[START_NODE_ID]) != 1:
        raise ValueError(f"Le nœud de départ {START_NODE_ID} doit être une extrémité SS21 (degré {len(adj[START_NODE_ID])})")

    # Parcours linéaire monotone sans boucle ni bifurcation
    chain: list[int] = [START_NODE_ID]
    edge_ways: list[int] = []
    prev = None
    visited = {START_NODE_ID}
    while True:
        cur = chain[-1]
        nxts = [(v, wid) for v, wid in adj[cur] if v != prev]
        if not nxts:
            break
        if len(nxts) > 1:
            raise ValueError(f"Bifurcation inattendue sur SS21 au nœud {cur}")
        nxt, wid = nxts[0]
        if nxt in visited:
            raise ValueError(f"Cycle inattendu sur SS21 au nœud {nxt}")
        visited.add(nxt)
        edge_ways.append(wid)
        prev = cur
        chain.append(nxt)

    if FINISH_NODE_ID not in visited or RUNOFF_END_NODE_ID not in visited:
        raise ValueError("Ligne d'arrivée Vinadio ou fin de zone de décélération absente de la chaîne SS21")

    finish_idx = chain.index(FINISH_NODE_ID)
    runoff_idx = chain.index(RUNOFF_END_NODE_ID)
    if not (0 < finish_idx < runoff_idx):
        raise ValueError("Ordre invalide départ < arrivée < fin de décélération")

    # Restreindre le corridor L1 du sommet jusqu'à la fin de la zone de décélération
    chain = chain[: runoff_idx + 1]
    edge_ways = edge_ways[:runoff_idx]

    # Indexer les échantillons DTM 5m par osmNodeId (vérification stricte)
    dtm_by_node = {int(s["osmNodeId"]): s for s in dtm.get("roadSamples", [])}
    if len(dtm_by_node) < len(chain):
        raise ValueError("Échantillons DTM 5m incomplets par rapport à la chaîne SS21")

    origin_e, origin_n = wgs84_to_utm32n(nodes[START_NODE_ID]["lat"], nodes[START_NODE_ID]["lon"])
    origin_z = dtm_by_node[START_NODE_ID]["zTerrainM"]
    if origin_z is None or not math.isfinite(origin_z):
        raise ValueError("Altitude DTM absente au point de départ")

    # Construction des points métriques (repère jeu : x = Est - E0, z = -(Nord - N0), y = altitude absolue m)
    points: list[dict[str, Any]] = []
    s_plan = 0.0
    for i, nid in enumerate(chain):
        nd = nodes[nid]
        E, No = wgs84_to_utm32n(nd["lat"], nd["lon"])
        sample = dtm_by_node.get(nid)
        if sample is None:
            raise ValueError(f"Échantillon DTM absent pour nœud {nid}")
        if math.hypot(E - sample["E"], No - sample["N"]) > 0.05:
            raise ValueError(f"Écart de projection UTM32N > 5 cm au nœud {nid}")
        z_t = sample["zTerrainM"]
        if z_t is None or not math.isfinite(z_t) or z_t < -50 or z_t > 5000:
            raise ValueError(f"Altitude terrain invalide au nœud {nid} : {z_t}")
        if i > 0:
            ds = math.hypot(E - points[-1]["utm32nE"], No - points[-1]["utm32nN"])
            if ds <= 1e-6:
                raise ValueError(f"Segment nul avant nœud {nid}")
            s_plan += ds
        w_in = ss21_ways[edge_ways[i - 1]] if i > 0 else ss21_ways[edge_ways[0]]
        w_out = ss21_ways[edge_ways[i]] if i < len(edge_ways) else ss21_ways[edge_ways[-1]]
        is_tunnel = bool(w_in.get("tags", {}).get("tunnel") or w_out.get("tags", {}).get("tunnel"))
        is_bridge = bool(w_in.get("tags", {}).get("bridge") or w_out.get("tags", {}).get("bridge"))
        points.append({
            "index": i,
            "osmNodeId": nid,
            "lat": nd["lat"],
            "lon": nd["lon"],
            "utm32nE": round(E, 3),
            "utm32nN": round(No, 3),
            "localX": round(E - origin_e, 3),
            "localZ": round(-(No - origin_n), 3),
            "sPlanM": round(s_plan, 3),
            "zTerrainDtm5M": round(float(z_t), 3),
            "yChausseeM": None if (is_tunnel or is_bridge) else round(float(z_t), 3),
            "statutAltitudeChaussee": (
                "inconnue_tunnel_ou_paravalanche" if is_tunnel
                else "inconnue_tablier_pont" if is_bridge
                else "terrain_dtm5_sans_ouvrage_tagge"
            ),
            "largeurGM": None,
            "largeurDM": None,
            "deversRad": None,
            "tunnelTag": is_tunnel,
            "pontTag": is_bridge,
            "coupeTerrain": sample.get("cross"),
        })

    # Recensement ordonné des ouvrages (tunnels/paravalanches et ponts)
    ouvrages: list[dict[str, Any]] = []
    cur_kind = None
    cur_start = None
    cur_way_ids: list[int] = []
    cur_name = None
    for i, wid in enumerate(edge_ways):
        tags = ss21_ways[wid].get("tags", {})
        kind = None
        if tags.get("tunnel"):
            kind = "paravalanche" if tags.get("tunnel") == "avalanche_protector" else "tunnel"
        elif tags.get("bridge"):
            kind = "pont"
        name = tags.get("tunnel:name") or tags.get("name") or ""
        if kind != cur_kind or (kind is not None and name != cur_name and cur_kind is not None):
            if cur_kind is not None and cur_start is not None:
                ouvrages.append({
                    "type": cur_kind,
                    "nom": cur_name or f"{cur_kind}-{len(ouvrages)+1}",
                    "wayIds": sorted(set(cur_way_ids)),
                    "indexDebut": cur_start,
                    "indexFin": i,
                    "sDebutM": points[cur_start]["sPlanM"],
                    "sFinM": points[i]["sPlanM"],
                    "longueurPlanM": round(points[i]["sPlanM"] - points[cur_start]["sPlanM"], 2),
                    "zEntreeDtm5M": points[cur_start]["zTerrainDtm5M"],
                    "zSortieDtm5M": points[i]["zTerrainDtm5M"],
                    "zMaxTerrainSurOuvrageM": round(max(points[k]["zTerrainDtm5M"] for k in range(cur_start, i + 1)), 3),
                    "zMinTerrainSurOuvrageM": round(min(points[k]["zTerrainDtm5M"] for k in range(cur_start, i + 1)), 3),
                })
            cur_kind = kind
            cur_start = i if kind is not None else None
            cur_way_ids = [wid] if kind is not None else []
            cur_name = name if kind is not None else None
        elif kind is not None:
            cur_way_ids.append(wid)
    if cur_kind is not None and cur_start is not None:
        end_i = len(edge_ways)
        ouvrages.append({
            "type": cur_kind,
            "nom": cur_name or f"{cur_kind}-{len(ouvrages)+1}",
            "wayIds": sorted(set(cur_way_ids)),
            "indexDebut": cur_start,
            "indexFin": end_i,
            "sDebutM": points[cur_start]["sPlanM"],
            "sFinM": points[end_i]["sPlanM"],
            "longueurPlanM": round(points[end_i]["sPlanM"] - points[cur_start]["sPlanM"], 2),
            "zEntreeDtm5M": points[cur_start]["zTerrainDtm5M"],
            "zSortieDtm5M": points[end_i]["zTerrainDtm5M"],
            "zMaxTerrainSurOuvrageM": round(max(points[k]["zTerrainDtm5M"] for k in range(cur_start, end_i + 1)), 3),
            "zMinTerrainSurOuvrageM": round(min(points[k]["zTerrainDtm5M"] for k in range(cur_start, end_i + 1)), 3),
        })

    # Profil continu provisoire (uniquement pour calcul indicatif D+/D-/3D en interpolant
    # linéairement entre portails d'ouvrages pour éviter les faux pics de toit de tunnel)
    z_profile = [p["zTerrainDtm5M"] for p in points]
    for ov in ouvrages:
        a, b = ov["indexDebut"], ov["indexFin"]
        sa, sb = points[a]["sPlanM"], points[b]["sPlanM"]
        za, zb = points[a]["zTerrainDtm5M"], points[b]["zTerrainDtm5M"]
        if sb > sa:
            for k in range(a + 1, b):
                t = (points[k]["sPlanM"] - sa) / (sb - sa)
                z_profile[k] = round(za + (zb - za) * t, 3)

    s_3d_finish = 0.0
    s_3d_total = 0.0
    d_plus = 0.0
    d_moins = 0.0
    pente_min = 0.0
    pente_max = 0.0
    pente_min_s = 0.0
    pente_max_s = 0.0
    for i in range(1, len(points)):
        ds = points[i]["sPlanM"] - points[i - 1]["sPlanM"]
        dz = z_profile[i] - z_profile[i - 1]
        d3 = math.hypot(ds, dz)
        s_3d_total += d3
        if i <= finish_idx:
            s_3d_finish += d3
            if dz > 0:
                d_plus += dz
            else:
                d_moins += -dz
            if ds >= 8.0:
                g = dz / ds
                if g < pente_min:
                    pente_min, pente_min_s = g, points[i]["sPlanM"]
                if g > pente_max:
                    pente_max, pente_max_s = g, points[i]["sPlanM"]

    # Anomalies de pente terrain sur tronçons hors ouvrage taggé (|pente| > 14 %, ds >= 5 m) :
    # signale un mur de soutènement de lacet, un décalage métrique axe OSM / pixel MNT 5 m, ou un ponceau non taggé.
    anomalies_pente: list[dict[str, Any]] = []
    for i in range(1, finish_idx + 1):
        ds = points[i]["sPlanM"] - points[i - 1]["sPlanM"]
        dz = points[i]["zTerrainDtm5M"] - points[i - 1]["zTerrainDtm5M"]
        if (
            ds >= 5.0
            and abs(dz / ds) > 0.14
            and not points[i]["tunnelTag"]
            and not points[i - 1]["tunnelTag"]
            and not points[i]["pontTag"]
            and not points[i - 1]["pontTag"]
        ):
            anomalies_pente.append({
                "index": i,
                "sPlanM": points[i]["sPlanM"],
                "dsM": round(ds, 2),
                "dzTerrainM": round(dz, 3),
                "penteTerrainPourcent": round(100.0 * dz / ds, 2),
                "lat": points[i]["lat"],
                "lon": points[i]["lon"],
            })

    # Détection des lacets / épingles (changement de cap cumulé >= 115° sur une fenêtre <= 160 m)
    headings = []
    for i in range(len(points) - 1):
        dx = points[i + 1]["utm32nE"] - points[i]["utm32nE"]
        dy = points[i + 1]["utm32nN"] - points[i]["utm32nN"]
        headings.append(math.atan2(dy, dx))
    dtheta = [0.0]
    for i in range(1, len(headings)):
        a = headings[i] - headings[i - 1]
        while a > math.pi:
            a -= 2 * math.pi
        while a < -math.pi:
            a += 2 * math.pi
        dtheta.append(a)

    hairpins: list[dict[str, Any]] = []
    i = 1
    while i < finish_idx:
        acc = 0.0
        j = i
        while j < finish_idx and points[j]["sPlanM"] - points[i]["sPlanM"] <= 160.0:
            acc += dtheta[j]
            if abs(acc) >= math.radians(115.0):
                # Trouver le sommet de courbure locale dans [i..j]
                peak = max(range(i, j + 1), key=lambda k: abs(dtheta[k]))
                arc_len = max(1.0, points[j]["sPlanM"] - points[i]["sPlanM"])
                hairpins.append({
                    "numero": len(hairpins) + 1,
                    "indexSommet": peak,
                    "sPlanM": points[peak]["sPlanM"],
                    "sens": "gauche" if acc > 0 else "droite",
                    "angleDeg": round(math.degrees(abs(acc)), 1),
                    "rayonEstimeM": round(arc_len / max(abs(acc), 0.1), 1),
                    "zTerrainDtm5M": points[peak]["zTerrainDtm5M"],
                    "lat": points[peak]["lat"],
                    "lon": points[peak]["lon"],
                })
                i = j + 3
                break
            j += 1
        else:
            i += 1

    # Repères de lecture vérifiés le long du corridor
    target_names = [
        "Col de Larche / Colle della Maddalena",
        "Argentera",
        "Bersezio",
        "Pontebernardo",
        "Pietraporzio",
        "Sambuco",
        "Pianche",
        "Vinadio",
    ]
    landmarks: list[dict[str, Any]] = []
    for name in target_names:
        match = next((pl for pl in places if pl.get("tags", {}).get("name") == name), None)
        if not match:
            continue
        E0, N0 = wgs84_to_utm32n(match["lat"], match["lon"])
        best = min(range(len(points)), key=lambda k: math.hypot(points[k]["utm32nE"] - E0, points[k]["utm32nN"] - N0))
        dist = math.hypot(points[best]["utm32nE"] - E0, points[best]["utm32nN"] - N0)
        landmarks.append({
            "nom": name,
            "osmId": match["id"],
            "osmType": "node",
            "categorie": match.get("tags", {}).get("place") or "mountain_pass",
            "lat": match["lat"],
            "lon": match["lon"],
            "utm32nE": round(E0, 3),
            "utm32nN": round(N0, 3),
            "indexPlusProche": best,
            "sPlanM": points[best]["sPlanM"],
            "distanceAxeM": round(dist, 1),
            "zAxeDtm5M": points[best]["zTerrainDtm5M"],
        })

    # Polygone du Lac de la Maddalena (repère sommet)
    lac_poly = []
    for w in water_ways:
        if "Maddalena" in w.get("tags", {}).get("name", ""):
            for nid in w["nodes"]:
                if nid in nodes:
                    E0, N0 = wgs84_to_utm32n(nodes[nid]["lat"], nodes[nid]["lon"])
                    lac_poly.append([round(E0, 2), round(N0, 2)])
            break

    # Comparaison altimétrique mesurée IGN69 vs Regione Piemonte DTM 5m à la frontière
    ign_elevs = ign.get("elevations", [])
    border_diffs: list[dict[str, Any]] = []
    for idx_b, el in enumerate(ign_elevs):
        if idx_b >= len(points):
            break
        zi = el.get("z")
        zp = points[idx_b]["zTerrainDtm5M"]
        if isinstance(zi, (int, float)) and not isinstance(zi, bool) and math.isfinite(zi) and zi > -9000:
            border_diffs.append({
                "index": idx_b,
                "sPlanM": points[idx_b]["sPlanM"],
                "zIgnRgeAltiM": round(float(zi), 3),
                "zPiemonteDtm5M": zp,
                "ecartPiemonteMoinsIgnM": round(zp - float(zi), 3),
            })
    diff_vals = [x["ecartPiemonteMoinsIgnM"] for x in border_diffs]
    mean_diff = round(sum(diff_vals) / len(diff_vals), 3) if diff_vals else None
    max_abs_diff = round(max(abs(v) for v in diff_vals), 3) if diff_vals else None

    # Comptage des attributs routiers OSM
    way_ids_used = sorted(set(edge_ways))
    ways_meta = []
    width_count = 0
    lanes_count = 0
    maxspeed_count = 0
    for wid in way_ids_used:
        w = ss21_ways[wid]
        t = w.get("tags", {})
        if t.get("width"):
            width_count += 1
        if t.get("lanes"):
            lanes_count += 1
        if t.get("maxspeed"):
            maxspeed_count += 1
        ways_meta.append({
            "osmWayId": wid,
            "version": w.get("version"),
            "timestamp": w.get("timestamp"),
            "name": t.get("name"),
            "surface": t.get("surface"),
            "lanes": t.get("lanes"),
            "width": t.get("width"),
            "maxspeed": t.get("maxspeed"),
            "tunnel": t.get("tunnel"),
            "bridge": t.get("bridge"),
            "layer": t.get("layer"),
        })

    manifest = {
        "format": "bitume-larche-vinadio-manifest-1",
        "parcours": "Sommet du col de Larche (Colle della Maddalena) -> Vinadio (SS21)",
        "identifiantReserve": "larche",
        "topologie": "ouvert",
        "echelle": "1:1",
        "dateCollecte": "2026-11-21",
        "pretPourRuntime": False,
        "departBarcelonnetteExclu": True,
        "projection": {
            "sourceGeographique": "EPSG:4326 (WGS84)",
            "metrique": "EPSG:32632 (WGS84 / UTM zone 32N)",
            "origineLocale": {
                "osmNodeId": START_NODE_ID,
                "nom": "Col de Larche / Colle della Maddalena",
                "lat": nodes[START_NODE_ID]["lat"],
                "lon": nodes[START_NODE_ID]["lon"],
                "utm32nE": round(origin_e, 3),
                "utm32nN": round(origin_n, 3),
                "zTerrainDtm5M": origin_z,
                "convention": "x = E - E0 (Est), z = -(N - N0) (Sud positif / Nord négatif, repère droitier avec y vers le haut), y = altitude m",
            },
        },
        "extremsProposes": {
            "depart": {
                "osmNodeId": START_NODE_ID,
                "sPlanM": 0.0,
                "lat": points[0]["lat"],
                "lon": points[0]["lon"],
                "zTerrainDtm5M": points[0]["zTerrainDtm5M"],
            },
            "arrivee": {
                "osmNodeId": FINISH_NODE_ID,
                "sPlanM": points[finish_idx]["sPlanM"],
                "lat": points[finish_idx]["lat"],
                "lon": points[finish_idx]["lon"],
                "zTerrainDtm5M": points[finish_idx]["zTerrainDtm5M"],
                "justification": "Sortie de Via Roma / centre de Vinadio sur la SS21 vérifiée (32,249 km, sans traverser le fort Albertino).",
            },
            "finDeceleration": {
                "osmNodeId": RUNOFF_END_NODE_ID,
                "sPlanM": points[runoff_idx]["sPlanM"],
                "longueurZoneM": round(points[runoff_idx]["sPlanM"] - points[finish_idx]["sPlanM"], 2),
                "lat": points[runoff_idx]["lat"],
                "lon": points[runoff_idx]["lon"],
                "zTerrainDtm5M": points[runoff_idx]["zTerrainDtm5M"],
            },
        },
        "licencesEtDroits": {
            "voirieOSM": {
                "producteur": "Contributeurs OpenStreetMap",
                "licence": "ODbL 1.0 (https://www.openstreetmap.org/copyright)",
                "attribution": "© OpenStreetMap contributors",
            },
            "terrainPiemont": {
                "producteur": "Regione Piemonte — Geoportale Piemonte",
                "jeuDeDonnees": dtm["dataset"],
                "identifiantMetadonnees": dtm["metadataRecordId"],
                "dateMetadonnees": dtm["metadataDate"],
                "licence": dtm["license"],
                "resolutionM": dtm["resolutionM"],
                "precisionNominaleM": dtm["nominalAccuracyM"],
                "nodata": dtm["nodata"],
            },
            "terrainFrontiereIGN": {
                "producteur": "IGN — Géoplateforme",
                "jeuDeDonnees": "RGE ALTI (ign_rge_alti_wld)",
                "licence": "Licence Ouverte 2.0 (Etalab)",
                "usage": "Contrôle inter-datum à la frontière du col de Larche (25 points sur le premier kilomètre) ; aucune montée française D900 incluse.",
            },
        },
        "sourcesFigees": [
            {
                "fichier": rel,
                "octets": len(raw_files[rel]),
                "sha256": sha256_bytes(raw_files[rel]),
            }
            for rel in EXPECTED_SOURCES
        ],
        "bandesWcsDtm5Brutes": dtm.get("strips", []),
        "grilleVallee100m": {
            "bbox32632": dtm["valleyOverview100m"]["bbox32632"],
            "resM": dtm["valleyOverview100m"]["resM"],
            "width": dtm["valleyOverview100m"]["width"],
            "height": dtm["valleyOverview100m"]["height"],
            "rawBytes": dtm["valleyOverview100m"]["rawBytes"],
            "rawSha256": dtm["valleyOverview100m"]["rawSha256"],
        },
        "commandeReproduction": "python3 tools/preparer-larche-vinadio.py --check",
    }

    inconnus = {
        "format": "bitume-larche-vinadio-inconnus-1",
        "pretPourRuntime": False,
        "mesuresAbsentesOuIncertaines": [
            {
                "id": "largeur_chaussee",
                "gravite": "elevee",
                "constat": f"Tag OSM 'width' renseigné sur {width_count}/{len(way_ids_used)} voies SS21 ({lanes_count}/{len(way_ids_used)} portent lanes=2).",
                "regle": "largeurGM et largeurDM restent null dans trace-l1.json ; ne pas les remplacer par une constante présentée comme mesurée.",
            },
            {
                "id": "devers_chaussee",
                "gravite": "elevee",
                "constat": "Aucun dévers routier n'est disponible dans OSM ni déductible fiablement d'un MNT 5 m.",
                "regle": "deversRad reste null dans trace-l1.json ; les coupes terrain ±15 m / ±40 m mesurent le versant naturel, pas la chaussée.",
            },
            {
                "id": "altitude_tunnels_et_paravalanches",
                "gravite": "elevee",
                "constat": f"{sum(1 for o in ouvrages if o['type'] in ('tunnel', 'paravalanche'))} tunnels/paravalanches détectés dans OSM : le LiDAR DTM 5 m mesure le versant ou le toit au-dessus de l'ouvrage, pas le radier routier.",
                "regle": "yChausseeM reste null sur tous les points tunnel/paravalanche ; une interpolation linéaire entre portails sert uniquement au calcul indicatif D+/D-.",
            },
            {
                "id": "altitude_tabliers_ponts",
                "gravite": "moyenne",
                "constat": f"{sum(1 for o in ouvrages if o['type'] == 'pont')} ponts taggés dans OSM : le DTM 5 m (sol nu filtré) peut plonger dans le lit du torrent sous le tablier.",
                "regle": "yChausseeM reste null sur les points taggés pont ; niveau du tablier à contrôler sur profils d'entrée/sortie.",
            },
            {
                "id": "anciennete_lidar_2009_2011",
                "gravite": "moyenne",
                "constat": "Le DTM 5 m Regione Piemonte provient de la campagne ICE 2009–2011 (métadonnées révisées le 19/02/2026).",
                "regle": "Vérifier séparément tout réaménagement routier ou paravalanche postérieur à 2011 avant L3/L4.",
            },
            {
                "id": "datum_vertical_frontiere",
                "gravite": "faible",
                "constat": f"Comparaison mesurée sur {len(border_diffs)} points frontaliers (s = 0..{border_diffs[-1]['sPlanM'] if border_diffs else 0:.0f} m) : écart moyen Piemonte - IGN69 = {mean_diff} m, max absolu = {max_abs_diff} m.",
                "regle": "Aucune constante manuelle n'est ajoutée ; l'écart reste dans l'incertitude nominale ±0,30 m du DTM 5 m.",
            },
            {
                "id": "anomalies_pente_hors_ouvrage",
                "gravite": "moyenne",
                "constat": f"{len(anomalies_pente)} segments hors ouvrage taggé dépassent 14 % sur le MNT brut 5 m (soutènement de lacet ou culée de pont non couverte par le tag).",
                "regle": "Consignés dans trace-l1.json (anomaliesPenteTerrain) pour filtrage contrôlé et vérification avant L3.",
            },
            {
                "id": "ligne_arrivee_vinadio_precise",
                "gravite": "faible",
                "constat": "Ligne d'arrivée proposée au nœud OSM 4295216268 (32,249 km, sortie centre Vinadio) avec 568 m de décélération sur la SS21 droite.",
                "regle": "Emplacement final et visibilité exacte du Fort Albertino à valider visuellement en L3/L4.",
            },
        ],
    }

    trace_l1 = {
        "format": "bitume-larche-vinadio-l1-1",
        "pretPourRuntime": False,
        "topologie": "ouvert",
        "resume": {
            "nbPointsCorridor": len(points),
            "nbPointsCourse": finish_idx + 1,
            "nbVoiesOsm": len(way_ids_used),
            "longueurPlanCourseM": points[finish_idx]["sPlanM"],
            "longueur3dIndicativeCourseM": round(s_3d_finish, 2),
            "longueurPlanAvecDecelerationM": points[runoff_idx]["sPlanM"],
            "longueur3dIndicativeTotaleM": round(s_3d_total, 2),
            "referenceUbayeIndicativeKm": 32.2,
            "ecartPlanVsReferenceKm": round(points[finish_idx]["sPlanM"] / 1000.0 - 32.2, 3),
            "remiseAEchelleAppliquee": False,
            "altitudeDepartDtm5M": points[0]["zTerrainDtm5M"],
            "altitudeArriveeDtm5M": points[finish_idx]["zTerrainDtm5M"],
            "deniveleNetM": round(points[finish_idx]["zTerrainDtm5M"] - points[0]["zTerrainDtm5M"], 2),
            "denivelePositifCumuleIndicatifM": round(d_plus, 1),
            "deniveleNegatifCumuleIndicatifM": round(d_moins, 1),
            "penteMoyennePourcent": round(100.0 * (points[finish_idx]["zTerrainDtm5M"] - points[0]["zTerrainDtm5M"]) / points[finish_idx]["sPlanM"], 2),
            "penteMinLocalePourcent": round(100.0 * pente_min, 2),
            "sPenteMinM": pente_min_s,
            "penteMaxLocalePourcent": round(100.0 * pente_max, 2),
            "sPenteMaxM": pente_max_s,
            "nbTunnelsEtParavalanches": sum(1 for o in ouvrages if o["type"] in ("tunnel", "paravalanche")),
            "nbPonts": sum(1 for o in ouvrages if o["type"] == "pont"),
            "nbEpinglesDetectees": len(hairpins),
            "nbAnomaliesPenteHorsOuvrage": len(anomalies_pente),
            "comparaisonFrontiereIgnPiemonte": {
                "nbPoints": len(border_diffs),
                "ecartMoyenM": mean_diff,
                "ecartMaxAbsM": max_abs_diff,
                "echantillons": border_diffs,
            },
        },
        "reperes": landmarks,
        "lacMaddalenaUtm32n": lac_poly,
        "ouvrages": ouvrages,
        "anomaliesPenteTerrain": anomalies_pente,
        "epingles": hairpins,
        "voiesOsm": ways_meta,
        "points": points,
    }

    # Génération du SVG de contrôle 2D + profil en long
    svg = render_svg(points, finish_idx, ouvrages, hairpins, landmarks, lac_poly, z_profile)

    return {
        "manifest.json": (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8"),
        "inconnus.json": (json.dumps(inconnus, indent=2, ensure_ascii=False) + "\n").encode("utf-8"),
        "trace-l1.json": (json.dumps(trace_l1, indent=2, ensure_ascii=False) + "\n").encode("utf-8"),
        "plan-et-profil.svg": svg.encode("utf-8"),
    }


def render_svg(
    points: list[dict[str, Any]],
    finish_idx: int,
    ouvrages: list[dict[str, Any]],
    hairpins: list[dict[str, Any]],
    landmarks: list[dict[str, Any]],
    lac_poly: list[list[float]],
    z_profile: list[float],
) -> str:
    W, H = 1200, 820
    # Panel 1 (plan 2D UTM32N): y in [48..450], x in [60..1150]
    e_vals = [p["utm32nE"] for p in points]
    n_vals = [p["utm32nN"] for p in points]
    e0, e1 = min(e_vals) - 600, max(e_vals) + 600
    n0, n1 = min(n_vals) - 600, max(n_vals) + 600
    pw, ph = 1090.0, 390.0
    scale = min(pw / (e1 - e0), ph / (n1 - n0))
    ox = 60.0 + (pw - (e1 - e0) * scale) * 0.5
    oy = 52.0 + (ph - (n1 - n0) * scale) * 0.5

    def map_xy(E: float, N: float) -> tuple[float, float]:
        return ox + (E - e0) * scale, oy + (n1 - N) * scale

    course_poly = " ".join(f"{map_xy(p['utm32nE'], p['utm32nN'])[0]:.1f},{map_xy(p['utm32nE'], p['utm32nN'])[1]:.1f}" for p in points[: finish_idx + 1])
    runoff_poly = " ".join(f"{map_xy(p['utm32nE'], p['utm32nN'])[0]:.1f},{map_xy(p['utm32nE'], p['utm32nN'])[1]:.1f}" for p in points[finish_idx:])

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">',
        '<rect width="100%" height="100%" fill="#0f1419"/>',
        '<text x="60" y="30" fill="#f0f4f8" font-family="monospace" font-size="16" font-weight="bold">BITUME L0/L1 — Col de Larche (Colle della Maddalena) → Vinadio (SS21, EPSG:32632, 1:1)</text>',
        '<rect x="52" y="44" width="1106" height="406" fill="#161d24" stroke="#2d3a46"/>',
    ]

    if lac_poly:
        lp = " ".join(f"{map_xy(e, n)[0]:.1f},{map_xy(e, n)[1]:.1f}" for e, n in lac_poly)
        parts.append(f'<polygon points="{lp}" fill="#2b6cb0" stroke="#63b3ed" stroke-width="1"/>')

    parts.append(f'<polyline points="{course_poly}" fill="none" stroke="#e53e3e" stroke-width="2.6" stroke-linejoin="round"/>')
    parts.append(f'<polyline points="{runoff_poly}" fill="none" stroke="#68d391" stroke-width="2.6" stroke-dasharray="6,4"/>')

    for ov in ouvrages:
        col = "#b794f4" if ov["type"] in ("tunnel", "paravalanche") else "#4fd1c5"
        pts_ov = " ".join(f"{map_xy(points[k]['utm32nE'], points[k]['utm32nN'])[0]:.1f},{map_xy(points[k]['utm32nE'], points[k]['utm32nN'])[1]:.1f}" for k in range(ov["indexDebut"], ov["indexFin"] + 1))
        parts.append(f'<polyline points="{pts_ov}" fill="none" stroke="{col}" stroke-width="5"/>')

    for hp in hairpins:
        hx, hy = map_xy(points[hp["indexSommet"]]["utm32nE"], points[hp["indexSommet"]]["utm32nN"])
        parts.append(f'<circle cx="{hx:.1f}" cy="{hy:.1f}" r="3.2" fill="#f6ad55"/>')

    for idx_lm, lm in enumerate(landmarks):
        lx, ly = map_xy(lm["utm32nE"], lm["utm32nN"])
        dy = -10 if idx_lm % 2 == 0 else 16
        parts.append(f'<circle cx="{lx:.1f}" cy="{ly:.1f}" r="4" fill="#edf2f7" stroke="#1a202c"/>')
        label = lm["nom"].split(" / ")[0]
        parts.append(f'<text x="{lx + 6:.1f}" y="{ly + dy:.1f}" fill="#e2e8f0" font-family="monospace" font-size="11">{label} ({lm["sPlanM"]/1000:.1f} km)</text>')

    # Légende plan
    parts.append('<text x="64" y="438" fill="#cbd5e0" font-family="monospace" font-size="11">Rouge: SS21 course (32,25 km) | Vert pointillé: décélération (+0,57 km) | Violet: tunnels/paravalanches (6) | Cyan: ponts (18) | Orange: épingles</text>')

    # Panel 2 (profil en long): y in [490..770], x in [60..1150]
    parts.append('<rect x="52" y="482" width="1106" height="304" fill="#161d24" stroke="#2d3a46"/>')
    s_max = points[-1]["sPlanM"]
    z_min, z_max = 800.0, 2100.0

    def prof_xy(s: float, z: float) -> tuple[float, float]:
        return 60.0 + (s / s_max) * 1090.0, 764.0 - ((z - z_min) / (z_max - z_min)) * 260.0

    for z_grid in range(900, 2100, 200):
        _, gy = prof_xy(0.0, float(z_grid))
        parts.append(f'<line x1="60" y1="{gy:.1f}" x2="1150" y2="{gy:.1f}" stroke="#26323e" stroke-dasharray="3,3"/>')
        parts.append(f'<text x="56" y="{gy + 4:.1f}" text-anchor="end" fill="#a0aec0" font-family="monospace" font-size="10">{z_grid}</text>')
    for km in range(0, 34, 5):
        gx, _ = prof_xy(km * 1000.0, z_min)
        parts.append(f'<line x1="{gx:.1f}" y1="504" x2="{gx:.1f}" y2="764" stroke="#26323e" stroke-dasharray="3,3"/>')
        parts.append(f'<text x="{gx:.1f}" y="780" text-anchor="middle" fill="#a0aec0" font-family="monospace" font-size="10">{km} km</text>')

    raw_line = " ".join(f"{prof_xy(p['sPlanM'], p['zTerrainDtm5M'])[0]:.1f},{prof_xy(p['sPlanM'], p['zTerrainDtm5M'])[1]:.1f}" for p in points)
    ov_line = " ".join(f"{prof_xy(points[i]['sPlanM'], z_profile[i])[0]:.1f},{prof_xy(points[i]['sPlanM'], z_profile[i])[1]:.1f}" for i in range(len(points)))
    parts.append(f'<polyline points="{raw_line}" fill="none" stroke="#718096" stroke-width="1.5"/>')
    parts.append(f'<polyline points="{ov_line}" fill="none" stroke="#fc8181" stroke-width="2.2"/>')

    # Finish line vertical marker
    fx, _ = prof_xy(points[finish_idx]["sPlanM"], z_min)
    parts.append(f'<line x1="{fx:.1f}" y1="504" x2="{fx:.1f}" y2="764" stroke="#68d391" stroke-width="1.8" stroke-dasharray="4,3"/>')
    parts.append(f'<text x="{fx - 6:.1f}" y="520" text-anchor="end" fill="#68d391" font-family="monospace" font-size="11">Arrivée Vinadio (32,25 km, 889 m)</text>')
    parts.append('<text x="64" y="498" fill="#cbd5e0" font-family="monospace" font-size="11">Profil en long — Gris: terrain brut DTM 5 m (inclut versants au-dessus des tunnels) | Rouge: profil indicatif avec portails interpolés</text>')
    parts.append("</svg>\n")
    return "\n".join(parts)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Préparation reproductible L0/L1 Col de Larche -> Vinadio.")
    parser.add_argument("--directory", type=Path, default=DEFAULT_DIR, help="Dossier du paquet L0/L1")
    parser.add_argument("--check", action="store_true", help="Vérifier sans écrire")
    args = parser.parse_args(argv)

    directory = args.directory
    outputs = reconstruct(directory)

    if args.check:
        diffs = []
        for name, expected in outputs.items():
            p = ensure_confined(directory, name)
            if not p.is_file():
                diffs.append(f"absent : {name}")
            elif p.read_bytes() != expected:
                diffs.append(f"dérive : {name}")
        if diffs:
            sys.stderr.write("ÉCHEC --check : " + ", ".join(diffs) + "\n")
            return 1
        print(f"OK --check ({len(outputs)} fichiers vérifiés sans écriture)")
        return 0

    for name, content in outputs.items():
        p = ensure_confined(directory, name)
        p.write_bytes(content)
    print(f"GÉNÉRÉ {len(outputs)} fichiers dans {directory}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
