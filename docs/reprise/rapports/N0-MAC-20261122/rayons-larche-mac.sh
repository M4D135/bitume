#!/bin/sh
# Construit la sonde et écrit le reçu des trois processus dans un dossier vide.
set -eu
sondes=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
racine=$(CDPATH= cd -- "$sondes/../../../.." && pwd -P)
: "${1:?Indiquer un dossier de travail vide}"
[ "$(uname -s)/$(uname -m)" = Darwin/arm64 ] || { echo "macOS arm64 requis" >&2; exit 1; }
mkdir -p "$1"
cd "$1"
[ -z "$(ls -A)" ] || { echo "Le dossier de travail doit être vide" >&2; exit 1; }
node "$sondes/extraire-rayons-larche.cjs" "$racine" scene.json
echo 'f57239788eba5c019145cef92ecb26ad259bd47f740531c55dece2f85d4fd3f0  scene.json' | shasum -a 256 -c -
xcrun -sdk macosx metal -std=metal3.1 -c "$sondes/rayons-larche.metal" -o rayons.air
xcrun -sdk macosx metallib rayons.air -o rayons.metallib
xcrun -sdk macosx clang++ -arch arm64 -std=c++20 -fobjc-arc -O2 -Wall -Wextra -Werror \
  -mmacosx-version-min=14.0 -framework Foundation -framework Metal "$sondes/rayons-larche.mm" -o rayons
[ "$(lipo -archs rayons)" = arm64 ]
for essai in 1 2 3; do
  MTL_DEBUG_LAYER=1 ./rayons scene.json rayons.metallib > "processus-$essai.json" 2> "metal-$essai.log"
  grep -F 'Metal API Validation Enabled' "metal-$essai.log" >/dev/null
done
# Le reçu contient les empreintes, le matériel et les durées, sans chemins locaux.
python3 - "$sondes" <<'PY'
from pathlib import Path
import hashlib, json, statistics, subprocess, sys
sondes = Path(sys.argv[1])
def sha(p):
    return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def commande(*c):
    return subprocess.check_output(c, text=True).strip()
scene = json.loads(Path('scene.json').read_text())
essais = [json.loads(Path(f'processus-{i}.json').read_text()) for i in [1,2,3]]
premier = essais[0]
for essai in essais:
    for cle in ('gpu','supportsRaytracing','octetsStructure','octetsScratch','triangles','rayons'):
        if essai[cle] != premier[cle]:
            raise ValueError(f'Résultats incohérents entre processus pour {cle}')
recu = {
    'scene': {'circuit':scene['circuit'], 'graine':scene['graine'], 'abscisseM':scene['abscisseM'],
              'triangles':premier['triangles'], 'sha256':sha('scene.json')},
    'machine': {'gpu':premier['gpu'], 'architecture':'arm64','macOS':commande('sw_vers','-productVersion'),
                'buildMacOS':commande('sw_vers','-buildVersion'),'xcode':commande('xcodebuild','-version').splitlines(),
                'sdk':commande('xcrun','--show-sdk-version'),'metal':commande('xcrun','metal','--version').splitlines()[0],
                'compilateur':commande('xcrun','clang++','--version').splitlines()[0],'node':commande('node','--version')},
    'supportsRaytracing':premier['supportsRaytracing'], 'validationAPI':True,
    'octetsStructure':premier['octetsStructure'],'octetsScratchConstruction':premier['octetsScratch'],
    'sha256Sources': {nom:sha(sondes/nom) for nom in ('rayons-larche.metal','rayons-larche.mm','extraire-rayons-larche.cjs','rayons-larche-mac.sh')},
    'sha256BinairesLocaux':{nom:sha(nom) for nom in ('rayons','rayons.metallib')},
    'controlesParPasse':premier['rayons'],'processus':[],
    'chronometrage':'GPUStartTime → GPUEndTime du command buffer en microsecondes. Chaque passe groupe six rayons. Les temps incluent le coût fixe du command buffer.'}
for i,e in enumerate(essais,1):
    recu['processus'].append({'numero':i,'constructionGPUus':round(e['constructionGPUus'],3),
                              'quatrePassesGPUus':[round(t,3) for t in e['commandesGPUus']]})
Path('rayons-larche.json').write_text(json.dumps(recu,ensure_ascii=False,indent=2)+'\n')
print(f"{premier['triangles']} triangles, trois constructions et {len(premier['rayons'])*4*3} comparaisons CPU/GPU vérifiées")
PY
