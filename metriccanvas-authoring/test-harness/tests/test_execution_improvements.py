"""Regressions from the 9235/9236 audit, through public composition/semantic seams."""
import unittest
import json
from pathlib import Path

CASES = json.loads((Path(__file__).resolve().parents[1] / "fixtures/execution-improvements.cases.json").read_text())
from copy import deepcopy
from types import SimpleNamespace
from metriccanvas_authoring.pages.referenced import compose
from metriccanvas_authoring.data.data_context import _project_surface


def record(total=41, row_count=41):
    rows = [{'d': str(i), 'v': i + 1} for i in range(row_count)]
    return {'rows': rows, 'returnedCount': len(rows), 'totalCount': total,
        'request': {'businessDomain': 'test', 'metrics': [{'kind': 'metric', 'name': 'v'}],
                    'groupBy': ['d'], 'filters': []},
        'source': {'fields': {'d': {'queryField': 'd', 'type': 'string', 'role': 'dimension', 'label': 'd', 'nullable': False},
                              'v': {'queryField': 'v', 'type': 'number', 'role': 'measure', 'label': 'v', 'nullable': False}},
                   'source': {'type': 'query', 'query': {'language': 'dqe', 'body': {'dsl_list': [{'output_dims': ['d'], 'output_metrics': ['v'], 'order': {}, 'filter': {}}]}},
                              'initial': {'capturedAt': '2026-09-29T00:00:00Z', 'rows': rows[:20], 'totalCount': total if total is not None else row_count}}}}


def request():
    return {'title': 'Report', 'sources': {'data': 'result-test'}, 'sections': [{'id': 'main', 'pattern': 'custom', 'blocks': [
        {'id': 'pie', 'type': 'data', 'source': 'data', 'component': 'pieChart', 'title': 'Share', 'fields': ['d', 'v']}]}]}


class CompositionEvidenceTest(unittest.TestCase):
    def test_complete_rows_compose_without_publishing_partial_pie_initial(self):
        for count in CASES['fullRowCounts']:
            value = compose(SimpleNamespace(binding={'pageId': 'test'}), request(), {'data': record(count, count)})
            self.assertEqual(value['status'], 'changed', value)
            if count > 20:
                self.assertNotIn('initial', value['document']['dataSources']['data']['source'])

    def test_unknown_or_truncated_totals_do_not_prove_proportion(self):
        for total in CASES['incompleteTotals']:
            value = compose(SimpleNamespace(binding={'pageId': 'test'}), request(), {'data': record(total)})
            self.assertEqual(value['operations'][0]['issues'][0]['code'], 'STRUCTURE_INCOMPLETE_PROPORTION')


class SemanticAliasTest(unittest.TestCase):
    def test_canonical_names_survive_alias_conflicts_and_input_order(self):
        entries = [{'name': name, 'type': 'number', 'nullable': False, 'sensitive': False, 'aliases': aliases}
                   for name, aliases in [('a', ['shared', 'b']), ('b', ['shared'])]]
        for metrics in (entries, list(reversed(entries))):
            surface = _project_surface({'name': 'domain', 'metrics': metrics, 'objects': []})
            self.assertEqual(surface.metric('a').name, 'a')
            self.assertEqual(surface.metric('b').name, 'b')
            self.assertIsNone(surface.metric('shared'))
            self.assertEqual(surface.ambiguous_metrics['shared'], ('a', 'b'))

