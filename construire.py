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
# Ordre d'exécution : le moteur, puis la simulation (circuit, conduite, course), le son, le décor, les carènes, la
# voiture, les traces et la fumée, le réalisateur de la démo, la coque.
MODULES = [
    'ferro/surface.js',  # taille physique et plafond de pixels, copie FERRO verrouillée
    'moteur/renderer.js',
    'ferro/engine.js',
    'ferro/physx-runtime.js',
    'ferro/physx.js',
    # chronomètre GPU optionnel du moteur (EXT_disjoint_timer_query_webgl2) : sans lui, rendu.profile() reste nul et
    # le volet de mesures ne peut pas distinguer le CPU du GPU. Copie verrouillée, chargée telle quelle.
    'ferro/gpu-profile.js',
    'circuit.js',
    'couverts.js',  # sections, abri 3D et galeries ; avant chaussée/décor/jeu
    'route-des-cimes.js',
    'route-des-cimes-decor.js',
    'larche-vinadio-data.js',
    'larche-vinadio.js',
    'larche-relief.js',
    'coniferes-alpins.js',
    'larche-vinadio-decor.js',
    'marseille.js',
    'marseille-decor.js',
    'destinations.js',
    'virages.js',
    'ferro/vehicle-dynamics.js',
    'pneus.js',
    'usure-pneus.js',
    'chaussee.js',
    'conduite.js',
    'degats.js',
    'contacts.js',
    'obstacles.js',
    'strategie-stands.js',
    'course.js',
    'son.js',
    'botanique.js',
    'ecologie.js',
    'saisons.js',
    'vegetation.js',
    # bords de route du lot 22F (publicités en séries, bords dangereux) : lu par decor.js et jeu.js s'il est présent
    'bords.js',
    'baikal.js',  # décor boréal préparé avant la construction des nappes
    'batiments.js',  # façades, garages et repères de la voie de service, préparés une fois
    'lieux.js',  # rochers organiques, pyramides du désert et lieux emblématiques des neuf circuits
    'decor.js',
    'solides-physx.js',
    'physique.js',
    'faune.js',
    'aeriens.js',
    'signalisation-course.js',
    'equipe-stands.js',
    'camera-transition.js',
    'championnat.js',
    'records.js',
    'cache.js',
    'panorama-cache.js',
    'effets-saison.js',
    'aurores.js',
    'carene.js',
    'humain-donnees.js',
    'humain-corps.js',
    'public.js',
    'main.js',
    'cockpit-matieres.js',
    'voiture.js',
    'eau-carrosserie.js',  # perles attachées aux surfaces peintes, préparées avant la séance
    'animaux.js',
    'traces.js',
    'echappement.js',
    'expressions-pilote.js',
    'cinema.js',
    'realisateur.js',
    'meteo.js',
    'visiere-optique.js',  # optique procédurale sur la scène courante, hors modules FERRO verrouillés
    'vitre.js',
    'sillage.js',
    'reseau.js',
    'pneus-reseau.js',
    'mesures.js',
    'qualite.js',
    # cadence d'affichage : période de l'écran, pas fixes verrouillés, diviseur d'images (lue par la boucle de jeu.js)
    'cadence.js',
    'graphismes.js',
    'detail-peripherique.js',
    'ambiance.js',
    'conditions-course.js',
    'navigation-menu.js',
    'menu-arcade.js',  # écrans arcade, vrai tracé XYZ et aperçu 2D à cadence bornée
    'autoconfig.js',
    'commandes-manette.js',  # affectations analogiques indépendantes de chaque joueur
    'scene-bench.js',
    # vibrations de manette : quatre sorties calculées une fois par image rendue, branchées par jeu.js
    'vibrations.js',
    # ombres photo (FERRO 0.3.11, ombresPhoto) : contact des voitures, tuile de la voiture filmée, pénombre, carte
    # lointaine et journal du gouverneur, préparés par jeu.js avant chaque rendu.draw
    'ombres.js',
    'visites.js',  # fréquentation globale du titre, via le salon du même site
    'jeu.js',
]
# Version affichée au titre (David, 16/11/2026 : « incrémente les versions à chaque maj, je veux la vraie version »).
# VERSION.json porte la version et l'empreinte des sources (src/ et ce script). Quand les sources changent par
# rapport au dernier commit, la version du commit monte d'un cran (dernier nombre), une seule fois pour toute la
# mise à jour ; reconstruire sans rien changer garde la même version et la même page. Une version montée à la main
# (0.3.0 pour un grand lot, par exemple) est gardée.
FICHIER_VERSION = ICI / 'VERSION.json'


def empreinte_sources():
    h = hashlib.sha256()
    for chemin in sorted(p for p in SRC.rglob('*') if p.is_file()) + [pathlib.Path(__file__).resolve()]:
        h.update(str(chemin.relative_to(ICI)).encode('utf-8') + b'\0' + chemin.read_bytes() + b'\0')
    return h.hexdigest()


