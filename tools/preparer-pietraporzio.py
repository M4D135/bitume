"""Reprojette l’extrait BDTRE versionné sur l’axe réellement joué, sans réseau."""
from pathlib import Path
import argparse
import collections
import json
import math
import statistics
import subprocess

ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / 'docs/references/larche-vinadio-2026'
DEBUT, FIN = 17900, 18500
MARGE_RAIL = 1.20
RAYON = 35


def produit(a, b, p):
    return (b[0]-a[0])*(p[1]-a[1]) - (b[1]-a[1])*(p[0]-a[0])


def bords(poly):
    return zip(poly, poly[1:] + poly[:1])


def distance(p, a, b):
    dx, dz = b[0]-a[0], b[1]-a[1]
    t = max(0, min(1, ((p[0]-a[0])*dx + (p[1]-a[1])*dz) / (dx*dx + dz*dz or 1)))
    return math.hypot(p[0]-a[0]-t*dx, p[1]-a[1]-t*dz)


def entre_segments(a, b, c, d):
    if produit(a,b,c)*produit(a,b,d)<0 and produit(c,d,a)*produit(c,d,b)<0:
        return 0
    return min(distance(a,c,d), distance(b,c,d), distance(c,a,b), distance(d,a,b))


def cle_empreinte(anneau):
    # Même cycle à un décalage d'origine ou un sens de parcours près.
    pts = [tuple(p) for p in anneau[:-1]]
    if not pts or anneau[0] != anneau[-1]:
        raise ValueError('Anneau BDTRE ouvert ou vide')
    ordre = min(range(len(pts)), key=pts.__getitem__)
    aller = tuple(pts[(ordre+i)%len(pts)] for i in range(len(pts)))
    retour = tuple(pts[(ordre-i)%len(pts)] for i in range(len(pts)))
    return min(aller,retour)


def trianguler(poly):
    # Polygone simple, antihoraire en XZ. Une oreille ne contient aucun autre sommet.
    reste = list(range(len(poly)))
    triangles = []
    while len(reste) > 3:
        for i, b in enumerate(reste):
            a, c = reste[i-1], reste[(i+1) % len(reste)]
            if produit(poly[a],poly[b],poly[c]) <= 0:
                continue
            if any(min(produit(poly[u],poly[v],poly[k]) for u,v in [(a,b),(b,c),(c,a)]) >= 0
                   for k in reste if k not in (a,b,c)):
                continue
            triangles.append([a,b,c])
            reste.pop(i)
            break
        else:
            raise ValueError('Emprise non simple')
    triangles.append(reste)
    return triangles


