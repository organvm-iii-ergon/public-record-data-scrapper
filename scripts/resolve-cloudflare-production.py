#!/usr/bin/env python3
"""Resolve or explicitly provision isolated production bindings."""
import argparse
import copy
import importlib.util
import json
import os
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "staging_provisioner", Path(__file__).with_name("provision-cloudflare-staging.py")
)
P = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(P)

WORKER = "ucc-mca-edge-production"
PAGES_PROJECT = "ucc-mca-dashboard"
PAGES_ACCESS = "ucc-mca-dashboard-access"
NAMES = {
    "d1": "ucc-mca",
    "kv": "ucc-mca-edge-KV",
    "r2": "cronus-assets",
    "access": "ucc-mca-edge-production-api",
}
STAGING_NAMES = {
    "d1": "ucc-mca-staging",
    "kv": "ucc-mca-edge-staging-KV",
    "r2": "cronus-assets-staging",
    "access": "ucc-mca-edge-staging-api",
}
STAGING_PAGES_ACCESS = "ucc-mca-dashboard-staging-access"


def exact(rows, kind, name):
    key = P.KEYS[kind][0]
    matches = [row for row in rows if row.get(key) == name]
    if len(matches) != 1:
        raise P.Blocked("production_resource_missing_or_ambiguous", resource=kind)
    return matches[0]


def resolve(api, root, report):
    account = api.request("account", f"/accounts/{P.ACCOUNT}").get("result")
    if not isinstance(account, dict) or account.get("id") != P.ACCOUNT:
        raise P.Blocked("returned_account_does_not_match")

    config, _, production = P.source_config(root)
    if production.get("name") != WORKER:
        raise P.Blocked("production_target_not_authorized")
    if config.get("main") != "workers/api/src/index.ts":
        raise P.Blocked("unexpected_production_source_path")

    rows = {kind: P.inventory(api, kind) for kind in NAMES}
    selected = {kind: exact(rows[kind], kind, name) for kind, name in NAMES.items()}
    staging = {kind: exact(rows[kind], kind, name) for kind, name in STAGING_NAMES.items()}
    pages_access = exact(rows["access"], "access", PAGES_ACCESS)
    staging_pages_access = exact(rows["access"], "access", STAGING_PAGES_ACCESS)
    for kind in NAMES:
        if P.identifier(kind, selected[kind]).lower() == P.identifier(kind, staging[kind]).lower():
            raise P.Blocked("production_resource_shared_with_staging", resource=kind)
    if P.identifier("access", pages_access) == P.identifier("access", staging_pages_access):
        raise P.Blocked("production_resource_shared_with_staging", resource="pages_access")

    organization = api.request(
        "access_organization", f"/accounts/{P.ACCOUNT}/access/organizations"
    ).get("result")
    team = organization.get("auth_domain") if isinstance(organization, dict) else None
    if not isinstance(team, str) or not re.fullmatch(
        r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com", team
    ):
        raise P.Blocked("existing_access_organization_required")
    subdomain_result = api.request(
        "workers_subdomain", f"/accounts/{P.ACCOUNT}/workers/subdomain"
    ).get("result")
    subdomain = subdomain_result.get("subdomain") if isinstance(subdomain_result, dict) else None
    if not isinstance(subdomain, str) or not re.fullmatch(
        r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", subdomain
    ):
        raise P.Blocked("existing_workers_subdomain_required")
    worker_url = f"https://{WORKER}.{subdomain}.workers.dev"
    domain = worker_url.removeprefix("https://") + "/api/*"

    original_names, original_worker = P.NAMES, P.WORKER
    try:
        P.NAMES, P.WORKER = NAMES, WORKER
        aud = P.access_identity(api, selected["access"], domain)
    finally:
        P.NAMES, P.WORKER = original_names, original_worker
    original_pages_access, original_pages_project = P.PAGES_ACCESS, P.PAGES_PROJECT
    try:
        P.PAGES_ACCESS, P.PAGES_PROJECT = PAGES_ACCESS, PAGES_PROJECT
        pages_aud = P.pages_access_identity(api, pages_access, PAGES_PROJECT + ".pages.dev")
    finally:
        P.PAGES_ACCESS, P.PAGES_PROJECT = original_pages_access, original_pages_project

    revision = os.environ.get("GITHUB_SHA", "")
    if not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise P.Blocked("invalid_deployment_revision")

    output = {
        "name": WORKER,
        "account_id": P.ACCOUNT,
        "main": str(P.safe_path(root, "cloudflare/" + config["main"], True)),
        "compatibility_date": config["compatibility_date"],
        "compatibility_flags": copy.deepcopy(config.get("compatibility_flags", [])),
        "workers_dev": True,
        "preview_urls": False,
        "d1_databases": [{
            "binding": "DB",
            "database_name": NAMES["d1"],
            "database_id": P.identifier("d1", selected["d1"]),
            "migrations_dir": str(P.safe_path(root, "cloudflare/migrations", True)),
        }],
        "kv_namespaces": [{"binding": "KV", "id": P.identifier("kv", selected["kv"])}],
        "r2_buckets": [{"binding": "ARTIFACTS", "bucket_name": NAMES["r2"]}],
        "triggers": copy.deepcopy(production.get("triggers", {"crons": []})),
        "vars": {
            "ENVIRONMENT": "production",
            "ACCESS_TEAM_DOMAIN": team,
            "ACCESS_AUD": aud + "," + pages_aud,
            "DEPLOYMENT_SHA": revision,
        },
    }
    report.update({
        "status": "ready",
        "revision": revision,
        "worker_url": worker_url,
        "resources": [
            {"kind": kind, "name": NAMES[kind], "id": P.identifier(kind, selected[kind])}
            for kind in NAMES
        ] + [{"kind": "pages_access", "name": PAGES_ACCESS,
              "id": P.identifier("access", pages_access)}],
    })
    return output


