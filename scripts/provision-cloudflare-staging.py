#!/usr/bin/env python3
"""Reconcile only UCC staging resources; plan by default, --apply to create.

API contracts: developers.cloudflare.com/api/resources/{d1,kv,r2,zero_trust}/
workers.dev Access paths: developers.cloudflare.com/workers/configuration/cloudflare-access/
No tokens, raw responses, exception text, billing changes, or production writes.
"""
import argparse
import copy
import json
import os
from pathlib import Path
import re
import sys
import time
import tomllib
import urllib.error
import urllib.parse
import urllib.request
import uuid

ACCOUNT = "e0921b840fd656d8ea46426f1f114c30"
WORKER = "ucc-mca-edge-staging"
PAGES_PROJECT = "ucc-mca-dashboard-staging"
PAGES_ACCESS = "ucc-mca-dashboard-staging-access"
NAMES = {"d1": "ucc-mca-staging", "kv": "ucc-mca-edge-staging-KV",
         "r2": "cronus-assets-staging", "access": "ucc-mca-edge-staging-api"}
PATHS = {"d1": "/d1/database", "kv": "/storage/kv/namespaces",
         "r2": "/r2/buckets", "access": "/access/apps"}
KEYS = {"d1": ("name", "uuid"), "kv": ("title", "id"),
        "r2": ("name", "name"), "access": ("name", "id")}
ORIGIN = "https://api.cloudflare.com/client/v4"
MAX_BYTES = 2_000_000
MAX_PAGES = 100


class Blocked(Exception):
    def __init__(self, code, **fields):
        self.receipt = {"code": code, **fields}
        super().__init__(code)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class API:
    def __init__(self, token, report):
        if not token or any(ord(c) < 33 or ord(c) > 126 for c in token):
            raise Blocked("missing_or_invalid_CLOUDFLARE_API_TOKEN")
        self.token = token
        self.report = report
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

    def request(self, operation, path, method="GET", body=None):
        # Paths are constructed only from constants, encoded query values and
        # validated provider IDs. No redirects or caller-selected API origins.
        prefix = f"/accounts/{ACCOUNT}"
        if not (path == prefix or path.startswith(prefix + "/")) or ".." in path:
            raise Blocked("endpoint_outside_staging_account")
        if method not in {"GET", "POST"}:
            raise Blocked("unsupported_mutation")
        if method == "POST" and path not in {prefix + p for p in PATHS.values()}:
            policy_path = re.fullmatch(
                re.escape(prefix) + r"/access/apps/([0-9a-fA-F-]{36})/policies", path
            )
            if not policy_path:
                raise Blocked("unsupported_mutation")
            try:
                uuid.UUID(policy_path.group(1))
            except ValueError:
                raise Blocked("unsupported_mutation") from None
        observation = {"operation": operation, "method": method, "success": False}
        self.report["requests"].append(observation)
        try:
            request = urllib.request.Request(ORIGIN + path, method=method,
                data=json.dumps(body).encode() if body is not None else None,
                headers={"Authorization": "Bearer " + self.token,
                         "Accept": "application/json", "Content-Type": "application/json"})
            try:
                response = self.opener.open(request, timeout=30)
            except urllib.error.HTTPError as exc:
                response = exc
            with response:
                raw = response.read(MAX_BYTES + 1)
                status = response.code
        except Exception:
            raise Blocked("cloudflare_transport_failed", operation=operation) from None
        observation["http_status"] = status
        if len(raw) > MAX_BYTES:
            raise Blocked("cloudflare_response_too_large", operation=operation)
        if self.token.encode() in raw and 200 <= status < 300:
            raise Blocked("credential_reflected_in_provider_response", operation=operation)
        try:
            payload = json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            raise Blocked("cloudflare_invalid_json", operation=operation) from None
        if not isinstance(payload, dict):
            raise Blocked("cloudflare_invalid_response", operation=operation)
        errors = payload.get("errors", [])
        codes = [e["code"] for e in errors if isinstance(e, dict)
                 and type(e.get("code")) is int][:10] if isinstance(errors, list) else []
        observation["error_codes"] = codes
        if not 200 <= status < 300 or payload.get("success") is not True:
            raise Blocked("cloudflare_request_denied_or_failed", operation=operation,
                          http_status=status, error_codes=codes)
        observation["success"] = True
        return payload


