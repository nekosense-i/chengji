#!/usr/bin/env bash
# Run as admin from the existing chengji Git checkout. --check is read-only.
# --apply creates an online SQLite backup, then publishes only two JS files + HTML.
set -euo pipefail
trap 'printf "Deployment stopped at line %s: %s\n" "$LINENO" "$BASH_COMMAND" >&2' ERR
mode=${1:---check}
live=/var/www/nekosensei/chengji
database=/var/lib/nekosensei-sync/sync.sqlite
if [[ "$mode" == --rollback ]]; then
  backup=${2:?Specify the backup directory printed during deployment}
  [[ "$backup" == /var/backups/nekosensei-sync/gakuten-frontend-* && -f "$backup/frontend.tar.gz" ]]
  stage=$(mktemp -d)
  trap 'rm -rf "$stage"' EXIT
  sudo tar -xzf "$backup/frontend.tar.gz" -C "$stage" Gakuten-2.0.html
  sudo install -m 644 "$stage/Gakuten-2.0.html" "$live/.Gakuten-2.0.rollback.html"
  sudo mv -f "$live/.Gakuten-2.0.rollback.html" "$live/Gakuten-2.0.html"
  echo 'Frontend rolled back. Production database was not restored or modified.'
  exit
fi
[[ "$mode" == --check || "$mode" == --apply ]]
commit=${2:?Specify the exact tested Git commit}
[[ "$commit" =~ ^[0-9a-f]{40}$ ]]
[[ -f "$live/Gakuten-2.0.html" ]]
sudo test -f "$database"
systemctl is-active --quiet nekosync-prod.service
printf '%s\n' '91fb9b245bfc997cb5d93f24dd1e6675b440b6d5e150ae0601a06093863e37af  /opt/nekosensei-sync-prod/src/gakuten-service.js' | sha256sum --check --status
printf '%s\n' '832ff4e802a7796f75d8ae61a31cb05e04a8bf1c3af6245e7d6c27abe1b735fc  /opt/nekosensei-sync-prod/src/gakuten-merge.js' | sha256sum --check --status
git cat-file -e "$commit^{commit}"
remote=$(git remote get-url origin)
[[ "$remote" == https://github.com/nekosense-i/chengji* || "$remote" == git@github.com:nekosense-i/chengji* ]]
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
git archive "$commit" Gakuten-2.0.html assets src/release/Gakuten-2.0.base.html | tar -x -C "$stage"
python3 - "$stage" "$live" <<'PY'
from pathlib import Path
import sys,re,hashlib
stage,live=map(Path,sys.argv[1:])
base=(stage/'src/release/Gakuten-2.0.base.html').read_bytes()
assert hashlib.sha256(base).hexdigest()=='9eb575bbc2754f5145b1bfab8426daea1ea64548aa6809bea6fcb6ffcbe1b0b8', 'Unknown release baseline'
assert (live/'Gakuten-2.0.html').read_bytes()==base, 'Production HTML changed; stop and inspect before deploying'
html=(stage/'Gakuten-2.0.html').read_text()
old=base.decode()
changed=[]
for kind in ['core','features']:
 pattern=r'assets/app/'+kind+r'\.[a-f0-9]+\.js'
 prior=re.search(pattern,old)[0]; current=re.search(pattern,html)[0]
 assert (live/prior).read_bytes()==(stage/prior).read_bytes(), 'Production '+kind+' changed'
 assert hashlib.sha256((stage/current).read_bytes()).hexdigest()[:16] in current, 'Invalid generated asset hash'
 old=old.replace(prior,current)
 changed.append(current)
assert old==html, 'Unexpected HTML modification'
for asset in re.findall(r'(?:src|href)="(assets/[^"?#]+)',html):
 assert (stage/asset).is_file(), 'Missing release asset: '+asset
 if asset not in changed:
  assert (live/asset).is_file(), 'Missing existing production asset: '+asset
(stage/'changed-assets.txt').write_text('\n'.join(changed)+'\n')
print('Verified production baseline, release hashes, and existing runtime assets.')
PY
curl -fsS --max-time 10 http://127.0.0.1:8789/health | python3 -c 'import json,sys; x=json.load(sys.stdin); assert x["status"]=="ok" and x["database"]=="ok"; print("Database health: ok")'
echo "Tested frontend commit: $commit"
if [[ "$mode" == --check ]]; then
  echo 'Check passed. No production files or database were changed.'
  exit
fi
sudo -n true || sudo -v
backup=/var/backups/nekosensei-sync/gakuten-frontend-$(TZ=Asia/Shanghai date +%Y%m%d_%H%M%S)
sudo install -d -m 700 "$backup"
sudo python3 - "$database" "$backup" "$commit" <<'PY'
import sqlite3,sys,json,hashlib,os
from pathlib import Path
source,folder,commit=sys.argv[1:]; folder=Path(folder)
dest=folder/'sync.sqlite'
with sqlite3.connect('file:'+source+'?mode=ro',uri=True) as src:
 with sqlite3.connect(dest) as out:
  src.backup(out)
  assert out.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
  row=out.execute('SELECT r.revision,s.snapshot_json FROM gakuten_rooms r JOIN gakuten_snapshots s ON s.group_id=r.group_id AND s.revision=r.revision WHERE r.group_id=?',('gakuten_prod_stable_v1',)).fetchone()
  assert row, 'Production Gakuten snapshot missing'
  snapshot=json.loads(row[1])
  metadata={'frontendCommit':commit,'revision':row[0],'counts':{k:len(snapshot['data'][k]) for k in ['students','exams','scores','examTemplates']},'integrity':'ok','databaseSha256':hashlib.sha256(dest.read_bytes()).hexdigest()}
(folder/'metadata.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
os.chmod(dest,0o600); os.chmod(folder/'metadata.json',0o600)
print(json.dumps(metadata,ensure_ascii=False))
PY
sudo tar -czf "$backup/frontend.tar.gz" -C "$live" Gakuten-2.0.html assets
sudo chmod 600 "$backup/frontend.tar.gz"
sudo install -m 700 "$0" "$backup/deploy.sh"
printf '%s\n' "$commit" | sudo tee "$backup/frontend-commit.txt" >/dev/null
while IFS= read -r asset; do
  sudo install -m 644 "$stage/$asset" "$live/$asset"
done < "$stage/changed-assets.txt"
sudo install -m 644 "$stage/Gakuten-2.0.html" "$live/.Gakuten-2.0.next.html"
sudo mv -f "$live/.Gakuten-2.0.next.html" "$live/Gakuten-2.0.html"
if ! curl -fsS --max-time 15 https://chengji.nekosensei.cn/Gakuten-2.0.html | cmp -s - "$stage/Gakuten-2.0.html"; then
  echo 'Public HTML verification failed; restoring the previous frontend.' >&2
  bash "$0" --rollback "$backup"
  exit 1
fi
echo "Published frontend $commit. Backup: $backup"
echo "Code-only rollback: sudo bash $backup/deploy.sh --rollback $backup"
echo 'No backend restart, schema change, or production grade write was performed.'