class ReferencedEditTest(unittest.IsolatedAsyncioTestCase):
    async def test_edit_uses_full_record_and_tracks_scope(self):
        from metriccanvas_authoring.pages.referenced import edit
        r = record()
        base_request = request(); base_request['sections'][0]['blocks'][0]['component'] = 'table'
        built = compose(SimpleNamespace(binding={'pageId':'test'}),base_request,{'data':r})
        block = request()['sections'][0]['blocks'][0]; block['id']='added-pie'; block['purpose']='comparison'
        async def resolve(ref): return r
        async def current(): pass
        edited=await edit(built['document'], {'operations':[{'id':'add','type':'add_result_component',
            'sectionId':'main','resultRef':'verified','block':block}]},resolve,current,
            scope_annotations=built['scopeAnnotations'])
        self.assertEqual(edited['status'],'changed',edited)
        self.assertNotIn('initial', edited['document']['dataSources']['data']['source'])
        notes=[c['props']['body'] for c in edited['document']['sections'][1]['components'] if c['type']=='text']
        self.assertEqual(len(notes),1)
        self.assertEqual(len(edited['scopeAnnotations']),1)

    async def test_match_beyond_sample_and_total_card(self):
        r=record(); req=request(); b=req['sections'][0]['blocks'][0]
        b.update(component='metricCard',fields=['v'],match={'field':'d','equals':'40'})
        built=compose(SimpleNamespace(binding={'pageId':'test'}),req,{'data':r})
        self.assertEqual(built['status'],'changed',built)
        for total in (None,50):
            built=compose(SimpleNamespace(binding={'pageId':'test'}),req,{'data':record(total)})
            self.assertEqual(built['operations'][0]['issues'][0]['code'],'STRUCTURE_ROW_SELECTION_UNVERIFIED')
        del b['match']; r['rows']=[{'v':42}]; r['returnedCount']=r['totalCount']=1
        r['source']['fields'].pop('d')
        r['source']['source']['query']['body']['dsl_list'][0]['output_dims']=[]
        r['source']['source'].pop('initial')
        built=compose(SimpleNamespace(binding={'pageId':'test'}),req,{'data':r})
        self.assertEqual(built['status'],'changed',built)


class ScopeOwnershipTest(unittest.TestCase):
    def test_owned_notes_follow_move_remove_and_preserve_manual_text(self):
        from metriccanvas_authoring.pages.scope_annotations import refresh
        req=request(); req['sections'][0]['blocks'][0]['component']='table'
        built=compose(SimpleNamespace(binding={'pageId':'test'}),req,{'data':record()})
        doc=built['document']; notes=built['scopeAnnotations']
        original=deepcopy(doc)
        component=doc['sections'][1]['components'].pop(0)
        doc['sections'].append({'id':'other','container':'panel','components':[component]})
        moved, adjustments=refresh(doc,notes)
        self.assertEqual(doc['sections'][1]['components'],[])
        self.assertEqual(len(doc['sections'][2]['components']),2)
        self.assertFalse(adjustments)
        doc['sections'][2]['components'].pop(0)
        remaining,_=refresh(doc,moved)
        self.assertFalse(remaining)
        self.assertFalse(doc['sections'][2]['components'])
        original['sections'][1]['components'][-1]['props']['body']='人工口径'
        remaining,_=refresh(original,notes)
        self.assertFalse(remaining)
        self.assertEqual(original['sections'][1]['components'][-1]['props']['body'],'人工口径')

    def test_source_replacement_removes_owned_stale_note_and_requests_review(self):
        from metriccanvas_authoring.pages.scope_annotations import refresh
        req=request(); req['sections'][0]['blocks'][0]['component']='table'
        built=compose(SimpleNamespace(binding={'pageId':'test'}),req,{'data':record()})
        built['document']['dataSources']['data']['fields']['v']['unit']='other'
        notes,adjustments=refresh(built['document'],built['scopeAnnotations'])
        self.assertFalse(notes)
        self.assertEqual(adjustments[0]['code'],'SCOPE_NOTE_REVIEW_REQUIRED')


class SemanticExecutionTest(unittest.IsolatedAsyncioTestCase):
    async def test_ambiguous_alias_fails_only_affected_request_before_dqe(self):
        from dataclasses import replace
        from test_platform_v2 import PlatformV2Test, query_request
        fixture=PlatformV2Test(); fixture.setUp()
        try:
            original=fixture.deps.data_context
            snapshot=await original.current()
            schema=snapshot['executionEnvironments'][0]['schemas'][0]
            metric=schema['metrics'][0]
            metric['aliases']=['shared']
            duplicate=deepcopy(metric); duplicate['name']='other-metric'
            schema['metrics'].append(duplicate)
            class Context:
                async def current(self): return deepcopy(snapshot)
            fixture.deps=replace(fixture.deps,data_context=Context())
            q=query_request(); valid=deepcopy(q['requests'][0]); invalid=deepcopy(valid)
            invalid['dataSourceId']='ambiguous'; invalid['metrics'][0]['name']='shared'
            q['requests']=[valid,invalid]
            result=await fixture.make().query('current-context',q)
            self.assertEqual(result['status'],'partial',result)
            self.assertEqual(result['results'][1]['issues'][0]['code'],'DATA_CONTEXT_NAME_AMBIGUOUS')
            self.assertEqual(len(fixture.deps.dqe.calls),1)
        finally:
            fixture.doCleanups()