def identifier(kind, row):
    if not isinstance(row, dict):
        raise Blocked("invalid_resource_metadata", resource=kind)
    name_key, id_key = KEYS[kind]
    name, value = row.get(name_key), row.get(id_key)
    if not isinstance(name, str) or not isinstance(value, str):
        raise Blocked("invalid_resource_metadata", resource=kind)
    if kind in {"d1", "access"}:
        try:
            parsed = uuid.UUID(value)
            if not parsed.int:
                raise ValueError()
            return str(parsed)
        except (ValueError, AttributeError):
            raise Blocked("invalid_resource_identifier", resource=kind) from None
    if kind == "kv":
        if not re.fullmatch(r"[0-9a-fA-F]{32}", value) or not value.strip("0"):
            raise Blocked("invalid_resource_identifier", resource=kind)
        return value.lower()
    if not re.fullmatch(r"[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]", value):
        raise Blocked("invalid_resource_identifier", resource=kind)
    return value


def inventory(api, kind):
    """Enumerate every page; failures never mean the resource is absent."""
    per_page = {"d1": 100, "kv": 1000, "r2": 1000, "access": 50}[kind]
    rows, seen, cursors = [], set(), set()
    cursor = None
    expected_total = None
    for page in range(1, MAX_PAGES + 1):
        query = {"per_page": per_page}
        if kind == "r2":
            if cursor:
                query["cursor"] = cursor
        else:
            query["page"] = page
        payload = api.request("list_" + kind, f"/accounts/{ACCOUNT}" + PATHS[kind]
                              + "?" + urllib.parse.urlencode(query))
        batch = payload.get("result")
        if kind == "r2" and isinstance(batch, dict):
            batch = batch.get("buckets")
        info = payload.get("result_info", {})
        if not isinstance(batch, list) or not isinstance(info, dict):
            raise Blocked("invalid_list_shape", resource=kind)
        size = info.get("per_page", per_page)
        if type(size) is not int or not 1 <= size <= per_page or len(batch) > size:
            raise Blocked("invalid_pagination", resource=kind)
        for row in batch:
            value = identifier(kind, row)
            if value in seen:
                raise Blocked("duplicate_resource_or_repeated_page", resource=kind)
            seen.add(value)
            rows.append(row)
        if kind == "r2":
            next_cursor = info.get("cursor")
            if next_cursor is not None and not isinstance(next_cursor, str):
                raise Blocked("invalid_pagination", resource=kind)
            if not next_cursor:
                if len(batch) >= size:
                    raise Blocked("incomplete_pagination", resource=kind)
                return rows
            if not batch or next_cursor in cursors or len(next_cursor) > 4096:
                raise Blocked("incomplete_pagination", resource=kind)
            cursors.add(next_cursor)
            cursor = next_cursor
            continue
        if info.get("page", page) != page:
            raise Blocked("unexpected_list_page", resource=kind)
        total = info.get("total_count")
        pages = info.get("total_pages")
        if total is not None:
            if type(total) is not int or total < len(rows) or (expected_total is not None and total != expected_total):
                raise Blocked("inconsistent_list_total", resource=kind)
            expected_total = total
        if pages is not None and (type(pages) is not int or pages < 0 or pages > MAX_PAGES):
            raise Blocked("invalid_pagination", resource=kind)
        done = len(rows) == total if total is not None else (page >= pages if pages is not None else len(batch) < size)
        if done:
            if pages is not None and pages not in {0, page}:
                raise Blocked("inconsistent_list_total", resource=kind)
            return rows
        if not batch or (pages is not None and page >= pages):
            raise Blocked("incomplete_pagination", resource=kind)
    raise Blocked("pagination_limit_exceeded", resource=kind)



