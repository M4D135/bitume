#!/usr/bin/env python3
"""Pilote autonome du Spark : il découpe lui-même chaque lot en fiches, puis la chaîne (chaine.py) les mène une à une,
sans jetons Claude. David, 18/11/2026 : « continue fais tout on a le spark pour economiser ». Repris de Point de rupture.

    python3 tools/spark/autonome.py LOTS.json --sortie DOSSIER [--essai]

LOTS.json : liste de lots { nom, arbre, plan, titre, texte, fichiers, filet }. « arbre » : l'arbre de travail où coder,
sur sa propre branche spark/… ; « plan » et « titre » : le document et le début du ou des titres de section qui
décrivent le lot ; « texte » : la consigne ; « fichiers » : les sources dont le Spark reçoit la carte ; « filet » :
expression régulière des suites de verifications/ lancées en filet après chaque fiche. Un seul passage, sans minuterie.
Les commits « Spark : … » restent locaux : à relire et à juger sur image avant toute intégration.
"""
import argparse, json, pathlib, re, subprocess, time

OUTILS = pathlib.Path(__file__).resolve().parent
KBZA = str(pathlib.Path.home() / 'bin' / 'kbza')
FORMAT = """Tu découpes un lot de travail du jeu « BITUME » (course de F1 1980 dans une seule page HTML ; JavaScript sans
dépendance ; modules src/*.js de la forme (function (B) { … })(globalThis.BITUME = globalThis.BITUME || {}) ; simulation
déterministe au pas fixe de 1/120 s ; tests Node dans verifications/*.test.mjs) en fiches pour une chaîne qui fait coder
un modèle fiche par fiche. Le modèle qui code ne voit QUE les extraits que la fiche désigne. Format exact d'une fiche :
Titre: <lot> : <ce que fait la fiche, une ligne>
Fichiers: <désignations séparées par « ; »>
Tests: <commandes séparées par « ; »>
---
<la tâche : quoi changer, dans quel fichier, quelles fonctions, quels noms, quelles valeurs ; précise, complète, rien à deviner>
Désignations : `chemin` (fichier entier : seulement s'il est court ou neuf), `chemin:a-b` (lignes a à b), `chemin:/motif/+N`
(N lignes à partir de la première ligne qui contient le motif). Un motif est copié EXACTEMENT d'une ligne de la carte du
code ci-dessous, sans « ; ». Les chemins partent de la racine du dépôt (src/…, verifications/…, tools/…).
Règles : de 3 à 8 fiches, dans l'ordre où elles s'appliquent ; une fiche = un changement cohérent sur 1 à 3 fichiers ;
120 lignes d'extraits au plus par fiche ; tout comportement nouveau a son test dans la même fiche ; les Tests nomment
des suites existantes ou celle que la fiche crée (node verifications/<nom>.test.mjs) ; ne touche ni à src/jeu.js ni à
src/index.html ; dans la simulation, ni Math.random ni Date, aucune allocation par pas ni par image ; rien d'importé
(ni image, ni son, ni bibliothèque) ; textes et commentaires en français. Ne refais pas ce qui existe déjà (la carte le
montre). Rends uniquement les fiches, chacune précédée d'une ligne `=== FICHE <nn>-<nom-court> ===`.
"""
DEF = re.compile(r'^\s{0,8}(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:\(|function|\w+\s*=>|\{)|B\.\w+\s*=)')


def dire(*a):
    print(time.strftime('%d/%m %H:%M:%S'), *a, flush=True)


def carte(arbre, fichiers, limite=4500):
    morceaux = []
    for f in fichiers:
        p = arbre / f
        if not p.is_file():
            continue
        lignes = p.read_text(encoding='utf-8').splitlines()
        defs = [f'{k}: {l.strip()[:100]}' for k, l in enumerate(lignes, 1) if DEF.match(l)]
        morceaux.append(f'### {f} ({len(lignes)} lignes)\n' + '\n'.join(defs[:45]))
    return '\n'.join(morceaux)[:limite]


def section(chemin, titres, limite=5500):
    if not chemin.is_file():
        return ''
    lignes, sorties = chemin.read_text(encoding='utf-8').splitlines(), []
    for titre in ([titres] if isinstance(titres, str) else titres):
        garde, niveau = [], 0
        for l in lignes:
            m = re.match(r'^(#+) ', l)
            if not niveau:
                if m and titre.lower() in l.lower():
                    niveau = len(m[1]); garde.append(l)
            elif m and len(m[1]) <= niveau:
                break
            else:
                garde.append(l)
        sorties.append('\n'.join(garde))
    return '\n\n'.join(sorties)[:limite]


