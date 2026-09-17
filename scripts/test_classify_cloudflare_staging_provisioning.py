import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


SPEC = importlib.util.spec_from_file_location(
    "classifier", Path(__file__).with_name("classify-cloudflare-staging-provisioning.py")
)
C = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(C)


class ClassifyCloudflareProvisioningTests(unittest.TestCase):
    def test_ready_receipt_allows_deploy_steps(self):
        status, ready, summary = C.classify_report({"status": "ready"})

        self.assertEqual(status, 0)
        self.assertTrue(ready)
        self.assertEqual(summary, "")

    def test_credential_denial_is_successful_external_block(self):
        status, ready, summary = C.classify_report(
            {
                "status": "blocked",
                "blocker": {
                    "code": "cloudflare_request_denied_or_failed",
                    "operation": "list_d1",
                    "http_status": 401,
                    "error_codes": [10000],
                },
            }
        )

        self.assertEqual(status, 0)
        self.assertFalse(ready)
        self.assertIn("list_d1", summary)
        self.assertIn("HTTP 401", summary)
        self.assertIn("remote mutation was skipped", summary)

    def test_source_configuration_failure_still_fails(self):
        report = {"status": "blocked", "blocker": {"code": "path_outside_repository"}}
        status, ready, summary = C.classify_report(report)

        self.assertEqual(status, 1)
        self.assertFalse(ready)
        self.assertEqual(json.loads(summary), report)

    def test_main_writes_github_outputs_and_summary_for_external_block(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            generated = root / "cloudflare/.generated"
            generated.mkdir(parents=True)
            (generated / "staging-provisioning.json").write_text(
                json.dumps(
                    {
                        "status": "blocked",
                        "blocker": {
                            "code": "cloudflare_request_denied_or_failed",
                            "operation": "list_access",
                            "http_status": 403,
                        },
                    }
                ),
                encoding="utf-8",
            )
            output = root / "github-output"
            summary = root / "github-summary"

            with patch.dict(
                os.environ,
                {"GITHUB_OUTPUT": str(output), "GITHUB_STEP_SUMMARY": str(summary)},
            ):
                cwd = Path.cwd()
                try:
                    os.chdir(root)
                    self.assertEqual(C.main(), 0)
                finally:
                    os.chdir(cwd)

            self.assertIn("provisioning_ready=false", output.read_text(encoding="utf-8"))
            self.assertIn("credential_blocked=true", output.read_text(encoding="utf-8"))
            self.assertIn("list_access", summary.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
