import unittest

from metriccanvas_authoring.domain.structure_preflight import preflight


class StructurePreflightTests(unittest.TestCase):
    def test_collects_schema_errors_without_querying(self):
        issues = preflight({'version': '2', 'scene': 'custom', 'question': '', 'dataRequests': [], 'sections': []})
        self.assertGreaterEqual(len(issues), 1)
        self.assertTrue(all(issue['code'] == 'STRUCTURE_PLAN_INVALID' for issue in issues))

    def test_v2_requires_business_semantics(self):
        plan = {'version': '2', 'scene': 'custom', 'question': 'x', 'dataContextVersion': 'v', 'dataRequests': [],
                'sections': [{'id': 's', 'title': 'x', 'pattern': 'custom', 'blocks': [{'id': 'n', 'type': 'text', 'body': 'x'}]}]}
        self.assertTrue(preflight(plan))


if __name__ == '__main__':
    unittest.main()
