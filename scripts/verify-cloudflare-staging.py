"""Reject missing or placeholder staging targets before remote mutations."""
from pathlib import Path
import re
import sys
import tomllib
import uuid

VERIFIED_ACCOUNT = "e0921b840fd656d8ea46426f1f114c30"


def validate_staging(config):
    envs = config.get("env", {})
    staging = envs.get("staging", {})
    production = envs.get("production", {})
    errors = []
    if staging.get("account_id") != VERIFIED_ACCOUNT:
        errors.append("staging.account_id must select the API-verified account")

    def binding(env, collection, field):
        rows = env.get(collection, [])
        target = "DB" if collection == "d1_databases" else "KV"
        if not isinstance(rows, list):
            return ""
        matches = [row for row in rows if isinstance(row, dict) and row.get("binding") == target]
        return matches[0].get(field, "") if len(matches) == 1 else ""

    database = binding(staging, "d1_databases", "database_id")
    namespace = binding(staging, "kv_namespaces", "id")
    try:
        valid_database = bool(uuid.UUID(database).int)
    except (ValueError, AttributeError, TypeError):
        valid_database = False
    if not valid_database:
        errors.append("staging DB database_id must be a provisioned, nonzero UUID")
    if not isinstance(namespace, str) or not re.fullmatch(r"[0-9a-fA-F]{32}", namespace) or not namespace.strip("0"):
        errors.append("staging KV id must be a provisioned, nonzero namespace ID")
    production_database = binding(production, "d1_databases", "database_id")
    production_namespace = binding(production, "kv_namespaces", "id")
    try:
        shared_database = valid_database and uuid.UUID(database) == uuid.UUID(production_database)
    except (ValueError, AttributeError, TypeError):
        shared_database = False
    if shared_database:
        errors.append("staging DB must be distinct from production DB")
    if isinstance(namespace, str) and namespace and isinstance(production_namespace, str) and namespace.lower() == production_namespace.lower():
        errors.append("staging KV must be distinct from production KV")

    variables = staging.get("vars", {})
    domain = variables.get("ACCESS_TEAM_DOMAIN", "")
    audience = variables.get("ACCESS_AUD", "")
    if not isinstance(domain, str) or not re.fullmatch(r"[a-z0-9-]+\.cloudflareaccess\.com", domain) or domain == "your-team.cloudflareaccess.com":
        errors.append("staging ACCESS_TEAM_DOMAIN must identify the configured Access team")
    if not isinstance(audience, str) or not audience.strip() or re.match(r"(?:REPLACE|YOUR|EXAMPLE|PLACEHOLDER)", audience, re.I):
        errors.append("staging ACCESS_AUD must identify the configured Access application")
    return errors


def main():
    path = Path(__file__).resolve().parents[1] / "cloudflare" / "wrangler.toml"
    with path.open("rb") as handle:
        config = tomllib.load(handle)
    errors = validate_staging(config)
    for error in errors:
        print("::error::" + error)
    if errors:
        print("Staging provisioning is incomplete; no migrations or deployment were attempted.")
        return 1
    print("Staging binding configuration is explicit and distinct; resource access remains a separate deployment check.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
