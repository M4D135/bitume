#!/usr/bin/env python3
"""Créations du moteur par le chemin du joueur : python3 lancer.py page.html dossier"""
import json, os, subprocess, sys
page, dossier = sys.argv[1], sys.argv[2]
os.makedirs(dossier, exist_ok=True)
OUTIL = '/Users/david/Projects/bitume-wt/moteur/tools/page-essai.mjs'
CONFS = [
  dict(nom='fine-cockpit-retro', circuit=0, qualite='high', vue='cockpit', retro='oui', meteo='soleil', moment='jour', mode='course'),
  dict(nom='fine-duo', circuit=0, qualite='high', vue='cockpit', retro='oui', meteo='soleil', moment='jour', mode='duo'),
  dict(nom='fine-pluie', circuit=2, qualite='high', vue='cockpit', retro='oui', meteo='pluie', moment='jour', mode='course'),
  dict(nom='fine-nuit', circuit=0, qualite='high', vue='cockpit', retro='oui', meteo='soleil', moment='nuit', mode='course'),
  dict(nom='moyenne-poursuite', circuit=3, qualite='medium', vue='poursuite', retro='oui', meteo='soleil', moment='jour', mode='course'),
  dict(nom='legere-cockpit', circuit=0, qualite='low', vue='cockpit', retro='oui', meteo='soleil', moment='jour', mode='course'),
  dict(nom='auto-cockpit', circuit=6, qualite='auto', vue='cockpit', retro='oui', meteo='soleil', moment='jour', mode='course'),
]
modele = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'modele.js')).read()
for c in CONFS:
    js = os.path.join(dossier, c['nom'] + '.js')
    open(js, 'w').write(modele.replace('__CONF__', json.dumps(c)))
    r = subprocess.run(['node', OUTIL, page, js, '--taille', '1440,757', '--capture', os.path.join(dossier, c['nom'] + '.png')], capture_output=True, text=True, timeout=600)
    open(os.path.join(dossier, c['nom'] + '.json'), 'w').write(r.stdout + r.stderr)
    try:
        v = json.loads(r.stdout); x = v['valeur']
        print(f"{c['nom']}: moteur {x['moteur']} créations prépa {x['creations']['preparation']} départ {x['creations']['depart']} course {x['creations']['course']} ; "
              f"tardives {x['tardives']} ; palier {x['palier']} ombres {x['ombres']} ; photo {x['photo']} ; {x['phase']} {x['horloge']} s ; erreurs {v.get('erreurs')}", flush=True)
    except Exception as e:
        print(f"{c['nom']}: ÉCHEC {r.stdout[:400]} {r.stderr[:400]}", flush=True)
