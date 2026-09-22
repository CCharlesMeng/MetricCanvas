"""Local-only projection of existing flow fixtures, never a production provider."""
import json
import sys
import os
from pathlib import Path
from copy import deepcopy

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).parent
LIBRARY_ROOT = Path(os.environ.get('METRICCANVAS_EVAL_LIBRARY_ROOT', ROOT))
sys.path[:0] = [str(LIBRARY_ROOT / 'metriccanvas-authoring/tool'), str(LIBRARY_ROOT / 'metriccanvas-authoring/test-harness/tests'),
               str(LIBRARY_ROOT / 'metriccanvas-authoring/test-harness')]
sys.path.insert(0, str(LIBRARY_ROOT / 'metriccanvas-authoring/test-harness/model-evals'))
from trusted_fixture_server import LocalSyntheticTurns
from test_authoring_candidates import MemoryCandidates
from test_source_mapping import DescriptorFixture
from adapters.fakes import FakeDataContextPort
from metriccanvas_authoring.pages.composition.compose_page import ComposePageDependencies
from metriccanvas_authoring.data.execution import DqeExecutionResult, DqeExecutionError
from metriccanvas_authoring.entrypoints.compat.unified_content_mcp import create_unified_content_mcp_server

# Refuse mixed-version imports before any paid model request can use this server.
import metriccanvas_authoring
if not Path(metriccanvas_authoring.__file__).resolve().is_relative_to(LIBRARY_ROOT.resolve()):
    raise RuntimeError('EVAL_LIBRARY_ROOT_MISMATCH')

FIXTURE = json.loads((ROOT / 'tools/dqe-sim/fixtures/flow-analysis-report.json').read_text())
PAGE = json.loads((ROOT / 'pages/flow-analysis-report.json').read_text())
SOURCES = {'flow-kpis': '流水概览', 'overall-monthly-trend': '流水趋势', 'region-monthly-trend': '流水结构'}


def configure_rich_fixture():
    """Expose more existing sample capabilities; never send customer identities or detail HTML."""
    SOURCES.update({'customer-growth-top':'客户增长样例', 'customer-risk-top':'风险客户样例',
                    'track-analysis':'赛道经营', 'industry-analysis':'行业经营'})
    for key in ('customer-growth-top', 'customer-risk-top'):
        query = FIXTURE['queries'][key]
        fields = PAGE['dataSources'][key]['fields']
        # Detail fields are not dimensions and cannot enter the scalar fixture adapter.
        query['output_dims'] = [name for name in query['output_dims'] if fields[name]['role']=='dimension']
        allowed = query['output_dims'] + query['output_metrics']
        query['rows'] = [{name: ('样例客户-'+str(i+1).zfill(2) if name=='customer-name' else row[name])
                          for name in allowed} for i,row in enumerate(query['rows'])]
        PAGE['dataSources'][key]['fields'] = {name:fields[name] for name in allowed}


class ReferenceRelations:
    """Evaluation-only, exact bindings in the supplied reference page, not inferred metric names."""
    async def resolve(self, scope, version, domain):
        relations = []
        for section in PAGE['sections']:
            for component in section['components']:
                source_id = component.get('data', {}).get('main')
                if component['type'] != 'metricCard' or SOURCES.get(source_id) != domain: continue
                query = FIXTURE['queries'][source_id]
                for ri, row in enumerate(component['props'].get('rows', [])):
                    primary = row['valueField']
                    if not isinstance(primary, dict): continue
                    for ci, change in enumerate(row.get('changes', [])):
                        auxiliary = change['field']
                        if not isinstance(auxiliary, dict) or primary.get('match') != auxiliary.get('match'): continue
                        # Every evidence ID identifies an explicit reference-page binding, including its object and time.
                        relations.append({'evidenceRef': component['id']+'-'+str(ri)+'-'+str(ci),
                            'primaryField': primary['field'], 'changeField': auxiliary['field'], 'origin': 'metadata',
                            'time': {'start': query['time']['start'], 'end': query['time']['end'], 'granularity': query['time']['period']},
                            **({'match': primary['match']} if primary.get('match') else {})})
        return {'dataContextVersion': version, 'businessDomain': domain, 'relations': relations}


