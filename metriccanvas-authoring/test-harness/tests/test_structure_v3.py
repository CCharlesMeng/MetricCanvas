"""Public create/edit contract: flexible presentation without changing data authority."""
from copy import deepcopy
import json
from pathlib import Path
import unittest
from fastmcp import Client
from test_section_presentation import plan, dependencies
from test_authoring_turns import Turns
from test_authoring_candidates import MemoryCandidates
from metriccanvas_authoring.entrypoints.compat.unified_content_mcp import create_unified_content_mcp_server


def v3_plan():
    p = plan()
    p['version'] = '3'
    s = p['sections'][0]
    s.pop('title')
    s['container'] = 'plain'
    s['blocks'][0]['width'] = 'full'
    s['blocks'][0]['presentation']['variant'] = 'compactStrip'
    for b in s['blocks'][1:]: b['width'] = 'half'
    return p


class StructureV3Tests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        import scenario_flow_server as fixture
        for name in ('FIXTURE','PAGE','SOURCES'):
            self.addCleanup(setattr,fixture,name,deepcopy(getattr(fixture,name)))

    async def create(self, p, deps=None):
        deps = deps or dependencies()
        async with Client(create_unified_content_mcp_server(deps, Turns('new'), candidate_store=MemoryCandidates())) as c:
            return (await c.call_tool('create_content_page', {'context_ref':'current-context', 'title':'测试', 'request':{'plan':p}})).structured_content

    async def test_summary_hierarchy_no_technical_scope_dump(self):
        r = await self.create(v3_plan())
        self.assertTrue(r['ok'], r)
        page = r['artifactEnvelope']['artifact']['document']
        section = page['sections'][1]
        self.assertNotIn('title', section)
        self.assertEqual([c['layout']['span'] for c in section['components']], [12,6,6])
        self.assertEqual(section['components'][0]['props']['variant'], 'compactStrip')
        text = str([c['props'] for s in page['sections'] for c in s['components'] if c['type']=='text'])
        self.assertNotIn('按scope', text)
        self.assertNotIn('month', text)
        self.assertEqual(text.count('2026年2月'), 0)
        self.assertNotIn('查询范围', text)

    async def test_bar_and_table_presentation_and_zero_query_revision(self):
        p=v3_plan(); s=p['sections'][0]
        s['blocks']=[{'id':'compare','type':'data','source':'totals','component':'barChart','fields':['scope','annual-total'],
                      'title':'对象比较','purpose':'comparison','width':'half','presentation':{'kind':'bar-comparison','horizontal':True}},
                     {'id':'records','type':'data','source':'totals','component':'table','fields':['scope','annual-total'],
                      'title':'精确核对','purpose':'reconciliation','width':'half','presentation':{'kind':'record-list','density':'compact','subtitle':'仅作核对'}}]
        deps=dependencies()
        async with Client(create_unified_content_mcp_server(deps,Turns('new'),candidate_store=MemoryCandidates())) as c:
            a=(await c.call_tool('create_content_page',{'context_ref':'current-context','title':'测试','request':{'plan':p}})).structured_content
            self.assertTrue(a['ok'],a)
            before=a['artifactEnvelope']['artifact']['document']
            self.assertTrue(before['sections'][1]['components'][0]['props']['horizontal'])
            self.assertEqual(before['sections'][1]['components'][1]['props']['variant'],'reportCompact')
            block=deepcopy(s['blocks'][1]); block['presentation']['subtitle']='更新说明'
            b=(await c.call_tool('edit_page',{'context_ref':'current-context','candidate_ref':a['modelSummary']['candidateRef'],
                 'request':{'structureRevision':{'planVersion':'3','parentVersion':1,'patches':[{'type':'replace-block','blockId':'records','block':block}]}}})).structured_content
            self.assertTrue(b['ok'],b)
            self.assertEqual(len(deps.dqe.calls),1)
            after=b['artifactEnvelope']['artifact']['document']
            self.assertEqual(before['dataSources'],after['dataSources'])
            self.assertEqual(before['sections'][1]['components'][0],after['sections'][1]['components'][0])
            self.assertEqual(after['sections'][1]['components'][1]['props']['subtitle'],'更新说明')

    async def test_bad_presentation_stops_before_query(self):
        p=v3_plan(); p['sections'][0]['blocks'][0]['presentation']={'kind':'bar-comparison','horizontal':True}
        deps=dependencies(); r=await self.create(p,deps)
        self.assertFalse(r['ok'],r)
        self.assertEqual(len(deps.dqe.calls),0)
        self.assertIn('/presentation',str(r['modelSummary']))

    async def test_safe_leaf_diagnostics(self):
        p=plan(); p['sections'][0]['blocks'][0]['purpose']='secret-value'
        deps=dependencies(); r=await self.create(p,deps)
        summary=r['modelSummary']
        self.assertIn('/sections/0/blocks/0/purpose',str(summary))
        self.assertIn('allowedValues',str(summary))
        self.assertNotIn('secret-value',str(summary))
        self.assertEqual(len(deps.dqe.calls),0)

    async def test_missing_title_has_structured_error(self):
        deps=dependencies()
        async with Client(create_unified_content_mcp_server(deps,Turns('new'),candidate_store=MemoryCandidates())) as c:
            r=(await c.call_tool('create_content_page',{'context_ref':'current-context','request':{'plan':v3_plan()}})).structured_content
        self.assertFalse(r['ok'])
        self.assertIn('/title',str(r['modelSummary']))
        self.assertEqual(len(deps.dqe.calls),0)

    async def test_legacy_version_keeps_scope_and_variant(self):
        r=await self.create(plan()); self.assertTrue(r['ok'],r)
        blocks=r['artifactEnvelope']['artifact']['document']['sections'][1]['components']
        self.assertEqual(blocks[0]['props']['variant'],'compactSummary')
        self.assertTrue(blocks[-1]['props']['body'].startswith('数据口径：'))

    async def test_business_reference_four_sources_through_public_create(self):
        import scenario_flow_server as fixture
        fixture.configure_rich_fixture()
        p=json.loads((Path(__file__).parents[1]/'fixtures/structure-v3-business.json').read_text())
        deps=dependencies(); r=await self.create(p,deps)
        self.assertTrue(r['ok'],r)
        self.assertEqual(r['modelSummary']['status'],'changed')
        self.assertEqual(len(deps.dqe.calls),4)
        page=r['artifactEnvelope']['artifact']['document']
        blocks=[c for s in page['sections'] for c in s['components']]
        self.assertEqual([c['layout']['span'] for c in blocks if c['type']=='metricCard'],[12,4,4,4])
        self.assertEqual([len(c['props']['columns']) for c in blocks if c['type']=='table'],[3,3])
        chart=next(c for c in blocks if c['type']=='barChart')
        self.assertEqual(len(chart['props']['series']),2)
        self.assertTrue(chart['props']['horizontal'])
        self.assertNotIn('customer-name',str([c['props'] for c in blocks if c['type']=='text']))

    async def test_usage_trend_does_not_require_business_template(self):
        import scenario_flow_server as fixture
        fixture.configure_usage_fixture()
        p=v3_plan(); p['scene']='usage-report'
        p['dataRequests']=[{'dataSourceId':'usage','businessDomain':'用量趋势',
            'metrics':[{'kind':'metric','name':'tokens'}],'groupBy':['month'],'filters':[],
            'time':{'start':'2026-01','end':'2026-02','granularity':'month','providedBy':'user'}}]
        # Use the fixture's declared domain, not an invented business name.
        p['dataRequests'][0]['businessDomain']=fixture.SOURCES['usage-trend']
        p['sections'][0]['blocks']=[{'id':'usage-trend','type':'data','source':'usage','component':'lineChart',
            'title':'用量变化','purpose':'trend','width':'full','fields':['month','tokens']}]
        current=deepcopy(p['dataRequests'][0]); current.update(dataSourceId='current',businessDomain=fixture.SOURCES['usage-kpis'],groupBy=['scope'])
        current['time']['start']='2026-02'; p['dataRequests'].append(current)
        section=deepcopy(p['sections'][0]); section['id']='resources'
        section['blocks']=[{'id':'resource-comparison','type':'data','source':'current','component':'barChart',
            'title':'资源当前用量','purpose':'comparison','width':'full','fields':['scope','tokens'],
            'presentation':{'kind':'bar-comparison','horizontal':True}}]
        p['sections'].append(section)
        r=await self.create(p); self.assertTrue(r['ok'],r)
        page=r['artifactEnvelope']['artifact']['document']
        blocks=[b for s in page['sections'][1:] for b in s['components']]
        self.assertEqual([b['type'] for b in blocks if b['type']!='text'],['lineChart','barChart'])
        self.assertFalse(any(b['id']=='structure-scope-page' for b in page['sections'][0]['components']))
        self.assertFalse(any(b['id'].startswith('structure-scope-') for b in blocks))

    async def test_wide_reconciliation_preserves_manual_columns_on_local_revision(self):
        p=v3_plan(); block={'id':'records','type':'data','source':'totals','component':'table',
            'title':'完整核对','purpose':'reconciliation','width':'full',
            'fields':['scope','annual-total','year-over-year','current-month','month-over-month'],
            'presentation':{'kind':'record-list','density':'standard'}}
        p['sections'][0]['blocks']=[block]; deps=dependencies()
        async with Client(create_unified_content_mcp_server(deps,Turns('new'),candidate_store=MemoryCandidates())) as c:
            a=(await c.call_tool('create_content_page',{'context_ref':'current-context','title':'核对','request':{'plan':p}})).structured_content
            self.assertTrue(a['ok'],a)
            first=a['artifactEnvelope']['artifact']['document']['sections'][1]['components'][0]
            manual=(await c.call_tool('edit_page',{'context_ref':'current-context','candidate_ref':a['modelSummary']['candidateRef'],
                'request':{'operations':[{'id':'manual','type':'set_table_column','componentId':'records',
                'fieldId':first['props']['columns'][0]['field'],'properties':{'width':240,'title':'人工客户标识'}}]}})).structured_content
            self.assertTrue(manual['ok'],manual)
            block=deepcopy(block); block['presentation']['subtitle']='增加核对说明'
            after=(await c.call_tool('edit_page',{'context_ref':'current-context','candidate_ref':manual['modelSummary']['candidateRef'],
                'request':{'structureRevision':{'planVersion':'3','parentVersion':2,'patches':[{'type':'replace-block','blockId':'records','block':block}]}}})).structured_content
            self.assertTrue(after['ok'],after)
            table=after['artifactEnvelope']['artifact']['document']['sections'][1]['components'][0]
            self.assertEqual(len(table['props']['columns']),5)
            self.assertEqual(table['props']['columns'][0]['width'],240)
            self.assertEqual(table['props']['columns'][0]['title'],'人工客户标识')
            self.assertEqual(table['layout']['span'],12)
            self.assertEqual(len(deps.dqe.calls),1)

    async def test_capability_projection_and_safe_model_channel(self):
        from run_trusted_local import model_view
        async with Client(create_unified_content_mcp_server(dependencies(),Turns('new'),candidate_store=MemoryCandidates())) as c:
            discovered=(await c.call_tool('discover_data_context',{'context_ref':'current-context'})).structured_content
            safe=model_view(discovered,'discover_data_context')
            self.assertEqual(safe['structureCapabilities']['preferredVersion'],'3')
            tools={t.name:t for t in await c.list_tools()}
            plans=tools['create_content_page'].inputSchema['properties']['request']['oneOf'][1]['properties']['plan']['oneOf']
            self.assertEqual([p['properties']['version']['const'] for p in plans],safe['structureVersions'])

    async def test_period_change_updates_query_without_inventing_visible_notes(self):
        p=v3_plan()
        # No auxiliary relation is claimed for a changed period.
        for b in p['sections'][0]['blocks']:
            b['fields']=['annual-total']; b['presentation']['metrics']=[{'field':'annual-total'}]
        deps=dependencies()
        async with Client(create_unified_content_mcp_server(deps,Turns('new'),candidate_store=MemoryCandidates())) as c:
            a=(await c.call_tool('create_content_page',{'context_ref':'current-context','title':'测试','request':{'plan':p}})).structured_content
            self.assertTrue(a['ok'],a)
            changed=deepcopy(p['dataRequests'][0]); changed['time']['start']='2026-01'
            import scenario_flow_server as fixture
            # Explicit test-provider response for the new requested period.
            fixture.FIXTURE['queries']['flow-kpis']['time']['start']='2026-01'
            b=(await c.call_tool('edit_page',{'context_ref':'current-context','candidate_ref':a['modelSummary']['candidateRef'],
                'request':{'structureRevision':{'planVersion':'3','parentVersion':1,'patches':[{'type':'replace-request','request':changed}]}}})).structured_content
            self.assertTrue(b['ok'],b)
            notes=[x['props']['body'] for s in b['artifactEnvelope']['artifact']['document']['sections'] for x in s['components'] if x['type']=='text']
            self.assertEqual(notes, [])
            document=b['artifactEnvelope']['artifact']['document']
            query=document['dataSources'][changed['dataSourceId']]['source']['query']
            self.assertEqual(query['body']['dsl_list'][0]['filter']['time']['start'],'2026-01')
            self.assertEqual(len(deps.dqe.calls),2)

    def test_scope_cleanup_preserves_authored_explanations_and_data(self):
        from metriccanvas_authoring.pages.composition.structure_scope import refresh_scope
        authored={'id':'business-note','type':'text','props':{'body':'推演不代表实际完成额。'}}
        document={'dataSources':{'kept':{'query':'unchanged'}},'sections':[
            {'id':'header','components':[{'id':'structure-scope-page'}]},
            {'id':'overview','components':[deepcopy(authored),{'id':'structure-scope-overview'}]}]}
        before=deepcopy(document['dataSources'])
        refresh_scope(document,{'version':'3','dataRequests':[], 'sections':[]})
        self.assertEqual(document['sections'][0]['components'],[])
        self.assertEqual(document['sections'][1]['components'],[authored])
        self.assertEqual(document['dataSources'],before)

    def test_capabilities_variants_are_supported_by_page_contract(self):
        from metriccanvas_authoring.pages.components.structure_presentation import capabilities
        from metriccanvas_authoring.runtime_assets import bundle_root
        page=json.loads((bundle_root()/'contract-snapshot/page/schema.json').read_text())
        # Validate with the actual generated page definitions, not a second enum list.
        def enums(value):
            if isinstance(value,dict):
                if 'enum' in value: yield value['enum']
                for child in value.values(): yield from enums(child)
            elif isinstance(value,list):
                for child in value: yield from enums(child)
        available=list(enums(page))
        metric=next(p for p in capabilities()['presentations'] if p['kind']=='metric-summary')
        self.assertTrue(any(set(metric['options']['variant'])<=set(e) for e in available))

    def test_creation_and_published_revision_contracts_do_not_drift(self):
        from metriccanvas_authoring.pages.composition.page_structure import V2_PLAN_SCHEMA,V3_PLAN_SCHEMA
        from metriccanvas_authoring.pages.editing.structure_revision import REVISION_SCHEMA
        for index,plan_schema in enumerate((V2_PLAN_SCHEMA,V3_PLAN_SCHEMA)):
            replacement=REVISION_SCHEMA['oneOf'][index]['properties']['structureRevision']['properties']['patches']['items']['oneOf'][0]['properties']['block']
            self.assertEqual(replacement,plan_schema['properties']['sections']['items']['properties']['blocks']['items'])

    def test_reference_route_includes_design_only_for_page_creation(self):
        from eval_evidence import injection_paths
        root=Path(__file__).resolve().parents[3]
        create=injection_paths(root,{'workflow':'create','expected':{},'scene':'usage-report'},'unified')
        edit=injection_paths(root,{'workflow':'edit','expected':{}},'unified')
        self.assertIn('reading-design.md',[p.name for p in create])
        self.assertNotIn('reading-design.md',[p.name for p in edit])
        self.assertTrue(all(p.is_file() for p in create+edit))