def provision(api, root, report):
    """Create only missing exact-name production resources, then re-resolve.

    The staging reconciler already owns the bounded create/readback contracts.
    Temporarily supply production names and configuration, then restore its
    module globals before independently resolving both environments again.
    """
    config, staging, production = P.source_config(root)
    originals = P.NAMES, P.WORKER, P.PAGES_PROJECT, P.PAGES_ACCESS
    try:
        P.NAMES = NAMES
        P.WORKER = WORKER
        P.PAGES_PROJECT = PAGES_PROJECT
        P.PAGES_ACCESS = PAGES_ACCESS
        P.reconcile(api, root, config, production, staging, report, True)
        creation_receipt = copy.deepcopy(report.get("resources", []))
    finally:
        P.NAMES, P.WORKER, P.PAGES_PROJECT, P.PAGES_ACCESS = originals
    report["production_writes"] = any(
        row.get("action") == "created" for row in creation_receipt
    )
    output = resolve(api, root, report)
    actions = {row.get("kind"): row.get("action") for row in creation_receipt}
    for row in report["resources"]:
        row["action"] = actions.get(row["kind"], "reuse")
    return output


def run(root=ROOT, api_factory=P.API, apply=False):
    report = {
        "schema_version": 1,
        "mode": "apply" if apply else "reuse-only",
        "status": "blocked",
        "account_id": P.ACCOUNT,
        "worker_name": WORKER,
        "requests": [],
        "resources": [],
        "production_writes": False,
    }
    generated = P.safe_path(root, "cloudflare/.generated")
    generated.mkdir(mode=0o700, exist_ok=True)
    try:
        api = api_factory(os.environ.get("CLOUDFLARE_API_TOKEN", ""), report)
        output = provision(api, root, report) if apply else resolve(api, root, report)
        P.save_json(P.safe_path(root, "cloudflare/.generated/production.wrangler.json"), output)
    except P.Blocked as exc:
        report["blocker"] = exc.receipt
    except Exception:
        report["blocker"] = {"code": "unexpected_production_resolution_failure"}
    P.save_json(P.safe_path(root, "cloudflare/.generated/production-resolution.json"), report)
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if report["status"] == "ready" else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply", action="store_true", help="Create only missing exact-name production resources"
    )
    raise SystemExit(run(apply=parser.parse_args().apply))