def readback(api, kind, value, created=False):
    """One corrective read after a new write; never repeat resource creation.

    A just-created D1 database was returned with a stale list total by the
    provider. Keep complete inventory checks and require a coherent readback;
    retry only that bounded post-create observation, never a denial or duplicate.
    """
    for attempt in range(2 if created else 1):
        try:
            current = one_exact(inventory(api, kind), kind)
            if current is None:
                raise Blocked("resource_readback_mismatch", resource=kind)
            if identifier(kind, current) != value:
                raise Blocked("resource_identity_changed", resource=kind)
            return current
        except Blocked as exc:
            if not created or attempt or exc.receipt["code"] not in {
                "inconsistent_list_total", "incomplete_pagination", "resource_readback_mismatch"
            }:
                raise
            time.sleep(2)
    raise AssertionError("unreachable readback state")


def one_exact(rows, kind):
    key = KEYS[kind][0]
    matches = [r for r in rows if r[key] == NAMES[kind]]
    if len(matches) > 1:
        raise Blocked("ambiguous_staging_resource", resource=kind)
    return matches[0] if matches else None


def one_access_named(rows, name):
    matches = [row for row in rows if row.get("name") == name]
    if len(matches) > 1:
        raise Blocked("ambiguous_staging_resource", resource="pages_access")
    return matches[0] if matches else None


def readback_access_named(api, name, value, created=False):
    for attempt in range(2 if created else 1):
        try:
            current = one_access_named(inventory(api, "access"), name)
            if current is None or identifier("access", current) != value:
                raise Blocked("resource_readback_mismatch", resource="pages_access")
            return current
        except Blocked as exc:
            if not created or attempt or exc.receipt["code"] not in {
                "inconsistent_list_total", "incomplete_pagination", "resource_readback_mismatch"
            }:
                raise
            time.sleep(2)
    raise AssertionError("unreachable readback state")


def safe_path(root, relative, must_exist=False):
    root = root.resolve()
    path = root / relative
    for part in [path, *path.parents]:
        if part.is_symlink():
            raise Blocked("symlink_path_rejected")
        if part == root:
            break
    if root not in path.resolve().parents:
        raise Blocked("path_outside_repository")
    if must_exist and not path.exists():
        raise Blocked("required_source_missing")
    return path


def source_config(root):
    path = safe_path(root, "cloudflare/wrangler.toml", True)
    try:
        config = tomllib.loads(path.read_text())
        staging = config["env"]["staging"]
        production = config["env"]["production"]
        if staging.get("account_id") != ACCOUNT or staging.get("name") != WORKER:
            raise Blocked("staging_target_not_authorized")
        if os.environ.get("CLOUDFLARE_ACCOUNT_ID", ACCOUNT) not in {"", ACCOUNT}:
            raise Blocked("account_override_conflicts_with_staging")
        for collection, binding in [("d1_databases", "DB"), ("kv_namespaces", "KV"), ("r2_buckets", "ARTIFACTS")]:
            if len(staging.get(collection, [])) != 1 or staging[collection][0].get("binding") != binding:
                raise Blocked("unexpected_staging_bindings")
        if staging["d1_databases"][0].get("database_name") not in {"ucc-mca", NAMES["d1"]}:
            raise Blocked("unexpected_staging_database_name")
        if staging["r2_buckets"][0].get("bucket_name") != NAMES["r2"]:
            raise Blocked("unexpected_staging_bucket_name")
        if config.get("main") != "workers/api/src/index.ts" or staging["d1_databases"][0].get("migrations_dir") != "migrations":
            raise Blocked("unexpected_staging_source_paths")
        safe_path(root, "cloudflare/" + config["main"], True)
        safe_path(root, "cloudflare/migrations", True)
        return config, staging, production
    except Blocked:
        raise
    except Exception:
        raise Blocked("invalid_wrangler_source_configuration") from None


