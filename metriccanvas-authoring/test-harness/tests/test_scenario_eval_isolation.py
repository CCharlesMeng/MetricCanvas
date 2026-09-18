"""The comparison's declared library root must also own imported runtime modules."""
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[3]


class ScenarioEvalIsolationTests(unittest.TestCase):
    def test_rich_fixture_public_creation_and_anonymized_metadata(self):
        code = '''
import sys, asyncio, json
sys.path.insert(0, sys.argv[1])
import scenario_flow_server as s
from fastmcp import Client
from test_authoring_turns import Turns
s.configure_rich_fixture()
assert len(s.SOURCES)==7
async def check():
    for key in ('customer-growth-top','customer-risk-top','track-analysis','industry-analysis'):
        q=s.FIXTURE['queries'][key]
        if key.startswith('customer'):
            assert all(r['customer-name'].startswith('样例客户-') for r in q['rows'])
            assert not any(n in q['output_dims'] for n in ('growth-description','risk-type'))
        request={'dataSourceId':'sample','businessDomain':s.SOURCES[key],
                 'metrics':[{'kind':'metric','name':m} for m in q['output_metrics'][:3]],
                 'groupBy':q['output_dims'][:1],'filters':[],
                 'time':{'start':q['time']['start'],'end':q['time']['end'],'granularity':'month','providedBy':'user'}}
        plan={'version':'2','scene':'business-report','question':'样例核对','dataContextVersion':'flow-fixture-20260917',
              'dataRequests':[request],'sections':[{'id':'sample','title':'样例核对','pattern':'custom',
              'businessQuestion':'有哪些对象','businessObject':'样例对象','distinctFrom':'独立核对',
              'blocks':[{'id':'table','type':'data','source':'sample','component':'table','title':'明细',
              'purpose':'reconciliation','fields':q['output_dims'][:1]+q['output_metrics'][:3]}]}]}
        async with Client(s.create_unified_content_mcp_server(s.dependencies(),Turns('new'),candidate_store=s.MemoryCandidates())) as c:
            result=(await c.call_tool('create_content_page',{'context_ref':'current-context','title':'样例','request':{'plan':plan}})).structured_content
            assert result['ok'] and result['modelSummary']['status']=='changed', json.dumps(result.get('modelSummary'),ensure_ascii=False)
asyncio.run(check())
'''
        env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'}
        env.pop('METRICCANVAS_EVAL_LIBRARY_ROOT',None)
        result=subprocess.run([sys.executable,'-c',code,str(ROOT/'metriccanvas-authoring/test-harness/model-evals')],
                              env=env,capture_output=True,text=True,timeout=30)
        self.assertEqual(result.returncode,0,result.stderr)

    def test_fixture_period_is_visible_in_discovery_metric_projection(self):
        code = '''
import sys, asyncio
sys.path.insert(0, sys.argv[1])
from scenario_flow_server import dependencies, FIXTURE, SOURCES
from fastmcp import Client
from test_authoring_turns import Turns
from test_authoring_candidates import MemoryCandidates
from metriccanvas_authoring.adapters.inbound.unified_content_mcp import create_unified_content_mcp_server
async def check():
    async with Client(create_unified_content_mcp_server(dependencies(), Turns('new'), candidate_store=MemoryCandidates())) as client:
        for key, domain in SOURCES.items():
            output=(await client.call_tool('discover_data_context', {'context_ref':'current-context', 'business_domain':domain})).structured_content
            descriptions=[m['metric']['description'] for m in output['matches'] if m['kind']=='metric']
            assert descriptions
            for description in descriptions:
                for boundary in ('start','end'):
                    assert FIXTURE['queries'][key]['time'][boundary] in description, 'period missing from discovery'
asyncio.run(check())
'''
        env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'}
        env.pop('METRICCANVAS_EVAL_LIBRARY_ROOT',None)
        result=subprocess.run([sys.executable,'-c',code,str(ROOT/'metriccanvas-authoring/test-harness/model-evals')],
                              env=env,capture_output=True,text=True,timeout=30)
        self.assertEqual(result.returncode,0,result.stderr)

    def test_alternate_root_survives_fixture_helper_imports(self):
        with tempfile.TemporaryDirectory() as temporary:
            alternate = Path(temporary)
            shutil.copytree(ROOT / 'metriccanvas-authoring', alternate / 'metriccanvas-authoring',
                            ignore=shutil.ignore_patterns('__pycache__', '.venv'))
            code = '''
import os, sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
import scenario_flow_server
import metriccanvas_authoring
import trusted_fixture_server
expected = Path(os.environ['METRICCANVAS_EVAL_LIBRARY_ROOT']).resolve()
assert Path(metriccanvas_authoring.__file__).resolve().is_relative_to(expected), 'runtime root mismatch'
assert trusted_fixture_server.ROOT.resolve() == expected, 'fixture root mismatch'
'''
            result = subprocess.run([sys.executable, '-c', code,
                str(ROOT / 'metriccanvas-authoring/test-harness/model-evals')],
                env={**os.environ, 'METRICCANVAS_EVAL_LIBRARY_ROOT': str(alternate),
                     'PYTHONDONTWRITEBYTECODE': '1'}, capture_output=True, text=True, timeout=30)
            self.assertEqual(result.returncode, 0, result.stderr)
