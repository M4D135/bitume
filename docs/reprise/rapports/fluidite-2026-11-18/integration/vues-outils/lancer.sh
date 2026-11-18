#!/bin/bash
# lancer.sh <page> <conf-json> <sortie.json> [options de tools/page-essai.mjs...]
# Pose CONF en tête de corps.js (mesure des vues : compteurs du moteur, cadence, captures) et l'évalue dans la page.
# Exemples (depuis ce dossier, BITUME = clone du dépôt principal) :
#   ./lancer.sh page.html '{"reference":{}}' compteurs.json --taille 1440,900 --dpr 1
#   ./lancer.sh page.html '{"capture":true,"reference":{"vue":"poursuite"}}' poursuite.json --taille 1440,900 --dpr 1 --capture poursuite.png
#   références des quatre captures : {} ; {"vue":"poursuite"} ; {"meteo":"pluie","mouille":0.75} ; {"mode":"duo"}
ici=$(cd "$(dirname "$0")" && pwd)
BITUME=${BITUME:-/Users/david/Projects/bitume}
page="$1"; conf="$2"; sortie="$3"; shift 3
f=$(mktemp "${TMPDIR:-/tmp}/essai-XXXXXX"); mv "$f" "$f.js"; f="$f.js"
{ printf 'var CONF = %s;\n' "$conf"; cat "$ici/corps.js"; } > "$f"
node "$BITUME/tools/page-essai.mjs" "$page" "$f" "$@" > "$sortie"
rc=$?
rm -f "$f"
exit $rc
