"""Counterexamples for staging acceptance, independent of provider credentials."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("live", Path(__file__).with_name("verify-cloudflare-live.py"))
live = importlib.util.module_from_spec(spec)
spec.loader.exec_module(live)
SHA = "a" * 40
ORIGIN = "https://ucc-mca-edge-staging.example.workers.dev"
CONFIG = {"vars": {"ACCESS_TEAM_DOMAIN": "example.cloudflareaccess.com"}}
UNAUTHORIZED = {"error": {"message": "Unauthorized", "code": "UNAUTHORIZED", "statusCode": 401}}


class LiveTests(unittest.TestCase):
    def responder(self, **overrides):
        responses = {
            "health": (200, {"ok": True, "env": "staging", "revision": SHA}, "", "application/json"),
            "unauthenticated": (401, UNAUTHORIZED, "", "application/json"),
            "forged": (401, UNAUTHORIZED, "", "application/json"),
            "missing": (404, None, "", "application/json"),
        } | overrides
        def fetch(origin, path, forged=False):
            self.assertEqual(origin, ORIGIN)
            return responses["forged" if forged else "health" if path.startswith("/health")
                             else "unauthenticated" if path == "/api/prospects" else "missing"]
        return fetch

    def test_exact_live_revision_and_denials(self):
        self.assertEqual(live.verify_live(ORIGIN, CONFIG, SHA, self.responder())["health"], 200)

    def test_stale_revision_is_not_deployed(self):
        with self.assertRaisesRegex(live.VerificationError, "live_revision"):
            live.verify_live(ORIGIN, CONFIG, SHA, self.responder(
                health=(200, {"ok": True, "env": "staging", "revision": "b" * 40}, "", "application/json")))

    def test_successful_forged_token_is_rejected(self):
        with self.assertRaisesRegex(live.VerificationError, "authentication_boundary"):
            live.verify_live(ORIGIN, CONFIG, SHA, self.responder(forged=(200, {}, "", "application/json")))

    def test_only_exact_access_login_redirect_is_denial(self):
        self.assertTrue(live.denied((302, None, "https://example.cloudflareaccess.com/cdn-cgi/access/login/site", ""), "example.cloudflareaccess.com"))
        for url in ["https://example.cloudflareaccess.com.evil.test/cdn-cgi/access/login/site",
                    "https://example.cloudflareaccess.com/other", "http://example.cloudflareaccess.com/cdn-cgi/access/login/site"]:
            self.assertFalse(live.denied((302, None, url, ""), "example.cloudflareaccess.com"))

    def test_full_schema_required(self):
        payload = [{"success": True, "results": [{"name": name} for name in sorted(live.SCHEMA)]}]
        live.validate_schema(payload)
        payload[0]["results"].pop()
        with self.assertRaises(live.VerificationError):
            live.validate_schema(payload)

    def test_generic_gateway_denial_does_not_prove_authentication(self):
        for response in [(403, None, "", "text/html"), (401, {"error": "unrelated"}, "", "application/json")]:
            self.assertFalse(live.denied(response, CONFIG["vars"]["ACCESS_TEAM_DOMAIN"]))
            with self.assertRaisesRegex(live.VerificationError, "authentication_boundary"):
                live.verify_live(ORIGIN, CONFIG, SHA, self.responder(forged=response))

    def test_failed_schema_query_not_accepted(self):
        with self.assertRaises(live.VerificationError):
            live.validate_schema([{"success": False, "results": []}])


if __name__ == "__main__":
    unittest.main()
