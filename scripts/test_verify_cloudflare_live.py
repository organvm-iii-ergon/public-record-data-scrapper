"""Counterexamples for staging acceptance, independent of provider credentials."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import MagicMock, patch

spec = importlib.util.spec_from_file_location("live", Path(__file__).with_name("verify-cloudflare-live.py"))
live = importlib.util.module_from_spec(spec)
spec.loader.exec_module(live)
SHA = "a" * 40
ORIGIN = "https://ucc-mca-edge-staging.example.workers.dev"
CONFIG = {"vars": {"ACCESS_TEAM_DOMAIN": "example.cloudflareaccess.com"}}
UNAUTHORIZED = {"error": {"message": "Unauthorized", "code": "UNAUTHORIZED", "statusCode": 401}}


class LiveTests(unittest.TestCase):
    def test_probe_identifies_itself_without_following_redirects(self):
        response = MagicMock()
        response.__enter__.return_value = response
        response.read.return_value = b'{"ok":true}'
        response.code = 200
        response.headers = {"Content-Type": "application/json"}
        with patch.object(live.urllib.request, "build_opener") as opener:
            opener.return_value.open.return_value = response
            live.fetch(ORIGIN, "/health")
            self.assertIsInstance(opener.call_args.args[0], live.NoRedirect)
            request = opener.return_value.open.call_args.args[0]
            self.assertEqual(request.get_header("User-agent"), "UCC-Staging-Verifier/1.0")
            self.assertIsNone(request.get_header("Authorization"))

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
        rows, history = live.expected_schema()
        payload = [{"success": True, "results": rows},
                   {"success": True, "results": [{"name": name} for name in history]}]
        live.validate_schema(payload)
        payload[0]["results"].pop()
        with self.assertRaises(live.VerificationError):
            live.validate_schema(payload)

    def test_later_migrations_indexes_and_history_are_required(self):
        import copy
        rows, history = live.expected_schema()
        valid = [{"success": True, "results": rows},
                 {"success": True, "results": [{"name": name} for name in history]}]
        for name in ["api_keys", "crm_integrations", "webhook_deliveries", "idx_api_keys_hash", "prospects_ai"]:
            payload = copy.deepcopy(valid)
            payload[0]["results"] = [row for row in rows if row["name"] != name]
            with self.assertRaises(live.VerificationError):
                live.validate_schema(payload)
        changed = copy.deepcopy(valid)
        changed[0]["results"][0]["sql"] += " BROKEN"
        with self.assertRaises(live.VerificationError):
            live.validate_schema(changed)
        for entries in [history[:-1], history + ["9999_unknown.sql"], history + history[:1]]:
            with self.assertRaisesRegex(live.VerificationError, "migration_history"):
                live.validate_schema([valid[0], {"success": True, "results": [{"name": name} for name in entries]}])

    def test_sql_comments_are_ignored_but_literal_bytes_are_preserved(self):
        self.assertEqual(live.sql_tokens("CREATE TABLE t (v TEXT -- comment\n)"),
                         live.sql_tokens("CREATE TABLE t (v TEXT)"))
        self.assertNotEqual(live.sql_tokens("DEFAULT '--private'"), live.sql_tokens("DEFAULT '--public'"))
        self.assertNotEqual(live.sql_tokens("DEFAULT 'a b'"), live.sql_tokens("DEFAULT 'ab'"))

    def test_upgrade_schema_matches_fresh_install_and_rejects_version_collisions(self):
        import sqlite3
        import tempfile
        with tempfile.TemporaryDirectory() as directory:
            db = Path(directory) / "upgrade.db"
            files = sorted(live.MIGRATIONS.glob("*.sql"))
            # Close and reopen between the initial install and the upgrade.
            with sqlite3.connect(db) as connection:
                connection.executescript(files[0].read_text())
            with sqlite3.connect(db) as connection:
                for path in files[1:]:
                    connection.executescript(path.read_text())
                connection.row_factory = sqlite3.Row
                rows = [dict(row) for row in connection.execute(
                    "SELECT type, name, tbl_name, sql FROM sqlite_master "
                    "WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name")]
            live.validate_schema([{"success": True, "results": rows},
                                  {"success": True, "results": [{"name": path.name} for path in files]}])
            migrations = Path(directory) / "migrations"
            migrations.mkdir()
            (migrations / "0001_first.sql").write_text("CREATE TABLE first (id TEXT);")
            (migrations / "1_duplicate.sql").write_text("CREATE TABLE second (id TEXT);")
            with self.assertRaisesRegex(live.VerificationError, "duplicate_migration"):
                live.expected_schema(migrations)

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
