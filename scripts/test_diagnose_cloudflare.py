"""Offline regression checks for the credential-bearing diagnostic boundary."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import unittest
from unittest.mock import patch
import urllib.request

SPEC = importlib.util.spec_from_file_location(
    "diagnose_cloudflare", Path(__file__).with_name("diagnose-cloudflare.py")
)
diag = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(diag)
TOKEN = "SECRET_SENTINEL_NEVER_EMITTED"


class Response(io.BytesIO):
    def __init__(self, payload, status=200):
        super().__init__(json.dumps(payload).encode())
        self.code = status


class DiagnosticTests(unittest.TestCase):
    def execute(self, env, responder):
        calls = []

        class Opener:
            def open(self, request, timeout):
                calls.append(request)
                return responder(request.full_url)

        stream = io.StringIO()
        with patch.dict(os.environ, env, clear=True), patch.object(
            diag.urllib.request, "build_opener", return_value=Opener()
        ), contextlib.redirect_stdout(stream):
            code = diag.main()
        return code, json.loads(stream.getvalue()), stream.getvalue(), calls

    def test_missing_or_different_account_sends_no_requests(self):
        for env in [{}, {"CLOUDFLARE_API_TOKEN": TOKEN, "CLOUDFLARE_ACCOUNT_ID": "different"}]:
            code, report, text, calls = self.execute(env, lambda _: self.fail("unexpected request"))
            self.assertEqual(code, 1)
            self.assertEqual(calls, [])
            self.assertNotIn(TOKEN, text)

    def test_get_only_exact_host_and_candidate_with_selected_metadata(self):
        def respond(url):
            if url.endswith("/tokens/verify"):
                return Response({"success": False, "errors": [{"code": 10000, "message": TOKEN}]}, 403)
            if url.endswith(diag.ACCOUNT):
                return Response({"success": True, "result": {"id": diag.ACCOUNT, "name": "PRIVATE_ACCOUNT_NAME"}})
            if "/d1/database" in url:
                return Response({"success": True, "result": [
                    {"name": "ucc-mca-staging", "uuid": "11111111-1111-1111-1111-111111111111"},
                    {"name": "PRIVATE_OTHER_DATABASE", "uuid": TOKEN},
                ], "result_info": {"total_count": 200}})
            if "/storage/kv/" in url:
                return Response({"success": True, "result": [
                    {"title": "ucc-mca-edge-KV", "id": "a" * 32},
                    {"title": "PRIVATE_OTHER_NAMESPACE", "id": TOKEN},
                ]})
            return Response({"success": True, "result": [
                {"id": "ucc-mca-edge-staging", "bindings": [{"value": TOKEN}]},
                {"id": "PRIVATE_OTHER_WORKER"},
            ]})

        code, report, text, calls = self.execute({"CLOUDFLARE_API_TOKEN": TOKEN}, respond)
        self.assertEqual(code, 0)
        self.assertEqual(len(calls), 6)
        for request in calls:
            self.assertEqual(request.get_method(), "GET")
            self.assertIsNone(request.data)
            self.assertTrue(request.full_url.startswith(diag.ORIGIN + "/accounts/" + diag.ACCOUNT)
                            or request.full_url == diag.ORIGIN + "/user/tokens/verify")
            self.assertEqual(request.get_header("Authorization"), "Bearer " + TOKEN)
        self.assertTrue(report["candidate_account_access_verified"])
        self.assertTrue(report["ucc_resource_metadata_observed"])
        self.assertFalse(report["deployment_verified"])
        self.assertFalse(report["cloudflare_writes"])
        self.assertFalse(report["checks"]["d1"]["list_complete"])
        self.assertEqual(report["checks"]["d1"]["matching_ucc_resources"],
                         [{"name": "ucc-mca-staging", "id": "11111111-1111-1111-1111-111111111111"}])
        self.assertEqual(report["checks"]["kv"]["matching_ucc_resources"],
                         [{"name": "ucc-mca-edge-KV", "id": "a" * 32}])
        self.assertEqual(report["checks"]["workers"]["matching_ucc_resources"],
                         [{"name": "ucc-mca-edge-staging", "id": "ucc-mca-edge-staging"}])
        self.assertNotIn(TOKEN, text)
        self.assertNotIn("PRIVATE_", text)

    def test_failed_auth_returns_only_status_and_numeric_codes(self):
        code, report, text, calls = self.execute(
            {"CLOUDFLARE_API_TOKEN": TOKEN},
            lambda _: Response({"success": False, "errors": [{"code": 10000, "message": TOKEN}]}, 403),
        )
        self.assertEqual(code, 1)
        self.assertFalse(report["candidate_account_access_verified"])
        self.assertEqual(report["checks"]["account_token"]["error_codes"], [10000])
        self.assertNotIn(TOKEN, text)
        self.assertEqual(len(calls), 6)

    def test_redirect_cannot_forward_credential(self):
        request = urllib.request.Request(diag.ORIGIN + "/user/tokens/verify",
                                         headers={"Authorization": "Bearer " + TOKEN})
        self.assertIsNone(diag.NoRedirect().redirect_request(
            request, None, 302, "redirect", {}, "https://example.invalid/collect"))
        with self.assertRaises(ValueError):
            diag.request_json("https://example.invalid/collect", TOKEN)
        with self.assertRaises(ValueError):
            diag.request_json("/accounts/other-account/workers/scripts", TOKEN)

    def test_malformed_credentials_and_transport_exceptions_are_redacted(self):
        for token in [TOKEN + "\nBAD", TOKEN + "\u2603"]:
            code, report, text, calls = self.execute(
                {"CLOUDFLARE_API_TOKEN": token}, lambda _: self.fail("unexpected request"))
            self.assertEqual(code, 1)
            self.assertEqual(calls, [])
            self.assertNotIn(TOKEN, text)
            self.assertTrue(all(c["invalid_credential_format"] for c in report["checks"].values()))

        def fail_open(_):
            raise ValueError("Authorization: Bearer " + TOKEN)

        class FailRead(Response):
            def read(self, *_):
                raise RuntimeError("Raw server text " + TOKEN)

        for responder in [fail_open, lambda _: FailRead({})]:
            code, report, text, calls = self.execute({"CLOUDFLARE_API_TOKEN": TOKEN}, responder)
            self.assertEqual(code, 1)
            self.assertNotIn(TOKEN, text)
            self.assertTrue(all(c["transport_error"] for c in report["checks"].values()))

    def test_malformed_success_does_not_establish_account_access(self):
        code, report, text, calls = self.execute(
            {"CLOUDFLARE_API_TOKEN": TOKEN},
            lambda _: Response({"success": True, "result": "invalid", "errors": None}),
        )
        self.assertEqual(code, 1)
        self.assertFalse(report["candidate_account_access_verified"])
        self.assertNotIn(TOKEN, text)


if __name__ == "__main__":
    unittest.main()