def isolate(selected, production):
    for kind, collection, field in [("d1", "d1_databases", "database_id"), ("kv", "kv_namespaces", "id"), ("r2", "r2_buckets", "bucket_name")]:
        if selected.get(kind) is None:
            continue
        current = identifier(kind, selected[kind])
        for row in production.get(collection, []):
            value = row.get(field, "")
            if kind == "d1":
                try:
                    value = str(uuid.UUID(value))
                except (ValueError, AttributeError, TypeError):
                    continue
            if isinstance(value, str) and value.lower() == current.lower():
                raise Blocked("staging_resource_shared_with_production", resource=kind)
    app = selected.get("access")
    production_audiences = {
        value.strip() for value in production.get("vars", {}).get("ACCESS_AUD", "").split(",")
        if value.strip()
    }
    if app and app.get("aud") in production_audiences:
        raise Blocked("staging_access_shared_with_production")


def access_identity(api, app, domain):
    if app.get("name") != NAMES["access"] or app.get("type") != "self_hosted" or app.get("domain") != domain:
        raise Blocked("access_application_target_mismatch")
    # Reject multi-destination apps: a dedicated staging app must not encompass
    # production or other hostnames via newer destination fields.
    if app.get("destinations") not in (None, [], [{"type": "public", "uri": domain}]) or app.get("self_hosted_domains") not in (None, [], [domain]):
        raise Blocked("access_application_has_additional_targets")
    aud = app.get("aud")
    if not isinstance(aud, str) or not re.fullmatch(r"[a-fA-F0-9]{64}", aud):
        raise Blocked("access_audience_not_verified")
    policies = inventory_policies(api, identifier("access", app))
    # Enrollment belongs to the Access owner. Preserve existing authenticated
    # allow/service-auth policies; never rewrite them during resource upkeep.
    # Bypass would remove Access authentication from the protected API path.
    if any(p.get("decision") not in {"deny", "allow", "non_identity"} for p in policies):
        raise Blocked("existing_access_policy_bypasses_authentication_or_is_unknown")
    return aud


def pages_access_identity(api, app, domain):
    if (app.get("name") != PAGES_ACCESS or app.get("type") != "self_hosted"
            or app.get("domain") != domain):
        raise Blocked("pages_access_application_target_mismatch")
    if app.get("destinations") not in (None, [], [{"type": "public", "uri": domain}]):
        raise Blocked("pages_access_application_has_additional_targets")
    if app.get("self_hosted_domains") not in (None, [], [domain]):
        raise Blocked("pages_access_application_has_additional_targets")
    aud = app.get("aud")
    if not isinstance(aud, str) or not re.fullmatch(r"[a-fA-F0-9]{64}", aud):
        raise Blocked("pages_access_audience_not_verified")
    policies = inventory_policies(api, identifier("access", app))
    if any(policy.get("decision") not in {"deny", "allow", "non_identity"}
           for policy in policies):
        raise Blocked("pages_access_policy_bypasses_authentication_or_is_unknown")
    allow = [policy for policy in policies if policy.get("decision") == "allow"]
    if not allow or any(not isinstance(policy.get("include"), list) or not policy["include"]
                        for policy in allow):
        raise Blocked("pages_access_enrollment_policy_required")
    return aud


