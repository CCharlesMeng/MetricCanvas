from copy import deepcopy
from dataclasses import replace
import unittest
from fastmcp import Client
from test_section_presentation import plan, dependencies
from test_authoring_candidates import MemoryCandidates
from test_authoring_turns import Turns
from metriccanvas_authoring.entrypoints.compat.unified_content_mcp import create_unified_content_mcp_server
from metriccanvas_authoring.data.structure_query_cache import StructureQueryCache
from metriccanvas_authoring.data.execution import DqeExecutionResult


class StructureRevisionTests(unittest.IsolatedAsyncioTestCase):
    async def test_removed_manual_target_fails_before_query_without_mutating_parent(self):
        from metriccanvas_authoring.pages.editing.structure_revision import revise_structure
        deps=dependencies()
        async def current(): return None
        store=MemoryCandidates()
        async with Client(create_unified_content_mcp_server(deps,Turns('new'),candidate_store=store)) as c:
            made=(await c.call_tool('create_content_page',{'context_ref':'current-context','title':'报告',
                  'request':{'plan':plan()}})).structured_content
        self.assertTrue(made['ok'],made)
        parent=await store.get(made['modelSummary']['candidateRef'])
        parent['document']['sections'][1]['components'].pop(0)
        before=deepcopy(parent)
        request={'structureRevision':{'planVersion':'2','parentVersion':1,
                 'patches':[{'type':'replace-block','blockId':'total','block':plan()['sections'][0]['blocks'][0]}]}}
        result=await revise_structure(parent,request,deps,current=current)
        self.assertEqual(result['issues'][0]['code'],'STRUCTURE_TARGET_NOT_FOUND')
        self.assertEqual(parent,before)
        self.assertEqual(len(deps.dqe.calls),1)

    def test_scope_notes_deduplicate_facts_not_order_and_keep_distinct_periods(self):
        from metriccanvas_authoring.pages.composition.page_structure import scope_notes
        first=deepcopy(plan()['dataRequests'][0])
        first['groupBy']=['scope','region']
        first['filters']=[{'dimension':'scope','values':['core','total']}]
        second=deepcopy(first); second['groupBy'].reverse(); second['filters'][0]['values'].reverse()
        second['dataSourceId']='another'; second['time']['providedBy']='model'
        different=deepcopy(first); different['time']['start']='2026-01'
        notes=scope_notes([first,second,different])
        self.assertEqual(len(notes),2)
        self.assertIn('2026-01',notes[1])

    async def test_changed_request_only_executes_one_preserving_other_source_and_manual_title(self):
        deps=dependencies(); p=plan()
        extra={'dataSourceId':'trend','businessDomain':'流水趋势','metrics':[{'kind':'metric','name':'core-actual'}],
               'groupBy':['month'],'filters':[],'time':{'start':'2026-01','end':'2026-12','granularity':'month','providedBy':'user'}}
        p['dataRequests'].append(extra)
        p['sections'].append({'id':'history','title':'历史','pattern':'custom','businessQuestion':'历史如何','businessObject':'Core','distinctFrom':'时间变化',
            'blocks':[{'id':'trend-chart','type':'data','source':'trend','component':'lineChart','fields':['month','core-actual'],'title':'趋势','purpose':'trend'}]})
        async with Client(create_unified_content_mcp_server(deps,Turns('new'),candidate_store=MemoryCandidates())) as c:
            a=(await c.call_tool('create_content_page',{'context_ref':'current-context','title':'报告','request':{'plan':p}})).structured_content
            self.assertTrue(a['ok'],a); self.assertEqual(len(deps.dqe.calls),2)
            r=a['artifactEnvelope']['artifact']
            changed=deepcopy(p['dataRequests'][0]); changed['metrics'].append({'kind':'metric','name':'annual-projection'})
            b=(await c.call_tool('edit_page',{'context_ref':'current-context','candidate_ref':r['candidateRef'],
                'request':{'structureRevision':{'planVersion':'2','parentVersion':1,'patches':[{'type':'replace-request','request':changed}]}}})).structured_content
            self.assertTrue(b['ok'],b); self.assertEqual(len(deps.dqe.calls),3)
            self.assertEqual(b['modelSummary']['queryCounts']['executed'],1)
            newer=b['artifactEnvelope']['artifact']['document']
            self.assertEqual(newer['sections'][2],r['document']['sections'][2])
            self.assertEqual(newer['dataSources']['trend'],r['document']['dataSources']['trend'])

    async def test_cache_authority_snapshot_field_contract_and_incomplete_results(self):
        class Port:
            def __init__(self): self.calls=0; self.count=1
            async def execute(self,q):
                self.calls+=1; return DqeExecutionResult(rows=[{'x':1}],total_count=self.count)
        port=Port(); q={'language':'dqe','body':{},'fieldMappings':{'x':{'type':'number'}}}
        first=StructureQueryCache(port,{'actor':'a'}, {'version':'v'})
        await first.execute(q); await first.execute(q); self.assertEqual(port.calls,1)
        same=StructureQueryCache(port,{'actor':'a'},{'version':'v'},first.entries)
        await same.execute(q); self.assertEqual(port.calls,1)
        for scope,snapshot,query in [({'actor':'b'},{'version':'v'},q),
                ({'actor':'a'},{'version':'v','permissions':'changed'},q),
                ({'actor':'a'},{'version':'v'},{**q,'fieldMappings':{'x':{'type':'money'}}})]:
            cache=StructureQueryCache(port,scope,snapshot,first.entries)
            before=port.calls; await cache.execute(query); self.assertEqual(port.calls,before+1)
        port.count=100
        incomplete=StructureQueryCache(port,{},{}); await incomplete.execute(q); await incomplete.execute(q)
        self.assertEqual(incomplete.hits,0)

    async def test_discovery_provider_failures_safe_and_snapshot_pagination(self):
        class Broken:
            async def resolve(self,*args): raise RuntimeError('credential-private-rows')
        deps=replace(dependencies(),metric_relations=Broken())
        async with Client(create_unified_content_mcp_server(deps,Turns('new'),candidate_store=MemoryCandidates())) as c:
            output=(await c.call_tool('discover_data_context',{'context_ref':'current-context','business_domain':'流水概览','limit':2})).structured_content
            self.assertEqual(output['metricRelations']['status'],'unavailable')
            self.assertEqual(output['coverage']['returned'],2)
            self.assertNotIn('credential-private',str(output))
            stale=(await c.call_tool('discover_data_context',{'context_ref':'current-context','business_domain':'流水概览','offset':2,'data_context_version':'stale'})).structured_content
            self.assertFalse(stale['ok'])


if __name__=='__main__': unittest.main()
