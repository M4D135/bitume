#!/usr/bin/env python3
"""Compose mesures/couts.txt et mesures/couts-seances.log du rapport à partir des campagnes du 19/11 :
python3 faire_couts.py couts.txt couts-seances.log ancien-couts.txt"""
import glob, os, re, subprocess, sys, statistics as st, json, random
C = '/private/tmp/ombres-corr/couts'
SORTIE, SEANCES, ANCIEN = sys.argv[1:4]  # ANCIEN : couts.txt du 18/11, gardé en fin de fichier
ICI = os.path.dirname(os.path.abspath(__file__))
run = lambda *a: subprocess.run(['python3', *a], cwd=C, capture_output=True, text=True, check=True).stdout
CAMPAGNES = (('b0', 'ancienne base, a.html contre b0.html'), ('final', 'a2 contre b02, v1 et v1n'),
             ('effets', 'effet par effet, b02 et v1n'), ('final2', 'a2 contre fin2'),
             ('temoin', 'témoin : a2, fin2-sans et fin2, ordre ABC puis CBA'), ('temoin2', 'témoin : a2, fin2-sans et fin2, carré latin'),
             ('diag', 'diagnostic : temps processeur de draw (modele4.js), a2, fin2-sans et fin2, carré latin'),
             ('diag2', 'diagnostic : part du shader, Légère, a2, fin2 et deux pages modifiées, carré latin'))
SCENES = ('fine-cockpit', 'fine-poursuite', 'moyenne-cockpit', 'legere-cockpit')
NOM_SCENE = {'fine-cockpit': 'Fine cockpit', 'fine-poursuite': 'Fine poursuite', 'moyenne-cockpit': 'Moyenne cockpit',
             'legere-cockpit': 'Légère cockpit'}


def bootstrap(l, n=4000, graine=1):
    r = random.Random(graine); m = []
    for _ in range(n):
        m.append(st.median([r.choice(l) for _ in l]))
    m.sort(); return m[int(.05 * n)], m[int(.95 * n)]


def lire(dossier):
    d = {}
    for f in glob.glob(os.path.join(C, dossier, '*.json')):
        m = re.match(r'(.+)-([a-z0-9]+)-(\d+)\.json$', os.path.basename(f))
        if not m: continue
        try: v = json.JSONDecoder().raw_decode(open(f).read())[0]['valeur']
        except Exception: continue
        d.setdefault(m.group(1), {}).setdefault(int(m.group(3)), {})[m.group(2)] = v
    return d


def tours(dossiers):
    """Écarts par tour : (dossier, page 0.3.11) ; variante 0 tout allumé, 1 tout coupé."""
    lignes = {}
    for dossier, ap in dossiers:
        for scene, ts in lire(dossier).items():
            for t, pages in ts.items():
                if 'a' not in pages or ap not in pages: continue
                A = [x['p50'] for x in pages['a']['variantes']]; B = [x['p50'] for x in pages[ap]['variantes']]
                L = lignes.setdefault(scene, {'tous': [], 'coupes': [], 'effets': [], 'aa': [], 'imgA': [], 'imgB': []})
                L['tous'].append(B[0] - A[0]); L['coupes'].append(B[1] - A[1]); L['effets'].append(B[0] - B[1])
                L['aa'].append(A[0] - A[1]); L['imgA'].append(A[0]); L['imgB'].append(B[0])
    return lignes


def tableau(dossiers, titre):
    lignes = tours(dossiers)
    out = [titre]
    for scene in SCENES:
        L = lignes.get(scene)
        if not L: continue
        out.append(f"{NOM_SCENE[scene]} : {len(L['tous'])} tours ; image 0.3.10 {st.median(L['imgA']):.1f} ms, 0.3.11 corrigé {st.median(L['imgB']):.1f} ms")
        for cle, nom in (('tous', 'tout allumé, construction contre construction'), ('coupes', 'tout coupé, construction contre construction (coût fixe)'),
                         ('effets', 'effets, même séance (tout allumé − tout coupé)'), ('aa', 'témoin 0.3.10 (deux variantes sans effet)')):
            l = L[cle]; lo, hi = bootstrap(l)
            out.append(f"   {nom:58s} {st.median(l):+.2f} ms  (90 % des médianes ré-échantillonnées entre {lo:+.2f} et {hi:+.2f} ; tours de {min(l):+.1f} à {max(l):+.1f})")
    return '\n'.join(out)