def version_du_jeu():
    import subprocess
    nombres = lambda v: tuple(int(x) for x in v.split('.'))
    actuel = json.loads(FICHIER_VERSION.read_text(encoding='utf-8')) if FICHIER_VERSION.exists() else {'version': '0.2.0'}
    try:
        base = json.loads(subprocess.run(['git', 'show', 'HEAD:VERSION.json'], cwd=ICI, capture_output=True, text=True, check=True).stdout)
    except Exception:
        base = None
    empreinte = empreinte_sources()
    if base is None or nombres(actuel['version']) > nombres(base['version']):
        version = actuel['version']
    elif base.get('empreinte') == empreinte:
        version = base['version']
    else:
        n = list(nombres(base['version'])); n[-1] += 1; version = '.'.join(map(str, n))
    contenu = {'version': version, 'titre': 'BITUME', 'moteur': 'FERRO', 'empreinte': empreinte}
    texte = json.dumps(contenu, indent=2, ensure_ascii=False) + '\n'
    if not FICHIER_VERSION.exists() or FICHIER_VERSION.read_text(encoding='utf-8') != texte:
        FICHIER_VERSION.write_text(texte, encoding='utf-8')
    return version
# Titre et description en tête du gabarit : ils passent dans le <head> de la page complète.
ENTETE = re.compile(r'\A(<title>[^<]*</title>\n<meta name="description" content="[^"]*">\n)')
ICONE_SVG = ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>"
             "<rect width='32' height='32' rx='7' fill='#0b0d10'/>"
             "<path d='M5 25 L15 7 h6 L11 25z' fill='#e0301e'/>"
             "<path d='M14 25 L24 7 h3 L17 25z' fill='#f2ecdf'/></svg>")
ICONE = f'<link rel="icon" href="data:image/svg+xml,{quote(ICONE_SVG)}">\n'


def main():
    import subprocess,sys
    subprocess.run([sys.executable,str(ICI/'tools/check-ferro-lock.py'),str(ICI)],check=True)
    gabarit = (SRC / 'index.html').read_text(encoding='utf-8')
    style = (SRC / 'style.css').read_text(encoding='utf-8')
    sources = {nom: (SRC / nom).read_text(encoding='utf-8') for nom in MODULES}
    for nom, code in sources.items():
        bas = code.lower()
        if '</script' in bas or '<!--' in bas:
            raise SystemExit(f'{nom} contient « </script » ou « <!-- » : la page serait mal découpée')
    if gabarit.count('/*STYLE*/') != 1 or gabarit.count('<!--MODULES-->') != 1:
        raise SystemExit('index.html doit contenir une fois /*STYLE*/ et une fois <!--MODULES-->')
    if gabarit.count('__VERSION_JEU__') != 2:
        raise SystemExit('index.html doit porter la version deux fois (libellé et badge du titre)')
    version = version_du_jeu()
    gabarit = gabarit.replace('__VERSION_JEU__', version)
    if 'googleapis' in gabarit or 'googleapis' in style:
        raise SystemExit('BITUME ne charge aucune police : le style se sert de celles du système')

    if sources['jeu.js'].count('__REVISION_PISTES__') != 1:
        raise SystemExit('Contrat de piste introuvable ou ambigu')
    # Une limite ou un obstacle peut venir d'un autre module : l'empreinte complète évite une dépendance oubliée.
    revision_pistes = empreinte_sources()
    sources['jeu.js'] = sources['jeu.js'].replace('__REVISION_PISTES__', revision_pistes)
    sources['jeu.js']='FERRO.initPhysics().then(function(){\n'+sources['jeu.js']+"\n}).catch(function(error){console.error('FERRO physics initialization failed',error);const notice=document.createElement('p');notice.setAttribute('role','alert');notice.textContent='Impossible de démarrer le jeu. Rechargez la page.';document.body.appendChild(notice);});"
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
    DIST.mkdir(exist_ok=True)
    (DIST / 'bitume.html').write_bytes(octets)
    (DIST / 'artefact.html').write_text(fragment, encoding='utf-8')

    taille = {
        'version': version,
        'raw': len(octets),
        'gzip': len(gzip.compress(octets, 9, mtime=0)),
        'sha256': hashlib.sha256(octets).hexdigest(),
        'sources': {nom: len(code.encode('utf-8')) for nom, code in {**sources, 'index.html': gabarit, 'style.css': style}.items()},
    }
    (ICI / 'SIZE.json').write_text(json.dumps(taille, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f"CONSTRUIT  {DIST / 'bitume.html'}  version {version}, {taille['raw']} octets, {taille['gzip']} compressés, sha256 {taille['sha256'][:16]}")


if __name__ == '__main__':
    main()
