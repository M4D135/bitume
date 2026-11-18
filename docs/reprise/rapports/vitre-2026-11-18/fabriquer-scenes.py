#!/usr/bin/env python3
"""Fabrique scenes.js : les images de fond du prototype, en base64, pour que la page s'ouvre sans serveur.

Une page ouverte depuis le disque (file://) ne peut pas donner à WebGL une image lue à côté d'elle : Chrome la
tient pour étrangère. Une image en data: n'a pas ce défaut. Les JPEG viennent du jeu lui-même (capturer-scenes.sh),
pris sans affichage ni couches 2D de pluie, puisque la visière les remplace.

    python3 fabriquer-scenes.py <dossier des JPEG> [sortie.js]
"""
import base64
import pathlib
import sys

source = pathlib.Path(sys.argv[1])
sortie = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else pathlib.Path(__file__).with_name('scenes.js'))
lignes = ['/* BITUME, lot 19 : images de fond du prototype (captures du jeu 0.2.38, 1280 x 720, sans affichage).',
          '   Fabriqué par fabriquer-scenes.py ; ne pas éditer à la main. */',
          'window.SCENES = {']
for image in sorted(source.glob('*.jpg')):
    donnees = base64.b64encode(image.read_bytes()).decode('ascii')
    lignes.append(f"  '{image.stem}': 'data:image/jpeg;base64,{donnees}',")
lignes.append('};')
sortie.write_text('\n'.join(lignes) + '\n', encoding='utf-8')
print(sortie, sortie.stat().st_size, 'octets')