def temoin(dossier, titre):
    """Trois pages par tour : a (0.3.10), sans (0.3.11 sans l'option), fin (0.3.11 corrigé, l'option)."""
    d = lire(dossier)
    out = [titre]
    for scene in SCENES:
        ts = d.get(scene)
        if not ts: continue
        V = {t: {p: [x['p50'] for x in pages[p]['variantes']] for p in ('a', 'sans', 'fin')}
             for t, pages in ts.items() if all(p in pages for p in ('a', 'sans', 'fin'))}
        img = {p: st.median([V[t][p][0] for t in V]) for p in ('a', 'sans', 'fin')}
        out.append(f"{NOM_SCENE[scene]} : {len(V)} tours ; image tout allumé : 0.3.10 {img['a']:.1f} ms, sans l'option {img['sans']:.1f} ms, "
                   f"avec l'option {img['fin']:.1f} ms")
        for b, a, i, nom in (('sans', 'a', 1, "sans l'option − 0.3.10 (témoin : même travail du GPU)"),
                             ('fin', 'sans', 1, "avec − sans l'option, tout coupé (coût fixe)"),
                             ('fin', 'a', 1, "avec l'option − 0.3.10, tout coupé"),
                             ('fin', 'a', 0, "avec l'option − 0.3.10, tout allumé")):
            l = [V[t][b][i] - V[t][a][i] for t in V]; lo, hi = bootstrap(l)
            out.append(f"   {nom:58s} {st.median(l):+.2f} ms  [{lo:+.2f} ; {hi:+.2f}] ; tours de {min(l):+.1f} à {max(l):+.1f}")
        for p, nom in (('fin', "les quatre effets, même séance (avec l'option)"), ('sans', "témoin, même séance (sans l'option : rien ne change)")):
            l = [V[t][p][0] - V[t][p][1] for t in V]; lo, hi = bootstrap(l)
            out.append(f"   {nom:58s} {st.median(l):+.2f} ms  [{lo:+.2f} ; {hi:+.2f}]")
        # effet de place dans le bloc de la scène : écart à la moyenne du tour, selon le rang de la séance
        ordre = {}
        for ligne in open(os.path.join(C, dossier + '.out')):
            m = re.match(r'\S+ (\S+) (\S+) t(\d+) ', ligne)
            if m and m.group(1) == scene: ordre.setdefault(int(m.group(3)), []).append(m.group(2))
        place = [[], [], []]
        for t in V:
            if len(ordre.get(t, [])) != 3: continue
            moy = st.mean(V[t][p][1] for p in ordre[t])
            for k, p in enumerate(ordre[t]): place[k].append(V[t][p][1] - moy)
        if all(place):
            out.append("   place de la séance dans le bloc (écart à la moyenne du tour, tout coupé) : " +
                       ', '.join(f"{k + 1}re {st.median(l):+.2f}" if k == 0 else f"{k + 1}e {st.median(l):+.2f}" for k, l in enumerate(place)) + " ms")
    return '\n'.join(out)


def p50s(dossier, cle='p50'):
    """{scène: {tour: {page: [valeur de chaque variante]}}}, premier objet JSON de chaque fichier."""
    d = {}
    for f in glob.glob(os.path.join(C, dossier, '*.json')):
        m = re.match(r'(.+)-([a-z0-9]+)-(\d+)\.json$', os.path.basename(f))
        if not m: continue
        try: v = json.JSONDecoder().raw_decode(open(f).read())[0]['valeur']
        except Exception: continue
        d.setdefault(m.group(1), {}).setdefault(int(m.group(3)), {})[m.group(2)] = [x[cle] for x in v['variantes']]
    return d


def ecarts(D, scene, b, a, i):
    return [D[scene][t][b][i] - D[scene][t][a][i] for t in sorted(D.get(scene, {})) if b in D[scene][t] and a in D[scene][t]]


