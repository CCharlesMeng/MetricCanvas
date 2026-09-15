"""Evidence gates, not synthetic model-success tests."""
import importlib.util
import json
from pathlib import Path
import tempfile
import sys
from types import SimpleNamespace
import unittest

EVALS=Path(__file__).resolve().parents[1]/'model-evals'
spec=importlib.util.spec_from_file_location('eval_evidence', EVALS/'eval_evidence.py')
evidence=importlib.util.module_from_spec(spec);spec.loader.exec_module(evidence)
sys.modules[spec.name]=evidence
spec=importlib.util.spec_from_file_location('model_eval_preflight', EVALS/'preflight.py')
preflight=importlib.util.module_from_spec(spec);spec.loader.exec_module(preflight)


class ModelEvalHarnessTest(unittest.TestCase):
    def test_nested_serialized_page_and_rows_rejected(self):
        for value in [{'rows':[]},{'schemaVersion':'6.2','dataSources':{},'sections':[]},{'artifactEnvelope':None}]:
            with self.assertRaises(ValueError):evidence.audit_messages([{'content':json.dumps(value)}])
        evidence.audit_messages({'targetConfig':{'columns':[{'field':'region','width':150}]}})

    def test_credential_never_enters_model_channel(self):
        with self.assertRaises(ValueError):evidence.audit_messages({'content':'sentinel-key'},'sentinel-key')

    def test_unknown_production_tool_fails_closed(self):
        tools=[SimpleNamespace(name='edit_page')]
        for allowlist in [None,[],['save_page'],['edit_page','edit_page']]:
            with self.assertRaises(ValueError):evidence.select_tools(tools,'production',allowlist)
        self.assertEqual(evidence.select_tools(tools,'production',['edit_page']),tools)
        self.assertEqual(evidence.select_tools(tools,'diagnostic',None),tools)

    def test_missing_checks_never_pass(self):
        self.assertEqual(evidence.status({}),'inconclusive')
        self.assertEqual(evidence.status({'x':{'status':'blocked'},'y':{'status':'pass'}}),'blocked')
        self.assertEqual(evidence.status({'x':{'status':'fail'},'y':{'status':'blocked'}}),'fail')

    def test_hash_audit_detects_missing_and_modified_evidence(self):
        with tempfile.TemporaryDirectory() as t:
            folder=Path(t);p=folder/'raw.json';p.write_text('{}')
            digest=evidence.sha(p);self.assertEqual(evidence.verify_hashes(folder,{'raw.json':digest}),[])
            p.write_text('[]');self.assertEqual(evidence.verify_hashes(folder,{'raw.json':digest}),['raw.json'])
            self.assertEqual(evidence.verify_hashes(folder,{'missing.json':digest}),['missing.json'])

    def test_missing_model_trace_and_stale_review_cannot_pass(self):
        with tempfile.TemporaryDirectory() as t:
            folder=Path(t);(folder/'result.json').write_text(json.dumps({'turns':[],'repeat':1}))
            case={'id':'readonly','turns':['Explain'],'expected':{'noTools':True}}
            result=evidence.score(case,folder,{'resultSha256':'stale','reviewer':'tester','reason':'looks fine','status':'pass'})
            self.assertEqual(result['status'],'inconclusive')
            self.assertEqual(result['checks']['semanticReview']['status'],'inconclusive')

    def test_discovery_misuse_overrides_a_positive_review(self):
        with tempfile.TemporaryDirectory() as t:
            folder=Path(t);p=folder/'result.json'
            p.write_text(json.dumps({'turns':[{'calls':[{'model':'actual','tools':[{'name':'discover_data_context'}]}]}],'repeat':1}))
            case={'id':'edit','turns':['Edit title'],'expected':{'noDiscovery':True}}
            review={'resultSha256':evidence.sha(p),'reviewer':'tester','reason':'answer checked','status':'pass'}
            self.assertEqual(evidence.score(case,folder,review)['status'],'fail')

    def test_suite_is_nine_cases_three_per_cohort_three_repeats(self):
        suite=json.loads((EVALS/'unified-authoring.cases.json').read_text())
        self.assertEqual(suite['repetitions'],3)
        self.assertEqual(len({c['id'] for c in suite['cases']}),9)
        for cohort in ['original-misuse','positive','heldout']:
            self.assertEqual(sum(c['cohort']==cohort for c in suite['cases']),3)

    def test_readonly_does_not_load_edit_or_layout_workflow(self):
        case={'workflow':None,'expected':{}}
        paths=evidence.injection_paths(Path('/repo'),case,'unified')
        self.assertEqual([p.name for p in paths],['SKILL.md','tools.md'])

    def test_preflight_surface_selects_module_without_legacy_fallback(self):
        root=Path('/repo')
        legacy=preflight.client_configuration(root)['mcpServers']['content']
        unified=preflight.client_configuration(root,'unified-content')['mcpServers']['content']
        self.assertEqual(legacy['args'],['-m','metriccanvas_authoring.content_server'])
        self.assertEqual(unified['args'],['-m','metriccanvas_authoring.unified_content_server'])
        self.assertNotIn('METRICCANVAS_CONTENT_BASELINES_DIR',unified['env'])
        with self.assertRaises(KeyError):preflight.client_configuration(root,'unknown')

    def test_s2_tool_listing_never_marks_runner_or_latest_ready(self):
        definitions=[SimpleNamespace(name=name,inputSchema={'properties':{'context_ref':{'type':'string'}},'required':['context_ref']})
                     for name in preflight.LEGACY_TOOLS | {'read_page_context'}]
        result=preflight.surface_evidence('unified-content',definitions)
        self.assertEqual(result['introspection']['status'],'pass')
        self.assertEqual(result['modelRunner']['status'],'blocked')
        self.assertEqual(result['trustedCurrentTurn']['status'],'blocked')
        self.assertTrue(result['latest'].startswith('blocked'))
        self.assertTrue(result['writeReadiness'].startswith('blocked'))
        self.assertEqual(result['expectedServerName'],'metriccanvas-platform-content')

    def test_s2_rejects_legacy_token_and_missing_current_context(self):
        definitions=[SimpleNamespace(name=name,inputSchema={'properties':{'context_ref':{'type':'string'}},'required':['context_ref']})
                     for name in preflight.LEGACY_TOOLS | {'read_page_context'}]
        for legacy_key in ['page_id','baseline_token','source_token']:
            definitions[0].inputSchema['properties'][legacy_key]={'type':'string'}
            self.assertEqual(preflight.surface_evidence('unified-content',definitions)['introspection']['status'],'fail')
            del definitions[0].inputSchema['properties'][legacy_key]
        definitions[0].inputSchema['required']=[]
        self.assertEqual(preflight.surface_evidence('unified-content',definitions)['introspection']['status'],'fail')

    def test_s2_requires_exact_five_tool_set(self):
        definitions=[SimpleNamespace(name=name,inputSchema={}) for name in preflight.LEGACY_TOOLS]
        self.assertEqual(preflight.surface_evidence('legacy-content',definitions)['introspection']['status'],'pass')
        self.assertEqual(preflight.surface_evidence('unified-content',definitions)['introspection']['status'],'fail')

    def test_original_fourteen_records_retained(self):
        raw=json.loads((EVALS/'history/first-round.results.json').read_text())
        self.assertEqual(raw['counts'],{'blocked':5,'pass':6,'fail':3})
        self.assertEqual(len(raw['results']),14)

if __name__=='__main__':unittest.main()
