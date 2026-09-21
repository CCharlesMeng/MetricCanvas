"""Offline page round trips against an extracted, immutable older authoring bundle.

Use the repository test venv. This exercises real public MCP creation and the old
page editor; synthetic data/identity ports issue no external requests. It does
not exercise provider writes, model evaluation, or pending-operation rollback.
"""
from __future__ import annotations

import argparse
import asyncio
from copy import deepcopy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
BUNDLE = ROOT / 'metriccanvas-authoring'
os.environ['METRICCANVAS_BUNDLE_ROOT'] = str(BUNDLE)
sys.path[:0] = [str(BUNDLE / 'tool'), str(BUNDLE / 'test-harness'), str(BUNDLE / 'test-harness/tests')]
from fastmcp import Client
from test_unified_content_mcp import dependencies
from test_authoring_turns import Turns
from test_authoring_candidates import MemoryCandidates
from test_unified_composition import data_op, text_op
from metriccanvas_authoring.entrypoints.compat.unified_content_mcp import create_unified_content_mcp_server
from metriccanvas_authoring.domain.page_validation import normalize_page_document, validate_page_document
from metriccanvas_authoring.application.edit_page import document_sha256

# A separate process prevents current modules/contracts leaking into the old reader.
OLD_READER = '''
import json, sys
from copy import deepcopy
from metriccanvas_authoring.domain.page_validation import normalize_page_document, validate_page_document
from metriccanvas_authoring.domain.page_editing import edit_page_document
value = json.load(sys.stdin)
original = deepcopy(value['document'])
normalized = normalize_page_document(original)
assert normalized['ok'], normalized
assert normalized['document'] == original, 'old normalization changed new page'
result = edit_page_document(original, {'operations': [value['operation']]})
assert result['status'] == 'changed', result
assert original == value['document'], 'old editor mutated input'
assert not validate_page_document(result['document'])
future = deepcopy(original); future['schemaVersion'] = '99.0'
assert validate_page_document(future), 'old reader accepted future protocol'
print(json.dumps(result['document'], ensure_ascii=False))
'''


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()


async def verify(baseline: Path):
    records = []
    for layout in ('report', 'dashboard'):
        turns = Turns('new')
        async with Client(create_unified_content_mcp_server(dependencies(), turns, candidate_store=MemoryCandidates())) as client:
            result = (await client.call_tool('create_content_page', {
                'context_ref': 'current-context', 'title': 'Compatibility page', 'layout': layout,
                'request': {'operations': [data_op(), text_op(),
                    {'id': 'span', 'type': 'set_component_layout', 'componentId': 'new-chart',
                     'changes': {'span': 5}, 'dependsOn': ['data']}]}
            })).structured_content
            assert result['ok'], result
            document = result['artifactEnvelope']['artifact']['document']
        operation = {'id': 'old-edit', 'type': 'set_title', 'componentId': 'page-header', 'title': 'Edited by old group'}
        env = dict(os.environ, PYTHONPATH=str(baseline / 'tool'), METRICCANVAS_BUNDLE_ROOT=str(baseline))
        completed = subprocess.run([sys.executable, '-c', OLD_READER], input=json.dumps({'document': document, 'operation': operation}),
                                   text=True, capture_output=True, check=True, cwd=baseline, env=env)
        returned = json.loads(completed.stdout)
        expected = deepcopy(document)
        for section in expected['sections']:
            for component in section['components']:
                if component['id'] == 'page-header': component['props']['title'] = operation['title']
        assert returned == expected, 'old edit lost unrelated fields, order, spans or data'
        normalized = normalize_page_document(returned)
        assert normalized['ok'] and normalized['document'] == expected
        assert not validate_page_document(returned)
        # The new public tool consumes the old editor's result as a trusted baseline.
        next_turn = Turns()
        from dataclasses import replace
        next_turn.baseline = replace(next_turn.baseline, document=returned, document_sha256=document_sha256(returned))
        next_turn.document_json = json.dumps(returned, ensure_ascii=False)
        next_turn.binding['documentSha256'] = hashlib.sha256(next_turn.document_json.encode()).hexdigest()
        next_turn.binding['selectedComponentId'] = None
        next_turn.binding['pageId'] = returned['id']
        async with Client(create_unified_content_mcp_server(dependencies(), next_turn, candidate_store=MemoryCandidates())) as client:
            edited = (await client.call_tool('edit_page', {'context_ref': 'current-context', 'request': {'operations': [
                dict(operation, id='new-edit', title='Edited again by new group')
            ]}})).structured_content
            assert edited['ok'], edited
            final = edited['artifactEnvelope']['artifact']['document']
        final_expected = deepcopy(expected)
        for section in final_expected['sections']:
            for component in section['components']:
                if component['id'] == 'page-header': component['props']['title'] = 'Edited again by new group'
        assert final == final_expected, 'new edit lost old page content'
        records.append({'layout': layout, 'schemaVersion': document['schemaVersion'],
                        'newDocumentSha256': digest(document), 'oldEditedSha256': digest(returned),
                        'newReeditedSha256': digest(final), 'status': 'passed',
                        'checks': ['old-normalization-exact', 'old-controlled-edit', 'unrelated-content-preserved',
                                   'new-normalization-exact', 'new-public-edit', 'future-protocol-rejected']})
    return records


def runtime_fingerprint(bundle):
    hasher = hashlib.sha256()
    for directory in ('tool', 'contracts', 'contract-snapshot'):
        for path in sorted((bundle / directory).rglob('*')):
            if path.is_file() and '__pycache__' not in path.parts and path.suffix != '.pyc':
                hasher.update(str(path.relative_to(bundle)).encode() + b'\0')
                hasher.update(hashlib.sha256(path.read_bytes()).digest())
    hasher.update((bundle / 'bundle.json').read_bytes())
    return hasher.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline-bundle', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    baseline = args.baseline_bundle.resolve()
    if baseline == BUNDLE.resolve(): parser.error('baseline must be a separate older snapshot')
    records = asyncio.run(verify(baseline))
    args.output.write_text(json.dumps({'scope': 'offline page round-trip only', 'realModelRequests': 0,
                                      'providerWrites': 0, 'baselineRuntimeSha256': runtime_fingerprint(baseline),
                                      'currentRuntimeSha256': runtime_fingerprint(BUNDLE), 'cases': records}, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(records)} cross-version page round trips passed')


if __name__ == '__main__': main()
