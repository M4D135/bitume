#!/usr/bin/env python3
"""Receive one CI archive, preserving its bytes and comparing the exact candidate tree."""
import argparse
import hashlib
import json
import re
import subprocess
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

p = argparse.ArgumentParser()
p.add_argument('--zip', required=True)
p.add_argument('--kind', required=True, choices=['push', 'pull_request'])
p.add_argument('--run', required=True, type=int)
p.add_argument('--artifact', required=True, type=int)
p.add_argument('--digest', required=True)
p.add_argument('--repo', required=True)
a = p.parse_args()
base = Path(__file__).resolve().parent
expected = json.loads((base / 'expected.json').read_text())
archive = Path(a.zip)
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
if digest != a.digest.removeprefix('sha256:'):
    raise SystemExit('GitHub ZIP digest mismatch')
out = base / a.kind
files = out / 'files'
files.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(archive) as z:
    for item in z.infolist():
        path = PurePosixPath(item.filename)
        if path.is_absolute() or '..' in path.parts:
            raise SystemExit('Unsafe ZIP member')
        if item.is_dir():
            continue
        target = files.joinpath(*path.parts)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(z.read(item))
q = files / 'qualification'
comparison = out / 'sources-comparison.json'
result = subprocess.run([
    'python3', str(base / 'verify_sources.py'), '--repo', a.repo,
    '--archive', str(q / 'bitume-sources.tar.gz'),
    '--ref', expected['candidate_commit'], '--output', str(comparison)
], capture_output=True, text=True)
(out / 'comparison.log').write_text(result.stdout + result.stderr)
if result.returncode:
    raise SystemExit('Source archive does not match candidate; see comparison.log')
source = json.loads(comparison.read_text())
source['archive'] = 'files/qualification/bitume-sources.tar.gz'
comparison.write_text(json.dumps(source, ensure_ascii=False, indent=2) + '\n')
def read(name):
    path = q / name
    return path.read_text() if path.exists() else None
summary = read('RESUME.txt') or ''
python = read('visiere-png-python.log')
decor = read('decor.log') or ''
html = files / 'dist/bitume.html'
html_sha = hashlib.sha256(html.read_bytes()).hexdigest()
sha_tokens = (read('SHA256SUMS.txt') or '').split()
recorded_sha = sha_tokens[0] if sha_tokens else None
passed = re.search(r'Suites reussies\s*:\s*(\d+)', summary)
failed = re.search(r'Suites en echec\s*:\s*(\d+)', summary)
py_count = re.search(r'Ran\s+(\d+)\s+tests?', python or '')
receipt = {
    'kind': a.kind, 'run_id': a.run, 'artifact_id': a.artifact,
    'url': f'https://github.com/M4D135/bitume/actions/runs/{a.run}',
    'received_utc': datetime.now(timezone.utc).isoformat(),
    'candidate_commit': expected['candidate_commit'],
    'local_provenance_commit': expected['local_provenance_commit'],
    'checkout_commit_received': (read('COMMIT.txt') or '').strip(),
    'archive_sha256': digest, 'github_digest_verified': True,
    'candidate_tree': source['tree'],
    'source_files': source['expected_files'],
    'received_source_files': source['received_files'],
    'identical_content_and_modes': source['identical_content_and_modes'],
    'html_sha256': html_sha,
    'html_matches_candidate': html_sha == expected['html_sha256'],
    'html_log_matches_received_file': recorded_sha == html_sha,
    'node_summary_complete': bool(passed and failed),
    'node_suites_passed': int(passed[1]) if passed else None,
    'node_suites_failed': int(failed[1]) if failed else None,
    'python_tests': int(py_count[1]) if py_count else None,
    'python_result': 'OK' if python and re.search(r'^OK$', python, re.M) else None,
    'decor_failures': [x for x in decor.splitlines() if 'FAIL' in x],
    'decor_individual_durations_recorded': bool(re.search(r'construit en moins de 150 ms:\s*\d', decor)),
    'environment': read('ENVIRONNEMENT.txt'),
    'sources_comparison': str(comparison.relative_to(base)),
}
(out / 'RECEPTION.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(receipt, ensure_ascii=False, indent=2))
if not receipt['html_matches_candidate'] or not receipt['html_log_matches_received_file']:
    raise SystemExit('HTML mismatch')
