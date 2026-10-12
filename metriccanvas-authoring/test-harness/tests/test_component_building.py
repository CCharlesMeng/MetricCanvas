from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

BUNDLE_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BUNDLE_ROOT / "tool"))
from metriccanvas_authoring.build_issues import PageBuildingIssue  # noqa: E402
from metriccanvas_authoring.data.executable_units import ExecutableUnit, UnitScope  # noqa: E402
from metriccanvas_authoring.pages.composition.page_building import (  # noqa: E402
    build_data_component,
)
from metriccanvas_authoring.data.execution import DqeExecutionResult  # noqa: E402
from metriccanvas_authoring.pages.validation.page_validation import validate_page_document  # noqa: E402


class ComponentBuildingConformanceTest(unittest.TestCase):
    """Fixed expectations shared with the browser; neither implementation writes them."""

    def test_shared_component_vectors(self) -> None:
        vectors = json.loads((BUNDLE_ROOT / "test-harness/fixtures/component-building.json").read_text())
        self.assertEqual(len({case["type"] for case in vectors["accepted"]}), 10)
        for accepted in (True, False):
            for case in vectors["accepted" if accepted else "rejected"]:
                with self.subTest(component=case["type"], accepted=accepted):
                    unit = ExecutableUnit(
                        data_source_id="result", title=case.get("title"),
                        fields=case["fields"], query_body={}, intent="detail",
                        pinned_component=case["type"],
                        scope=UnitScope("example", (), "", "", ()), formula_traces=(),
                    )
                    execution = DqeExecutionResult(rows=case["rows"], total_count=case.get("totalCount"))
                    if accepted:
                        built = build_data_component(unit, execution, 0)
                        self.assertEqual(built["type"], case["type"])
                        self.assertEqual(built["props"], case["expectedProps"])
                        for layout in ("report", "dashboard"):
                            page = {
                                "schemaVersion": "6.5", "layout": layout,
                                "id": "component-building",
                                "dataSources": {"result": {
                                    "fields": {
                                        key: {k: v for k, v in field.items() if k != "queryField"}
                                        for key, field in case["fields"].items()
                                    },
                                    "source": {"type": "inline", "rows": case["rows"]},
                                }},
                                "sections": [{"id": "main", "components": [built]}],
                            }
                            self.assertEqual(validate_page_document(page), [], layout)
                    else:
                        with self.assertRaises(PageBuildingIssue):
                            build_data_component(unit, execution, 0)


class AutomaticTablePaginationTest(unittest.TestCase):
    def partial_page(self):
        from metriccanvas_authoring.pages.composition.page_building import assemble_page_document
        unit = ExecutableUnit(
            data_source_id='records', title='明细',
            fields={'name': {'type': 'string', 'role': 'dimension', 'queryField': 'name'},
                    'value': {'type': 'number', 'role': 'measure', 'queryField': 'value'}},
            query_body={'dsl_list': [{'output_dims': ['name'], 'output_metrics': ['value'],
                        'filter': {'dims': [], 'metrics': []}, 'order': {'order_by_field': 'value', 'type': 'desc'}}]},
            intent='detail', pinned_component='table',
            scope=UnitScope('example', ('name',), '2026-01 至 2026-06', 'month', ()), formula_traces=(),
        )
        execution = DqeExecutionResult(rows=[{'name': f'row-{i}', 'value': i} for i in range(20)],
                                       total_count=714, captured_at='2026-10-12T00:00:00Z')
        return assemble_page_document(page_id='automatic-pagination', description=None,
                                      schema_version='6.11', units=[unit], executions=[execution])

    def test_assembles_partial_table_with_query_pagination(self):
        page = self.partial_page()
        table = page['sections'][1]['components'][0]
        self.assertEqual(table['props'].get('pagination'), {'mode': 'query'})
        order = page['dataSources']['records']['source']['query']['body']['dsl_list'][0]['order']
        self.assertEqual(order, {'order_by_field': 'value', 'type': 'desc', 'offset': 0, 'limit': 20})
        self.assertEqual(validate_page_document(page), [])

    def test_shared_sources_and_explicit_choices_are_preserved(self):
        from copy import deepcopy
        from metriccanvas_authoring.pages.composition.table_pagination import add_query_table_pagination
        for variant in ('shared', 'none', 'missing-total', 'computed', 'offset', 'limit-mismatch'):
            with self.subTest(variant=variant):
                page = self.partial_page()
                table = page['sections'][1]['components'][0]
                table['props'].pop('pagination', None)
                source = page['dataSources']['records']['source']
                order = source['query']['body']['dsl_list'][0]['order']
                order.pop('offset', None); order.pop('limit', None)
                if variant == 'shared':
                    other = deepcopy(table); other['id'] = 'other'; page['sections'][1]['components'].append(other)
                elif variant == 'none': table['props']['pagination'] = {'mode': 'none'}
                elif variant == 'missing-total': source['initial'].pop('totalCount')
                elif variant == 'computed': page['dataSources']['records']['compute'] = [{'op': 'pivot'}]
                elif variant == 'offset': order['offset'] = 20
                elif variant == 'limit-mismatch': order['limit'] = 50
                before = deepcopy(page)
                add_query_table_pagination(page)
                self.assertEqual(page, before)
