#!/bin/sh
# Construit la SDL de la sonde N0 et vérifie trois lectures GPU sur macOS arm64.
set -eu
sondes=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
: "${1:?Indiquer un dossier de travail vide}"
[ "$(uname -s)/$(uname -m)" = Darwin/arm64 ] || { echo "macOS arm64 requis" >&2; exit 1; }
mkdir -p "$1"
cd "$1"
[ -z "$(ls -A)" ] || { echo "Le dossier de travail doit être vide" >&2; exit 1; }
ici=$(pwd -P)
mkdir sources
python3 -m venv outils
cat > outils-verrouilles.txt <<'VERROU'
cmake==3.31.6 --hash=sha256:da9d4fd9abd571fd016ddb27da0428b10277010b23bb21e3678f8b9e96e1686e
ninja==1.11.1.4 --hash=sha256:b33923c8da88e8da20b6053e38deb433f53656441614207e01d283ad02c5e8e7
VERROU
outils/bin/pip --disable-pip-version-check install --only-binary=:all: --no-deps --require-hashes -r outils-verrouilles.txt
export PATH="$ici/outils/bin:$PATH"

version=3.4.20
archive="SDL3-$version.tar.gz"
revision=release-3.4.20-0-gf00dc919c
curl -fsSL --retry 2 "https://github.com/libsdl-org/SDL/releases/download/release-$version/$archive" -o "$archive"
echo "f3bb06f55bed9557227a700af2ea62e49497ebdf58037732a731a5fb3ef8581f  $archive" | shasum -a 256 -c -
tar -xzf "$archive" --strip-components=1 -C sources
[ "$(cat sources/REVISION.txt)" = "$revision" ]

cmake -S sources -B build -G Ninja -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_OSX_ARCHITECTURES=arm64 -DCMAKE_OSX_DEPLOYMENT_TARGET=14.0 \
  -DCMAKE_INSTALL_PREFIX="$ici/install" -DSDL_GPU=ON -DSDL_METAL=ON \
  -DSDL_SHARED=ON -DSDL_STATIC=OFF -DSDL_INSTALL=ON -DSDL_INSTALL_CPACK=OFF \
  -DSDL_TEST_LIBRARY=OFF -DSDL_TESTS=OFF -DSDL_EXAMPLES=OFF > configuration.log
cmake --build build --parallel 4 > compilation.log
cmake --install build > installation.log
lib="$ici/install/lib"
[ "$(lipo -archs "$lib/libSDL3.dylib")" = arm64 ]
xcrun -sdk macosx metal -c "$sondes/deux-passes.metal" -o deux-passes.air
xcrun -sdk macosx metallib deux-passes.air -o deux-passes.metallib
xcrun -sdk macosx clang++ -arch arm64 -std=c++20 -mmacosx-version-min=14.0 \
  -I "$ici/install/include" "$sondes/deux-passes.cpp" -L "$lib" -lSDL3 "-Wl,-rpath,$lib" -o deux-passes

# La sonde approuvée ne change pas. Vérifier la révision exportée à l'exécution
# et le chemin réellement ouvert par dyld, puis comparer chaque pixel au témoin.
cat > revision.cpp <<'CPP'
#include <SDL3/SDL_version.h>
#include <cstdio>
int main() { std::puts(SDL_GetRevision()); }
CPP
xcrun -sdk macosx clang++ -arch arm64 -std=c++20 -mmacosx-version-min=14.0 \
  -I "$ici/install/include" revision.cpp -L "$lib" -lSDL3 "-Wl,-rpath,$lib" -o revision
[ "$(./revision)" = "SDL-$revision" ]
otool -L ./deux-passes | grep -F '@rpath/libSDL3.0.dylib' >/dev/null
for essai in 1 2 3; do
  DYLD_PRINT_LIBRARIES=1 ./deux-passes > "rendu-$essai.log" 2> "dyld-$essai.log"
  grep -F "$lib/libSDL3" "dyld-$essai.log" >/dev/null
  cmp "$sondes/sdl-rendu.log" "rendu-$essai.log"
done
printf 'SDL %s arm64. Trois processus Metal, bibliothèque locale et pixels témoins vérifiés.\n' "$(./revision)"
cat rendu-1.log
