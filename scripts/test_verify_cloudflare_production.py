import importlib.util
import os
from pathlib import Path
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location(
    "production_verifier", Path(__file__).with_name("verify-cloudflare-production.py")
)
V = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(V)


class ProductionVerifierTests(unittest.TestCase):
    def setUp(self):
        self.sha = "a" * 40
        self.config = {
            "name": "ucc-mca-edge-production",
            "account_id": "account",
            "vars": {
                "ENVIRONMENT": "production",
                "DEPLOYMENT_SHA": self.sha,
                "ACCESS_TEAM_DOMAIN": "example.cloudflareaccess.com",
            },
        }
        self.resolution = {
            "status": "ready",
            "revision": self.sha,
            "account_id": "account",
            "worker_url": "https://ucc-mca-edge-production.example.workers.dev",
        }

    def requester(self, origin, path, forged=False):
        if path.startswith("/health"):
            return 200, {"ok": True, "env": "production", "revision": self.sha}, "", "application/json"
        return 302, None, "https://example.cloudflareaccess.com/cdn-cgi/access/login/test", "text/html"

    def test_exact_revision_and_authentication_boundary(self):
        with patch.object(V.V, "read_json", side_effect=[self.config, self.resolution, []]), \
             patch.object(V.V, "validate_schema"), \
             patch.dict(os.environ, {"GITHUB_SHA": self.sha}):
            result = V.verify(self.requester)
        self.assertTrue(result["deployment_verified"])
        self.assertTrue(result["schema_verified"])

    def test_configuration_rejects_stale_revision(self):
        self.config["vars"]["DEPLOYMENT_SHA"] = "b" * 40
        with patch.object(V.V, "read_json", side_effect=[self.config, self.resolution]), \
             patch.dict(os.environ, {"GITHUB_SHA": self.sha}):
            with self.assertRaisesRegex(V.V.VerificationError, "production_revision_mismatch"):
                V.verify(self.requester, configuration_only=True)


if __name__ == "__main__":
    unittest.main()
