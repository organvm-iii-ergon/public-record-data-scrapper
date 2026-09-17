import contextlib
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location(
    "production_resolver", Path(__file__).with_name("resolve-cloudflare-production.py")
)
R = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(R)

D1_PROD = "12345678-1234-4234-8234-123456789abc"
D1_STAGE = "22345678-1234-4234-8234-123456789abc"
APP_PROD = "32345678-1234-4234-8234-123456789abc"
APP_STAGE = "42345678-1234-4234-8234-123456789abc"
PAGES_APP_PROD = "52345678-1234-4234-8234-123456789abc"
PAGES_APP_STAGE = "62345678-1234-4234-8234-123456789abc"
KV_PROD = "0123456789abcdef0123456789abcdef"
KV_STAGE = "1123456789abcdef0123456789abcdef"
AUD = "a" * 64


class FakeAPI:
    def __init__(self):
        self.calls = []
        self.rows = {
            "d1": [
                {"name": R.NAMES["d1"], "uuid": D1_PROD},
                {"name": R.STAGING_NAMES["d1"], "uuid": D1_STAGE},
            ],
            "kv": [
                {"title": R.NAMES["kv"], "id": KV_PROD},
                {"title": R.STAGING_NAMES["kv"], "id": KV_STAGE},
            ],
            "r2": [
                {"name": R.NAMES["r2"]},
                {"name": R.STAGING_NAMES["r2"]},
            ],
            "access": [
                {"name": R.NAMES["access"], "id": APP_PROD, "aud": AUD,
                 "type": "self_hosted", "domain": "ucc-mca-edge-production.example.workers.dev/api/*"},
                {"name": R.STAGING_NAMES["access"], "id": APP_STAGE, "aud": "b" * 64,
                 "type": "self_hosted", "domain": "ucc-mca-edge-staging.example.workers.dev/api/*"},
                {"name": R.PAGES_ACCESS, "id": PAGES_APP_PROD, "aud": "c" * 64,
                 "type": "self_hosted", "domain": "ucc-mca-dashboard.pages.dev"},
                {"name": R.STAGING_PAGES_ACCESS, "id": PAGES_APP_STAGE, "aud": "d" * 64,
                 "type": "self_hosted", "domain": "ucc-mca-dashboard-staging.pages.dev"},
            ],
        }

    def factory(self, token, report):
        if not token:
            raise R.P.Blocked("missing_or_invalid_CLOUDFLARE_API_TOKEN")
        return self

    def request(self, operation, path, method="GET", body=None):
        self.calls.append((operation, method))
        if method != "GET":
            raise AssertionError("production resolution must be read-only")
        if operation == "account":
            return {"result": {"id": R.P.ACCOUNT}}
        if operation == "access_organization":
            return {"result": {"auth_domain": "example.cloudflareaccess.com"}}
        if operation == "workers_subdomain":
            return {"result": {"subdomain": "example"}}
        if operation == "list_access_policies":
            return {"result": [{"id": "policy", "decision": "allow",
                                "include": [{"everyone": {}}]}],
                    "result_info": {"total_count": 1}}
        kind = operation.removeprefix("list_")
        rows = copy.deepcopy(self.rows[kind])
        result = {"buckets": rows} if kind == "r2" else rows
        return {"result": result, "result_info": {"total_count": len(rows),
                "per_page": {"d1": 100, "kv": 1000, "r2": 1000, "access": 50}[kind]}}


class ProductionResolverTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / "cloudflare/workers/api/src").mkdir(parents=True)
        (self.root / "cloudflare/workers/api/src/index.ts").touch()
        (self.root / "cloudflare/migrations").mkdir()
        source = Path(__file__).parents[1] / "cloudflare/wrangler.toml"
        (self.root / "cloudflare/wrangler.toml").write_text(source.read_text())
        self.api = FakeAPI()

    def run_case(self):
        stream = io.StringIO()
        with patch.dict(os.environ, {"CLOUDFLARE_API_TOKEN": "test-token", "GITHUB_SHA": "a" * 40}), contextlib.redirect_stdout(stream):
            status = R.run(self.root, self.api.factory)
        return status, json.loads(stream.getvalue())

    def test_resolves_existing_isolated_resources_without_writes(self):
        status, report = self.run_case()
        self.assertEqual((status, report["status"]), (0, "ready"))
        self.assertTrue(all(method == "GET" for _, method in self.api.calls))
        config = json.loads(
            (self.root / "cloudflare/.generated/production.wrangler.json").read_text()
        )
        self.assertEqual(config["d1_databases"][0]["database_id"], D1_PROD)
        self.assertEqual(config["vars"]["DEPLOYMENT_SHA"], "a" * 40)
        self.assertEqual(config["vars"]["ACCESS_AUD"], AUD + "," + "c" * 64)
        self.assertEqual(report["production_writes"], False)

    def test_missing_or_shared_resource_fails_closed(self):
        self.api.rows["kv"] = self.api.rows["kv"][1:]
        status, report = self.run_case()
        self.assertEqual(status, 1)
        self.assertEqual(report["blocker"]["code"], "production_resource_missing_or_ambiguous")

        self.api = FakeAPI()
        self.api.rows["d1"][1]["uuid"] = D1_PROD
        status, report = self.run_case()
        self.assertEqual(status, 1)
        self.assertEqual(report["blocker"]["code"], "duplicate_resource_or_repeated_page")


if __name__ == "__main__":
    unittest.main()