class CompositionPolicyTest(unittest.IsolatedAsyncioTestCase):
    async def test_actual_compose_rejects_policy_change_before_save(self):
        from unittest.mock import patch
        from test_platform_v2 import PlatformV2Test, query_request, plan
        from metriccanvas_authoring.work.content_ports import ContentBaselineError
        fixture=PlatformV2Test(); fixture.setUp()
        try:
            with patch.dict('os.environ', {'METRICCANVAS_QUERY_VALIDATION_STRICT':'false'}):
                result=await fixture.app.query('current-context',query_request())
            request={'title':'Report','sources':{'result':result['results'][0]['resultRef']},'sections':plan()['sections']}
            with patch.dict('os.environ', {'METRICCANVAS_QUERY_VALIDATION_STRICT':'true'}):
                with self.assertRaisesRegex(ContentBaselineError,'RESULT_VALIDATION_POLICY_CHANGED'):
                    await fixture.app.mutate('compose','current-context',request)
            self.assertFalse(fixture.service.calls)
        finally: fixture.doCleanups()


class EvidenceCoverageTest(unittest.TestCase):
    def test_model_evidence_contains_every_returned_row(self):
        from metriccanvas_authoring.data.results import QueryResults
        from metriccanvas_authoring.work.state import Limits
        query=QueryResults(None,SimpleNamespace(limits=Limits()),None)
        r=record();r.update(resultRef='test',status='ready',capturedAt='2026-09-29T00:00:00Z')
        r['request']['dataSourceId']='data'
        evidence=query.evidence(r)
        self.assertTrue(evidence['coverage']['resultComplete'])
        self.assertFalse(evidence['coverage']['sampleTruncated'])
        self.assertTrue(evidence['coverage']['complete'])
        self.assertEqual(len(evidence['rows']),41)
        r['totalCount']=None
        self.assertFalse(query.evidence(r)['coverage']['resultComplete'])

    def test_714_rows_survive_evidence_and_explicit_limits_fail_without_sampling(self):
        from metriccanvas_authoring.data.results import QueryResults
        from metriccanvas_authoring.work.state import Limits
        r = record(714, 714)
        r.update(resultRef='test', status='ready', capturedAt='2026-09-29T00:00:00Z')
        r['request']['dataSourceId'] = 'data'
        query = QueryResults(None, SimpleNamespace(limits=Limits()), None)
        payload = {'results': [query.evidence(r)]}
        query.bound(payload)
        self.assertEqual(len(payload['results'][0]['rows']), 714)
        self.assertEqual(payload['results'][0]['rows'][-1]['d'], '713')
        for limits in [Limits(evidence_rows=20), Limits(evidence_bytes=16000)]:
            query.state.limits = limits
            with self.assertRaisesRegex(Exception, 'MODEL_EVIDENCE_LIMIT'):
                query.bound(payload)
            self.assertEqual(len(payload['results'][0]['rows']), 714)

    def test_initial_does_not_invent_a_total_when_upstream_count_is_unknown(self):
        from metriccanvas_authoring.data.executable_units import build_query_source
        from metriccanvas_authoring.data.execution import DqeExecutionResult
        source = build_query_source(SimpleNamespace(fields={}, query_body={}),
            DqeExecutionResult(rows=({'d': 'last'},), total_count=None, captured_at='2026-09-30T00:00:00Z'))
        self.assertNotIn('totalCount', source['source']['initial'])
        self.assertEqual(source['source']['initial']['rows'], [{'d': 'last'}])
