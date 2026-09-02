from __future__ import annotations

import sys
import unittest
from pathlib import Path


BUNDLE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BUNDLE_ROOT))

from core.ports import DqeExecutionResult, SavedRevision  # noqa: E402
from infrastructure.fakes import (  # noqa: E402
    FakeDataContextPort,
    FakeDqeExecutionPort,
    FakePageAssetPort,
)


class SemanticPortFakeTest(unittest.IsolatedAsyncioTestCase):
    async def test_fakes_record_structured_calls_without_wire_assumptions(self) -> None:
        data_context = FakeDataContextPort({"version": "fixture"})
        dqe = FakeDqeExecutionPort(DqeExecutionResult(rows=[{"区域": "华东"}], total_count=1))
        pages = FakePageAssetPort(SavedRevision("page-1", "revision-1", 1))

        self.assertEqual(await data_context.current(), {"version": "fixture"})
        result = await dqe.execute({"language": "dqe", "body": {"dsl_list": []}})
        saved = await pages.save_revision({"pageId": "page-1", "document": {"id": "page-1"}})

        self.assertEqual(result.total_count, 1)
        self.assertEqual(saved.revision_id, "revision-1")
        self.assertEqual(data_context.calls, 1)
        self.assertEqual(dqe.calls, [{"language": "dqe", "body": {"dsl_list": []}}])
        self.assertEqual(pages.calls[0]["pageId"], "page-1")


if __name__ == "__main__":
    unittest.main()
