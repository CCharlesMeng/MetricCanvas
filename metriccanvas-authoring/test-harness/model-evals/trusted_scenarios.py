"""Local protocol exercises, not the frozen S1/holdout model benchmark."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]


def action(name, **args): return {'name':name,'arguments':{'context_ref':'$context', **args}}
def edit_title(title, candidate=False):
    return action('edit_page',request={'operations':[{'id':'title','type':'set_title','componentId':'header','title':title}]},
                  **({'candidate_ref':'$candidate'} if candidate else {}))
def spec(): return json.loads((ROOT/'metriccanvas-authoring/test-harness/fixtures/page-build-spec.json').read_text())
def data(): return {'id':'data','type':'add_data_component','sectionId':'main','componentId':'new-chart','spec':spec()}
def text(): return {'id':'text','type':'add_text','sectionId':'main','componentId':'new-note','body':'Local synthetic explanation'}


def scenarios():
    read=action('read_page_context',use_selection=True)
    create=action('create_content_page',title='Local synthetic page',request={'operations':[text()]})
    compose=action('compose_page',spec=spec(),layout='report')
    discover=action('discover_data_context',query='各区域Tokens请求量')
    cases=[
        {'id':'read-edit-chain','workflow':'edit','mode':'existing','prompts':['读取所选表格配置，将header标题改为Stage one，再在候选改为Final。'],
         'turns':[[read,edit_title('Stage one'),action('read_page_context',candidate_ref='$candidate',target_component_id='header'),edit_title('Final',True),edit_title('Final',True)]],'check':'chain'},
        {'id':'fresh-local-turn','workflow':'edit','mode':'existing','prompts':['把header标题改为Stage one。','再改为Final。'],
         'turns':[[edit_title('Stage one')],[edit_title('Final')]],'check':'fresh-turn'},
        {'id':'static-new','workflow':'create','mode':'new','prompts':['新建report，仅含静态说明。'],'turns':[[create]],'check':'new'},
        {'id':'data-new','workflow':'create','mode':'new','prompts':['使用合成源新建report数据页面。'],'turns':[[discover,compose]],'check':'data'},
        {'id':'data-existing','workflow':'edit','mode':'existing','prompts':['给当前页增加合成图表和说明。'],
         'turns':[[action('edit_page',request={'operations':[data(),text()]})]],'check':'preserve-existing'},
        {'id':'missing-source','workflow':'create','mode':'new','dataProvider':'missing-source','prompts':['创建数据图表与独立说明。'],
         'turns':[[action('create_content_page',title='Partial',request={'operations':[data(),dict(text(),id='dependent',componentId='dependent-note',dependsOn=['data']),text()]})]],'check':'partial'},
        {'id':'missing-data','workflow':'create','mode':'new','dataProvider':'unavailable','prompts':['查找合成业务源。'],'turns':[[discover]],'expectedError':'DATA_CONTEXT_CONFIG_ERROR'},
        {'id':'missing-candidate-store','workflow':'edit','mode':'existing','candidateProvider':'unavailable','prompts':['修改标题。'],'turns':[[edit_title('Final')]],'expectedError':'CANDIDATE_STORE_UNAVAILABLE'},
        {'id':'missing-turn-provider','workflow':'edit','mode':'existing','turnProvider':'unavailable','prompts':['测试五工具在未注入可信轮次时都拒绝。'],
         'turns':[[read,discover,compose,create,edit_title('Final')]],'expectedError':'CURRENT_TURN_UNAVAILABLE'},
        {'id':'cross-scope','workflow':'edit','mode':'existing','scopeMismatch':True,'prompts':['修改标题。'],'turns':[[edit_title('Final')]],'expectedError':'CURRENT_TURN_SCOPE_MISMATCH'},
    ]
    for layout in ['report','dashboard']:
        cases.append({'id':'mixed-new-'+layout,'workflow':'create','mode':'new','layout':layout,'prompts':['创建'+layout+'合成图表和静态说明。'],
                      'turns':[[action('create_content_page',title='Mixed',layout=layout,request={'operations':[data(),text()]})]],'check':'mixed'})
    for case in cases: case['expected']={'layout':case.get('layout','report')}
    return cases