def reunion():
    """Les campagnes réunies, contraste par contraste (tours de toutes les campagnes qui ont les deux pages)."""
    camp = {k: p50s(k) for k in ('final2', 'temoin', 'temoin2', 'diag', 'diag2')}
    out = ["Réunion des passages (final2 : § 1 ; temoin, temoin2 : plus haut ; diag, diag2 : plus bas), contraste par contraste :"]
    for scene in ('moyenne-cockpit', 'legere-cockpit'):
        out.append(f"{NOM_SCENE[scene]} :")
        for b, a, i, nom in (('sans', 'a', 1, "témoin, sans l'option − 0.3.10, tout coupé"), ('fin', 'sans', 1, "coût fixe, avec − sans l'option, tout coupé"),
                             ('fin', 'a', 1, "avec l'option − 0.3.10, tout coupé"), ('fin', 'a', 0, "avec l'option − 0.3.10, tout allumé")):
            l, parts = [], []
            for k, D in camp.items():
                x = ecarts(D, scene, b, a, i)
                if x: l += x; parts.append(f"{k} {st.median(x):+.2f}")
            lo, hi = bootstrap(l)
            out.append(f"   {nom:46s} {st.median(l):+.2f} ms [{lo:+.2f} ; {hi:+.2f}], {len(l)} tours, {sum(v > 0 for v in l)} positifs ({', '.join(parts)})")
    return '\n'.join(out)


def diagnostic_cpu():
    """modele4.js : temps processeur de rendu.draw seul (cpu50) à côté du temps synchronisé (p50)."""
    T, P = p50s('diag'), p50s('diag', 'cpu50')
    out = ["Temps processeur de rendu.draw, sans attendre le GPU (outils/modele4.js, carré latin, 6 tours ; médianes) :"]
    for scene in ('moyenne-cockpit', 'legere-cockpit'):
        ligne = []
        for page, nom in (('a', '0.3.10'), ('sans', "sans l'option"), ('fin', "avec l'option")):
            ligne.append(f"{nom} {st.median([P[scene][t][page][0] for t in P[scene]]):.2f} ms (synchronisé {st.median([T[scene][t][page][0] for t in T[scene]]):.2f})")
        out.append(f"   {NOM_SCENE[scene]}, tout allumé : " + ' ; '.join(ligne))
        out.append(f"      avec l'option − 0.3.10, processeur : {st.median(ecarts(P, scene, 'fin', 'a', 0)):+.2f} ms ; "
                   f"témoin sans − 0.3.10 en temps synchronisé sur ces 6 tours : {st.median(ecarts(T, scene, 'sans', 'a', 1)):+.2f} ms")
    return '\n'.join(out)


def diagnostic_code():
    """Pages de diagnostic : fin2 sans le code du soleil (contact) ou sans celui du contact (soleil), Légère."""
    D = p50s('diag2'); sc = 'legere-cockpit'
    n = len([t for t in D.get(sc, {}) if len(D[sc][t]) == 4])
    out = [f"Part du shader (Légère cockpit, carré latin à quatre pages, {n} tours) : fin2.html modifiée dans le dossier de travail, une",
           "   ligne de son JavaScript ; « contact » : le shader appelle shadow() au lieu de photoSoleil(), le code du soleil",
           "   (tuile, carte lointaine, pénombre) et ses échantillonneurs disparaissent à la compilation ; « soleil » : contactOcc",
           "   vaut 0, le code du contact disparaît. En Légère, sans ombres du soleil, photoSoleil rendait déjà shadow() d'entrée."]
    for b, nom in (('fin', "l'option entière"), ('contact', 'contact seul'), ('soleil', 'code du soleil seul')):
        for i, quoi in ((1, 'tout coupé'), (0, 'tout allumé')):
            l = ecarts(D, sc, b, 'a', i); lo, hi = bootstrap(l)
            out.append(f"   {nom + ' − 0.3.10, ' + quoi:44s} {st.median(l):+.2f} ms [{lo:+.2f} ; {hi:+.2f}], {sum(v > 0 for v in l)} positifs sur {len(l)}")
    return '\n'.join(out)


