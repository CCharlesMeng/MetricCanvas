"""Package identity is asserted before layout snapshots use stable placeholders."""
from copy import deepcopy
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[3]
SPEC = importlib.util.spec_from_file_location('mc_fixture_generator', ROOT / 'tools/scripts/mc-content-fixtures.py')
fixtures = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(fixtures)
from mc_content import compile_layout, evaluate, inspect_assembly, verify_package


def actual_report(root):
    _, manifest = verify_package(root)
    matrix = json.loads((root / 'eval/fixtures/example-matrix.json').read_text())
    compiled = compile_layout(matrix['checks'][0]['input'], root=root)
    document = {'id': 'snapshot-test', 'schemaVersion': manifest['alignedWith']['pageSchemaVersion'],
        'layout': 'dashboard', 'dataSources': {}, 'sections': [{'id': 'header', 'components': [
            {'id': 'page-header', 'type': 'reportHeader', 'layout': {'span': 12}, 'props': {'title': '合成验收'}}]},
            {'id': 'summary', 'components': [
            {'id': 'note', 'type': 'text', 'layout': {'span': 12}, 'props': {'body': '结构验收'}}]}]}
    inspection = inspect_assembly(document, compiled['inspectionSpec'], root=root)
    assert compiled['status'] == 'ok', compiled
    assert inspection['status'] == 'ok', inspection
    return {'compile': compiled, 'inspection': inspection}, manifest


def replace_identity(value, location, replacement):
    parent = value
    for key in location[:-1]:
        parent = parent[key]
    parent[location[-1]] = replacement


def adjacent_package(root):
    target = root / 'references/authoring-knowledge/model.json'
    target.write_bytes(target.read_bytes() + b'\n')
    file = root / 'mc-content.version.json'
    manifest = json.loads(file.read_text())
    entry = next(item for item in manifest['files'] if item['file'] == target.relative_to(root).as_posix())
    entry['sha256'] = hashlib.sha256(target.read_bytes()).hexdigest()
    serialized = (json.dumps(manifest['files'], ensure_ascii=False, indent=2) + '\n').encode()
    manifest['contentSha256'] = hashlib.sha256(serialized).hexdigest()
    manifest['contentVersion'] = '1-' + manifest['contentSha256'][:16]
    file.write_text(json.dumps(manifest), encoding='utf-8')


class FixtureStabilityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.report, cls.manifest = actual_report(fixtures.CONTENT)

    def test_adjacent_verified_packages_keep_stable_structure_and_actual_compile_inspection(self):
        before = fixtures.snapshot_value(fixtures.LAYOUT_FIXTURES / 'business-report.json', self.report, self.manifest)
        with tempfile.TemporaryDirectory(prefix='mc-snapshot-package-') as directory:
            installed = Path(directory) / 'mc-content'
            shutil.copytree(fixtures.CONTENT, installed, ignore=shutil.ignore_patterns('__pycache__'))
            adjacent_package(installed)
            report, manifest = actual_report(installed)
            after = fixtures.snapshot_value(fixtures.LAYOUT_FIXTURES / 'business-report.json', report, manifest)
            self.assertNotEqual(manifest['contentSha256'], self.manifest['contentSha256'])
            self.assertNotEqual(manifest['contentVersion'], self.manifest['contentVersion'])
            self.assertEqual(after, before)
            self.assertNotEqual(report['compile']['contentSha256'], self.report['compile']['contentSha256'])
            with self.assertRaisesRegex(ValueError, 'identity mismatch'):
                fixtures.snapshot_value(fixtures.LAYOUT_FIXTURES / 'business-report.json', self.report, manifest)

    def test_all_declared_identity_locations_require_current_values_and_cannot_disappear(self):
        matrix = json.loads((fixtures.CONTENT / 'eval/fixtures/example-matrix.json').read_text())
        diagnostics = {'compile': self.report['compile'], 'required': self.report['compile'],
            'evaluation': evaluate(matrix, root=fixtures.CONTENT)}
        values = {'business-report.json': self.report, 'usage-report.json': self.report, 'diagnostics.json': diagnostics}
        for name, value in values.items():
            normalized = fixtures.snapshot_value(fixtures.LAYOUT_FIXTURES / name, value, self.manifest)
            self.assertEqual(set(fixtures.content_identity_paths(normalized)), set(fixtures.LAYOUT_IDENTITIES[name]))
            for location in fixtures.LAYOUT_IDENTITIES[name]:
                with self.subTest(file=name, location=location):
                    tampered = deepcopy(value)
                    replace_identity(tampered, location, 'old-or-tampered-identity')
                    with self.assertRaisesRegex(ValueError, 'identity mismatch'):
                        fixtures.snapshot_value(fixtures.LAYOUT_FIXTURES / name, tampered, self.manifest)
                    missing = deepcopy(value)
                    parent = missing
                    for key in location[:-1]:
                        parent = parent[key]
                    del parent[location[-1]]
                    with self.assertRaisesRegex(ValueError, 'identity fields'):
                        fixtures.snapshot_value(fixtures.LAYOUT_FIXTURES / name, missing, self.manifest)

    def test_plan_document_and_capability_versions_remain_observable_and_input_unchanged(self):
        value = deepcopy(self.report)
        value['planSha256'] = self.manifest['contentSha256']
        value['documentSha256'] = 'document-identity'
        value['schemaVersion'] = '6.107'
        value['templateVersion'] = '1'
        original = deepcopy(value)
        file = fixtures.LAYOUT_FIXTURES / 'usage-report.json'
        normalized = fixtures.snapshot_value(file, value, self.manifest)
        self.assertEqual(value, original)
        self.assertEqual(normalized['planSha256'], self.manifest['contentSha256'])
        self.assertEqual(normalized['documentSha256'], 'document-identity')
        self.assertEqual(normalized['schemaVersion'], '6.107')
        self.assertEqual(normalized['templateVersion'], '1')
        changed = deepcopy(value)
        changed['compile']['plan']['title'] = 'Changed structure'
        self.assertNotEqual(fixtures.snapshot_value(file, changed, self.manifest), normalized)
        changed = deepcopy(value)
        changed['compile']['inspectionSpec']['correlation']['planSha256'] = 'changed-plan'
        self.assertNotEqual(fixtures.snapshot_value(file, changed, self.manifest), normalized)

    def test_only_three_layout_snapshots_use_placeholders_and_new_identity_paths_require_review(self):
        page_file = ROOT / 'pages/capabilities/layout/mc-layout-business-report.json'
        self.assertIs(fixtures.snapshot_value(page_file, self.report, self.manifest), self.report)
        unknown = fixtures.LAYOUT_FIXTURES / 'unreviewed.json'
        with self.assertRaisesRegex(ValueError, 'identity fields'):
            fixtures.snapshot_value(unknown, self.report, self.manifest)
        changed = deepcopy(self.report)
        changed['unexpected'] = {'contentSha256': self.manifest['contentSha256']}
        with self.assertRaisesRegex(ValueError, 'identity fields'):
            fixtures.snapshot_value(fixtures.LAYOUT_FIXTURES / 'business-report.json', changed, self.manifest)


if __name__ == '__main__':
    unittest.main()
