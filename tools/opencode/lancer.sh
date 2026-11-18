#!/usr/bin/env bash
# Confie une tâche bornée à opencode et à l'un de ses modèles gratuits, dans un arbre de travail du jeu.
#     tools/opencode/lancer.sh <dossier de travail> <consigne.md> [journal]
#     BITUME_OPENCODE_MODELE=opencode/<modèle> pour choisir le modèle (liste : tools/opencode/lancer.sh --modeles)
# Le réglage est isolé de celui de la machine, exprès :
#   - ni le serveur MCP de la mémoire de David ni les consignes globales (AGENTS.md, CLAUDE.md de la machine) ne sont
#     chargés : un modèle dans le nuage ne doit voir que le code du jeu ;
#   - opencode.json, à côté, n'autorise que node, la lecture de git et de fichiers et la construction de la page ; le
#     réseau et les fichiers hors du dossier sont refusés ;
#   - le modèle ne committe pas : on relit son diff, on relance les suites, on committe soi-même en disant que le
#     premier jet vient de lui ;
#   - chaque lancement a son propre dossier de données : deux lancements ne se bloquent pas, rien n'entre dans
#     l'historique d'opencode de la machine.
# Bon pour une tâche que des tests savent vérifier, sur des fichiers nommés. Pas pour ce qui se juge sur une image.
set -euo pipefail
ici=$(cd "$(dirname "$0")" && pwd)
reglage=$(mktemp -d "${TMPDIR:-/tmp}/bitume-opencode.XXXXXX")
mkdir -p "$reglage/opencode" "$reglage/donnees"
cp "$ici/opencode.json" "$ici/AGENTS.md" "$reglage/opencode/"
export XDG_CONFIG_HOME="$reglage" XDG_DATA_HOME="$reglage/donnees" OPENCODE_DISABLE_CLAUDE_CODE=1
if [ "${1:-}" = "--modeles" ]; then opencode models 2>/dev/null | grep -i "free" || true; exit 0; fi
if [ "${1:-}" = "--controle" ]; then opencode debug config --pure 2>/dev/null | grep -n '"mcp"\|instructions\|kbza' || echo "aucun MCP, aucune consigne globale"; exit 0; fi
dossier=${1:?dossier de travail}
consigne=${2:?fichier de consigne}
journal=${3:-/dev/stdout}
modele=${BITUME_OPENCODE_MODELE:-opencode/deepseek-v4.1-flash-free}
opencode run --pure -m "$modele" --dir "$dossier" --title "BITUME $(basename "$consigne" .md)" "$(cat "$consigne")" > "$journal" 2>&1