def configure_usage_fixture():
    """Explicit synthetic usage metadata and rows. No business-source data is fetched."""
    global FIXTURE, PAGE, SOURCES
    period={'period':'month','start':'2026-02','end':'2026-02'}
    fields={
        'scope':{'type':'string','role':'dimension','label':'资源对象'},
        'tokens':{'type':'number','role':'measure','label':'Tokens用量','unit':'个'},
        'tokens-yoy':{'type':'number','role':'measure','label':'Tokens同比','unit':'%'},
        'requests':{'type':'number','role':'measure','label':'请求次数','unit':'次'},
        'requests-yoy':{'type':'number','role':'measure','label':'请求同比','unit':'%'}}
    trend={'month':{'type':'string','role':'dimension','label':'月份'},'tokens':fields['tokens']}
    metrics=['tokens','tokens-yoy','requests','requests-yoy']
    FIXTURE={'capturedAt':'2026-02-28T23:59:59+08:00','queries':{
        'usage-kpis':{'output_dims':['scope'],'output_metrics':metrics,'time':period,
            'rows':[{'scope':'all','tokens':1500000,'tokens-yoy':12,'requests':30000,'requests-yoy':8},
                    {'scope':'model-a','tokens':900000,'tokens-yoy':15,'requests':18000,'requests-yoy':10},
                    {'scope':'model-b','tokens':600000,'tokens-yoy':8,'requests':12000,'requests-yoy':5}]},
        'usage-trend':{'output_dims':['month'],'output_metrics':['tokens'],
            'time':{'period':'month','start':'2026-01','end':'2026-02'},
            'rows':[{'month':'1月','tokens':1400000},{'month':'2月','tokens':1500000}]}}}
    components=[]
    for scope in ['all','model-a','model-b']:
        rows=[]
        for name in ['tokens','requests']:
            binding={'data':'main','field':name,'match':{'field':'scope','equals':scope}}
            rows.append({'label':fields[name]['label'],'valueField':binding,
                         'changes':[{'label':'同比','field':{**binding,'field':name+'-yoy'}}]})
        components.append({'id':scope+'-card','type':'metricCard','data':{'main':'usage-kpis'},'props':{'rows':rows}})
    PAGE={'dataSources':{'usage-kpis':{'fields':fields},'usage-trend':{'fields':trend}},'sections':[{'components':components}]}
    SOURCES={'usage-kpis':'资源用量','usage-trend':'资源使用历史'}

def context():
    value = json.loads((ROOT / 'metriccanvas-authoring/test-harness/fixtures/data-context.json').read_text())
    value.update(id='flow-fixture-evaluation', version='flow-fixture-20260917', source='local-existing-flow-fixture')
    env = value['executionEnvironments'][0]
    env['schemas'] = []
    for key, domain in SOURCES.items():
        query = FIXTURE['queries'][key]
        fields = PAGE['dataSources'][key]['fields']
        limitations = {
            'customer-growth-top':'仅是增长客户入选清单，不是完整客户群体，不能计算整体增长贡献或证明原因。',
            'customer-risk-top':'仅是风险复核入选清单，不提供风险原因明细；1月与上月为独立样例列，不能据此拼成连续时间序列。',
            'track-analysis':'年目标与年推演可并列核对；较年初推演增长量不是目标差额，不提供计算后的完成率。',
            'industry-analysis':'年目标与年推演可并列核对；较年初推演增长量不是目标差额，不提供计算后的完成率。',
        }.get(key, '')
        metrics = []
        for name in query['output_metrics']:
            source = fields[name]
            metrics.append({'name': name, 'type': 'number', 'aliases': [source['label']],
                'description': f"{domain}样例：{source['label']}。只允许按原始维度展示，不可跨行或跨源求和。"
                    f"固定期间{query['time']['start']}至{query['time']['end']}，粒度{query['time']['period']}；查询必须显式使用该期间。" + limitations,
                'unit': source.get('unit', '元' if source['type']=='money' else '%'), 'additivity': '不可加',
                'timeAggregation': '期末值', 'isRatio': source.get('unit')=='%' or (source['type']!='money' and 'unit' not in source),
                'dimensions': query['output_dims'], 'nullable': source.get('nullable', False), 'sensitive': False})
        dims = []
        for name in query['output_dims']:
            source = fields[name]
            is_time = name == 'month'
            dims.append({'name': name, 'type': 'string', 'aliases': [source['label']],
                'description': f"{source['label']}。取值域:" + '、'.join(dict.fromkeys(str(r[name]) for r in query['rows'])) + '。',
                'roleHints': ['dimension', 'time'] if is_time else ['dimension'],
                **({'granularity':'month'} if is_time else {}), 'nullable':False,'sensitive':False})
        if 'month' not in query['output_dims']:
            dims.append({'name':'统计周期','type':'date','description':f"样例账期{query['time']['start']}至{query['time']['end']}。支持的时间粒度:month。",
                         'roleHints':['dimension','time'],'granularity':'month','nullable':False,'sensitive':False})
        env['schemas'].append({'id':key,'name':domain,
            'description':f"流水报告现有样例，期间{query['time']['start']}至{query['time']['end']}。各样例口径独立，不能对账或互算。",
            'metrics':metrics,'objects':[{'id':key,'name':domain,'kind':'dataset','description':'原样例只读投影','fields':dims}],
            'relationships':[],'verifiedQueries':[]})
    return value