def demander(texte, fichier):
    fichier.write_text(texte, encoding='utf-8')
    r = subprocess.run([KBZA, 'ask', '--prompt-file', str(fichier), '--no-memory', '--reasoning-effort', 'low', '--max-tokens', '0',
                        '--timeout-seconds', '2400', '--idle-timeout-seconds', '0'], capture_output=True, text=True)
    return '\n'.join(l for l in r.stdout.splitlines() if not l.startswith('Spark : ')).strip()


def lot(L, sortie, essai):
    arbre = pathlib.Path(L['arbre']).expanduser()
    d = sortie / L['nom']
    d.mkdir(parents=True, exist_ok=True)
    suites = sorted(p.name for p in (arbre / 'verifications').glob('*.test.mjs'))
    proches = [s for s in suites if L.get('filet') and re.search(L['filet'], s)]
    filet = [f'node verifications/{s}' for s in proches]
    texte = (L.get('texte', '') + '\n\n' + (section(arbre / L['plan'], L['titre']) if L.get('plan') else '')).strip()
    demande = (FORMAT + f"\n=== LOT {L['nom']} ===\n{texte}\n\n=== SUITES EXISTANTES PROCHES (verifications/) ===\n{' '.join(proches)}\n\n"
               f"=== CARTE DU CODE (numéro de ligne : définition) ===\n{carte(arbre, L.get('fichiers', []))}\n")
    dire(L['nom'], f'demande de découpe : {len(demande)} caractères, filet de {len(filet)} suite(s)')
    (d / 'decoupe.demande.txt').write_text(demande, encoding='utf-8')
    if essai:
        return 'essai'
    rep = ''
    for tour in (1, 2):
        rep = demander(demande, d / 'decoupe.demande.txt')
        (d / f'decoupe-{tour}.md').write_text(rep + '\n', encoding='utf-8')
        if '=== FICHE' in rep:
            break
    morceaux = re.split(r'^=== FICHE\s+(\S+)\s*===\s*$', rep, flags=re.M)
    fiches = []
    for nom, corps in zip(morceaux[1::2], morceaux[2::2]):
        corps = corps.strip()
        if not re.search(r'^Titre:', corps, flags=re.M) or '\n---' not in corps:
            continue
        if filet and re.search(r'^Tests:', corps, flags=re.M):
            corps = re.sub(r'^(Tests:.*)$', lambda m: m[1].rstrip(' ;') + ' ; ' + ' ; '.join(filet), corps, count=1, flags=re.M)
        elif filet:
            corps = corps.replace('\n---', '\nTests: ' + ' ; '.join(filet) + '\n---', 1)
        f = d / (re.sub(r'[^\w.-]', '-', nom) + '.md')
        f.write_text(corps + '\n', encoding='utf-8')
        fiches.append(f)
    if not fiches:
        dire(L['nom'], 'aucune fiche exploitable')
        return 'aucune fiche exploitable'
    dire(L['nom'], f'{len(fiches)} fiche(s) : ' + ', '.join(f.stem for f in fiches))
    avant = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], cwd=arbre, capture_output=True, text=True).stdout.strip()
    subprocess.run(['python3', str(OUTILS / 'chaine.py'), *map(str, fiches), '--tours', '4', '--sortie', str(d / 'chaine')], cwd=arbre)
    n = subprocess.run(['git', 'rev-list', '--count', f'{avant}..HEAD'], cwd=arbre, capture_output=True, text=True).stdout.strip()
    return f'{len(fiches)} fiche(s), {n} commit(s) depuis {avant}'


p = argparse.ArgumentParser(description=__doc__.split('\n')[0])
p.add_argument('lots', type=pathlib.Path)
p.add_argument('--sortie', type=pathlib.Path, required=True)
p.add_argument('--essai', action='store_true', help='construit les demandes de découpe sans appeler le Spark')
a = p.parse_args()
a.sortie.mkdir(parents=True, exist_ok=True)
bilan = []
for L in json.loads(a.lots.read_text(encoding='utf-8')):
    try:
        r = lot(L, a.sortie, a.essai)
    except Exception as e:  # un lot qui casse ne doit pas arrêter les suivants
        r = f'erreur : {e}'
    dire(L['nom'], '→', r)
    bilan.append(f"- {L['nom']} ({L['arbre']}) : {r}")
    (a.sortie / 'BILAN.md').write_text('# Pilote autonome du Spark\n\n' + '\n'.join(bilan) + '\n', encoding='utf-8')
dire('PILOTE FINI')