def inventory_policies(api, app_id):
    # Application policies use the same page-number contract as Access apps.
    # Keep policy parsing separate: unlike resources, policies need no names/IDs
    # when the list is empty (new app's deliberate default-deny posture).
    rows, seen = [], set()
    expected_total = None
    for page in range(1, MAX_PAGES + 1):
        payload = api.request("list_access_policies", f"/accounts/{ACCOUNT}/access/apps/{app_id}/policies?per_page=50&page={page}")
        batch, info = payload.get("result"), payload.get("result_info", {})
        if not isinstance(batch, list) or not isinstance(info, dict) or not all(isinstance(p, dict) for p in batch):
            raise Blocked("invalid_access_policy_list")
        size = info.get("per_page", 50)
        if type(size) is not int or not 1 <= size <= 50 or info.get("page", page) != page or len(batch) > size:
            raise Blocked("invalid_access_policy_pagination")
        for policy in batch:
            # Complete policy metadata is required before preserving an app.
            value = policy.get("id")
            if not isinstance(value, str) or value in seen:
                raise Blocked("invalid_or_repeated_access_policy")
            seen.add(value)
        rows.extend(batch)
        total, pages = info.get("total_count"), info.get("total_pages")
        if total is not None:
            if type(total) is not int or total < len(rows) or (expected_total is not None and total != expected_total):
                raise Blocked("invalid_access_policy_pagination")
            expected_total = total
        if pages is not None and (type(pages) is not int or pages < 0 or pages > MAX_PAGES):
            raise Blocked("invalid_access_policy_pagination")
        done = len(rows) == total if total is not None else (page >= pages if pages is not None else len(batch) < size)
        if done:
            if pages is not None and pages not in {0, page}:
                raise Blocked("invalid_access_policy_pagination")
            return rows
        if not batch or (pages is not None and page >= pages):
            raise Blocked("incomplete_access_policy_pagination")
    raise Blocked("access_policy_pagination_limit")


def prior_deployment(api):
    """Read only the staging predecessor; absence comes from the complete list."""
    payload = api.request("list_workers", f"/accounts/{ACCOUNT}/workers/scripts")
    workers = payload.get("result")
    if not isinstance(workers, list) or not all(isinstance(w, dict) and isinstance(w.get("id"), str) for w in workers):
        raise Blocked("invalid_workers_inventory")
    info = payload.get("result_info", {})
    if not isinstance(info, dict) or len({w["id"] for w in workers}) != len(workers) or info.get("cursor"):
        raise Blocked("incomplete_workers_inventory")
    if ("total_count" in info and info["total_count"] != len(workers)) or info.get("total_pages", 1) not in {0, 1}:
        raise Blocked("incomplete_workers_inventory")
    matches = [w for w in workers if w["id"] == WORKER]
    if not matches:
        return None
    payload = api.request("staging_deployments", f"/accounts/{ACCOUNT}/workers/scripts/{WORKER}/deployments")
    result = payload.get("result")
    deployments = result.get("deployments") if isinstance(result, dict) else None
    if not isinstance(deployments, list) or not deployments:
        raise Blocked("staging_predecessor_unverified")
    latest = deployments[0]
    try:
        deployment_id = str(uuid.UUID(latest["id"]))
        versions = [{"version_id": str(uuid.UUID(v["version_id"])), "percentage": v["percentage"]} for v in latest["versions"]]
        if not versions or not all(type(v["percentage"]) in {int, float} and 0 < v["percentage"] <= 100 for v in versions) or abs(sum(v["percentage"] for v in versions) - 100) > 0.0001:
            raise ValueError()
    except (KeyError, ValueError, TypeError, AttributeError):
        raise Blocked("staging_predecessor_unverified") from None
    return {"id": deployment_id, "versions": versions}


