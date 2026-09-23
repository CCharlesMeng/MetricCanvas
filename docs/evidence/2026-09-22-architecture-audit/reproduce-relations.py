import sys, asyncio, json
from pathlib import Path
from types import SimpleNamespace
from dataclasses import replace
r=Path.cwd()/'metriccanvas-authoring'
sys.path[:0]=[str(r/'tool'),str(r/'test-harness'),str(r/'test-harness/tests'),str(r/'test-harness/model-evals')]
from authoring_fixtures import presentation_plan
from scenario_flow_server import dependencies
from test_authoring_turns import Turns
from metriccanvas_authoring.pages.composition.structure_composition import compose_structure
from metriccanvas_authoring.pages.composition.page_structure import block_component,StructureError
from metriccanvas_authoring.pages.referenced import compose
async def main():
 p=presentation_plan();deps=replace(dependencies(),authoring_scope=dict(Turns('new').binding),require_source_description=True)
 async def current():pass
 old=await compose_structure('report','Report','report',p,deps,current=current)
 b=p['sections'][0]['blocks'][0]
 try: block_component(b,old['document']['dataSources'],p['sections'][0]['pattern']);probe='unexpected success'
 except StructureError as e:probe=e.code
 request={'title':'Report','layout':'report','sources':{'totals':'result-test'},'sections':p['sections']}
 records={'totals':{'source':old['document']['dataSources']['totals'],'request':p['dataRequests'][0]}}
 new=compose(SimpleNamespace(binding={'pageId':'report'}),request,records)
 print(json.dumps({'current_compose_status':new['status'],'current_operations':new['operations'],'legacy_status':old['status'],'current_default_relations_result':probe,'block':b['id']},ensure_ascii=False))
asyncio.run(main())