class FlowExecution:
    def __init__(self, trace_path=None):
        self.trace_path = trace_path
        self.calls = []

    async def execute(self, effective_query):
        self.calls.append(deepcopy(effective_query))
        item = effective_query['body']['dsl_list'][0]
        metrics = item['output_metrics']
        match = [(key,FIXTURE['queries'][key]) for key in SOURCES
                 if metrics and all(isinstance(m,str) and m in FIXTURE['queries'][key]['output_metrics'] for m in metrics)
                 and set(item['output_dims']) <= set(FIXTURE['queries'][key]['output_dims'])
                 and all(item.get('filter',{}).get('time',{}).get(k) == FIXTURE['queries'][key]['time'][k]
                         for k in ['period','start','end'])]
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
        keys = {tuple(json.dumps(r[d],sort_keys=True) for d in dims) for r in rows}
        if len(keys) != len(rows) and any(len({r[d] for r in rows})>1 for d in omitted):
            reject('必须保留原始分组维度 '+str(query['output_dims'])+'；或先筛选至一个值，不允许聚合')
        if item['filter'].get('metrics') or item.get('order'):
            reject('此只读样例投影不支持指标筛选或排序')
        projected = [{k:r[k] for k in dims+metrics} for r in rows]
        trace = {'source':key,'effectiveQuery':effective_query,'rows':projected,'capturedAt':FIXTURE['capturedAt']}
        if self.trace_path:
            with self.trace_path.open('a') as output:
                output.write(json.dumps(trace,ensure_ascii=False)+'\n')
        return DqeExecutionResult(rows=projected,total_count=len(projected),captured_at=FIXTURE['capturedAt'])

def dependencies(trace_path=None):
    names = {n for key in SOURCES for n in FIXTURE['queries'][key]['output_dims']+FIXTURE['queries'][key]['output_metrics']}
    labels = {n: f['label'] for key in SOURCES for n,f in PAGE['dataSources'][key]['fields'].items()}
    ratios={n for key in SOURCES for n,f in PAGE['dataSources'][key]['fields'].items()
            if f.get('unit')=='%' or f.get('defaultFormat','').startswith('percent-')}
    overrides = {n:{'label':labels[n],**({'scale':'percent','defaultFormat':'percent-1'} if n in ratios else {})} for n in names}
    for key in SOURCES:
        for n, field in PAGE['dataSources'][key]['fields'].items():
            if field['type'] == 'money':
                overrides[n].update(type='money', currency=field['currency'], scale='currency-base', defaultFormat=field['defaultFormat'])
    options = {'metric_relations': ReferenceRelations()} if 'metric_relations' in ComposePageDependencies.__dataclass_fields__ else {}
    return ComposePageDependencies(FakeDataContextPort(context()),FlowExecution(trace_path),
        source_description=DescriptorFixture(logical_ids={n:'flow-fixture:'+n for n in names},overrides=overrides), **options)


def server(path):
    deps = dependencies(path.parent/'data-executions.jsonl')
    return create_unified_content_mcp_server(deps,LocalSyntheticTurns(path),candidate_store=MemoryCandidates())

if __name__=='__main__':
    from model_transport import deny_network
    deny_network()
    if os.environ.get('METRICCANVAS_EVAL_SCENE')=='usage-report': configure_usage_fixture()
    if os.environ.get('METRICCANVAS_EVAL_DATA_PROFILE')=='rich': configure_rich_fixture()
    server(Path(sys.argv[1])).run(show_banner=False)
