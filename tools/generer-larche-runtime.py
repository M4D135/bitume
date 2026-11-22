#!/usr/bin/env python3
"""Génère src/larche-vinadio-data.js depuis docs/references/larche-vinadio-2026/trace-l1.json.

Sources mesurées conservées fidèlement :
- Axe planimétrique OSM de la SS21 (Col de Larche -> Vinadio, 1 042 nœuds, 32 249,3 m + 567,5 m décélération).
- Altitudes réelles Piemonte DTM 5 m (croisées IGN RGE Alti 1 m à la frontière, écart moyen 2,3 cm).
- Coupes terrain réelles à ±15 m et ±40 m de part et d'autre de l'axe.
- 6 tunnels/paravalanches, 16 ponts, 21 épingles, 8 villages/repères, contour du Lac de la Maddalena.

Conventions runtime explicites (non présentées comme mesures terrain) :
- Radier interpolé linéairement entre portails sur les 6 tunnels/paravalanches et 16 ponts où yChausseeM=null.
- Lissage local de la chaussée si une marche LiDAR ponctuelle dépasse 15 % de pente sur < 30 m (artefact MNT 5 m).
- Largeur de chaussée course : 11 m (5,5 m/voie pour une 2 voies SS21 jouable en GT/F1).
"""
import base64, json, math, pathlib, struct

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs' / 'references' / 'larche-vinadio-2026' / 'trace-l1.json'
DST = ROOT / 'src' / 'larche-vinadio-data.js'

ALT_BASE = 880.0


def couverture_versants(origin_e, origin_n):
    """Filtrer les trois proportions séparément, sans masquer les classes minoritaires."""
    grille = json.loads((SRC.parent / 'sources/worldcover-2021.json').read_text())
    nx, nz, pas = grille['nx'], grille['nz'], grille['pas']
    # Le renderer prend une couleur par triangle de 128 m. Un filtre binomial
    # de rayon 4 cellules réduit les marches de teinte sans modifier le MNT.
    poids = (1, 8, 28, 56, 70, 56, 28, 8, 1)
    donnees = base64.b64decode(grille['fractionsU8'], validate=True)
    if grille['crs'] != 'EPSG:32632' or grille['classes'] != [10, 30, 60] or len(donnees) != nx*nz*3:
        raise ValueError('Grille de couverture de Larche incompatible')
    for dx, dz in ((1, 0), (0, 1)):
        sortie = bytearray(len(donnees))
        for z in range(nz):
            for x in range(nx):
                indices = [3*(min(nz-1, max(0, z+dz*i))*nx+min(nx-1, max(0, x+dx*i))) for i in range(-4, 5)]
                for canal in range(3):
                    sortie[3*(z*nx+x)+canal] = (sum(w*donnees[k+canal] for w,k in zip(poids, indices))+128)//256
        donnees = sortie
    return {'pas': pas, 'nx': nx, 'nz': nz,
            'x0': round(grille['originE']+pas/2-origin_e, 3),
            'z0': round(origin_n-grille['originN']+pas/2, 3),
            'attribution': grille['attribution'], 'licence': grille['licence'],
            'fractionsU8': base64.b64encode(donnees).decode('ascii')}


