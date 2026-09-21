"""Local-only projection of existing flow fixtures, never a production provider."""
import json
import sys
from pathlib import Path
from copy import deepcopy

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).parent
sys.path.insert(0, str(ROOT / 'metriccanvas-authoring/test-harness/model-evals'))
from trusted_fixture_server import LocalSyntheticTurns
from test_authoring_candidates import MemoryCandidates
from test_source_mapping import DescriptorFixture
from adapters.fakes import FakeDataContextPort
from metriccanvas_authoring.pages.composition.compose_page import ComposePageDependencies
from metriccanvas_authoring.domain.execution import DqeExecutionResult
from metriccanvas_authoring.domain.execution import DqeExecutionError
from metriccanvas_authoring.entrypoints.compat.unified_content_mcp import create_unified_content_mcp_server

FIXTURE = json.loads((ROOT / 'tools/dqe-sim/fixtures/flow-analysis-report.json').read_text())
PAGE = json.loads((ROOT / 'pages/flow-analysis-report.json').read_text())
SOURCES = {'flow-kpis': '流水概览', 'overall-monthly-trend': '流水趋势', 'region-monthly-trend': '流水结构'}

def context():
    value = json.loads((ROOT / 'metriccanvas-authoring/test-harness/fixtures/data-context.json').read_text())
    value.update(id='flow-fixture-evaluation', version='flow-fixture-20260917', source='local-existing-flow-fixture')
    env = value['executionEnvironments'][0]
    env['schemas'] = []
    for key, domain in SOURCES.items():
        query = FIXTURE['queries'][key]
        fields = PAGE['dataSources'][key]['fields']
        metrics = []
        for name in query['output_metrics']:
            source = fields[name]
            metrics.append({'name': name, 'type': 'number', 'aliases': [source['label']],
                'description': f"{domain}样例：{source['label']}。只允许按原始维度展示，不可跨行或跨源求和。",
                'unit': '元' if source['type']=='money' else '%', 'additivity': '不可加',
                'timeAggregation': '期末值', 'isRatio': source['type']!='money',
                'dimensions': query['output_dims'], 'nullable': source.get('nullable', False), 'sensitive': False})
        dims = []
        for name in query['output_dims']:
            source = fields[name]
            is_time = name == 'month'
            dims.append({'name': name, 'type': 'string', 'aliases': [source['label']],
                'description': f"{source['label']}。取值域:" + '、'.join(dict.fromkeys(str(r[name]) for r in query['rows'])) + '。',
                'roleHints': ['dimension', 'time'] if is_time else ['dimension'],
                **({'granularity':'month'} if is_time else {}), 'nullable':False,'sensitive':False})
        if key == 'flow-kpis':
            dims.append({'name':'统计周期','type':'date','description':'样例账期2026-02。支持的时间粒度:month。',
                         'roleHints':['dimension','time'],'granularity':'month','nullable':False,'sensitive':False})
        env['schemas'].append({'id':key,'name':domain,
            'description':f"流水报告现有样例，期间{query['time']['start']}至{query['time']['end']}。各样例口径独立，不能对账或互算。",
            'metrics':metrics,'objects':[{'id':key,'name':domain,'kind':'dataset','description':'原样例只读投影','fields':dims}],
            'relationships':[],'verifiedQueries':[]})
    return value

class FlowExecution:
    async def execute(self, effective_query):
        item = effective_query['body']['dsl_list'][0]
        metrics = item['output_metrics']
        match = [(key,FIXTURE['queries'][key]) for key in SOURCES
                 if metrics and all(isinstance(m,str) and m in FIXTURE['queries'][key]['output_metrics'] for m in metrics)]
        def reject(message):
            raise DqeExecutionError('DQE_QUERY_REJECTED', message)
        if len(match)!=1: reject('仅支持已声明的单个流水样例源指标，不支持公式或混合来源')
        key, query = match[0]
        dims = item['output_dims']
        if not set(dims) <= set(query['output_dims']): reject('分组维度不属于流水样例')
        time = item.get('filter',{}).get('time',{})
        if any(time.get(k)!=query['time'][k] for k in ['period','start','end']):
            reject('样例仅支持期间 '+str(query['time']))
        rows = deepcopy(query['rows'])
        for f in item['filter'].get('dims',[]):
            if f['dim_name'] not in query['output_dims']: reject('未知筛选维度')
            rows = [r for r in rows if r[f['dim_name']] in f['dim_value_list']]
        # Never collapse non-additive sample rows or create synthetic totals.
        omitted = set(query['output_dims'])-set(dims)
        if any(len({r[d] for r in rows})>1 for d in omitted):
            reject('必须保留原始分组维度 '+str(query['output_dims'])+'；或先筛选至一个值，不允许聚合')
        if item['filter'].get('metrics') or item.get('order'):
            reject('此只读样例投影不支持指标筛选或排序')
        projected = [{k:r[k] for k in dims+metrics} for r in rows]
        trace = {'source':key,'effectiveQuery':effective_query,'rows':projected,'capturedAt':FIXTURE['capturedAt']}
        with (Path(sys.argv[1]).parent/'data-executions.jsonl').open('a') as output:
            output.write(json.dumps(trace,ensure_ascii=False)+'\n')
        return DqeExecutionResult(rows=projected,total_count=len(projected),captured_at=FIXTURE['capturedAt'])

def server(path):
    names = {n for key in SOURCES for n in FIXTURE['queries'][key]['output_dims']+FIXTURE['queries'][key]['output_metrics']}
    labels = {n: f['label'] for key in SOURCES for n,f in PAGE['dataSources'][key]['fields'].items()}
    overrides = {n:{'label':labels[n],**({'scale':'percent','defaultFormat':'percent-1'} if n in ['year-over-year','month-over-month','target-support-rate'] else {})} for n in names}
    for key in SOURCES:
        for n, field in PAGE['dataSources'][key]['fields'].items():
            if field['type'] == 'money':
                overrides[n].update(type='money', currency=field['currency'], scale='currency-base', defaultFormat=field['defaultFormat'])
    deps = ComposePageDependencies(FakeDataContextPort(context()),FlowExecution(),
        source_description=DescriptorFixture(logical_ids={n:'flow-fixture:'+n for n in names},overrides=overrides))
    return create_unified_content_mcp_server(deps,LocalSyntheticTurns(path),candidate_store=MemoryCandidates())

if __name__=='__main__':
    from model_transport import deny_network
    deny_network()
    server(Path(sys.argv[1])).run(show_banner=False)
