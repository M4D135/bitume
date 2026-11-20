#!/usr/bin/env python3
"""Mesure les déplacements dans les PNG, sans employer le shader comme oracle.

Les perles fines et moyennes sont identifiées par leurs voisinages géométriques.
Pour les grandes perles et nappes, la registration compare des motifs alpha.
Aucune de ces méthodes ne lit les uniformes ou le transport prédit.
L'analyse initiale reste conservée dans les preuves du lot EAU-VITESSE.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

FENETRE = 17
RAYON_RECHERCHE = 144
CORRELATION_MIN = .92
MARGE_PIC_MIN = .025


def options():
    return argparse.Namespace(alpha=32, minimum=5, bord=8, bande=.12)


def sommes_fenetres(a, taille):
    integre = np.pad(a, ((1, 0), (1, 0))).cumsum(0).cumsum(1)
    return (integre[taille:, taille:] - integre[:-taille, taille:]
            - integre[taille:, :-taille] + integre[:-taille, :-taille])


def correlation(recherche, motif):
    """ZNCC sur toutes les translations, insensible au fondu d'opacité.

    La normalisation et le domaine valide excluent les zones transparentes et
    le bouclage FFT ; aucune donnée de simulation n'entre dans la recherche.
    """
    k = motif.shape[0]
    zero = motif - motif.mean()
    energie = float(np.sum(zero * zero))
    if energie < 1e-8 or min(recherche.shape) < k:
        return None
    spectre = np.fft.rfft2(recherche)
    numerateur = np.fft.irfft2(spectre * np.conj(np.fft.rfft2(zero, s=recherche.shape)), s=recherche.shape)
    numerateur = numerateur[:recherche.shape[0] - k + 1, :recherche.shape[1] - k + 1]
    sommes = sommes_fenetres(recherche, k)
    variance = np.maximum(0, sommes_fenetres(recherche * recherche, k) - sommes * sommes / (k * k))
    denominateur = np.sqrt(variance * energie)
    scores = np.full_like(numerateur, -1.0)
    np.divide(numerateur, denominateur, out=scores, where=denominateur > 1e-8)
    return np.clip(scores, -1, 1)


def retrouver(motif, image, centre, rayon=RAYON_RECHERCHE):
    h, w = image.shape
    demi = motif.shape[0] // 2
    x, y = centre
    x0, x1 = max(0, int(x - rayon - demi)), min(w, int(x + rayon + demi + 1))
    y0, y1 = max(0, int(y - rayon - demi)), min(h, int(y + rayon + demi + 1))
    scores = correlation(image[y0:y1, x0:x1], motif)
    if scores is None:
        return None
    py, px = np.unravel_index(np.argmax(scores), scores.shape)
    meilleur = float(scores[py, px])
    # Un pic de corrélation à lui seul ne suffit pas : le motif doit être distinct.
    autres = scores.copy()
    autres[max(0, py - 3):py + 4, max(0, px - 3):px + 4] = -1
    marge = meilleur - float(autres.max())
    if meilleur < CORRELATION_MIN or marge < MARGE_PIC_MIN:
        return None
    def sous_pixel(v0, v1, v2):
        d = v0 - 2 * v1 + v2
        return float(np.clip(.5 * (v0 - v2) / d, -.5, .5)) if d < -1e-8 else 0.0
    dx = sous_pixel(scores[py, px - 1], scores[py, px], scores[py, px + 1]) if 0 < px < scores.shape[1] - 1 else 0.0
    dy = sous_pixel(scores[py - 1, px], scores[py, px], scores[py + 1, px]) if 0 < py < scores.shape[0] - 1 else 0.0
    return {'centre': [float(x0 + px + demi + dx), float(y0 + py + demi + dy)],
            'centreEntier': [int(x0 + px + demi), int(y0 + py + demi)],
            'correlation': meilleur, 'margePic': marge}


def motifs(alpha, bande=.12, maximum_par_quadrant=24, supports=None):
    """Fenêtres disjointes riches en variations dans deux directions.

    Contrairement aux composantes connexes, un morceau encore visible d'une
    nappe coupée par le cadre reste mesurable. Les lignes uniformes, qui ne
    permettent pas de retrouver un déplacement tangent, sont éliminées.
    """
    h, w = alpha.shape
    gy, gx = np.gradient(alpha)
    xx = sommes_fenetres(gx * gx, FENETRE)
    yy = sommes_fenetres(gy * gy, FENETRE)
    xy = sommes_fenetres(gx * gy, FENETRE)
    force = .5 * (xx + yy - np.sqrt((xx - yy) ** 2 + 4 * xy ** 2))
    demi = FENETRE // 2
    resultats, comptes = [], {}
    for indice in np.argsort(force, axis=None)[::-1]:
        y, x = np.unravel_index(indice, force.shape)
        if force[y, x] < .004:
            break
        x, y = int(x + demi), int(y + demi)
        origine, support = [x, y], None
        if supports is not None:
            proches = [(math.dist([x, y], c['centre']), i, c) for i, c in enumerate(supports)
                       if c['boite'][0] - demi <= x <= c['boite'][2] + demi
                       and c['boite'][1] - demi <= y <= c['boite'][3] + demi]
            if not proches:
                continue
            _, support, composante = min(proches)
            origine = composante['centre']
        # Les bords d'une nappe ne sont pas des gouttes indépendantes : la zone
        # attendue est celle de son centre visible, même si le motif est excentré.
        ox, oy = origine
        if abs(ox / w - .5) < bande or abs(oy / h - .45) < bande:
            continue
        quadrant = ('haut' if oy / h < .45 else 'bas') + '-' + ('gauche' if ox / w < .5 else 'droite')
        if comptes.get(quadrant, 0) >= maximum_par_quadrant:
            continue
        if any(abs(x - a['centre'][0]) < FENETRE and abs(y - a['centre'][1]) < FENETRE for a in resultats):
            continue
        resultats.append({'centre': [x, y], 'origineDirectionPx': origine, 'support': support,
                          'quadrant': quadrant, 'force': float(force[y - demi, x - demi])})
        comptes[quadrant] = comptes.get(quadrant, 0) + 1
        if len(resultats) == 4 * maximum_par_quadrant:
            break
    return resultats


def enregistrer(alpha_a, alpha_b, bande=.12, supports=None):
    assert alpha_a.shape == alpha_b.shape
    choix = motifs(alpha_a, bande, supports=supports)
    demi = FENETRE // 2
    matches, rejetes = [], 0
    for p in choix:
        x, y = p['centre']
        motif = alpha_a[y - demi:y + demi + 1, x - demi:x + demi + 1]
        r = retrouver(motif, alpha_b, [x, y])
        if r is None:
            rejetes += 1
            continue
        bx, by = r['centreEntier']
        retour = retrouver(alpha_b[by - demi:by + demi + 1, bx - demi:bx + demi + 1], alpha_a, [bx, by])
        if retour is None or math.dist(retour['centre'], [x, y]) > 1.25:
            rejetes += 1
            continue
        if any(math.dist(r['centre'], m['apresPx']) < FENETRE * .75 for m in matches):
            rejetes += 1
            continue
        matches.append({'avantPx': [x, y], 'apresPx': r['centre'], 'quadrant': p['quadrant'],
                        'origineDirectionPx': p['origineDirectionPx'], 'support': p['support'],
                        'deplacementObservePx': [r['centre'][0] - x, r['centre'][1] - y],
                        'correlation': r['correlation'], 'margePic': r['margePic'],
                        'erreurRetourPx': math.dist(retour['centre'], [x, y])})
    return matches, {'motifsChoisis': len(choix), 'motifsRejetes': rejetes}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def composantes(path, seuil=32, minimum=5, bord=8):
    image = np.asarray(Image.open(path).convert('RGBA'))
    alpha = image[:, :, 3]
    masque = alpha > seuil
    h, w = masque.shape
    ys, xs = np.nonzero(masque)
    resultats = []
    rejetes_petits = rejetes_bord = 0
    for y, x in zip(ys.tolist(), xs.tolist()):
        if not masque[y, x]:
            continue
        masque[y, x] = False
        pile = [(x, y)]
        n = somme = sx = sy = 0
        minx = maxx = x
        miny = maxy = y
        while pile:
            px, py = pile.pop()
            a = int(alpha[py, px])
            n += 1
            somme += a
            sx += (px + .5) * a
            sy += (py + .5) * a
            minx, maxx = min(minx, px), max(maxx, px)
            miny, maxy = min(miny, py), max(maxy, py)
            for ny in range(max(0, py - 1), min(h, py + 2)):
                for nx in range(max(0, px - 1), min(w, px + 2)):
                    if masque[ny, nx]:
                        masque[ny, nx] = False
                        pile.append((nx, ny))
        if n < minimum:
            rejetes_petits += 1
        elif minx < bord or miny < bord or maxx >= w - bord or maxy >= h - bord:
            rejetes_bord += 1
        else:
            resultats.append({'centre': [sx / somme, sy / somme], 'pixels': n,
                              'poidsAlpha': somme, 'boite': [minx, miny, maxx, maxy]})
    return {'dimensions': [w, h], 'composantes': resultats,
            'rejeteesPetites': rejetes_petits, 'rejeteesBord': rejetes_bord,
            'pixelsAuDessusDuSeuil': int(len(xs)), 'sha256': sha256(path)}


def signatures(points, voisins=6):
    """Géométrie locale des perles, invariante par translation et échelle.

    Les points sont exclusivement des centroïdes PNG. Ce voisinage distingue
    les perles denses sans chercher une autre goutte à une position prédite.
    """
    resultat = np.empty((len(points), voisins * 2))
    for debut in range(0, len(points), 256):
        fin = min(len(points), debut + 256)
        ecarts = points[None, :, :] - points[debut:fin, None, :]
        distances = np.sum(ecarts * ecarts, axis=2)
        distances[np.arange(fin - debut), np.arange(debut, fin)] = np.inf
        indices = np.argpartition(distances, voisins - 1, axis=1)[:, :voisins]
        vecteurs = np.take_along_axis(ecarts, indices[:, :, None], axis=1)
        ordre = np.argsort(np.arctan2(vecteurs[:, :, 1], vecteurs[:, :, 0]), axis=1)
        vecteurs = np.take_along_axis(vecteurs, ordre[:, :, None], axis=1)
        norme = np.sqrt(np.mean(np.sum(vecteurs * vecteurs, axis=2), axis=1))
        resultat[debut:fin] = (vecteurs / np.maximum(norme[:, None, None], 1e-8)).reshape(fin - debut, -1)
    return resultat


def voisins_descripteurs(a, b):
    indices, erreurs, marges = [], [], []
    norme_b = np.sum(b * b, axis=1)
    for debut in range(0, len(a), 256):
        lot = a[debut:debut + 256]
        distances = np.maximum(0, np.sum(lot * lot, axis=1)[:, None] + norme_b[None, :] - 2 * lot @ b.T)
        deux = np.argpartition(distances, 1, axis=1)[:, :2]
        valeurs = np.take_along_axis(distances, deux, axis=1)
        ordre = np.argsort(valeurs, axis=1)
        deux = np.take_along_axis(deux, ordre, axis=1)
        valeurs = np.sqrt(np.take_along_axis(valeurs, ordre, axis=1) / a.shape[1])
        indices.extend(deux[:, 0].tolist())
        erreurs.extend(valeurs[:, 0].tolist())
        ratio = np.ones(len(valeurs))
        np.divide(valeurs[:, 0], valeurs[:, 1], out=ratio, where=valeurs[:, 1] > 1e-8)
        marges.extend(ratio.tolist())
    return np.asarray(indices), np.asarray(erreurs), np.asarray(marges)


def apparier_voisinages(a, b):
    ca, cb = a['composantes'], b['composantes']
    if min(len(ca), len(cb)) < 7:
        return [], len(ca)
    pa, pb = np.array([c['centre'] for c in ca]), np.array([c['centre'] for c in cb])
    da, db = signatures(pa), signatures(pb)
    ia, ea, ra = voisins_descripteurs(da, db)
    ib, eb, rb = voisins_descripteurs(db, da)
    matches = []
    for i, j in enumerate(ia):
        if ib[j] != i or max(ea[i], eb[j]) > .035 or max(ra[i], rb[j]) > .6:
            continue
        p, q = ca[i]['centre'], cb[j]['centre']
        matches.append({'composanteAvant': i, 'composanteApres': int(j), 'avantPx': p, 'apresPx': q,
                        'deplacementObservePx': [q[0] - p[0], q[1] - p[1]],
                        'erreurVoisinageRMS': float(max(ea[i], eb[j])), 'ratioDeuxiemeVoisin': float(max(ra[i], rb[j]))})
    return matches, len(ca)


def analyser_paire(groupe, avant, apres, ca, cb, args):
    suivi_a, suivi_b = avant['suivi'], apres['suivi']
    registration = suivi_a['couche'] in [3, 4]
    details = {}
    if registration:
        matches, details = enregistrer(ca['alpha'], cb['alpha'], args.bande, ca.get('supports'))
        eligibles = details['motifsChoisis']
    else:
        matches, eligibles = apparier_voisinages(ca, cb)
    w, h = ca['dimensions']
    repos = suivi_a['vitesse'] == 0
    quadrants = {n: {'mesures': 0, 'conformes': 0, 'tropFaibles': 0}
                 for n in ['haut-gauche', 'haut-droite', 'bas-gauche', 'bas-droite']}
    utilises = []
    for m in matches:
        origine = m.get('origineDirectionPx', m['avantPx'])
        x, y = origine[0] / w, origine[1] / h
        if abs(x - .5) < args.bande or abs(y - .45) < args.bande:
            m['usage'] = 'bande_centrale_exclue'
            continue
        cote_x, cote_y = (-1 if x < .5 else 1), (-1 if y < .45 else 1)
        quadrant = ('haut' if cote_y == -1 else 'bas') + '-' + ('gauche' if cote_x == -1 else 'droite')
        dx, dy = m['deplacementObservePx']
        m['quadrant'] = quadrant
        m['usage'] = 'mesure'
        trop_faible = abs(dy) < .75 if repos else min(abs(dx), abs(dy)) < .75
        conforme = dy > .75 and abs(dx) < 1 if repos else dx * cote_x > .75 and dy * cote_y > .75
        m['conforme'] = conforme
        m['mouvementTropFaible'] = trop_faible
        quadrants[quadrant]['mesures'] += 1
        quadrants[quadrant]['conformes'] += int(conforme)
        quadrants[quadrant]['tropFaibles'] += int(trop_faible)
        utilises.append(m)
    count = len(utilises)
    conformes = sum(m['conforme'] for m in utilises)
    # Au moins deux identités mesurées dans chacun des quatre quadrants ; chaque
    # sens doit être documenté, une seule correspondance opportuniste ne suffit pas.
    assez = count >= 12 and all(v['mesures'] >= 2 for v in quadrants.values())
    valide = assez and all(v['conformes'] / v['mesures'] >= .9 for v in quadrants.values())
    return {'groupe': groupe, 'intervalleImages': [suivi_a['image'], suivi_b['image']],
            'vitesseKmh': suivi_a['vitesse'] * 3.6, 'dimensions': [w, h],
            'methode': 'registration_motifs_alpha' if registration else 'voisinages_centroides',
            **details,
            'composantesAvant': len(ca.get('composantes', [])), 'composantesApres': len(cb.get('composantes', [])),
            'observationsAvantEligibles': eligibles, 'appariementsUniques': len(matches),
            'quadrants': quadrants, 'mesuresHorsCentre': count, 'conformes': conformes,
            'tauxConforme': conformes / count if count else None,
            'statut': 'conforme' if valide else 'preuve_insuffisante' if not assez else 'non_conforme',
            'matches': matches}


def analyser(racine, args=None):
    args = args or options()
    racine = Path(racine)
    donnees = json.loads((racine / 'etats.json').read_text())
    groupes = {}
    images = {}
    for d in donnees:
        if not d.get('suivi'):
            continue
        groupes.setdefault(d['suivi']['groupe'], []).append(d)
        nom = d['nom'] + '-overlay.png'
        if d['suivi']['couche'] in [3, 4]:
            alpha = np.asarray(Image.open(racine / nom).convert('RGBA'))[:, :, 3].astype(float) / 255
            images[nom] = {'dimensions': [alpha.shape[1], alpha.shape[0]], 'alpha': alpha,
                           'sha256': sha256(racine / nom)}
            if d['suivi']['couche'] in [3, 4]:
                images[nom]['supports'] = composantes(racine / nom, args.alpha, args.minimum, bord=0)['composantes']
        else:
            images[nom] = composantes(racine / nom, args.alpha, args.minimum, args.bord)
    resultats = []
    for groupe, etats in sorted(groupes.items()):
        etats.sort(key=lambda d: d['suivi']['image'])
        assert [x['suivi']['image'] for x in etats] == [12, 48, 108], groupe
        for avant, apres in zip(etats, etats[1:]):
            resultats.append(analyser_paire(groupe, avant, apres,
                             images[avant['nom'] + '-overlay.png'], images[apres['nom'] + '-overlay.png'], args))
    return {'format': 'bitume-png-trajectoires-2', 'reussi': bool(resultats) and all(r['statut'] == 'conforme' for r in resultats), 'protocole': {
        'alphaSuperieurA': args.alpha, 'composantesConnexite': 8, 'pixelsMinimum': args.minimum,
        'margeBordPx': args.bord, 'centroides': 'Moyenne des centres de pixels pondérée par leur alpha RGBA natif.',
        'identites': 'Géométrie des voisinages pour les fines/moyennes ; motifs alpha pour grandes perles/nappes. Aucun uniforme ni transport déclaré.',
        'perlesFinesMoyennes': 'Six voisins PNG, géométrie normalisée par leur distance RMS ; correspondance mutuelle, erreur RMS <=0,035 et ratio premier/second <=0,6. Aucun transport prédit.',
        'centreUV': [.5, .45], 'bandeCentraleExclueUV': args.bande,
        'directionRepos': 'dy > 0.75 px et |dx| < 1 px',
        'direction300': 'dx et dy signés vers le quadrant de départ, chacun > 0.75 px',
        'suffisance': '12 mesures par intervalle, dont au moins 2 par quadrant ; 90 % conformes dans chaque quadrant.',
        'registration': {'fenetrePx': FENETRE, 'recherchePx': RAYON_RECHERCHE, 'candidatsMaximumParQuadrant': 24,
                         'correlationMinimum': CORRELATION_MIN, 'margePicMinimum': MARGE_PIC_MIN,
                         'erreurAllerRetourMaximumPx': 1.25,
                         'methode': 'Motifs alpha disjoints, variations dans deux axes, ZNCC exhaustive et retour mutuel ; ni transport ni direction prédits.',
                         'nappes': 'Zone déterminée par le centre alpha de la nappe ; motifs encore visibles utilisables même si la nappe touche le cadre.'},
        'limites': 'Couches isolées à densité fixée et graine commune. Ne démontre ni toutes les gouttes ni la scène complète, les FPS ou le réalisme subjectif.'},
        'provenance': {'etatsSha256': sha256(racine / 'etats.json'), 'scriptSha256': sha256(Path(__file__))},
        'synthese': {'groupes': len(groupes), 'intervalles': len(resultats),
                    'conformes': sum(r['statut'] == 'conforme' for r in resultats),
                    'nonConformes': sum(r['statut'] == 'non_conforme' for r in resultats),
                    'insuffisants': sum(r['statut'] == 'preuve_insuffisante' for r in resultats),
                    'appariements': sum(r['appariementsUniques'] for r in resultats),
                    'mesuresHorsCentre': sum(r['mesuresHorsCentre'] for r in resultats)},
        'images': {nom: {k: v for k, v in image.items() if k not in ['composantes', 'alpha', 'supports']} for nom, image in images.items()},
        'intervalles': resultats}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--racine', type=Path, required=True)
    parser.add_argument('--sortie', type=Path, required=True)
    parser.add_argument('--alpha', type=int, default=32)
    parser.add_argument('--minimum', type=int, default=5)
    parser.add_argument('--bord', type=int, default=8)
    parser.add_argument('--bande', type=float, default=.12)
    args = parser.parse_args()
    assert not args.sortie.exists(), 'Conserver le reçu précédent et choisir une nouvelle sortie.'
    rapport = analyser(args.racine, args)
    args.sortie.write_text(json.dumps(rapport, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(rapport['synthese'], ensure_ascii=False))
    for r in rapport['intervalles']:
        print(r['groupe'], r['intervalleImages'], r['statut'], r['conformes'], '/', r['mesuresHorsCentre'], r['quadrants'])
    raise SystemExit(0 if rapport['reussi'] else 1)
