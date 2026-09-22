"""Opt-in real model / local fixture evaluation of the target platform protocol.

Only test fixture metadata and explicitly authorized bounded fixture evidence
are sent to the configured model. Java/Relay adapters are local substitutes.
"""
import argparse
import asyncio
import json
from pathlib import Path
import sys
import tempfile
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path[:0] = [str(HERE.parent/'tests'), str(HERE.parent), str(HERE.parents[1]/'tool')]
from fastmcp import Client
from test_platform_v2 import Authorization, Identities, Service, Preview, query_request
from test_authoring_turns import Turns
from authoring_fixtures import dependencies
from metriccanvas_authoring.pages.platform_authoring import PlatformAuthoring
from metriccanvas_authoring.entrypoints.mcp.platform_mcp import create_platform_mcp_server
from metriccanvas_authoring.adapters.storage.platform_state import SqlitePlatformState
from metriccanvas_authoring.work.state import Limits
from metriccanvas_authoring.pages.validation.page_validation import validate_page_document
from model_transport import HttpTransport
from run_local import config


def audit_v2(messages, secret):
    from eval_evidence import audit_messages
    sanitized = []
    for message in messages:
        copied = dict(message)
        if message['role'] == 'tool':
            value = json.loads(message['content'])
            if 'results' in value:
                if len(message['content'].encode()) > 16000: raise ValueError('Evidence budget exceeded')
                for item in value['results']:
                    if 'rows' in item:
                        if not item.get('resultRef') or 'coverage' not in item or len(item['rows']) > 20:
                            raise ValueError('Unbounded evidence')
                        # The application authorized this projection; audit the
                        # other fields with the unchanged legacy channel guard.
                        if secret in json.dumps(item['rows']): raise ValueError('Credential in evidence')
                        item.pop('rows')
            copied['content'] = json.dumps(value)
        sanitized.append(copied)
    audit_messages(sanitized, secret)


async def run(output):
    output.mkdir(parents=True, exist_ok=False)
    skill = HERE.parents[1]/'skill/metriccanvas-platform-authoring'
    instructions = '\n\n'.join((skill/p).read_text() for p in ['SKILL.md','workflows/create.md','workflows/data-analysis.md','references/tools.md','references/scenarios.md'])
    deps, service, preview = dependencies(), Service(), Preview()
    transport = HttpTransport(config(ROOT/'apps/platform/.env'), 350000, message_auditor=audit_v2)
    approved = query_request()
    class ApprovedPlan(Authorization):
        async def authorize(self, binding, request, version):
            grant = await super().authorize(binding, request, version)
            grant['planConfirmed'] = request in approved['requests'] and version == approved['dataContextVersion']
            return grant
    app = PlatformAuthoring(deps, Turns('new'), SqlitePlatformState(output/'state.db'), analysis_authorization=ApprovedPlan(),
        lifecycle_service=service, lifecycle_identities=Identities(), relay_preview=preview, limits=Limits(seconds=600))
    messages = [{'role':'system','content':instructions}, {'role':'user','content':json.dumps({
        'question':'新建区域运营报告。以下分析计划已经用户确认，先取得证据，再组织图表与明细。说明这是本地测试样例，不能声称生产数据或生产保存。按当前工具完成草稿与预览交付。',
        'trustedContext':{'context_ref':'current-context','mode':'new','platformProtocolVersion':'2.0'},
        'approvedPlan':approved},ensure_ascii=False)}]
    trajectory=[]; started=time.monotonic(); final=''; artifact=None
    async with Client(create_platform_mcp_server(app)) as client:
        tools = [{'type':'function','function':{'name':t.name,'description':t.description,'parameters':t.inputSchema}} for t in await client.list_tools()]
        for _ in range(8):
            response=await transport.complete(transport.prepare_request({'messages':messages,'tools':tools}))
            message=response['choices'][0]['message']; messages.append(message)
            calls=message.get('tool_calls') or []
            if not calls:
                final=message.get('content') or ''; break
            for call in calls:
                arguments=json.loads(call['function']['arguments'])
                result=await client.call_tool(call['function']['name'], arguments, raise_on_error=False)
                value=result.structured_content
                if value is None: raise RuntimeError('MODEL_TOOL_INPUT_INVALID')
                if value.get('artifactEnvelope'): artifact=value['artifactEnvelope']['artifact']
                summary=value['modelSummary']
                trajectory.append({'tool':call['function']['name'],'arguments':arguments,'summary':summary})
                messages.append({'role':'tool','tool_call_id':call['id'],'content':json.dumps(summary,ensure_ascii=False)})
    report={'evidenceKind':'real-model-local-fixture','model':transport.configuration['DEEPSEEK_MODEL'],
        'elapsedSeconds':round(time.monotonic()-started,3),'modelCalls':transport.calls,'tokens':transport.tokens,
        'toolCalls':len(trajectory),'queryCalls':len(deps.dqe.calls),'saveCalls':len(service.calls),'previewCalls':len(preview.calls),
        'final':final,'trajectory':trajectory,'validDocument':artifact is not None and not validate_page_document(artifact['document']),
        'limitations':['Local data fixture; not production Lab','Local Java and Relay substitutes; no real workbench injection']}
    report['passed']=bool(report['validDocument'] and report['queryCalls']==1 and report['saveCalls']==1 and report['previewCalls']==1
        and '{{RESPONSE_START}}' in final and '{{PAGE_METADATA_PREVIEW_JSON}}' in final)
    (output/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    if artifact: (output/'artifact.json').write_text(json.dumps(artifact,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ['passed','model','elapsedSeconds','modelCalls','tokens','toolCalls','queryCalls','saveCalls','previewCalls']},ensure_ascii=False))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,required=True)
    asyncio.run(run(parser.parse_args().output))
