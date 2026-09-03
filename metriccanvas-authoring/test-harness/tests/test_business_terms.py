from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

from jsonschema import Draft202012Validator


BUNDLE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BUNDLE_ROOT / "tool"))

from metriccanvas_authoring.domain.business_terms import (  # noqa: E402
    resolve_metric_terms,
)
from metriccanvas_authoring.domain.data_context import parse_data_context  # noqa: E402


class BusinessTermResolutionTest(unittest.TestCase):
    def test_matches_typescript_retrieval_and_disambiguation_vectors(self) -> None:
        vector = json.loads(
            (
                BUNDLE_ROOT
                / "contracts"
                / "exported"
                / "agent-conformance.json"
            ).read_text(encoding="utf-8")
        )
        data_context, issues = parse_data_context(vector["dataContext"])
        self.assertEqual(issues, ())
        assert data_context is not None
        schema = json.loads(
            (
                BUNDLE_ROOT
                / "contracts"
                / "authored"
                / "business-term-resolution.schema.json"
            ).read_text(encoding="utf-8")
        )
        validator = Draft202012Validator(schema)

        for case in vector["cases"]:
            if case["kind"] != "business_term_resolution":
                continue
            with self.subTest(case=case["case"]):
                result = resolve_metric_terms(
                    question=case["input"]["question"],
                    business_domains=case["input"]["businessDomains"],
                    metric_entries=data_context.metric_entries,
                    limit=case["input"]["limit"],
                )
                self.assertEqual(
                    [candidate.to_payload() for candidate in result.candidates],
                    case["expected"]["candidates"],
                )
                self.assertEqual(
                    [candidate.to_payload() for candidate in result.selected],
                    case["expected"]["selected"],
                )
                self.assertEqual(
                    list(result.ambiguous_terms),
                    case["expected"]["ambiguousTerms"],
                )
                self.assertEqual(
                    list(
                        validator.iter_errors(
                            result.to_payload(case["input"]["question"])
                        )
                    ),
                    [],
                )


if __name__ == "__main__":
    unittest.main()
