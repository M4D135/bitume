#!/usr/bin/env bash
# Met https://bitume.estrasse.fr à jour avec la page construite du commit courant. Commande manuelle, sans timer :
#     ./deposer.sh
# Sur amiga, compte ddd, sans root, même schéma que pdr.estrasse.fr :
#     ~/apps/bitume/releases/<commit>/index.html   page d'un commit ; les 3 plus récentes sont gardées
#     ~/apps/bitume/current                        lien vers la version en ligne, basculé d'un coup
#     ~/apps/caddy-shared/vhosts.d/bitume.estrasse.fr.Caddyfile   copie de deploiement/, appliquée par caddy-shared-apply
#     ~/apps/bitume/salon/salon.mjs                 salon du jeu en ligne (serveur/salon.mjs), service utilisateur
#     ~/.config/systemd/user/bitume-salon.service   bitume-salon sur 127.0.0.1:8790, servi par Caddy sous /salon ;
#                                                   reposé et relancé seulement s'il a changé (les parties en cours tombent)
# Le VPS n'a pas accès au dépôt privé : la page part du Mac.
# Refuse de déposer une page qui ne serait pas celle du commit : sources, page, vhost et ce script doivent être
# commités, avant et après la construction.
# Retour arrière : ssh amiga 'ln -sfn releases/<commit> ~/apps/bitume/current.new && mv -T ~/apps/bitume/current.new ~/apps/bitume/current'
# Couper le jeu en ligne : ssh amiga 'systemctl --user disable --now bitume-salon' (la page affiche alors « Le salon ne
# répond pas »).
set -euo pipefail

depot=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
hote=${BITUME_HOTE:-amiga}
racine=/home/ddd/apps/bitume
vhost_local="$depot/deploiement/bitume.estrasse.fr.Caddyfile"
vhost_distant=/home/ddd/apps/caddy-shared/vhosts.d/bitume.estrasse.fr.Caddyfile
url=https://bitume.estrasse.fr/

propre() { [ -z "$(git -C "$depot" status --porcelain -- src serveur construire.py dist SIZE.json VERSION.json deploiement deposer.sh)" ]; }
propre || { echo "src, serveur, construire.py, dist, SIZE.json, VERSION.json, deploiement ou deposer.sh ont des modifications non commitées : committer d'abord." >&2; exit 1; }
commit=$(git -C "$depot" rev-parse HEAD)

python3 "$depot/construire.py"
propre || { echo "La page construite diffère de celle du commit : committer dist/bitume.html et SIZE.json, puis relancer." >&2; exit 1; }
page="$depot/dist/bitume.html"
empreinte=$(shasum -a 256 "$page" | cut -d' ' -f1)

ssh -o BatchMode=yes "$hote" "install -d -m 755 $racine/releases && rm -rf -- $racine/releases/.tmp-$commit && install -d -m 755 $racine/releases/.tmp-$commit"
scp -q -o BatchMode=yes "$page" "$hote:$racine/releases/.tmp-$commit/index.html"
ssh -o BatchMode=yes "$hote" bash -s -- "$racine" "$commit" "$empreinte" <<'DISTANT'
set -euo pipefail
racine=$1 commit=$2 empreinte=$3
tmp=$racine/releases/.tmp-$commit
echo "$empreinte  $tmp/index.html" | sha256sum -c --quiet -
chmod -R u=rwX,go=rX "$tmp"
rm -rf -- "${racine:?}/releases/$commit"
mv "$tmp" "$racine/releases/$commit"
ln -sfn "releases/$commit" "$racine/current.new"
mv -T "$racine/current.new" "$racine/current"
echo "version en ligne : $commit"
cd "$racine/releases"
ls -1t | tail -n +4 | while read -r ancienne; do
  [ "$ancienne" = "$commit" ] || { rm -rf -- "$ancienne" && echo "version retirée : $ancienne"; }
done
DISTANT

# Salon du jeu en ligne : posé et relancé s'il a changé (fichier ou unité)
salon_local="$depot/serveur/salon.mjs"
unite_local="$depot/deploiement/bitume-salon.service"
unite_distante=.config/systemd/user/bitume-salon.service
if ! ssh -o BatchMode=yes "$hote" "cmp -s - $racine/salon/salon.mjs" < "$salon_local" ||
   ! ssh -o BatchMode=yes "$hote" "cmp -s - $unite_distante" < "$unite_local" ||
   ! ssh -o BatchMode=yes "$hote" "systemctl --user is-active --quiet bitume-salon"; then
  ssh -o BatchMode=yes "$hote" "install -d -m 755 $racine/salon .config/systemd/user"
  scp -q -o BatchMode=yes "$salon_local" "$hote:$racine/salon/salon.mjs.new"
  scp -q -o BatchMode=yes "$unite_local" "$hote:$unite_distante.new"
  ssh -o BatchMode=yes "$hote" "chmod 644 $racine/salon/salon.mjs.new $unite_distante.new && mv $racine/salon/salon.mjs.new $racine/salon/salon.mjs && mv $unite_distante.new $unite_distante && systemctl --user daemon-reload && systemctl --user enable --quiet bitume-salon && systemctl --user restart bitume-salon"
  echo "salon posé et relancé"
fi

if ! ssh -o BatchMode=yes "$hote" "cmp -s - $vhost_distant" < "$vhost_local"; then
  scp -q -o BatchMode=yes "$vhost_local" "$hote:$racine/bitume.estrasse.fr.Caddyfile"
  ssh -o BatchMode=yes "$hote" "install -m 644 $racine/bitume.estrasse.fr.Caddyfile $vhost_distant.tmp && mv $vhost_distant.tmp $vhost_distant && systemctl --user start caddy-shared-apply"
  echo "vhost posé et appliqué"
fi

servie=
for essai in $(seq 1 30); do
  servie=$(curl -fsS -m 15 "$url" 2>/dev/null | shasum -a 256 | cut -d' ' -f1 || true)
  [ "$servie" = "$empreinte" ] && break
  sleep 2
done
[ "$servie" = "$empreinte" ] || { echo "La page servie par $url n'est pas celle déposée (sha256 attendu ${empreinte:0:16})." >&2; exit 1; }
echo "EN LIGNE  $url  commit ${commit:0:7}, sha256 ${empreinte:0:16}"
for essai in $(seq 1 30); do
  sante=$(curl -fsS -m 10 "${url}salon/sante" 2>/dev/null || true)
  case "$sante" in "salon BITUME"*) echo "SALON     ${url}salon  ${sante}"; exit 0 ;; esac
  sleep 2
done
echo "Le salon ne répond pas sur ${url}salon/sante (journal : ssh $hote journalctl --user -u bitume-salon -n 30)." >&2
exit 1
