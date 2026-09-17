#!/usr/bin/env python3
"""Prepare and verify the existing UCC ruleset; never call GitHub or mutate settings."""

import argparse
import copy
import json
import sys


REPOSITORY = "organvm-iii-ergon/public-record-data-scrapper"
RULESET_ID = 12671627
GITHUB_ACTIONS_APP_ID = 15368
REQUIRED_CONTEXTS = ("gate", "validate-dependencies")
WRITE_FIELDS = ("name", "target", "enforcement", "bypass_actors", "conditions", "rules")


def writable(snapshot):
    missing = set(WRITE_FIELDS) - snapshot.keys()
    if missing:
        # Public API reads can omit bypass actors. Do not replace undisclosed policy.
        raise ValueError(f"Incomplete ruleset snapshot: missing {', '.join(sorted(missing))}")
    return {key: copy.deepcopy(snapshot[key]) for key in WRITE_FIELDS}


def validate_identity(snapshot):
    if snapshot.get("id") != RULESET_ID or snapshot.get("source") != REPOSITORY:
        raise ValueError("Snapshot is not the existing UCC dependency ruleset")
    if snapshot.get("source_type") != "Repository" or snapshot.get("target") != "branch":
        raise ValueError("Expected a repository branch ruleset")
    ref_name = snapshot.get("conditions", {}).get("ref_name", {})
    if ref_name.get("include") != ["~DEFAULT_BRANCH"]:
        raise ValueError("Default-branch scope changed; re-review the settings plan")
    if ref_name.get("exclude"):
        raise ValueError("Branch exclusions require a policy review before activation")


def desired_settings(snapshot):
    validate_identity(snapshot)
    result = writable(snapshot)
    if not isinstance(result["rules"], list):
        raise ValueError("Expected an array of rules")
    status_rules = [rule for rule in result["rules"] if rule.get("type") == "required_status_checks"]
    if len(status_rules) != 1:
        raise ValueError("Expected exactly one existing required-status-checks rule")
    params = status_rules[0].get("parameters")
    if not isinstance(params, dict) or not isinstance(params.get("required_status_checks"), list):
        raise ValueError("Missing required-status-check parameters")
    contexts = params["required_status_checks"]
    for context in REQUIRED_CONTEXTS:
        matches = [check for check in contexts if check.get("context") == context]
        if len(matches) > 1:
            raise ValueError(f"Duplicate existing required context: {context}")
        if matches:
            previous_app = matches[0].get("integration_id")
            if previous_app not in (None, GITHUB_ACTIONS_APP_ID):
                raise ValueError(f"Required context {context} has a different publisher; review policy")
            matches[0]["integration_id"] = GITHUB_ACTIONS_APP_ID
        else:
            contexts.append({"context": context, "integration_id": GITHUB_ACTIONS_APP_ID})
    params["strict_required_status_checks_policy"] = True
    params["do_not_enforce_on_create"] = False
    result["enforcement"] = "active"
    return result


def canonical(settings):
    result = copy.deepcopy(settings)
    # GitHub may reorder arrays on readback; do not treat order as a control.
    for rule in result["rules"]:
        if rule.get("type") == "required_status_checks":
            checks = rule["parameters"]["required_status_checks"]
            checks.sort(key=lambda value: json.dumps(value, sort_keys=True))
    result["rules"].sort(key=lambda value: json.dumps(value, sort_keys=True))
    result["bypass_actors"].sort(key=lambda value: json.dumps(value, sort_keys=True))
    return result


def verify_readback(snapshot, readback):
    validate_identity(readback)
    expected = canonical(desired_settings(snapshot))
    actual = canonical(writable(readback))
    differences = [key for key in WRITE_FIELDS if expected[key] != actual[key]]
    if differences:
        raise ValueError(f"Settings readback differs from the reviewed plan: {', '.join(differences)}")
    return {
        "settings_match": True,
        "automatic_acceptance_verified": False,
        "limitation": "Settings readback is not trusted-workflow, freshness, or live-canary evidence.",
    }


def make_plan(snapshot):
    return {
        "repository": REPOSITORY,
        "ruleset_id": RULESET_ID,
        "status": "staged_only",
        "settings_applied": False,
        "automatic_acceptance_verified": False,
        "activation_preconditions": [
            "Maintenance workflow repairs are accepted on main; refresh this ruleset snapshot immediately before applying.",
            "Observe successful gate and validate-dependencies checks from their reviewed workflows on the current accepted main revision.",
            "Verify their workflow paths, run IDs, attempts, tested SHA, and publisher through authenticated API evidence, not names alone.",
            "Apply through an existing Administration-write channel, then verify the complete readback and live failing-check/stale-base canaries.",
        ],
        "trust_boundary": "github-actions App 15368 can publish other workflows with identical names. These checks alone never authorize delegated review or automatic acceptance.",
        "request": {
            "method": "PUT",
            "url": f"https://api.github.com/repos/{REPOSITORY}/rulesets/{RULESET_ID}",
            "body": desired_settings(snapshot),
        },
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", required=True, help="Complete GET ruleset JSON, including bypass_actors")
    parser.add_argument("--readback", help="Verify a later GET against the original snapshot's exact proposed settings")
    args = parser.parse_args()
    try:
        with open(args.snapshot, encoding="utf-8") as handle:
            snapshot = json.load(handle)
        if args.readback:
            with open(args.readback, encoding="utf-8") as handle:
                output = verify_readback(snapshot, json.load(handle))
        else:
            output = make_plan(snapshot)
        print(json.dumps(output, indent=2))
        return 0
    except (ValueError, TypeError, KeyError, OSError) as error:
        print(f"ruleset-plan: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
