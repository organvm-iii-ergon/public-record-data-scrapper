#!/usr/bin/env python3
"""Verify generated staging bindings, migrated schema and exact live revision."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
GENERATED = ROOT / "cloudflare" / ".generated"
MAX_BYTES = 65_536
SCHEMA = {"organizations", "prospects", "jobs", "prospects_fts"}


class VerificationError(Exception):
    """Only fixed, non-sensitive diagnostic codes are exposed."""


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def read_json(path):
    try:
        if path.is_symlink() or path.parent.is_symlink():
            raise VerificationError("unsafe_receipt_path")
        raw = path.read_bytes()
        if len(raw) > MAX_BYTES:
            raise VerificationError("receipt_too_large")
        return json.loads(raw)
    except VerificationError:
        raise
    except Exception:
        raise VerificationError("receipt_unreadable") from None


def validate_configuration(config, provision, expected_sha):
    if not isinstance(expected_sha, str) or not re.fullmatch(r"[0-9a-f]{40}", expected_sha):
        raise VerificationError("invalid_expected_revision")
    if not isinstance(config, dict) or not isinstance(provision, dict):
        raise VerificationError("invalid_receipt_shape")
    if provision.get("status") != "ready" or provision.get("mode") != "apply":
        raise VerificationError("provisioning_not_ready")
    if config.get("name") != "ucc-mca-edge-staging" or "env" in config:
        raise VerificationError("wrong_staging_worker")
    if config.get("vars", {}).get("ENVIRONMENT") != "staging":
        raise VerificationError("wrong_staging_environment")
    if config.get("vars", {}).get("DEPLOYMENT_SHA") != expected_sha:
        raise VerificationError("generated_revision_mismatch")
    spec = importlib.util.spec_from_file_location(
        "staging_guard", ROOT / "scripts" / "verify-cloudflare-staging.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    import tomllib
    with (ROOT / "cloudflare" / "wrangler.toml").open("rb") as handle:
        source = tomllib.load(handle)
    if module.validate_staging({"env": {"staging": config, "production": source["env"]["production"]}}):
        raise VerificationError("invalid_generated_bindings")
    if provision.get("account_id") != config.get("account_id"):
        raise VerificationError("account_receipt_mismatch")
    origin = provision.get("worker_url", "")
    if not isinstance(origin, str) or not re.fullmatch(
        r"https://ucc-mca-edge-staging\.[a-z0-9-]+\.workers\.dev", origin
    ):
        raise VerificationError("invalid_worker_origin")
    return origin


def validate_schema(payload):
    if not isinstance(payload, list) or len(payload) != 1:
        raise VerificationError("invalid_schema_receipt")
    result = payload[0]
    if not isinstance(result, dict) or result.get("success") is not True:
        raise VerificationError("schema_query_failed")
    rows = result.get("results")
    if not isinstance(rows, list) or len(rows) != len(SCHEMA):
        raise VerificationError("schema_incomplete")
    if any(not isinstance(row, dict) or set(row) != {"name"} for row in rows):
        raise VerificationError("invalid_schema_rows")
    if {row["name"] for row in rows} != SCHEMA:
        raise VerificationError("schema_incomplete")


def fetch(origin, path, forged=False):
    """Unauthenticated probes only; never follow redirects or print payloads."""
    headers = {"Accept": "application/json", "Cache-Control": "no-cache"}
    if forged:
        headers["Cf-Access-Jwt-Assertion"] = "invalid-staging-verification-token"
    try:
        request = urllib.request.Request(origin + path, headers=headers)
        try:
            response = urllib.request.build_opener(NoRedirect()).open(request, timeout=20)
        except urllib.error.HTTPError as exc:
            response = exc
        with response:
            raw = response.read(MAX_BYTES + 1)
            status = response.code
            location = response.headers.get("Location", "")
            content_type = response.headers.get("Content-Type", "").split(";", 1)[0]
        if len(raw) > MAX_BYTES:
            raise VerificationError("live_response_too_large")
        try:
            payload = json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            payload = None
        return status, payload, location, content_type
    except VerificationError:
        raise
    except Exception:
        raise VerificationError("live_transport_failed") from None


def denied(response, team_domain):
    status, payload, location, content_type = response
    if status == 401:
        return content_type == "application/json" and payload == {
            "error": {"message": "Unauthorized", "code": "UNAUTHORIZED", "statusCode": 401}
        }
    if status not in {302, 303, 307}:
        return False
    parsed = urllib.parse.urlsplit(location)
    return (
        parsed.scheme == "https" and parsed.netloc == team_domain
        and parsed.path.startswith("/cdn-cgi/access/login/")
    )


def verify_live(origin, config, expected_sha, requester=fetch):
    health = requester(origin, "/health?revision=" + expected_sha)
    if health[0] != 200 or health[3] != "application/json" or health[1] != {
        "ok": True, "env": "staging", "revision": expected_sha
    }:
        raise VerificationError("live_revision_or_health_mismatch")
    domain = config["vars"]["ACCESS_TEAM_DOMAIN"]
    unauthenticated = requester(origin, "/api/prospects")
    forged = requester(origin, "/api/prospects", forged=True)
    if not denied(unauthenticated, domain) or not denied(forged, domain):
        raise VerificationError("authentication_boundary_failed")
    missing = requester(origin, "/staging-verification-nonexistent-route")
    if missing[0] != 404:
        raise VerificationError("missing_route_not_404")
    return {"health": 200, "unauthenticated": unauthenticated[0],
            "forged_token": forged[0], "missing_route": 404}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--configuration-only", action="store_true")
    modes.add_argument("--schema-only", action="store_true")
    args = parser.parse_args()
    report = {"schema_version": 1, "deployment_verified": False}
    try:
        config = read_json(GENERATED / "staging.wrangler.json")
        provision = read_json(GENERATED / "staging-provisioning.json")
        revision = os.environ.get("GITHUB_SHA", "")
        origin = validate_configuration(config, provision, revision)
        if not args.configuration_only:
            validate_schema(read_json(GENERATED / "staging-schema.json"))
        if args.configuration_only or args.schema_only:
            print("Staging configuration" + (" and schema" if args.schema_only else "") + " verified")
            return 0
        checks = verify_live(origin, config, revision)
        report.update({"deployment_verified": True, "revision": revision,
                       "worker_url": origin, "checks": checks,
                       "schema_verified": True, "access_enrollment_verified": False})
    except VerificationError as exc:
        report["blocker"] = str(exc)
    except Exception:
        report["blocker"] = "verification_failed"
    if not GENERATED.is_dir() or GENERATED.is_symlink():
        print(json.dumps(report, sort_keys=True))
        return 1
    target = GENERATED / "staging-deployment.json"
    if target.is_symlink():
        print('{"blocker":"unsafe_receipt_path","deployment_verified":false}')
        return 1
    target.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    print(json.dumps(report, sort_keys=True))
    return 0 if report["deployment_verified"] else 1


if __name__ == "__main__":
    sys.exit(main())
