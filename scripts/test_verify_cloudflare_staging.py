"""Offline counterexamples; these do not require live environment provisioning."""
from copy import deepcopy
import importlib.util
from pathlib import Path
import unittest

SPEC = importlib.util.spec_from_file_location(
    "staging", Path(__file__).with_name("verify-cloudflare-staging.py")
)
staging = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(staging)


class StagingTests(unittest.TestCase):
    def fixture(self):
        return {"env": {"staging": {
            "account_id": staging.VERIFIED_ACCOUNT,
            "d1_databases": [{"binding": "DB", "database_id": "11111111-1111-1111-1111-111111111111"}],
            "kv_namespaces": [{"binding": "KV", "id": "a" * 32}],
            "vars": {"ACCESS_TEAM_DOMAIN": "test-team.cloudflareaccess.com", "ACCESS_AUD": "b" * 64},
        }}}

    def test_explicit_configuration_passes_without_claiming_live_resources(self):
        self.assertEqual(staging.validate_staging(self.fixture()), [])

    def test_placeholder_binding_fixture_is_rejected(self):
        config = self.fixture()
        env = config["env"]["staging"]
        env["d1_databases"][0]["database_id"] = "REPLACE_WITH_STAGING_D1_ID"
        env["kv_namespaces"][0]["id"] = "REPLACE_WITH_STAGING_KV_ID"
        env["vars"] = {"ACCESS_TEAM_DOMAIN": "your-team.cloudflareaccess.com", "ACCESS_AUD": "REPLACE_WITH_STAGING_ACCESS_AUD"}
        errors = staging.validate_staging(config)
        for field in ["DB database_id", "KV id", "ACCESS_TEAM_DOMAIN", "ACCESS_AUD"]:
            self.assertTrue(any(field in error for error in errors))
        self.assertFalse(any("account_id" in error for error in errors))

    def test_shared_production_resources_are_rejected(self):
        config = self.fixture()
        config["env"]["staging"]["d1_databases"][0]["database_id"] = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
        config["env"]["production"] = deepcopy(config["env"]["staging"])
        config["env"]["production"]["d1_databases"][0]["database_id"] = "AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA"
        config["env"]["production"]["kv_namespaces"][0]["id"] = "A" * 32
        errors = staging.validate_staging(config)
        self.assertTrue(any("DB must be distinct" in error for error in errors))
        self.assertTrue(any("KV must be distinct" in error for error in errors))

    def test_wrong_account_and_zero_ids_are_rejected(self):
        config = self.fixture()
        env = config["env"]["staging"]
        env["account_id"] = "0" * 32
        env["d1_databases"][0]["database_id"] = "00000000-0000-0000-0000-000000000000"
        env["kv_namespaces"][0]["id"] = "0" * 32
        errors = staging.validate_staging(config)
        for field in ["account_id", "DB database_id", "KV id"]:
            self.assertTrue(any(field in error for error in errors))

    def test_malformed_binding_tables_return_structured_errors(self):
        config = self.fixture()
        config["env"]["staging"]["d1_databases"] = {"binding": "DB"}
        config["env"]["staging"]["kv_namespaces"] = ["not-a-table"]
        errors = staging.validate_staging(config)
        self.assertTrue(any("DB database_id" in error for error in errors))
        self.assertTrue(any("KV id" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
