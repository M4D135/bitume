#!/usr/bin/env python3
"""Verify the received CI source archive against an observed Git tree."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tarfile

p = argparse.ArgumentParser()
p.add_argument("--repo", required=True)
p.add_argument("--archive", required=True)
p.add_argument("--ref", required=True)
p.add_argument("--output", required=True)
args = p.parse_args()
repo = Path(args.repo)
archive = Path(args.archive)
raw = subprocess.check_output(["git", "-C", str(repo), "ls-tree", "-rz", args.ref])
expected = {}
for entry in raw.split(b"\0"):
    if not entry:
        continue
    meta, name = entry.split(b"\t", 1)
    mode, kind, oid = meta.decode().split()
    expected[name.decode()] = {"mode": mode, "kind": kind, "oid": oid}
seen = set()
errors = []
with tarfile.open(archive, "r:gz") as tar:
    for member in tar:
        if member.isdir():
            continue
        name = member.name.removeprefix("./")
        if name in seen:
            errors.append({"file": name, "error": "duplicate"})
        seen.add(name)
        target = expected.get(name)
        if target is None:
            errors.append({"file": name, "error": "unexpected"})
            continue
        if member.issym():
            content = member.linkname.encode()
            mode = "120000"
        elif member.isfile():
            content = tar.extractfile(member).read()
            mode = "100755" if member.mode & 0o111 else "100644"
        else:
            errors.append({"file": name, "error": "unsupported archive member"})
            continue
        oid = hashlib.sha1(b"blob " + str(len(content)).encode() + b"\0" + content).hexdigest()
        if target != {"mode": mode, "kind": "blob", "oid": oid}:
            errors.append({"file": name, "error": "content or mode differs", "actual_mode": mode, "actual_oid": oid, "expected": target})
errors.extend({"file": name, "error": "missing"} for name in sorted(set(expected) - seen))
result = {
    "archive": str(archive),
    "archive_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
    "reference": args.ref,
    "tree": subprocess.check_output(["git", "-C", str(repo), "rev-parse", args.ref + "^{tree}"], text=True).strip(),
    "expected_files": len(expected),
    "received_files": len(seen),
    "identical_content_and_modes": not errors,
    "errors": errors,
}
Path(args.output).write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({k: v for k, v in result.items() if k != "errors"}, ensure_ascii=False))
if errors:
    print(json.dumps(errors[:20], ensure_ascii=False))
    raise SystemExit(1)