def generer():
    ref = json.loads((REFERENCE / 'trace-l1.json').read_text())['points']
    couches = json.loads((REFERENCE / 'sources/bdtre-pietraporzio.json').read_text())['couches']
    js = """require('./src/larche-vinadio.js');const c=BITUME.larche.creer(210),r=[];
    for(let i=17300/c.pas;i<=19100/c.pas;i++)r.push([i*c.pas,c.x[i],c.z[i],c.limiteG[i],c.limiteD[i]]);
    console.log(JSON.stringify(r));"""
    route = json.loads(subprocess.check_output(['node','-e',js],cwd=ROOT))
    pts = [ligne[1:3] for ligne in route]
    origine = ref[0]['utm32nE'], ref[0]['utm32nN']
    residus = []
    for p in ref:
        if DEBUT <= p['sPlanM'] <= FIN:
            k = (p['sPlanM']-route[0][0])/(route[1][0]-route[0][0])
            i, t = int(k), k % 1
            residus.append([pts[i][j] + t*(pts[i+1][j]-pts[i][j]) - p[v] for j,v in enumerate(['localX','localZ'])])
    decalage = list(map(statistics.mean,zip(*residus)))
    erreur = [math.dist(r,decalage) for r in residus]
    if len(erreur)<15 or max(erreur)>2:
        raise ValueError('Recalage des contrôles OSM incompatible avec la spéciale')
    volumes = collections.defaultdict(list)
    for v in couches['un_vol']['objets']:
        rings = v['geometrie']['coordinates']
        if len(rings)==1 and float(v['un_vol_av'] or 0)>0 and v['un_vol_ex']=='altezza' and v['un_vol_por']=='al suolo':
            volumes[cle_empreinte(rings[0])].append(v)
    batiments = []
    for f in couches['edifc']['objets']:
        rings = f['geometrie']['coordinates']
        if len(rings)!=1 or f['edifc_stat']!='costruito':
            continue
        vs = volumes.get(cle_empreinte(rings[0]),[])
        if len(vs)!=1:
            continue
        poly = [[p[0]-origine[0]+decalage[0],origine[1]-p[1]+decalage[1]] for p in rings[0][:-1]]
        centre = list(map(statistics.mean,zip(*poly)))
        k = min(range(len(pts)),key=lambda i:math.dist(pts[i],centre))
        if not DEBUT <= route[k][0] <= FIN:
            continue
        # Un cercle englobant fournit une borne inférieure sûre pour tous les segments ignorés.
        rayon = max(math.dist(centre,p) for p in poly)
        candidats = [i for i in range(len(pts)-1) if distance(centre,pts[i],pts[i+1])<=rayon+RAYON]
        if not candidats:
            continue
        d = min(entre_segments(a,b,pts[i],pts[i+1]) for a,b in bords(poly) for i in candidats)
        if d > RAYON:
            continue
        if any(min(entre_segments(a,b,pts[i],pts[i+1]) for a,b in bords(poly))
               < max(*route[i][3:], *route[i+1][3:])+MARGE_RAIL for i in candidats):
            continue
        # Les coordonnées sources sont au centimètre. Une origine de lot borne les attributs FERRO.
        x,z = [round(v,2) for v in centre]
        pts_cm = [[round(100*(u-x)),round(100*(v-z))] for u,v in poly]
        if sum(produit([0,0],a,b) for a,b in bords(pts_cm))<0:
            pts_cm.reverse()
        batiments.append(dict(id=f['uuid'],volume=vs[0]['uuid'],usage=f['edifc_uso'],h=int(vs[0]['un_vol_av']),
                              s=route[k][0],axe=round(d,3),x=x,z=z,cm=pts_cm,tri=trianguler(pts_cm)))
    axe_regional = []
    for r in couches['el_str']['objets']:
        ligne = [(e-origine[0]+decalage[0],origine[1]-n+decalage[1]) for e,n in r['geometrie']['coordinates']]
        axe_regional.extend(zip(ligne,ligne[1:]))
    ecarts = sorted(min(distance(p,a,b) for a,b in axe_regional) for q,p in zip(route,pts) if DEBUT<=q[0]<=FIN)
    return sorted(batiments,key=lambda f:f['s']), len(residus), erreur, decalage, ecarts


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    args = parser.parse_args()
    batiments,n,erreur,decalage,axe = generer()
    texte = '/* Géométrie BDTRE de Regione Piemonte, CC BY 4.0. Généré par tools/preparer-pietraporzio.py. */\n'
    texte += '(globalThis.BITUME=globalThis.BITUME||{}).pietraporzioData=[\n'
    texte += ',\n'.join(json.dumps(f,ensure_ascii=False,separators=(',',':')) for f in batiments)+'\n];\n'
    sortie = ROOT/'src/pietraporzio-data.js'
    if args.check and sortie.read_text()!=texte:
        raise SystemExit('Extrait différent du fichier embarqué')
    if not args.check:
        sortie.write_text(texte)
    print(f'{len(batiments)} bâtiments, {n} contrôles, translation {decalage}, RMS {statistics.mean(e*e for e in erreur)**.5:.3f} m, max {max(erreur):.3f} m')
    print(f'Axe BDTRE, {len(axe)} sondes : médiane {statistics.median(axe):.3f} m, P90 {axe[int(.9*(len(axe)-1))]:.3f} m, max {max(axe):.3f} m')
