"""Policy regressions for a read-only settings planner; no credentials or network."""

import copy
import importlib.util
import pathlib
import unittest

SPEC = importlib.util.spec_from_file_location("ruleset_plan", pathlib.Path(__file__).with_name("ruleset-plan.py"))
PLAN = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PLAN)


def snapshot():
    return {
        "id": PLAN.RULESET_ID,
        "name": "validate-dependencies-required",
        "target": "branch",
        "source": PLAN.REPOSITORY,
        "source_type": "Repository",
        "enforcement": "disabled",
        "conditions": {"ref_name": {"include": ["~DEFAULT_BRANCH"], "exclude": []}},
        "bypass_actors": [],
        "rules": [{
            "type": "required_status_checks",
            "parameters": {
                "strict_required_status_checks_policy": False,
                "do_not_enforce_on_create": False,
                "required_status_checks": [{"context": "validate-dependencies"}],
            },
        }],
    }


class RulesetPlanTests(unittest.TestCase):
    def test_strict_gate_and_dependency_checks_with_no_acceptance_claim(self):
        source = snapshot()
        original = copy.deepcopy(source)
        result = PLAN.make_plan(source)
        self.assertEqual(source, original)
        self.assertEqual(result["status"], "staged_only")
        self.assertFalse(result["settings_applied"])
        self.assertFalse(result["automatic_acceptance_verified"])
        body = result["request"]["body"]
        self.assertEqual(body["enforcement"], "active")
        params = body["rules"][0]["parameters"]
        self.assertTrue(params["strict_required_status_checks_policy"])
        self.assertFalse(params["do_not_enforce_on_create"])
        self.assertEqual({item["context"] for item in params["required_status_checks"]}, {"gate", "validate-dependencies"})
        self.assertTrue(all(item["integration_id"] == 15368 for item in params["required_status_checks"]))

    def test_preserves_unrelated_rules_checks_conditions_and_bypass(self):
        source = snapshot()
        source["rules"].append({"type": "non_fast_forward"})
        source["bypass_actors"].append({"actor_type": "Team", "actor_id": 9, "bypass_mode": "pull_request"})
        source["rules"][0]["parameters"]["required_status_checks"].append({"context": "other", "integration_id": 77})
        desired = PLAN.desired_settings(source)
        self.assertEqual(desired["rules"][1], source["rules"][1])
        self.assertEqual(desired["bypass_actors"], source["bypass_actors"])
        self.assertEqual(desired["conditions"], source["conditions"])
        self.assertIn({"context": "other", "integration_id": 77}, desired["rules"][0]["parameters"]["required_status_checks"])

    def test_rejects_incomplete_snapshot(self):
        source = snapshot()
        del source["bypass_actors"]
        with self.assertRaisesRegex(ValueError, "missing bypass_actors"):
            PLAN.desired_settings(source)

    def test_rejects_wrong_repository_id_scope_and_duplicate_rules(self):
        for field, value in (("id", 1), ("source", "someone/else"), ("source_type", "Organization")):
            with self.subTest(field=field):
                source = snapshot()
                source[field] = value
                with self.assertRaises(ValueError):
                    PLAN.desired_settings(source)
        source = snapshot()
        source["conditions"]["ref_name"]["exclude"] = ["main"]
        with self.assertRaises(ValueError):
            PLAN.desired_settings(source)
        source = snapshot()
        source["rules"].append(copy.deepcopy(source["rules"][0]))
        with self.assertRaises(ValueError):
            PLAN.desired_settings(source)

    def test_rejects_widened_or_duplicate_branch_scope(self):
        for includes in (["~DEFAULT_BRANCH", "refs/heads/develop"], ["~ALL"], [], ["~DEFAULT_BRANCH", "~DEFAULT_BRANCH"]):
            source = snapshot()
            source["conditions"]["ref_name"]["include"] = includes
            with self.assertRaisesRegex(ValueError, "scope changed"):
                PLAN.desired_settings(source)

    def test_rejects_conflicting_publisher_and_duplicate_context(self):
        source = snapshot()
        checks = source["rules"][0]["parameters"]["required_status_checks"]
        checks[0]["integration_id"] = 77
        with self.assertRaisesRegex(ValueError, "different publisher"):
            PLAN.desired_settings(source)
        checks[0].pop("integration_id")
        checks.append(copy.deepcopy(checks[0]))
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            PLAN.desired_settings(source)

    def test_readback_accepts_ordering_but_not_disabled_missing_or_weakened_controls(self):
        source = snapshot()
        readback = {**source, **PLAN.desired_settings(source)}
        readback["rules"][0]["parameters"]["required_status_checks"].reverse()
        self.assertTrue(PLAN.verify_readback(source, readback)["settings_match"])
        for key, value in (("enforcement", "disabled"), ("bypass_actors", [{"actor_type": "OrganizationAdmin", "bypass_mode": "always"}])):
            with self.subTest(key=key):
                changed = copy.deepcopy(readback)
                changed[key] = value
                with self.assertRaisesRegex(ValueError, "readback differs"):
                    PLAN.verify_readback(source, changed)
        for mutate in (
            lambda p: p.update(strict_required_status_checks_policy=False),
            lambda p: p["required_status_checks"].pop(),
            lambda p: p["required_status_checks"][0].pop("integration_id"),
        ):
            changed = copy.deepcopy(readback)
            mutate(changed["rules"][0]["parameters"])
            with self.assertRaisesRegex(ValueError, "readback differs"):
                PLAN.verify_readback(source, changed)


if __name__ == "__main__":
    unittest.main()
