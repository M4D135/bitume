#!/usr/bin/env python3
"""Reproduit dans un checkout jetable le HTML exact observé par 01 chez 00.

Le checkout fourni doit être propre, distinct du dépôt des outils et au commit
de base épinglé. Aucune branche n'est déplacée, aucun fichier de ce dépôt modifié.
Le patch conserve le candidat existant : il ne fabrique pas un autre runtime de test.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys

RACINE = Path(__file__).resolve().parents[2]
RACCORD = RACINE / "docs/reprise/PARALLELE-2026-11-20/raccordements"


def sha(contenu):
    return hashlib.sha256(contenu).hexdigest()


def git(dossier, *arguments):
    return subprocess.check_output(["git", "-C", str(dossier), *arguments], text=True).strip()


def preparer(checkout, sortie):
    manifeste = json.loads((RACCORD / "01-assemblage-test.json").read_text())
    patch = RACCORD / "01-assemblage-test.patch"
    if sha(patch.read_bytes()) != manifeste["patch_sha256"]:
        raise ValueError("Empreinte du raccord différente du candidat")
    checkout = checkout.resolve()
    if checkout == RACINE or not (checkout / ".git").exists():
        raise ValueError("Fournir un checkout temporaire distinct du dépôt des outils")
    if git(checkout, "rev-parse", "HEAD") != manifeste["base"]:
        raise ValueError("Le checkout n'est pas au commit de base épinglé")
    if git(checkout, "status", "--porcelain", "--untracked-files=normal"):
        raise ValueError("Le checkout temporaire contient déjà des changements")
    subprocess.run(["git", "-C", str(checkout), "apply", "--check", str(patch)], check=True)
    subprocess.run(["git", "-C", str(checkout), "apply", str(patch)], check=True)
    fichiers = sorted(p for p in (checkout / "src").rglob("*") if p.is_file())
    h = hashlib.sha256()
    for chemin in fichiers + [checkout / "construire.py"]:
        h.update(str(chemin.relative_to(checkout)).encode() + b"\0" + chemin.read_bytes() + b"\0")
    if h.hexdigest() != manifeste["empreinte_sources"]:
        raise ValueError("Les sources reconstituées diffèrent du candidat de 00")
    if sha((checkout / "FERRO.lock.json").read_bytes()) != manifeste["ferro_lock_sha256"]:
        raise ValueError("Le verrou FERRO a changé")
    reconstructions = []
    for numero in (1, 2):
        subprocess.run([sys.executable, str(checkout / "construire.py")], cwd=checkout, check=True)
        html = (checkout / "dist/bitume.html").read_bytes()
        version = json.loads((checkout / "VERSION.json").read_text())
        if sha(html) != manifeste["html_sha256"] or len(html) != manifeste["html_octets"]:
            raise ValueError(f"HTML différent du candidat exact, reconstruction {numero}")
        if version["version"] != manifeste["version"]:
            raise ValueError("Version différente du candidat exact")
        reconstructions.append({"numero": numero, "sha256": sha(html), "octets": len(html)})
    resultat = {"schema": 1, "statut": "candidat_exact_reproduit", "candidat": manifeste,
                "reconstructions": reconstructions, "outils_commit": git(RACINE, "rev-parse", "HEAD"),
                "reserve": "Reconstruction de qualification isolée ; ne vaut ni publication de 00 ni preuve navigateur."}
    sortie.parent.mkdir(parents=True, exist_ok=True)
    sortie.write_text(json.dumps(resultat, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"statut": resultat["statut"], "version": manifeste["version"],
                      "html_sha256": manifeste["html_sha256"]}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkout", type=Path, required=True)
    parser.add_argument("--sortie", type=Path, required=True)
    args = parser.parse_args()
    preparer(args.checkout, args.sortie)
