from __future__ import annotations

import json
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator


BUNDLE_ROOT = Path(__file__).resolve().parents[2]
AUTHORED_ROOT = BUNDLE_ROOT / "contracts" / "authored"
EXPORTED_ROOT = BUNDLE_ROOT / "contracts" / "exported"


def load_json(path: Path) -> dict[str, object]:
    return json.loads(path.read_text(encoding="utf-8"))


class AgentContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.business_terms = load_json(
            AUTHORED_ROOT / "business-term-resolution.schema.json"
        )
        cls.model_decision = load_json(
            AUTHORED_ROOT / "agent-model-decision.schema.json"
        )
        cls.step_event = load_json(AUTHORED_ROOT / "agent-step-event.schema.json")
        cls.conformance_schema = load_json(
            AUTHORED_ROOT / "agent-conformance.schema.json"
        )
        cls.conformance = load_json(EXPORTED_ROOT / "agent-conformance.json")

    def test_all_agent_schemas_are_valid_draft_2020_12(self) -> None:
        for schema in (
            self.business_terms,
            self.model_decision,
            self.step_event,
            self.conformance_schema,
        ):
            with self.subTest(schema=schema.get("$id")):
                Draft202012Validator.check_schema(schema)

    def test_typescript_agent_conformance_export_matches_schema(self) -> None:
        errors = list(
            Draft202012Validator(self.conformance_schema).iter_errors(
                self.conformance
            )
        )
        self.assertEqual(errors, [])
        cases = self.conformance["cases"]
        self.assertGreaterEqual(len(cases), 10)

        longest = next(case for case in cases if case["case"] == "longest-name-hit")
        self.assertEqual(
            [entry["metricName"] for entry in longest["expected"]["candidates"]],
            ["新增客户数"],
        )
        ambiguous = next(
            case for case in cases if case["case"] == "ambiguous-canonical-name"
        )
        self.assertEqual(ambiguous["expected"]["ambiguousTerms"], ["客户数"])
        self.assertEqual(ambiguous["expected"]["selected"], [])

        model_cases = [case for case in cases if case["kind"] == "model_decision"]
        self.assertEqual(len(model_cases), 5)
        decision_validator = Draft202012Validator(self.model_decision)
        for case in model_cases:
            with self.subTest(model_case=case["case"]):
                self.assertEqual(
                    list(decision_validator.iter_errors(case["expected"])),
                    [],
                )

    def test_model_decision_schema_enforces_closed_operations(self) -> None:
        valid = {
            "decisionType": "submit_data_request_units",
            "outcome": "operations",
            "operations": [
                {
                    "op": "modify",
                    "dataSourceId": "unit-1",
                    "patch": {"groupBy": ["区域"]},
                }
            ],
        }
        self.assertEqual(
            list(Draft202012Validator(self.model_decision).iter_errors(valid)),
            [],
        )

        missing_target = {
            "decisionType": "submit_data_request_units",
            "outcome": "operations",
            "operations": [{"op": "remove"}],
        }
        self.assertNotEqual(
            list(
                Draft202012Validator(self.model_decision).iter_errors(
                    missing_target
                )
            ),
            [],
        )
        too_many_domains = {
            "decisionType": "route_business_domains",
            "businessDomains": ["A", "B", "C"],
        }
        self.assertNotEqual(
            list(
                Draft202012Validator(self.model_decision).iter_errors(
                    too_many_domains
                )
            ),
            [],
        )

    def test_step_event_never_accepts_result_rows(self) -> None:
        safe_summary = {
            "type": "rows_ready",
            "summary": {
                "rowCount": 2,
                "totalCount": 2,
                "outputFields": ["区域", "Tokens请求量"],
            },
            "dataSourceId": "unit-1",
        }
        validator = Draft202012Validator(self.step_event)
        self.assertEqual(list(validator.iter_errors(safe_summary)), [])

        leaking_rows = {
            **safe_summary,
            "rows": [{"区域": "华东", "Tokens请求量": 18}],
        }
        self.assertNotEqual(list(validator.iter_errors(leaking_rows)), [])


if __name__ == "__main__":
    unittest.main()
