"""End-to-end public tools: object cards, exact evidence, layout, privacy and immutable revision."""
import json
import sys
import unittest
from copy import deepcopy
from pathlib import Path
from fastmcp import Client
from test_authoring_turns import Turns
from test_authoring_candidates import MemoryCandidates
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'model-evals'))
from scenario_flow_server import dependencies
from metriccanvas_authoring.adapters.inbound.unified_content_mcp import create_unified_content_mcp_server
from metriccanvas_authoring.domain.page_validation import validate_page_document


def plan():
    cards=[]
    for object, evidence in [('total','total-card'), ('core','core-card'), ('communication','communication-card')]:
        cards.append({'id':object,'type':'data','source':'totals','component':'metricCard','fields':['annual-total','year-over-year','current-month','month-over-month'],
            'title':object,'purpose':'primary-value','match':{'field':'scope','equals':object},
            'presentation':{'kind':'metric-summary','metrics':[
                {'field':'annual-total','changes':[{'field':'year-over-year','label':'同比','evidenceRef':evidence+'-0-0'}]},
                {'field':'current-month','changes':[{'field':'month-over-month','label':'环比','evidenceRef':evidence+'-1-0'}]}]}})
    return {'version':'2','scene':'business-report','question':'业务表现如何','dataContextVersion':'flow-fixture-20260917',
        'dataRequests':[{'dataSourceId':'totals','businessDomain':'流水概览','metrics':[{'kind':'metric','name':m} for m in ['annual-total','year-over-year','current-month','month-over-month']],
                         'groupBy':['scope'],'filters':[],'time':{'start':'2026-02','end':'2026-02','granularity':'month','providedBy':'user'}}],
        'sections':[{'id':'business','title':'业务表现','pattern':'overview-with-trend','businessQuestion':'各业务当前如何','businessObject':'整体及板块','distinctFrom':'当前规模与变化', 'blocks':cards}]}


