#!/usr/bin/env python3
"""Construit BITUME en une seule page HTML, sans dépendance ni fichier d'image ou de son.

    python3 construire.py

Écrit :
  dist/bitume.html    la page complète, à ouvrir telle quelle dans un navigateur, sans rien charger d'ailleurs ;
  dist/artefact.html  le même contenu sans l'enveloppe <html>, pour une publication en artefact (non versionné) ;
  SIZE.json           tailles brute et compressée, empreinte, taille de chaque source.
"""
import gzip
import hashlib
import json
import pathlib
import re
from urllib.parse import quote

ICI = pathlib.Path(__file__).resolve().parent
SRC = ICI / 'src'
DIST = ICI / 'dist'
# Ordre d'exécution : le moteur, puis la simulation (circuit, conduite, course), le son, le décor, la voiture, le
# réalisateur de la démo, la coque.
MODULES = [
    'moteur/renderer.js',
    'circuit.js',
    'conduite.js',
    'course.js',
    'son.js',
    'decor.js',
    'voiture.js',
    'realisateur.js',
    'jeu.js',
]
VERSION = 'essai-0.1'
BUDGET = 1_400_000      # octets : la page reste petite, bien sous la limite des artefacts (16 Mo)
# Titre et description en tête du gabarit : ils passent dans le <head> de la page complète.
ENTETE = re.compile(r'\A(<title>[^<]*</title>\n<meta name="description" content="[^"]*">\n)')
ICONE_SVG = ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>"
             "<rect width='32' height='32' rx='7' fill='#0b0d10'/>"
             "<path d='M5 25 L15 7 h6 L11 25z' fill='#e0301e'/>"
             "<path d='M14 25 L24 7 h3 L17 25z' fill='#f2ecdf'/></svg>")
ICONE = f'<link rel="icon" href="data:image/svg+xml,{quote(ICONE_SVG)}">\n'


def main():
    gabarit = (SRC / 'index.html').read_text(encoding='utf-8')
    style = (SRC / 'style.css').read_text(encoding='utf-8')
    sources = {nom: (SRC / nom).read_text(encoding='utf-8') for nom in MODULES}
    for nom, code in sources.items():
        bas = code.lower()
        if '</script' in bas or '<!--' in bas:
            raise SystemExit(f'{nom} contient « </script » ou « <!-- » : la page serait mal découpée')
    if gabarit.count('/*STYLE*/') != 1 or gabarit.count('<!--MODULES-->') != 1:
        raise SystemExit('index.html doit contenir une fois /*STYLE*/ et une fois <!--MODULES-->')
    if 'googleapis' in gabarit or 'googleapis' in style:
        raise SystemExit('BITUME ne charge aucune police : le style se sert de celles du système')

    scripts = '\n'.join(f'<script>\n// ---- {nom} ----\n{sources[nom]}</script>' for nom in MODULES)
    fragment = gabarit.replace('/*STYLE*/', style.rstrip('\n')).replace('<!--MODULES-->', scripts)
    entete = ENTETE.match(fragment)
    if not entete:
        raise SystemExit('index.html doit commencer par <title> puis <meta name="description">')
    page = ('<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<meta name="robots" content="noindex">\n' + ICONE + entete.group(1) +
            '</head>\n<body>\n' + fragment[entete.end():] + '</body>\n</html>\n')

    octets = page.encode('utf-8')
    if len(octets) > BUDGET:
        raise SystemExit(f'page de {len(octets)} octets, au-delà du budget de {BUDGET}')
    DIST.mkdir(exist_ok=True)
    (DIST / 'bitume.html').write_bytes(octets)
    (DIST / 'artefact.html').write_text(fragment, encoding='utf-8')

    taille = {
        'version': VERSION,
        'raw': len(octets),
        'gzip': len(gzip.compress(octets, 9, mtime=0)),
        'sha256': hashlib.sha256(octets).hexdigest(),
        'sources': {nom: len(code.encode('utf-8')) for nom, code in {**sources, 'index.html': gabarit, 'style.css': style}.items()},
    }
    (ICI / 'SIZE.json').write_text(json.dumps(taille, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f"CONSTRUIT  {DIST / 'bitume.html'}  {taille['raw']} octets, {taille['gzip']} compressés, sha256 {taille['sha256'][:16]}")


if __name__ == '__main__':
    main()
