#!/usr/bin/env python3
"""Read-only UCC account diagnostics; never emit credentials or raw API payloads."""
import json
import os
import re
import sys
import urllib.error
import urllib.request

# This candidate is already documented in cloudflare/wrangler.toml. A successful
# read establishes access, not deployment acceptance or staging/production identity.
ACCOUNT = "e0921b840fd656d8ea46426f1f114c30"
ORIGIN = "https://api.cloudflare.com/client/v4"
WORKERS = {"ucc-mca-edge", "ucc-mca-edge-staging", "ucc-mca-edge-production"}
MAX_BYTES = 2_000_000


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def request_json(path, token):
    """Only caller-constructed account paths are permitted; responses stay memory-only."""
    if not (path == "/user/tokens/verify" or path == f"/accounts/{ACCOUNT}"
            or path.startswith(f"/accounts/{ACCOUNT}/")):
        raise ValueError("Endpoint outside diagnostic scope")
    if not token or any(ord(char) < 33 or ord(char) > 126 for char in token):
        return {"success": False, "invalid_credential_format": True}, {}
    try:
        request = urllib.request.Request(
            ORIGIN + path, method="GET",
            headers={"Authorization": "Bearer " + token, "Accept": "application/json"},
        )
        opener = urllib.request.build_opener(NoRedirect())
        try:
            response = opener.open(request, timeout=20)
        except urllib.error.HTTPError as exc:
            response = exc
        with response:
            raw = response.read(MAX_BYTES + 1)
            status = response.code
    except Exception:
        # Header, protocol and read exceptions can contain raw credential/payload
        # text. Never propagate or stringify them from this narrow transport scope.
        return {"success": False, "transport_error": True}, {}
    receipt = {"http_status": status, "success": False}
    if len(raw) > MAX_BYTES:
        return {**receipt, "response_too_large": True}, {}
    try:
        payload = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        return {**receipt, "invalid_json": True}, {}
    if not isinstance(payload, dict):
        return {**receipt, "invalid_shape": True}, {}
    receipt["success"] = status == 200 and payload.get("success") is True
    errors = payload.get("errors")
    receipt["error_codes"] = [
        item["code"] for item in (errors if isinstance(errors, list) else [])
        if isinstance(item, dict) and type(item.get("code")) is int
    ][:10]
    return receipt, payload


def emit(report):
    text = json.dumps(report, indent=2, sort_keys=True)
    print(text)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as handle:
            handle.write("### Read-only Cloudflare provisioning diagnostics\n\n")
            handle.write("Account access and matching metadata are observations; no resources were changed.\n\n")
            handle.write("```json\n" + text + "\n```\n")


def main():
    token = os.environ.get("CLOUDFLARE_API_TOKEN", "")
    configured_account = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
    report = {
        "candidate_account_id": ACCOUNT,
        "api_token_present": bool(token),
        "account_override_present": bool(configured_account),
        "account_override_matches_documented_candidate": configured_account == ACCOUNT if configured_account else None,
        "cloudflare_writes": False,
        "deployment_verified": False,
        "checks": {},
    }
    if not token:
        report["diagnosis"] = "missing_CLOUDFLARE_API_TOKEN"
        emit(report)
        return 1
    if configured_account and configured_account != ACCOUNT:
        report["diagnosis"] = "configured_account_differs_from_documented_candidate_no_requests_sent"
        emit(report)
        return 1
    checks = report["checks"]
    for kind, path in [
        ("account_token", f"/accounts/{ACCOUNT}/tokens/verify"),
        ("user_token", "/user/tokens/verify"),
    ]:
        receipt, payload = request_json(path, token)
        result = payload.get("result")
        if receipt["success"] and isinstance(result, dict):
            state = result.get("status")
            receipt["token_status"] = state if state in {"active", "disabled", "expired"} else "unknown"
        checks[kind] = receipt
    receipt, payload = request_json(f"/accounts/{ACCOUNT}", token)
    result = payload.get("result")
    receipt["returned_account_matches"] = bool(receipt["success"] and isinstance(result, dict) and result.get("id") == ACCOUNT)
    checks["account"] = receipt
    for kind, suffix, name_key, id_key, name_ok, id_pattern in [
        ("d1", "/d1/database?name=ucc-mca&per_page=100&page=1", "name", "uuid",
         lambda value: re.fullmatch(r"ucc-mca(?:-[a-z0-9_-]+)?", value), r"[a-fA-F0-9-]{36}"),
        ("kv", "/storage/kv/namespaces?per_page=1000&page=1", "title", "id",
         lambda value: re.fullmatch(r"ucc[-_]mca[-_][A-Za-z0-9_-]+", value, re.I), r"[a-fA-F0-9]{32}"),
        ("workers", "/workers/scripts", "id", "id",
         lambda value: value in WORKERS, r"ucc-mca-edge(?:-(?:staging|production))?"),
    ]:
        receipt, payload = request_json(f"/accounts/{ACCOUNT}" + suffix, token)
        matches = []
        rows = payload.get("result")
        if receipt["success"] and isinstance(rows, list):
            for row in rows:
                if not isinstance(row, dict):
                    continue
                name, identifier = row.get(name_key), row.get(id_key)
                if isinstance(name, str) and isinstance(identifier, str) and name_ok(name) and re.fullmatch(id_pattern, identifier):
                    matches.append({"name": name, "id": identifier})
            info = payload.get("result_info", {})
            total = info.get("total_count") if isinstance(info, dict) else None
            receipt["list_complete"] = kind == "workers" or (total <= len(rows) if type(total) is int else len(rows) < (1000 if kind == "kv" else 100))
        else:
            if receipt["success"]:
                receipt["success"] = False
                receipt["invalid_shape"] = True
            receipt["list_complete"] = False
        receipt["matching_ucc_resources"] = matches
        checks[kind] = receipt
    account_access = checks["account"].get("returned_account_matches") or any(checks[k]["success"] for k in ["d1", "kv", "workers"])
    matched = any(checks[k]["matching_ucc_resources"] for k in ["d1", "kv", "workers"])
    report["candidate_account_access_verified"] = bool(account_access)
    report["ucc_resource_metadata_observed"] = matched
    report["staging_production_binding_identity_verified"] = False
    if account_access:
        report["diagnosis"] = "candidate_account_accessible_explicit_account_configuration_can_avoid_membership_discovery"
    elif any(checks[k].get("token_status") == "active" for k in ["account_token", "user_token"]):
        report["diagnosis"] = "active_token_but_candidate_resource_access_not_established"
    else:
        report["diagnosis"] = "token_validity_or_candidate_access_unresolved_see_endpoint_status_codes"
    emit(report)
    return 0 if account_access else 1


if __name__ == "__main__":
    sys.exit(main())
