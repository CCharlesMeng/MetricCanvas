from __future__ import annotations

import sys
import unittest
from pathlib import Path


BUNDLE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BUNDLE_ROOT / "tool"))
sys.path.insert(0, str(BUNDLE_ROOT / "test-harness"))

from adapters.fakes import (  # noqa: E402
    FakeDataContextPort,
    FakeDqeExecutionPort,
)
from metriccanvas_authoring.data.execution import DqeExecutionResult  # noqa: E402


class SemanticPortFakeTest(unittest.IsolatedAsyncioTestCase):
    async def test_fakes_record_structured_calls_without_wire_assumptions(self) -> None:
        data_context = FakeDataContextPort({"version": "fixture"})
        dqe = FakeDqeExecutionPort(DqeExecutionResult(rows=[{"区域": "华东"}], total_count=1))

        self.assertEqual(await data_context.current(), {"version": "fixture"})
        result = await dqe.execute({"language": "dqe", "body": {"dsl_list": []}})

        self.assertEqual(result.total_count, 1)
        self.assertEqual(data_context.calls, 1)
        self.assertEqual(dqe.calls, [{"language": "dqe", "body": {"dsl_list": []}}])


if __name__ == "__main__":
    unittest.main()