def annexe():
    out = ['== 4. Chargement, préparation côté jeu, créations\n']
    carte = {'fm': [], 'l': []}; prep = []; n = 0; avec = 0; parDossier = {}
    for dossier, _ in CAMPAGNES:
        k = 0
        for f in glob.glob(os.path.join(C, dossier, '*.json')):
            try: v = json.JSONDecoder().raw_decode(open(f).read())[0]['valeur']
            except Exception: continue
            k += 1; n += 1
            if v.get('creations'): avec += 1
            if v.get('moteur') == '0.3.11':
                c = v.get('carte')
                if c and c.get('medianeMs') is not None:
                    (carte['l'] if 'legere' in os.path.basename(f) else carte['fm']).append(c['medianeMs'])
                if v.get('preparerUs') is not None: prep.append(v['preparerUs'])
        parDossier[dossier] = k
    fm, lg = carte['fm'], carte['l']
    out.append(f"carte lointaine (precalculerOmbre, 2048², lots qui projettent : 386 appels, 3 759 instances ; temps synchronisé,\n"
               f"  médiane de 5 essais par séance) : médiane {st.median(fm):.1f} ms, de {min(fm):.1f} à {max(fm):.1f} ms ({len(fm)} séances Fine et\n"
               f"  Moyenne des pages 0.3.11). En Légère, le script de mesure la force : {st.median(lg):.1f} ms (de {min(lg):.1f} à {max(lg):.1f} ;\n"
               f"  {len(lg)} séances), 97 appels et 8 Mo. Avant la correction, le jeu la calculait aussi en Légère ; la page corrigée ne\n"
               f"  la calcule plus quand aucune ombre du soleil n'est possible (créations, legere-cockpit : loinTaille 0).")
    out.append(f"B.ombres.preparer (processeur) : médiane {st.median(prep):.1f} µs par appel, de {min(prep):.1f} à {max(prep):.1f} µs ({len(prep)} séances).")
    out.append(f"stats.creations pendant les images mesurées : 0 dans {n - avec} séances sur {n} (" +
               ', '.join(f"{d} {parDossier[d]}" for d, _ in CAMPAGNES) + ').')
    out.append(open(os.path.join(ICI, 'couts-annexe.txt')).read())
    return '\n'.join(out)


entete = open(os.path.join(ICI, 'couts-entete.txt')).read()
texte = [entete]
texte.append("== 1. Construction contre construction, 0.3.10 contre 0.3.11 corrigé\n")
texte.append(tableau((('final2', 'fin'),), "Page finale (fin2.html), 16 tours :"))
texte.append('')
texte.append(tableau((('final', 'v1n'), ('final2', 'fin')), "Réunis avec les 8 tours de v1n (mêmes images dans ces scènes, voir l'en-tête), 24 tours :"))
texte.append("\nDétail : 8 tours à 01 h (a2 contre v1n, avec b02 et v1 dans les mêmes tours ; alternance par bloc au hasard) :\n")
for nom, quoi in (('v0', 'b02.html, 0.3.11 tel que relu'), ('v1', 'shader allégé, bloc PCSS compilé'), ('v1n', 'shader allégé, sans bloc PCSS')):
    texte.append(f"--- a2 contre {nom} ({quoi})")
    texte.append(run('resume.py', 'final', 'a', nom))
texte.append("--- 16 tours, a2 contre fin2 (page finale) :\n")
texte.append(run('resume.py', 'final2', 'a', 'fin'))
texte.append("== 1 bis. Témoin de construction : 0.3.10, 0.3.11 sans l'option et 0.3.11 corrigé\n")
texte.append(open(os.path.join(ICI, 'couts-temoin.txt')).read())
texte.append(temoin('temoin2', "Carré latin (outils/seances_latin.py), 18 tours :"))
texte.append('')
texte.append(temoin('temoin', "Premier passage, ordre ABC puis CBA (outils/seances.py), 20 tours ; « sans » toujours au milieu du bloc :"))
texte.append('')
texte.append(reunion())
texte.append('')
texte.append(diagnostic_cpu())
texte.append('')
texte.append(diagnostic_code())
texte.append('')
texte.append("== 2. Effet par effet, même séance, 8 tours (v0 = 0.3.11 tel que relu, v1n = corrigé ; fin2 fait le même travail\n"
            "que v1n dans ces scènes, voir l'en-tête). En Légère, la tuile, la carte lointaine et la pénombre ne servent pas :\n"
            "leurs lignes y mesurent le bruit.\n")
texte.append(run('resume_effets.py', 'effets'))
texte.append("== 3. Reproduction de la relecture sur l'ancienne base (avant le rebasage ; alternance stricte, outils/modele.js)\n")
texte.append(run('resume.py', 'b0', 'avant', 'apres'))
texte.append(annexe())
texte.append("\n== 5. Mesures du 18/11 (ancienne base, avant correction), gardées pour mémoire\n")
texte.append(open(ANCIEN).read())
open(SORTIE, 'w').write('\n'.join(texte))
with open(SEANCES, 'w') as s:
    s.write("Une ligne par séance : heure, scène, page, tour, durée, charge de la machine, toile, moteur, créations, puis\n"
            "p50 de chaque variante (ms). Campagnes du 19/11, dans l'ordre où elles ont tourné.\n")
    for dossier, quoi in CAMPAGNES:
        s.write(f"\n=== {dossier} ({quoi})\n")
        s.write(open(os.path.join(C, dossier + '.out')).read())
print('écrit', SORTIE, SEANCES)
