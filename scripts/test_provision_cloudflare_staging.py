"""Offline provider counterexamples: no credentials or network required."""
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
import urllib.parse

SPEC = importlib.util.spec_from_file_location("provision", Path(__file__).with_name("provision-cloudflare-staging.py"))
P = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(P)
D1 = "12345678-1234-4234-8234-123456789abc"
APP = "98765432-1234-4234-8234-123456789abc"
KV = "0123456789abcdef0123456789abcdef"
AUD = "a" * 64
SECRET = "sensitive-token-must-not-appear"


class FakeAPI:
    def __init__(self):
        self.rows = {kind: [] for kind in P.NAMES}
        self.calls = []
        self.denied = None
        self.overrides = {}
        self.workers = []
        self.policies = []
        self.created = {"d1": {"name": P.NAMES["d1"], "uuid": D1},
                        "kv": {"title": P.NAMES["kv"], "id": KV},
                        "r2": {"name": P.NAMES["r2"]},
                        "access": {"name": P.NAMES["access"], "id": APP, "aud": AUD,
                                   "type": "self_hosted", "domain": P.WORKER + ".example.workers.dev/api/*"}}

    def factory(self, token, report):
        self.report = report
        return self

    def request(self, operation, path, method="GET", body=None):
        self.calls.append((operation, path, method, copy.deepcopy(body)))
        if operation == self.denied:
            raise P.Blocked("cloudflare_request_denied_or_failed", operation=operation, http_status=401)
        if operation in self.overrides:
            override = self.overrides[operation]
            return override(path) if callable(override) else copy.deepcopy(override)
        if operation == "account":
            return {"result": {"id": P.ACCOUNT}}
        if operation == "access_organization":
            return {"result": {"auth_domain": "example.cloudflareaccess.com"}}
        if operation == "workers_subdomain":
            return {"result": {"subdomain": "example"}}
        if operation == "list_workers":
            return {"result": self.workers}
        if operation == "list_access_policies":
            return {"result": self.policies, "result_info": {"total_count": len(self.policies)}}
        kind = operation.split("_", 1)[1]
        if method == "POST":
            result = copy.deepcopy(self.created[kind])
            self.rows[kind].append(result)
            return {"result": result}
        rows = copy.deepcopy(self.rows[kind])
        return {"result": {"buckets": rows} if kind == "r2" else rows,
                "result_info": {"total_count": len(rows), "per_page": 1000 if kind == "r2" else {"d1": 100, "kv": 1000, "access": 50}[kind]}}

    @property
    def writes(self):
        return [c for c in self.calls if c[2] != "GET"]


class ProvisionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / "cloudflare/workers/api/src").mkdir(parents=True)
        (self.root / "cloudflare/workers/api/src/index.ts").touch()
        (self.root / "cloudflare/migrations").mkdir()
        self.source = Path(__file__).parents[1] / "cloudflare/wrangler.toml"
        self.config_path = self.root / "cloudflare/wrangler.toml"
        self.config_path.write_text(self.source.read_text())
        self.api = FakeAPI()

    def run_case(self, apply=True):
        stream = io.StringIO()
        with patch.dict(os.environ, {"CLOUDFLARE_API_TOKEN": SECRET, "CLOUDFLARE_ACCOUNT_ID": "", "GITHUB_SHA": "a" * 40}), contextlib.redirect_stdout(stream):
            status = P.run(self.root, apply, self.api.factory)
        self.assertNotIn(SECRET, stream.getvalue())
        return status, json.loads(stream.getvalue())

    def test_plan_reads_all_capabilities_and_does_not_create(self):
        status, report = self.run_case(False)
        self.assertEqual((status, report["status"]), (0, "planned"))
        self.assertEqual(self.api.writes, [])
        self.assertFalse((self.root / "cloudflare/.generated/staging.wrangler.json").exists())
        self.assertIn("access_organization", [c[0] for c in self.api.calls])

    def test_preflight_denial_at_every_endpoint_makes_zero_mutations(self):
        for operation in ["account", "list_workers", "list_d1", "list_kv", "list_r2", "list_access", "access_organization", "workers_subdomain"]:
            with self.subTest(operation=operation):
                self.api = FakeAPI()
                self.api.denied = operation
                status, report = self.run_case()
                self.assertEqual(status, 1)
                self.assertEqual(report["blocker"]["http_status"], 401)
                self.assertEqual(self.api.writes, [])

    def test_create_readback_then_repeat_reuses_every_resource(self):
        status, report = self.run_case()
        self.assertEqual((status, report["status"]), (0, "ready"))
        self.assertEqual(len(self.api.writes), 4)
        config = json.loads((self.root / "cloudflare/.generated/staging.wrangler.json").read_text())
        self.assertEqual(config["name"], P.WORKER)
        self.assertNotIn("env", config)
        self.assertEqual(config["d1_databases"][0]["database_name"], P.NAMES["d1"])
        self.assertTrue(Path(config["main"]).is_absolute())
        self.assertEqual(config["vars"]["ACCESS_AUD"], AUD)
        self.assertEqual(config["vars"]["DEPLOYMENT_SHA"], "a" * 40)
        self.assertFalse(report["access_enrollment_verified"])
        self.assertIsNone(report["prior_deployment"])
        self.assertEqual(self.api.writes[-1][3]["policies"], [])
        self.api.calls.clear()
        status, report = self.run_case()
        self.assertEqual(status, 0)
        self.assertEqual(self.api.writes, [])
        self.assertTrue(all(r["action"] == "reuse" for r in report["resources"]))

    def test_duplicate_name_and_repeated_ids_fail_before_create(self):
        for second in [self.api.created["d1"], {"name": P.NAMES["d1"], "uuid": APP}]:
            self.api = FakeAPI()
            self.api.rows["d1"] = [self.api.created["d1"], second]
            status, report = self.run_case()
            self.assertEqual(status, 1)
            self.assertEqual(self.api.writes, [])

    def test_total_count_gap_and_r2_cursor_cycle_fail_without_mutations(self):
        self.api.overrides["list_d1"] = {"result": [], "result_info": {"total_count": 1}}
        self.assertEqual(self.run_case()[0], 1)
        self.assertEqual(self.api.writes, [])
        self.api = FakeAPI()
        self.api.overrides["list_r2"] = {"result": {"buckets": [{"name": "existing-bucket"}]}, "result_info": {"cursor": "repeat"}}
        self.assertEqual(self.run_case()[0], 1)
        self.assertEqual(self.api.writes, [])

    def test_pagination_reaches_later_exact_resource(self):
        def page(path):
            number = int(urllib.parse.parse_qs(urllib.parse.urlparse(path).query)["page"][0])
            row = {"name": "unrelated", "uuid": APP} if number == 1 else self.api.created["d1"]
            return {"result": [row], "result_info": {"page": number, "per_page": 1, "total_count": 2, "total_pages": 2}}
        self.api.overrides["list_d1"] = page
        status, report = self.run_case(False)
        self.assertEqual(status, 0)
        self.assertEqual(report["resources"][0]["action"], "reuse")

    def test_shared_production_ids_block_uuid_alias_and_kv_case(self):
        for kind, placeholder, value in [("d1", "REPLACE_WITH_PRODUCTION_D1_ID", D1.replace("-", "").upper()), ("kv", "REPLACE_WITH_PRODUCTION_KV_ID", KV.upper())]:
            self.config_path.write_text(self.source.read_text().replace(placeholder, value))
            self.api = FakeAPI()
            self.api.rows[kind] = [self.api.created[kind]]
            status, report = self.run_case()
            self.assertEqual(status, 1)
            self.assertEqual(report["blocker"]["code"], "staging_resource_shared_with_production")
            self.assertEqual(self.api.writes, [])

    def test_create_name_mismatch_stops_following_writes(self):
        self.api.created["d1"]["name"] = "production"
        status, report = self.run_case()
        self.assertEqual(status, 1)
        self.assertEqual(report["blocker"]["code"], "created_resource_name_mismatch")
        self.assertEqual(len(self.api.writes), 1)

    def test_denied_create_stops_and_next_run_reuses_partial_progress(self):
        self.api.denied = "create_kv"
        status, report = self.run_case()
        self.assertEqual(status, 1)
        self.assertEqual([c[0] for c in self.api.writes], ["create_d1", "create_kv"])
        self.assertFalse((self.root / "cloudflare/.generated/staging.wrangler.json").exists())
        self.api.denied = None
        self.api.calls.clear()
        status, report = self.run_case()
        self.assertEqual(status, 0)
        self.assertEqual([c[0] for c in self.api.writes], ["create_kv", "create_r2", "create_access"])
        self.assertEqual(report["resources"][0]["action"], "reuse")

    def test_success_response_without_matching_readback_is_not_accepted(self):
        self.api.overrides["list_d1"] = {"result": [], "result_info": {"total_count": 0}}
        status, report = self.run_case()
        self.assertEqual(status, 1)
        self.assertEqual(report["blocker"]["code"], "resource_readback_mismatch")
        self.assertEqual(len(self.api.writes), 1)

    def test_r2_follows_cursor_and_reuses_later_bucket(self):
        def page(path):
            query = urllib.parse.parse_qs(urllib.parse.urlparse(path).query)
            if "cursor" not in query:
                return {"result": {"buckets": [{"name": "another-bucket"}]}, "result_info": {"cursor": "next/+="}}
            self.assertEqual(query["cursor"], ["next/+="])
            return {"result": {"buckets": [self.api.created["r2"]]}, "result_info": {}}
        self.api.overrides["list_r2"] = page
        status, report = self.run_case(False)
        self.assertEqual(status, 0)
        self.assertEqual(next(r for r in report["resources"] if r["kind"] == "r2")["action"], "reuse")

    def test_missing_org_and_unsafe_existing_access_do_not_create(self):
        self.api.overrides["access_organization"] = {"result": {}}
        self.assertEqual(self.run_case()[0], 1)
        self.assertEqual(self.api.writes, [])
        for patch_data in [{"domain": "production.example.workers.dev/api/*"}, {"destinations": [{"type": "all_workers"}]}]:
            self.api = FakeAPI()
            self.api.rows["access"] = [{**self.api.created["access"], **patch_data}]
            self.assertEqual(self.run_case()[0], 1)
            self.assertEqual(self.api.writes, [])

    def test_existing_authenticated_policies_are_preserved_on_redeploy(self):
        for decision in ["allow", "non_identity"]:
            self.api = FakeAPI()
            self.api.rows = {kind: [row] for kind, row in self.api.created.items()}
            self.api.policies = [{"id": APP, "decision": decision, "include": [{"email": {"email": "owner@example.test"}}]}]
            status, report = self.run_case()
            self.assertEqual(status, 0)
            self.assertFalse(report["access_enrollment_verified"])
            self.assertEqual(self.api.writes, [])

    def test_existing_bypass_policy_does_not_pass_authentication_gate(self):
        self.api.rows["access"] = [self.api.created["access"]]
        self.api.policies = [{"id": APP, "decision": "bypass", "include": [{"everyone": {}}]}]
        status, report = self.run_case()
        self.assertEqual(status, 1)
        self.assertEqual(report["blocker"]["code"], "existing_access_policy_bypasses_authentication_or_is_unknown")
        self.assertEqual(self.api.writes, [])

    def test_symlink_source_or_output_never_mutates(self):
        self.config_path.unlink()
        self.config_path.symlink_to(self.source)
        self.assertEqual(self.run_case()[0], 1)
        self.assertEqual(self.api.calls, [])
        self.config_path.unlink()
        self.config_path.write_text(self.source.read_text())
        output = self.root / "cloudflare/.generated"
        output.mkdir(exist_ok=True)
        (output / "staging.wrangler.json").symlink_to(self.config_path)
        self.assertEqual(self.run_case()[0], 1)
        self.assertEqual(self.api.calls, [])

    def test_unexpected_exception_never_leaks_token(self):
        self.api.overrides["list_d1"] = lambda path: (_ for _ in ()).throw(RuntimeError(SECRET))
        status, report = self.run_case()
        self.assertEqual(status, 1)
        self.assertEqual(report["blocker"]["code"], "unexpected_provisioning_failure")
        self.assertEqual(self.api.writes, [])

    def test_predecessor_is_captured_without_author_email(self):
        self.api.workers = [{"id": P.WORKER}]
        self.api.overrides["staging_deployments"] = {"result": {"deployments": [{"id": APP, "versions": [{"version_id": D1, "percentage": 100}], "author_email": SECRET}]}}
        status, report = self.run_case(False)
        self.assertEqual(status, 0)
        self.assertEqual(report["prior_deployment"]["id"], APP)
        self.assertEqual(set(report["prior_deployment"]), {"id", "versions"})