class SectionPresentationTests(unittest.IsolatedAsyncioTestCase):
    async def invoke(self, p, deps=None):
        deps=deps or dependencies()
        async with Client(create_unified_content_mcp_server(deps,Turns('new'),candidate_store=MemoryCandidates())) as c:
            return (await c.call_tool('create_content_page',{'context_ref':'current-context','title':'业务报告','request':{'plan':p}})).structured_content

    async def test_public_object_cards_have_surface_main_change_binding_and_format(self):
        result=await self.invoke(plan()); self.assertTrue(result['ok'],result)
        self.assertEqual(result['modelSummary']['status'],'changed',result)
        page=result['artifactEnvelope']['artifact']['document']; self.assertEqual(validate_page_document(page),[])
        cards=[c for c in page['sections'][1]['components'] if c['type']=='metricCard']
        self.assertEqual(len(cards),3)
        for c in cards:
            self.assertEqual(c['props']['variant'],'compactSummary'); self.assertEqual(c['layout']['span'],4)
            self.assertEqual(len(c['props']['rows']),2)
            for row in c['props']['rows']:
                self.assertEqual(row['valueField']['format'],'compact-million-2')
                for change in row['changes']:
                    self.assertEqual(change['field']['format'],'percent-1')
                    self.assertEqual(change['field']['match'],row['valueField']['match'])
        self.assertNotIn('rows',json.dumps(result['modelSummary']))
        self.assertEqual(result['modelSummary']['queryCounts']['executed'],1)

    async def test_forged_evidence_is_not_trusted_and_absent_adapter_is_unknown(self):
        from dataclasses import replace
        p=plan(); p['sections'][0]['blocks'][0]['presentation']['metrics'][0]['changes'][0]['evidenceRef']='forged'
        result=await self.invoke(p)
        self.assertEqual(result['modelSummary']['status'],'partial')
        self.assertIn('STRUCTURE_CHANGE_RELATION_UNVERIFIED',str(result['modelSummary']))
        p=plan(); deps=replace(dependencies(),metric_relations=None)
        result=await self.invoke(p,deps); self.assertFalse(result['ok'])
        p['dataRequests'][0]['trustedRelations']={'year-over-year':'annual-total'}
        self.assertFalse((await self.invoke(p))['ok'])

    async def test_wrong_object_and_time_evidence_rejected(self):
        p=plan(); p['sections'][0]['blocks'][0]['match']['equals']='core'
        result=await self.invoke(p)
        self.assertIn('STRUCTURE_CHANGE_RELATION_UNVERIFIED',str(result['modelSummary']))
        from dataclasses import replace
        deps=dependencies(); original=deps.metric_relations
        class Stale:
            async def resolve(self,*args):
                r=await original.resolve(*args)
                for item in r['relations']: item['time']['start']='2025-01'
                return r
        result=await self.invoke(plan(),replace(deps,metric_relations=Stale()))
        self.assertFalse(result['ok'])

    async def test_multiple_bad_sources_and_independent_text_survive_without_query(self):
        p=plan(); p['dataRequests']=[]
        for i,b in enumerate(p['sections'][0]['blocks']): b['source']='missing-'+str(i)
        p['sections'][0]['blocks'].append({'id':'note','type':'text','purpose':'explanation','body':'原始人工说明'})
        deps=dependencies(); result=await self.invoke(p,deps)
        self.assertTrue(result['ok']); self.assertEqual(len(deps.dqe.calls),0)
        self.assertEqual(len(result['modelSummary']['issues']),3)
        self.assertIn('原始人工说明',str(result['artifactEnvelope']))

    async def test_same_data_trend_table_overlap_kept(self):
        p=plan(); blocks=p['sections'][0]['blocks']
        table={'id':'check','type':'data','source':'totals','component':'table','fields':['scope','annual-total'], 'title':'核对','purpose':'reconciliation'}
        blocks.extend([{**table,'id':'compare','component':'barChart','purpose':'distribution'},table])
        result=await self.invoke(p); self.assertTrue(result['ok'],result)
        self.assertEqual(len(result['modelSummary']['overlapFindings']),1)
        self.assertEqual(result['modelSummary']['queryCounts']['executed'],1)

    async def test_source_reuse_uses_identical_presentation_and_no_query(self):
        deps=dependencies()
        async with Client(create_unified_content_mcp_server(deps,Turns('new'),candidate_store=MemoryCandidates())) as c:
            result=(await c.call_tool('create_content_page',{'context_ref':'current-context','title':'报告','request':{'plan':plan()}})).structured_content
            original=result['artifactEnvelope']['artifact']['document']['sections'][1]['components'][0]
            b=deepcopy(plan()['sections'][0]['blocks'][0]); b['id']='reused'
            edited=(await c.call_tool('edit_page',{'context_ref':'current-context','candidate_ref':result['modelSummary']['candidateRef'],
                'request':{'operations':[{'id':'reuse','type':'add_source_component','sectionId':'business','block':b}]}})).structured_content
            self.assertTrue(edited['ok'],edited)
            component=next(x for x in edited['artifactEnvelope']['artifact']['document']['sections'][1]['components'] if x['id']=='reused')
            self.assertEqual(component,{**original,'id':'reused'}); self.assertEqual(len(deps.dqe.calls),1)

    async def test_schema_contract_and_program_privacy_do_not_accept_raw_or_trust_input(self):
        from metriccanvas_authoring.domain.structure_preflight import preflight
        for key in ['trustedRelations','rows','query','credentials']:
            p=plan(); p['dataRequests'][0][key]='private-value'
            errors=preflight(p)
            self.assertTrue(errors); self.assertNotIn('private-value',str(errors))

    async def test_full_result_beyond_initial_sample_supports_unique_row(self):
        from metriccanvas_authoring.domain.execution import DqeExecutionResult
        deps=dependencies(); original=deps.dqe.execute
        async def many(query):
            r=await original(query); rows=[{**r.rows[0],'scope':'object-'+str(i)} for i in range(30)]
            return DqeExecutionResult(rows=rows,total_count=30,captured_at=r.captured_at)
        deps.dqe.execute=many
        p=plan(); p['sections'][0]['blocks']=p['sections'][0]['blocks'][:1]
        b=p['sections'][0]['blocks'][0]; b['match']['equals']='object-29'
        b['fields']=['current-month']; b['presentation']['metrics']=[{'field':'current-month'}]
        result=await self.invoke(p,deps); self.assertTrue(result['ok'],result)
        page=result['artifactEnvelope']['artifact']['document']
        self.assertEqual(len(page['dataSources']['totals']['source']['initial']['rows']),30)
        self.assertNotIn('rows',str(result['modelSummary']))

    async def test_atomic_revision_zero_layout_query_and_affected_request_only(self):
        deps=dependencies(); store=MemoryCandidates()
        async with Client(create_unified_content_mcp_server(deps,Turns('new'),candidate_store=store)) as c:
            first=(await c.call_tool('create_content_page',{'context_ref':'current-context','title':'报告','request':{'plan':plan()}})).structured_content
            self.assertTrue(first['ok'],first)
            record=first['artifactEnvelope']['artifact']; original=deepcopy(record)
            revision={'structureRevision':{'planVersion':'2','parentVersion':1,'patches':[{'type':'set-section','sectionId':'business','changes':{'title':'人工标题'}}]}}
            second=(await c.call_tool('edit_page',{'context_ref':'current-context','candidate_ref':record['candidateRef'],'request':revision})).structured_content
            self.assertTrue(second['ok'],second); self.assertEqual(len(deps.dqe.calls),1)
            record2=second['artifactEnvelope']['artifact']; self.assertEqual(record2['document']['sections'][1]['components'],record['document']['sections'][1]['components'])
            b=deepcopy(plan()['sections'][0]['blocks'][0]); b['title']='整体'; b['width']='half'
            revision['structureRevision'].update(parentVersion=2,patches=[{'type':'replace-block','blockId':'total','block':b}])
            third=(await c.call_tool('edit_page',{'context_ref':'current-context','candidate_ref':record2['candidateRef'],'request':revision})).structured_content
            self.assertTrue(third['ok'],third); self.assertEqual(len(deps.dqe.calls),1)
            self.assertEqual(third['artifactEnvelope']['artifact']['document']['sections'][1]['title'],'人工标题')
            self.assertEqual(record,original)
            stale=(await c.call_tool('edit_page',{'context_ref':'current-context','candidate_ref':record['candidateRef'],'request':revision})).structured_content
            self.assertFalse(stale['ok']); self.assertIn('STRUCTURE_PARENT_VERSION_MISMATCH',str(stale))


if __name__=='__main__': unittest.main()