def reconcile(api, root, config, staging, production, report, apply):
    account = api.request("account", f"/accounts/{ACCOUNT}").get("result")
    if not isinstance(account, dict) or account.get("id") != ACCOUNT:
        raise Blocked("returned_account_does_not_match")
    revision = os.environ.get("GITHUB_SHA", "")
    if revision and not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise Blocked("invalid_deployment_revision")
    report["prior_deployment"] = prior_deployment(api)
    all_rows = {kind: inventory(api, kind) for kind in NAMES}
    selected = {kind: one_exact(rows, kind) for kind, rows in all_rows.items()}
    org = api.request("access_organization", f"/accounts/{ACCOUNT}/access/organizations").get("result")
    team = org.get("auth_domain") if isinstance(org, dict) else None
    if not isinstance(team, str) or not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com", team) or team == "your-team.cloudflareaccess.com":
        raise Blocked("existing_access_organization_required")
    sub = api.request("workers_subdomain", f"/accounts/{ACCOUNT}/workers/subdomain").get("result")
    subdomain = sub.get("subdomain") if isinstance(sub, dict) else None
    if not isinstance(subdomain, str) or not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", subdomain):
        raise Blocked("existing_workers_subdomain_required")
    hostname = WORKER + "." + subdomain + ".workers.dev"
    domain = hostname + "/api/*"
    pages_domain = PAGES_PROJECT + ".pages.dev"
    report.update(worker_url="https://" + hostname, access_domain=domain,
                  pages_access_domain=pages_domain)
    for app in all_rows["access"]:
        if app.get("domain") == domain and app.get("name") != NAMES["access"]:
            raise Blocked("access_hostname_owned_by_another_application")
        if app.get("domain") == pages_domain and app.get("name") != PAGES_ACCESS:
            raise Blocked("pages_access_hostname_owned_by_another_application")
    pages_access = one_access_named(all_rows["access"], PAGES_ACCESS)
    isolate(selected, production)
    if selected["access"]:
        access_identity(api, selected["access"], domain)
    if pages_access:
        pages_access_identity(api, pages_access, pages_domain)
        production_audiences = {
            value.strip() for value in production.get("vars", {}).get("ACCESS_AUD", "").split(",")
            if value.strip()
        }
        if pages_access.get("aud") in production_audiences:
            raise Blocked("staging_access_shared_with_production")
    report["resources"] = [{"kind": kind, "name": NAMES[kind], "action": "reuse" if row else "create"}
                           for kind, row in selected.items()]
    report["resources"].append({"kind": "pages_access", "name": PAGES_ACCESS,
                                "action": "reuse" if pages_access else "create"})
    if not apply:
        report["status"] = "planned"
        return None
    bodies = {"d1": {"name": NAMES["d1"]}, "kv": {"title": NAMES["kv"]},
              "r2": {"name": NAMES["r2"], "storageClass": "Standard"},
              "access": {"name": NAMES["access"], "type": "self_hosted", "domain": domain,
                         "session_duration": "1h", "app_launcher_visible": False, "policies": []}}
    for entry in report["resources"]:
        kind = entry["kind"]
        if kind == "pages_access":
            continue
        if selected[kind] is None:
            row = api.request("create_" + kind, f"/accounts/{ACCOUNT}" + PATHS[kind], "POST", bodies[kind]).get("result")
            if not isinstance(row, dict) or row.get(KEYS[kind][0]) != NAMES[kind]:
                raise Blocked("created_resource_name_mismatch", resource=kind)
            identifier(kind, row)
            selected[kind] = row
            entry["action"] = "created"
        value = identifier(kind, selected[kind])
        entry["id"] = value
        # Re-list rather than trusting a successful create response. This also
        # detects concurrent duplicate creation without deleting anyone's work.
        current = readback(api, kind, value, created=entry["action"] == "created")
        selected[kind] = current
        isolate(selected, production)
    pages_entry = report["resources"][-1]
    if pages_access is None:
        pages_access = api.request(
            "create_pages_access", f"/accounts/{ACCOUNT}" + PATHS["access"], "POST",
            {"name": PAGES_ACCESS, "type": "self_hosted", "domain": pages_domain,
             "session_duration": "1h", "app_launcher_visible": False, "policies": []},
        ).get("result")
        if not isinstance(pages_access, dict) or pages_access.get("name") != PAGES_ACCESS:
            raise Blocked("created_resource_name_mismatch", resource="pages_access")
        page_id = identifier("access", pages_access)
        pages_access = readback_access_named(api, PAGES_ACCESS, page_id, created=True)
        pages_entry.update(action="created", id=page_id)
    else:
        pages_entry["id"] = identifier("access", pages_access)
    policies = inventory_policies(api, identifier("access", pages_access))
    if not any(policy.get("decision") == "allow" for policy in policies):
        api.request(
            "create_pages_access_policy",
            f"/accounts/{ACCOUNT}/access/apps/{identifier('access', pages_access)}/policies",
            "POST",
            {"name": "Authenticated tenant members", "decision": "allow",
             "precedence": 1, "include": [{"everyone": {}}]},
        )
    aud = access_identity(api, selected["access"], domain)
    pages_aud = pages_access_identity(api, pages_access, pages_domain)
    output = {"name": WORKER, "account_id": ACCOUNT, "main": str(safe_path(root, "cloudflare/" + config["main"], True)),
              "compatibility_date": config["compatibility_date"], "compatibility_flags": copy.deepcopy(config.get("compatibility_flags", [])),
              "workers_dev": True, "preview_urls": False,
              "d1_databases": [{"binding": "DB", "database_name": NAMES["d1"], "database_id": identifier("d1", selected["d1"]), "migrations_dir": str(safe_path(root, "cloudflare/migrations", True))}],
              "kv_namespaces": [{"binding": "KV", "id": identifier("kv", selected["kv"])}],
              "r2_buckets": [{"binding": "ARTIFACTS", "bucket_name": NAMES["r2"]}],
              "triggers": copy.deepcopy(staging.get("triggers", {"crons": []})),
              "vars": {"ENVIRONMENT": "staging", "ACCESS_TEAM_DOMAIN": team,
                       "ACCESS_AUD": aud + "," + pages_aud}}
    revision = os.environ.get("GITHUB_SHA", "")
    if revision:
        if not re.fullmatch(r"[0-9a-f]{40}", revision):
            raise Blocked("invalid_deployment_revision")
        output["vars"]["DEPLOYMENT_SHA"] = revision
        report["deployment_sha"] = revision
    report["status"] = "ready"
    report["access_policy_verified"] = True
    return output


