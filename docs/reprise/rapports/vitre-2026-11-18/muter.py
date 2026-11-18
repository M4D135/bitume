# BITUME, lot 19 : preuve que verifications/visiere.test.mjs peut échouer. Chaque mutant casse une garantie du
# module (rythme d'images, hasard, allocation, comportements, source GLSL) ; le test doit échouer sur chacun.
#   python3 -I muter.py <dossier temporaire>
# Le module muté et une copie du test vont dans le dossier temporaire ; le dépôt n'est pas touché.
import pathlib, shutil, subprocess, sys
ICI = pathlib.Path(__file__).resolve().parent
DEPOT = ICI.parents[3]
M = pathlib.Path(sys.argv[1]).resolve()
src = (ICI / 'visiere.js').read_text()
test = (DEPOT / 'verifications/visiere.test.mjs').read_text()
SEC_LEGERE = '  if(actif<=.0008)return vec4(0.);\n'
mutants = [
  ('sans extrapolation du reliquat', 'u[0] = e.t + r;', 'u[0] = e.t;'),
  ('hasard de la course', '    const h = PAS;\n', '    const h = PAS; Math.random();\n'),
  ('allocation par image', 'const u = e.uniformes, r = e.reste', 'const u = new Float32Array(28), r = e.reste'),
  ('buée en vue extérieure', 'const cibleBuee = exterieur ? 0 :', 'const cibleBuee = exterieur ? .5 :'),
  ("l'air ne chasse plus l'eau", 'const air = lisse(9, 52, v);', 'const air = 0 * lisse(9, 52, v);'),
  ('pas fixe à 1/60', 'const PAS = 1 / 120;', 'const PAS = 1 / 60;'),
  ('seuil des gerbes à 8 m/s (mutant équivalent : lisse(14, …) y vaut déjà 0)', '!(vitesse > 14)) return 0;', '!(vitesse > 8)) return 0;'),
  ('gerbes portées à 90 m', '(1 - lisse(45, 70, distance))', '(1 - lisse(45, 90, distance))'),
  ('accolade en trop au palier Fine', '  for(int i=0;i<4;i++){', '  for(int i=0;i<4;i++){{'),
  ('Légère lit la scène', SEC_LEGERE, SEC_LEGERE + '  vec4 z=texture(uScene,uv);\n'),
  ('pas de sortie à sec dans Légère', SEC_LEGERE, ''),
]
for nom, a, b in mutants:
  assert src.count(a) == 1, (nom, src.count(a))
  d = M / 'arbre'
  shutil.rmtree(d, ignore_errors=True)
  (d / 'verifications').mkdir(parents=True); (d / 'docs/reprise/rapports/vitre-2026-11-18').mkdir(parents=True)
  (d / 'verifications/visiere.test.mjs').write_text(test)
  (d / 'docs/reprise/rapports/vitre-2026-11-18/visiere.js').write_text(src.replace(a, b))
  r = subprocess.run(['node', str(d / 'verifications/visiere.test.mjs')], capture_output=True, text=True)
  passes = sum(1 for l in r.stdout.splitlines() if l.startswith('ok '))
  err = [l for l in (r.stderr or '').splitlines() if 'Error' in l][:1]
  print(f"{'ÉCHOUE' if r.returncode else 'PASSE '}  {nom}  ({passes} contrôles passés avant) {err[0][:100] if err else ''}")
shutil.rmtree(M / 'arbre', ignore_errors=True)
