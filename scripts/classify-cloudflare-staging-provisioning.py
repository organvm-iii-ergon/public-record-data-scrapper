#!/usr/bin/env python3
"""Classify staging provisioning receipts for the deploy workflow."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


EXTERNAL_CAPABILITY_OPERATIONS = {
    "account",
    "list_workers",
    "list_d1",
    "list_kv",
    "list_r2",
    "list_access",
    "access_organization",
    "workers_subdomain",
}


def write_output(path: Path, name: str, value: str) -> None:
    with path.open("a", encoding="utf-8") as handle:
        handle.write(f"{name}={value}\n")


def classify_report(report: dict[str, Any]) -> tuple[int, bool, str]:
    if report.get("status") == "ready":
        return 0, True, ""

    blocker = report.get("blocker", {})
    code = blocker.get("code")
    operation = blocker.get("operation")
    http_status = blocker.get("http_status")

    is_external_capability_block = (
        report.get("status") == "blocked"
        and code == "cloudflare_request_denied_or_failed"
        and operation in EXTERNAL_CAPABILITY_OPERATIONS
        and http_status in {401, 403}
    )

    if is_external_capability_block:
        error_codes = blocker.get("error_codes", [])
        summary = (
            "Accepted `main` stayed inside the verified source boundary, but the staging "
            f"token could not complete `{operation}`"
        )
        if http_status is not None:
            summary += f" (HTTP {http_status})"
        if error_codes:
            summary += f" with provider codes {error_codes}"
        summary += ". The sanitized provisioning receipt was preserved and remote mutation was skipped."
        return 0, False, summary

    return 1, False, json.dumps(report, indent=2, sort_keys=True)


def main() -> int:
    report_path = Path("cloudflare/.generated/staging-provisioning.json")
    if not report_path.is_file():
        raise SystemExit("missing staging provisioning receipt")

    report = json.loads(report_path.read_text(encoding="utf-8"))
    exit_status, provisioning_ready, summary = classify_report(report)

    output_path = Path(os.environ["GITHUB_OUTPUT"])
    write_output(output_path, "provisioning_ready", "true" if provisioning_ready else "false")
    write_output(output_path, "credential_blocked", "true" if summary and not provisioning_ready else "false")

    if summary:
        summary_path = Path(os.environ["GITHUB_STEP_SUMMARY"])
        with summary_path.open("a", encoding="utf-8") as handle:
            handle.write("## Staging deploy blocked outside the repository\n\n")
            handle.write(summary)
            handle.write("\n")

    if exit_status != 0:
        print(summary)
        raise SystemExit("staging provisioning failed for a source/configuration reason")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
