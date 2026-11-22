#!/bin/sh
# Qualifie le SDK CPU de la référence web .91 dans un dossier vide, sur un Mac arm64.
set -eu
sources=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
: "${1:?Indiquer un dossier de travail vide pour la compilation}"
[ "$(uname -s)/$(uname -m)" = Darwin/arm64 ] || { echo "macOS arm64 requis" >&2; exit 1; }
mkdir -p "$1"
cd "$1"
[ -z "$(ls -A)" ] || { echo "Le dossier de travail doit être vide" >&2; exit 1; }
ici=$(pwd -P)
mkdir sdk
python3 -m venv outils
cat > outils-verrouilles.txt <<'VERROU'
cmake==3.31.6 --hash=sha256:da9d4fd9abd571fd016ddb27da0428b10277010b23bb21e3678f8b9e96e1686e
ninja==1.11.1.4 --hash=sha256:b33923c8da88e8da20b6053e38deb433f53656441614207e01d283ad02c5e8e7
VERROU
outils/bin/pip --disable-pip-version-check --no-cache-dir install --only-binary=:all: --no-deps --require-hashes -r outils-verrouilles.txt
export PATH="$ici/outils/bin:$PATH"
commit=9f355ca9246febc4da9dd1b012f0dc7dec6ce0bf
curl -fsSL --retry 2 "https://codeload.github.com/fabmax/PhysX/tar.gz/$commit" -o physx.tar.gz
echo 'cad47b3032244fbf096f0839d75df89092a2dc2e5507a25ad083b5f9120d479a  physx.tar.gz' | shasum -a 256 -c -
tar -xzf physx.tar.gz --strip-components=1 -C sdk
# Le profil Mac du fork ajoute le wrapper JNI à chaque configuration. La sonde C++
# utilise les cibles CPU de ce même profil, sans générateur de liaisons Java.
python3 - <<'PY'
from pathlib import Path
p = Path('sdk/physx/source/compiler/cmake/jni-mac/CMakeLists.txt')
s = p.read_text()
ligne = 'INCLUDE(jni-mac/PhysXJniBindings.cmake)\n'
if s.count(ligne) != 1:
    raise SystemExit('Manifeste JNI différent de la révision qualifiée')
p.write_text(s.replace(ligne,''))
PY
cmake -S "$ici/sdk/physx/compiler/public" -B build -G Ninja \
  -DPHYSX_ROOT_DIR="$ici/sdk/physx" -DTARGET_BUILD_PLATFORM=jni-mac -DPX_OUTPUT_ARCH=arm \
  -DCMAKE_BUILD_TYPE=release -DCMAKE_OSX_ARCHITECTURES=arm64 -DCMAKE_OSX_DEPLOYMENT_TARGET=12.0 \
  -DPX_GENERATE_STATIC_LIBRARIES=ON -DPX_GENERATE_GPU_PROJECTS=OFF -DPX_BUILDSNIPPETS=OFF \
  -DPX_OUTPUT_LIB_DIR="$ici/lib" -DPX_OUTPUT_BIN_DIR="$ici/bin"
cmake --build build --parallel 6 --target PhysX PhysXCommon PhysXFoundation PhysXExtensions
lib="$ici/lib/bin/jni-mac.aarch64/release"
xcrun clang++ -std=c++20 -O2 -arch arm64 -DNDEBUG -DPX_PHYSX_STATIC_LIB -Isdk/physx/include \
  "$sources/physx-cpu.cpp" -L"$lib" -lPhysXExtensions_static_64 -lPhysX_static_64 \
  -lPhysXPvdSDK_static_64 -lPhysXCommon_static_64 -lPhysXFoundation_static_64 -o sonde
lipo -archs sonde
for passage in 1 2 3; do
  echo "Passage $passage"
  ./sonde
done