class TransportTests(unittest.TestCase):
    def test_redirects_are_refused(self):
        self.assertIsNone(P.NoRedirect().redirect_request(None, None, 302, "", {}, "https://attacker.invalid"))

    def test_request_or_response_exceptions_are_sanitized(self):
        api = P.API(SECRET, {"requests": []})
        with patch.object(api.opener, "open", side_effect=RuntimeError(SECRET)):
            with self.assertRaises(P.Blocked) as raised:
                api.request("account", f"/accounts/{P.ACCOUNT}")
        self.assertNotIn(SECRET, str(raised.exception.receipt))

    def test_invalid_token_format_and_cross_account_refuse_before_transport(self):
        with self.assertRaises(P.Blocked):
            P.API(SECRET + "\n", {"requests": []})
        api = P.API(SECRET, {"requests": []})
        with patch.object(api.opener, "open") as opened:
            with self.assertRaises(P.Blocked):
                api.request("account", "/accounts/not-authorized")
            with self.assertRaises(P.Blocked):
                api.request("delete", f"/accounts/{P.ACCOUNT}/r2/buckets/production", "DELETE")
            opened.assert_not_called()

    def test_successful_response_cannot_reflect_credential_into_metadata(self):
        class Response(io.BytesIO):
            code = 200
        api = P.API(SECRET, {"requests": []})
        response = Response(json.dumps({"success": True, "result": {"subdomain": SECRET}}).encode())
        with patch.object(api.opener, "open", return_value=response):
            with self.assertRaises(P.Blocked) as raised:
                api.request("workers_subdomain", f"/accounts/{P.ACCOUNT}/workers/subdomain")
        self.assertEqual(raised.exception.receipt["code"], "credential_reflected_in_provider_response")
        self.assertNotIn(SECRET, json.dumps(api.report))

    def test_http_error_codes_only_no_payload_messages(self):
        class Response(io.BytesIO):
            code = 401
        api = P.API(SECRET, {"requests": []})
        response = Response(json.dumps({"success": False, "errors": [{"code": 10000, "message": SECRET}]}).encode())
        with patch.object(api.opener, "open", return_value=response):
            with self.assertRaises(P.Blocked) as raised:
                api.request("account", f"/accounts/{P.ACCOUNT}")
        self.assertEqual(raised.exception.receipt["error_codes"], [10000])
        self.assertNotIn(SECRET, json.dumps(api.report))


if __name__ == "__main__":
    unittest.main()
