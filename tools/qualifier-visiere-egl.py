#!/usr/bin/env python3
"""Compatibilité de la commande de qualification historique, désormais exécutée sur WebGPU."""
import argparse
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--sortie', type=Path, required=True)
parser.add_argument('--racine', type=Path, default=Path(__file__).resolve().parents[1])
args = parser.parse_args()
root = args.racine.resolve()
raise SystemExit(subprocess.call(['node', str(root / 'tools/qualifier-visiere-webgpu.mjs'), '--page',
    str(root / 'dist/bitume.html'), '--sortie', str(args.sortie), '--trajectoires']))