def main():
    tr = json.loads(SRC.read_text(encoding='utf-8'))
    pts = tr['points']
    n = len(pts)
    origin_e = pts[0]['utm32nE']
    origin_n = pts[0]['utm32nN']

    # 1. Reconstruire yChaussee continu : mesures réelles + interpolation linéaire sur ouvrages (yChausseeM is None)
    s_arr = [p['sPlanM'] for p in pts]
    y_arr = [p['yChausseeM'] for p in pts]
    for i in range(n):
        if y_arr[i] is not None:
            continue
        a = i - 1
        while a >= 0 and y_arr[a] is None:
            a -= 1
        b = i + 1
        while b < n and y_arr[b] is None:
            b += 1
        if a < 0:
            y_arr[i] = pts[i]['zTerrainDtm5M']
        elif b >= n:
            y_arr[i] = y_arr[a]
        else:
            t = (s_arr[i] - s_arr[a]) / max(1e-6, s_arr[b] - s_arr[a])
            y_arr[i] = y_arr[a] + (y_arr[b] - y_arr[a]) * t

    # 2. Lissage doux des artefacts LiDAR ponctuels (> 15 % sur segments courts < 35 m)
    # Sans modifier la cote globale ni le dénivelé total (1993 m -> 889 m).
    for _ in range(12):
        changed = False
        for i in range(1, n - 1):
            ds1 = max(1.0, s_arr[i] - s_arr[i - 1])
            ds2 = max(1.0, s_arr[i + 1] - s_arr[i])
            p1 = abs(y_arr[i] - y_arr[i - 1]) / ds1
            p2 = abs(y_arr[i + 1] - y_arr[i]) / ds2
            if max(p1, p2) > 0.145:
                t = ds1 / (ds1 + ds2)
                cible = y_arr[i - 1] + (y_arr[i + 1] - y_arr[i - 1]) * t
                y_arr[i] = y_arr[i] * 0.45 + cible * 0.55
                changed = True
        if not changed:
            break

    max_pente = max(abs(y_arr[i] - y_arr[i - 1]) / max(1.0, s_arr[i] - s_arr[i - 1]) for i in range(1, n))

    # 3. Quantifier les tableaux compacts (0,1 m pour axe XYZ ; 0,5 m relatif pour coupes terrain ±15 / ±40 m)
    x10 = [int(round(p['localX'] * 10)) for p in pts]
    z10 = [int(round(p['localZ'] * 10)) for p in pts]
    y10 = [int(round((y_arr[i] - ALT_BASE) * 10)) for i in range(n)]

    def coupe_rel(cle):
        out = []
        for i, p in enumerate(pts):
            c = p.get('coupeTerrain') or {}
            v = c.get(cle)
            if v is None:
                v = y_arr[i]
            dv = max(-120.0, min(120.0, v - y_arr[i]))
            out.append(int(round(dv * 2)))
        return out

    g15, d15, g40, d40 = coupe_rel('g15'), coupe_rel('d15'), coupe_rel('g40'), coupe_rel('d40')

    # 4. Ouvrages (tunnels, paravalanches, ponts)
    ouvrages = []
    for o in tr['ouvrages']:
        ouvrages.append([
            o['type'],
            round(o['sDebutM'], 1),
            round(o['sFinM'], 1),
            o['nom'],
        ])

    # 5. Épingles
    epingles = [
        [round(e['sPlanM'], 1), e['sens'], round(e['angleDeg'], 1)]
        for e in tr['epingles']
    ]

    # 6. Repères & villages (localX/localZ calculés depuis UTM 32N)
    reperes = []
    for r in tr['reperes']:
        lx = round(r['utm32nE'] - origin_e, 1)
        lz = round(-(r['utm32nN'] - origin_n), 1)
        reperes.append([r['nom'], r.get('categorie', 'village'), round(r['sPlanM'], 1), lx, lz])

    # 7. Contour réel du Lac de la Maddalena en coordonnées locales + altitude au voisinage du col
    lac = []
    for e, n_utm in tr['lacMaddalenaUtm32n']:
        lac.append(round(e - origin_e, 1))
        lac.append(round(-(n_utm - origin_n), 1))
    # Altitude du lac : proche de la route aux alentours de s = 800..1100 m (1974 m IGN/Piemonte)
    lac_y = round(1974.0 - ALT_BASE, 1)

    # Le MNT de vallée est redistribué avec attribution. Coordonnées au centre
    # des pixels GeoTIFF, Z du jeu vers le sud et même origine verticale que la piste.
    dtm = json.loads((SRC.parent / 'sources/piemonte-dtm5-samples.json').read_text())
    grille = dtm['valleyOverview100m']
    pas = grille['resM']
    hauteurs = [round(y - ALT_BASE) if y is not None else -32768 for y in grille['elevationsM']]
    relief = {
        'source': 'Regione Piemonte, RIPRESA AEREA ICE 2009–2011 — DTM 5, CC BY 4.0',
        'licence': 'https://creativecommons.org/licenses/by/4.0/',
        'pas': pas, 'nx': grille['width'], 'nz': grille['height'],
        'x0': round(grille['originE'] + pas / 2 - origin_e, 3),
        'z0': round(origin_n - grille['originN'] + pas / 2, 3),
        'couverture': couverture_versants(origin_e, origin_n),
        'metresI16LE': base64.b64encode(struct.pack(f'<{len(hauteurs)}h', *hauteurs)).decode('ascii'),
    }

    payload = {
        'provenance': {
            'source': 'docs/references/larche-vinadio-2026/trace-l1.json',
            'format': tr['format'],
            'mesuresReelles': 'Axe OSM SS21 (1042 nœuds), altitudes Piemonte DTM 5m / IGN RGE Alti 1m, coupes ±15/±40 m, 6 tunnels/paravalanches, 16 ponts, 21 épingles, 8 villages, Lac de la Maddalena',
            'conventionsRuntime': 'Largeur chaussée 11 m (SS21 2 voies), radier interpolé linéairement entre portails sur tunnels/ponts, lissage local artefacts DTM5m > 14,5 %, dévers léger dérivé de courbure',
        },
        'altitudeBaseM': ALT_BASE,
        'reliefVallee': relief,
        'altitudeDepartM': round(y_arr[0], 2),
        'altitudeArriveeM': round(y_arr[tr['resume']['nbPointsCourse'] - 1], 2),
        'longueurCourseM': round(tr['resume']['longueurPlanCourseM'], 2),
        'longueurTotaleM': round(tr['resume']['longueurPlanAvecDecelerationM'], 2),
        'x10': x10,
        'z10': z10,
        'y10': y10,
        'g15': g15,
        'd15': d15,
        'g40': g40,
        'd40': d40,
        'ouvrages': ouvrages,
        'epingles': epingles,
        'reperes': reperes,
        'lac': {'y': lac_y, 'poly': lac},
    }

    js = (
        "/* BITUME — données compactes Col de Larche -> Vinadio (SS21, 32,8 km).\n"
        "   Généré par tools/generer-larche-runtime.py depuis docs/references/larche-vinadio-2026/trace-l1.json.\n"
        "   Ne pas éditer à la main. */\n"
        "(function (B) {\n"
        "  'use strict';\n"
        f"  B.larcheData = Object.freeze({json.dumps(payload, separators=(',', ':'), ensure_ascii=False)});\n"
        "})(globalThis.BITUME = globalThis.BITUME || {});\n"
        "if (typeof module !== 'undefined' && module.exports) module.exports = globalThis.BITUME.larcheData;\n"
    )
    DST.write_text(js, encoding='utf-8')
    print(f"Wrote {DST} ({len(js):,} bytes), n={n}, max_pente={max_pente*100:.2f}%, y0={y_arr[0]:.1f}m -> yFin={y_arr[tr['resume']['nbPointsCourse']-1]:.1f}m")


if __name__ == '__main__':
    main()
