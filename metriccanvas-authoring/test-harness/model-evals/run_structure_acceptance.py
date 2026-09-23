"""Deterministic acceptance plan through the current platform query/compose use case; explicitly not autonomous model evidence."""
import argparse
import asyncio
import json
import os
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / "tool"), str(ROOT / "test-harness"), str(ROOT / "test-harness/tests")]
from scenario_flow_server import dependencies
from authoring_fixtures import presentation_plan as plan
from test_authoring_turns import Turns
from metriccanvas_authoring.pages.platform_authoring import PlatformAuthoring
from metriccanvas_authoring.adapters.storage.platform_state import SqlitePlatformState
from test_platform_v2 import Authorization, Identities, Service, Preview
from metriccanvas_authoring.pages.validation.page_validation import validate_page_document


async def main():
    p=argparse.ArgumentParser(description=__doc__); p.add_argument('--output',type=Path,required=True); args=p.parse_args()
    os.umask(0o077); args.output.mkdir(parents=True,exist_ok=False)
    authored=plan()
    labels={'total':'整体流水','core':'Core 流水','communication':'云通信流水'}
    for b in authored['sections'][0]['blocks']: b['title']=labels[b['id']]
    authored['sections'][0].update(title='各业务规模与变化',businessQuestion='整体、Core 与云通信当前规模和变化如何',businessObject='整体 / Core / 云通信',distinctFrom='按业务对象对照当前金额和各自变化，后续章节观察时间走势')
    authored['dataRequests'].append({'dataSourceId':'monthly','businessDomain':'流水趋势',
        'metrics':[{'kind':'metric','name':m} for m in ['core-actual','communication-actual','core-forecast','communication-forecast']],
        'groupBy':['month'],'filters':[],'time':{'start':'2026-01','end':'2026-12','granularity':'month','providedBy':'user'}})
    authored['sections'].append({'id':'business-trend','title':'业务流水走势（实际与预测）','pattern':'custom',
        'businessQuestion':'已发生的流水与后续预测怎样变化','businessObject':'Core / 云通信','distinctFrom':'按月看走势，不重复当前规模；来源独立，不与概况跨源对账',
        'blocks':[{'id':'business-trend-chart','type':'data','source':'monthly','component':'lineChart',
            'fields':['month','core-actual','communication-actual','core-forecast','communication-forecast'],
            'purpose':'trend','title':'1–2 月实际 · 3–12 月预测'},
            {'id':'fixture-note','type':'text','purpose':'explanation','body':'本地样例，非生产数据。不同来源口径独立，不跨源对账；预测使用已有样例，不代表业务承诺。'}]})
    deps = dependencies()
    turns = Turns('new')
    app = PlatformAuthoring(deps, turns, SqlitePlatformState(args.output / 'state.db'),
        analysis_authorization=Authorization(), lifecycle_service=Service(),
        lifecycle_identities=Identities(), relay_preview=Preview())
    queried = await app.query('current-context', {'question': authored['question'],
        'dataContextVersion': authored['dataContextVersion'], 'requests': authored['dataRequests']})
    result, artifact = await app.mutate('compose', 'current-context', {
        'title': '流水分析报告（本地样例）', 'layout': 'report', 'sections': authored['sections'],
        'sources': {item['dataSourceId']: item['resultRef'] for item in queried['results']}})
    if result['saveStatus'] != 'saved': raise RuntimeError(str(result))
    document = artifact['previewJson']
    errors=validate_page_document(document)
    cards=[c for s in document['sections'] for c in s['components'] if c['type']=='metricCard']
    assert not errors and len(cards)==3 and all(c['props']['variant']=='compactSummary' for c in cards)
    report={'evidenceKind':'deterministic-structure-acceptance','autonomousModel':False,'valid':not errors,
        'issues':[], 'queryCount':len(deps.dqe.calls),'objects':len(cards),'primaryRows':sum(len(c['props']['rows']) for c in cards),
        'changeBindings':sum(len(r.get('changes',[])) for c in cards for r in c['props']['rows']),
        'visualAcceptance':'user-owned-not-executed','modelSummary':{'status':result['status']}}
    for name,value in [('page.json',document),('plan.json',authored),('validation.json',report)]:
        (args.output/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='modelSummary'},ensure_ascii=False))


if __name__=='__main__': asyncio.run(main())
