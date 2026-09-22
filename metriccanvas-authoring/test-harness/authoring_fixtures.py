import json
from pathlib import Path
from test_source_mapping import DescriptorFixture
from adapters.fakes import FakeDataContextPort, FakeDqeExecutionPort
from metriccanvas_authoring.pages.composition.compose_page import ComposePageDependencies
from metriccanvas_authoring.data.execution import DqeExecutionResult
ROOT = Path(__file__).resolve().parents[1]

def dependencies():
    def fixture(name): return json.loads((ROOT / 'test-harness/fixtures' / name).read_text())
    execution = fixture('page-build-execution.json')
    return ComposePageDependencies(FakeDataContextPort(fixture('data-context.json')),
        FakeDqeExecutionPort(DqeExecutionResult(rows=execution['rows'], total_count=execution.get('totalCount'), captured_at=execution.get('capturedAt'))), source_description=DescriptorFixture())


from test_source_mapping import fixture

def plan():
    unit = fixture('page-build-spec.json')['units'][0]
    unit = {k: v for k, v in unit.items() if k not in {'intent', 'pinnedComponent', 'title'}}
    return {'version': '3', 'scene': 'usage-report', 'question': '区域运营报告',
            'dataContextVersion': '2026-09-02.1', 'dataRequests': [unit],
            'sections': [{'id': 'business', 'title': '经营表现', 'pattern': 'comparison',
                          'businessQuestion': '业务表现如何', 'businessObject': '区域', 'distinctFrom': '规模与明细',
                          'blocks': [block('chart'), block('details', 'table')]}]}


def block(id, component='barChart'):
    return {'id': id, 'type': 'data', 'source': 'result', 'component': component,
            'fields': ['区域', 'Tokens请求量'], 'title': id, 'purpose': 'comparison' if component == 'barChart' else 'reconciliation'}


def presentation_plan():
    cards=[]
    for object, evidence in [('total','total-card'), ('core','core-card'), ('communication','communication-card')]:
        cards.append({'id':object,'type':'data','source':'totals','component':'metricCard','fields':['annual-total','year-over-year','current-month','month-over-month'],
            'title':object,'purpose':'primary-value','match':{'field':'scope','equals':object},
            'presentation':{'kind':'metric-summary','metrics':[
                {'field':'annual-total','changes':[{'field':'year-over-year','label':'同比','evidenceRef':evidence+'-0-0'}]},
                {'field':'current-month','changes':[{'field':'month-over-month','label':'环比','evidenceRef':evidence+'-1-0'}]}]}})
    return {'version':'3','scene':'business-report','question':'业务表现如何','dataContextVersion':'flow-fixture-20260917',
        'dataRequests':[{'dataSourceId':'totals','businessDomain':'流水概览','metrics':[{'kind':'metric','name':m} for m in ['annual-total','year-over-year','current-month','month-over-month']],
                         'groupBy':['scope'],'filters':[],'time':{'start':'2026-02','end':'2026-02','granularity':'month','providedBy':'user'}}],
        'sections':[{'id':'business','title':'业务表现','pattern':'overview-with-trend','businessQuestion':'各业务当前如何','businessObject':'整体及板块','distinctFrom':'当前规模与变化', 'blocks':cards}]}
