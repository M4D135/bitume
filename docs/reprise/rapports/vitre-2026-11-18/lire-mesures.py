# BITUME, lot 19 : résume les mesures de mesurer.mjs (une ou plusieurs passes) en tableaux Markdown.
#   python3 -I lire-mesures.py mesures-1.jsonl mesures-2.jsonl
# Temps de mur par passe (ms) : la rafale de n passes, divisée par n ; « a–b » donne l'écart entre les passes de mesure.
# Le chronomètre GPU d'ANGLE sur Metal compte aussi le travail encore en file : il est donné à part, pour mémoire.
import json, sys
PALIERS = {2: 'Fine', 1: 'Moyenne', 0: 'Légère'}
ETATS = ['sec', 'forte-pluie-250', 'grille', 'nuage', 'neige-lente']
mes, controles = {}, []
for f in sys.argv[1:]:
  for l in open(f):
    r = json.loads(l)
    if 'controle' in r: controles.append(r); continue
    if 'erreur' in r: print('erreur', r['essai'], r['erreur'][:120]); continue
    p = PALIERS[r['palier']] + (' mi-rés.' if 'demi=1' in r['essai'] else '')
    mes.setdefault((p, r['etat'], tuple(r['taille'])), []).append(r)
def plage(v):
  v = [x for x in v if x is not None]
  if not v: return '–'
  a, b = min(v), max(v)
  return f'{a:.2f}' if abs(a - b) < .005 else f'{a:.2f}–{b:.2f}'
print('Contrôles :')
for c in controles:
  if c['controle'] == 'sec': print(f"  sec, palier {c['palier']}{' mi-rés.' if 'demi=1' in c['essai'] else ''} : écart max {c['ecart_max']}, {c['pixels_differents']} pixels différents sur {c['pixels']}")
  else: print(f"  ips {c['scene']} : " + ', '.join(f"{k[3:]} Hz → écart {v['ecart_max']} ({v['pixels_differents']} px), uniformes {v['ecart_uniformes']}" for k, v in c.items() if k.startswith('ips')))
for taille in sorted({k[2] for k in mes}, key=lambda x: x[0] * x[1]):
  print(f'\n{taille[0]} × {taille[1]} ({taille[0] * taille[1] / 1e6:.2f} Mpx), temps de mur par passe (ms)\n')
  print('| palier | ' + ' | '.join(ETATS) + ' | voile (¼) | copie seule |')
  print('|---|' + '---|' * (len(ETATS) + 2))
  for p in ['Fine', 'Moyenne', 'Légère', 'Légère mi-rés.']:
    cel = []
    for e in ETATS:
      rs = mes.get((p, e, taille), [])
      # Légère : l'effet compte la copie de la scène qui précède le mélange ; on la retire (effet − copie).
      cel.append(plage([r['effet_mur_ms'] - (r['copie_mur_ms'] if r['palier'] == 0 else 0) for r in rs]))
    tous = [r for e in ETATS for r in mes.get((p, e, taille), [])]
    cel.append(plage([r.get('voile_mur_ms') for r in tous]) if p in ('Fine', 'Moyenne') else '–')
    cel.append(plage([r['copie_mur_ms'] for r in tous]))
    print(f'| {p} | ' + ' | '.join(cel) + ' |')
  print('\nChronomètre GPU (mêmes essais, pour mémoire) :')
  for p in ['Fine', 'Moyenne', 'Légère', 'Légère mi-rés.']:
    print(f'  {p} : ' + ', '.join(f"{e} {plage([r.get('effet_seul_ms', r['effet_ms']) for r in mes.get((p, e, taille), [])])}" for e in ETATS))
gpu = {r['gpu'] for rs in mes.values() for r in rs}
print('\nProcesseur graphique :', ', '.join(gpu))