def save_json(path, content):
    # Reject both symlinks and multiply-linked files. No atomic-write temporary
    # filename from untrusted input; O_NOFOLLOW protects the final open as well.
    if path.is_symlink() or (path.exists() and (not path.is_file() or path.stat().st_nlink != 1)):
        raise Blocked("unsafe_generated_output")
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        json.dump(content, handle, indent=2, sort_keys=True)
        handle.write("\n")


def run(root, apply=False, api_factory=API):
    report = {"schema_version": 1, "mode": "apply" if apply else "plan", "status": "blocked",
              "account_id": ACCOUNT, "worker_name": WORKER, "requests": [], "resources": [],
              "access_policy_verified": False, "access_enrollment_verified": False,
              "deployment_verified": False}
    directory = None
    try:
        config, staging, production = source_config(root)
        directory = safe_path(root, "cloudflare/.generated")
        directory.mkdir(mode=0o700, exist_ok=True)
        generated = safe_path(root, "cloudflare/.generated/staging.wrangler.json")
        if apply and generated.exists():
            if not generated.is_file() or generated.stat().st_nlink != 1:
                raise Blocked("unsafe_generated_output")
            generated.unlink()
        api = api_factory(os.environ.get("CLOUDFLARE_API_TOKEN", ""), report)
        result = reconcile(api, root, config, staging, production, report, apply)
        if result is not None:
            save_json(generated, result)
    except Blocked as exc:
        report["status"] = "blocked"
        report["blocker"] = exc.receipt
    except Exception:
        # Never stringify unexpected SDK, transport, filesystem or provider data.
        report["status"] = "blocked"
        report["blocker"] = {"code": "unexpected_provisioning_failure"}
    if directory is not None:
        try:
            save_json(safe_path(root, "cloudflare/.generated/staging-provisioning.json"), report)
        except Exception:
            report["status"] = "blocked"
            report["blocker"] = {"code": "receipt_write_failed"}
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if report["status"] in {"planned", "ready"} else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--apply", action="store_true", help="Create missing dedicated staging resources")
    group.add_argument("--plan", action="store_true", help="Read-only remote preflight (default)")
    args = parser.parse_args()
    return run(Path(__file__).resolve().parents[1], args.apply)


if __name__ == "__main__":
    sys.exit(main())
