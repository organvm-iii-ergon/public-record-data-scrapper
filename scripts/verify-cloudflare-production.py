#!/usr/bin/env python3
"""Verify production config, schema, exact live revision and authentication boundary."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "live_verifier", Path(__file__).with_name("verify-cloudflare-live.py")
)
V = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(V)
GENERATED = ROOT / "cloudflare/.generated"


def verify(requester=V.fetch, configuration_only=False, schema_only=False):
    config = V.read_json(GENERATED / "production.wrangler.json")
    resolution = V.read_json(GENERATED / "production-resolution.json")
    revision = os.environ.get("GITHUB_SHA", "")
    if not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise V.VerificationError("invalid_expected_revision")
    if resolution.get("status") != "ready" or resolution.get("revision") != revision:
        raise V.VerificationError("production_resolution_not_ready")
    if config.get("name") != "ucc-mca-edge-production" or config.get("account_id") != resolution.get("account_id"):
        raise V.VerificationError("wrong_production_worker")
    if config.get("vars", {}).get("ENVIRONMENT") != "production" or config["vars"].get("DEPLOYMENT_SHA") != revision:
        raise V.VerificationError("production_revision_mismatch")
    if configuration_only:
        return {"revision": revision, "configuration_verified": True}
    V.validate_schema(V.read_json(GENERATED / "production-schema.json"))
    if schema_only:
        return {"revision": revision, "configuration_verified": True, "schema_verified": True}
    origin = resolution.get("worker_url", "")
    if not re.fullmatch(r"https://ucc-mca-edge-production\.[a-z0-9-]+\.workers\.dev", origin):
        raise V.VerificationError("invalid_production_origin")
    health = requester(origin, "/health?revision=" + revision)
    if health[0] != 200 or health[3] != "application/json" or health[1] != {
        "ok": True, "env": "production", "revision": revision
    }:
        raise V.VerificationError("live_revision_or_health_mismatch")
    domain = config["vars"]["ACCESS_TEAM_DOMAIN"]
    unauthenticated = requester(origin, "/api/prospects")
    forged = requester(origin, "/api/prospects", forged=True)
    if not V.denied(unauthenticated, domain) or not V.denied(forged, domain):
        raise V.VerificationError("authentication_boundary_failed")
    return {
        "revision": revision,
        "worker_url": origin,
        "schema_verified": True,
        "deployment_verified": True,
        "checks": {"health": 200, "unauthenticated": unauthenticated[0], "forged_token": forged[0]},
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--configuration-only", action="store_true")
    modes.add_argument("--schema-only", action="store_true")
    args = parser.parse_args()
    report = {"schema_version": 1, "deployment_verified": False}
    try:
        report.update(verify(configuration_only=args.configuration_only, schema_only=args.schema_only))
    except V.VerificationError as exc:
        report["blocker"] = str(exc)
    except Exception:
        report["blocker"] = "verification_failed"
    if not args.configuration_only and not args.schema_only:
        V.GENERATED.mkdir(mode=0o700, exist_ok=True)
        (GENERATED / "production-deployment.json").write_text(
            json.dumps(report, indent=2, sort_keys=True) + "\n"
        )
    print(json.dumps(report, sort_keys=True))
    expected = "configuration_verified" if args.configuration_only else "schema_verified" if args.schema_only else "deployment_verified"
    return 0 if report.get(expected) is True else 1


if __name__ == "__main__":
    raise SystemExit(main())
