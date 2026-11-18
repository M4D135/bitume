#!/bin/zsh
# Étude E3 du lot 17 : les 46 critères obligatoires de la phase 2 (verifications/conduite-criteres.test.mjs) sur une
# COPIE de l'arbre dont le bloc PARAMS de src/conduite.js est réécrit, une variante à la fois. L'arbre de travail
# n'est jamais touché : la copie se prépare à part, par exemple
#   rsync -a --exclude .git --exclude dist --exclude docs <arbre>/ <copie>/ && mkdir -p <copie>/docs
# Usage : etude-criteres.sh <copie> 'cle=valeur cle=valeur…' ['cle=valeur…' …]
# Après chaque variante, conduite.js est remis tel quel dans la copie.
copie=$1; shift
[[ -f $copie/src/conduite.js && -f $copie/verifications/conduite-criteres.test.mjs ]] || { print -u2 "copie invalide : $copie"; exit 1; }
cd $copie || exit 1
orig=$copie/.conduite.js.orig
cp src/conduite.js $orig
for variante in "$@"; do
  print "=== $variante"
  node -e '
    const fs = require("fs"), f = "src/conduite.js"; let t = fs.readFileSync(f, "utf8");
    const i = t.indexOf("const PARAMS = Object.freeze({"), j = t.indexOf("});", i); let b = t.slice(i, j);
    for (const kv of process.argv[1].split(/\s+/).filter(Boolean)) {
      const [k, v] = kv.split("="), re = new RegExp("(\\b" + k + ":\\s*)-?[\\d.]+(?:e-?\\d+)?");
      if (!re.test(b) || !Number.isFinite(+v)) { console.error("réglage inconnu ou invalide " + kv); process.exit(2); }
      b = b.replace(re, "$1" + v);
    }
    fs.writeFileSync(f, t.slice(0, i) + b + t.slice(j));' "$variante" || { cp $orig src/conduite.js; exit 2; }
  node verifications/conduite-criteres.test.mjs 2>&1 | grep -E "^(KO|mesure)|critères obligatoires|S3 plein gaz|S3 lever|S11|S9 plein|S6 tenue|S7 R80"
  cp $orig src/conduite.js
done
rm -f $orig
