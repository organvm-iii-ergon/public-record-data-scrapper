#!/usr/bin/env python3
"""Run preflight and reject stale, incomplete or dirty-tree submission receipts."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
from datetime import datetime, timezone

CHECKS = {
    "prettier": ["npx", "--no-install", "prettier", "--check", "."],
    "eslint": ["npm", "run", "lint"],
    "typecheck": ["npm", "run", "typecheck"],
    "server-typecheck": ["npm", "run", "typecheck:server"],
    "migration-versions": ["node", "scripts/check-migration-versions.mjs"],
    "server-tests": ["npm", "run", "test:server:strict", "--", "--run"],
    "database-tests": ["npm", "run", "test:database"],
    "build:render": ["npm", "run", "build:render"],
}
RECEIPT = Path(".quality/agent-receipt.json")


def output(*args):
    return subprocess.check_output(args, text=True).strip()


def fingerprint():
    # All tracked source/configuration is represented by the Git tree; include
    # local installed resolution and tool versions, which Git does not capture.
    if output("git", "status", "--porcelain", "--untracked-files=all"):
        raise ValueError("preflight requires a clean tracked and untracked tree")
    lock = Path("node_modules/.package-lock.json")
    if not lock.is_file():
        raise ValueError("missing installed dependency fingerprint; run npm ci")
    node, npm = output("node", "--version"), output("npm", "--version")
    if node != "v24.19.0" or npm != "11.9.0":
        raise ValueError("preflight requires Node 24.19.0 and npm 11.9.0")
    return {
        "commit": output("git", "rev-parse", "HEAD"),
        "tree": output("git", "rev-parse", "HEAD^{tree}"),
        "branch": output("git", "branch", "--show-current"),
        "installed_lock_sha256": hashlib.sha256(lock.read_bytes()).hexdigest(),
        "node": node, "npm": npm,
        "environment_configuration": {
            name: hashlib.sha256(os.environ[name].encode()).hexdigest() if name in os.environ else None
            for name in ("DATABASE_URL", "TEST_DATABASE_URL", "JWT_SECRET", "NODE_ENV", "CI", "ENFORCE_COVERAGE")
        },
        "local_configuration": {
            name: hashlib.sha256(Path(name).read_bytes()).hexdigest() if Path(name).is_file() else None
            for name in (".env", ".env.local", ".env.test", ".env.production")
        },
    }


def validate(receipt, current):
    if receipt.get("schema_version") != 2 or receipt.get("status") != "GREEN":
        raise ValueError("invalid or unsuccessful preflight receipt")
    if receipt.get("fingerprint") != current:
        raise ValueError("stale preflight: revision, branch, configuration or dependencies changed")
    expected = [{"name": name, "command": command, "exit_code": 0} for name, command in CHECKS.items()]
    if receipt.get("checks") != expected or not receipt.get("completed_at"):
        raise ValueError("incomplete preflight receipt")


def main():
    mode = sys.argv[1] if len(sys.argv) == 2 else ""
    if mode not in {"run", "verify"}:
        raise ValueError("usage: agent-receipt.py run|verify")
    if RECEIPT.is_symlink() or RECEIPT.parent.is_symlink():
        raise ValueError("unsafe receipt path")
    if mode == "verify":
        validate(json.loads(RECEIPT.read_text()), fingerprint())
        print("Preflight receipt matches current clean revision")
        return
    RECEIPT.unlink(missing_ok=True)
    before = fingerprint()
    RECEIPT.parent.mkdir(exist_ok=True)
    checks = []
    for name, command in CHECKS.items():
        print(f"Preflight: {name}", flush=True)
        subprocess.run(command, check=True, timeout=300)
        checks.append({"name": name, "command": command, "exit_code": 0})
    if fingerprint() != before:
        raise ValueError("tree or dependencies changed during preflight")
    receipt = {"schema_version": 2, "status": "GREEN", "fingerprint": before,
               "checks": checks, "completed_at": datetime.now(timezone.utc).isoformat()}
    RECEIPT.write_text(json.dumps(receipt, indent=2) + "\n")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.SubprocessError) as exc:
        print(f"Preflight rejected: {exc}", file=sys.stderr)
        sys.exit(1)
