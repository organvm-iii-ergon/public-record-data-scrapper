import copy
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("receipt", Path(__file__).with_name("agent-receipt.py"))
R = importlib.util.module_from_spec(spec)
spec.loader.exec_module(R)


class ReceiptTests(unittest.TestCase):
    def setUp(self):
        self.current = {"commit": "a" * 40, "tree": "b" * 40, "branch": "fix/test",
                        "installed_lock_sha256": "c" * 64, "node": "v24.19.0", "npm": "11.9.0", "local_configuration": {".env": None}}
        self.receipt = {"schema_version": 2, "status": "GREEN", "fingerprint": self.current.copy(),
                        "completed_at": "2026-09-16T00:00:00+00:00",
                        "checks": [{"name": n, "command": c, "exit_code": 0} for n, c in R.CHECKS.items()]}

    def test_complete_current_receipt(self):
        R.validate(self.receipt, self.current)

    def test_revision_branch_tool_or_dependency_drift(self):
        for key in self.current:
            current = self.current | {key: "changed"}
            with self.subTest(key=key), self.assertRaises(ValueError):
                R.validate(self.receipt, current)

    def test_missing_failed_and_changed_checks(self):
        for change in ["missing", "failed", "command"]:
            receipt = copy.deepcopy(self.receipt)
            if change == "missing":
                receipt["checks"].pop()
            elif change == "failed":
                receipt["checks"][0]["exit_code"] = 1
            else:
                receipt["checks"][0]["command"] = ["true"]
            with self.subTest(change=change), self.assertRaises(ValueError):
                R.validate(receipt, self.current)

    def test_old_receipt_is_rejected(self):
        with self.assertRaises(ValueError):
            R.validate({"status": "GREEN", "commit": self.current["commit"]}, self.current)

    def test_dirty_tree_rejected_before_dependency_probe(self):
        for status in [" M server/index.ts", "?? new-config.json"]:
            with patch.object(R, "output", return_value=status), self.assertRaisesRegex(ValueError, "clean"):
                R.fingerprint()


if __name__ == "__main__":
    unittest.main()
