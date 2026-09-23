"""Create/edit Skill evaluation through the trusted stdio and HTTP test stack."""
from __future__ import annotations

import argparse
import asyncio
from copy import deepcopy
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import time
from uuid import uuid4

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
AUTHORING = ROOT / "metriccanvas-authoring"
sys.path[:0] = [str(HERE), str(AUTHORING / "test-harness/tests"),
                str(AUTHORING / "test-harness"), str(AUTHORING / "tool")]

import httpx
from fastmcp import Client
from fastmcp.client.transports import StdioTransport

from eval_evidence import audit_messages, sha
from main_flow_http import serve_main_flow
from metriccanvas_authoring.pages.editing.edit_page import document_sha256
from metriccanvas_authoring.pages.validation.page_validation import validate_page_document
from metriccanvas_authoring.work.authoring_turns import SCOPE_KEYS
from model_transport import HttpTransport
from run_local import config


FIXTURE_PATH = AUTHORING / "test-harness/fixtures/platform-main-flow.json"
SUITE_PATH = HERE / "platform-authoring.cases.json"
SERVER_PATH = HERE / "trusted_fixture_server.py"
MAIN_FLOW_TOOLS = {
    "read_page_context", "discover_data_context", "query_data", "compose_page",
    "edit_page", "page_metadata_emit_preview",
}


def dump(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def audit_v2(messages, secret):
    sanitized = []
    for message in messages:
        copied = dict(message)
        if message["role"] == "tool":
            value = json.loads(message["content"])
            if "results" in value:
                if len(message["content"].encode()) > 16000:
                    raise ValueError("Evidence budget exceeded")
                for item in value["results"]:
                    if "rows" in item:
                        if not item.get("resultRef") or "coverage" not in item or len(item["rows"]) > 20:
                            raise ValueError("Unbounded evidence")
                        if secret and secret in json.dumps(item["rows"]):
                            raise ValueError("Credential in evidence")
                        item.pop("rows")
            copied["content"] = json.dumps(value)
        sanitized.append(copied)
    audit_messages(sanitized, secret)


def _facts(messages, state):
    facts = {"context": "current-context", "pageId": state["binding"]["pageId"],
             "selectedComponentId": state["binding"].get("selectedComponentId")}
    for message in messages:
        if message.get("role") != "tool":
            continue
        value = json.loads(message["content"])
        for key in ("dataContextVersion", "workVersion", "artifactRef", "pageId"):
            if key in value:
                facts[key] = value[key]
        results = value.get("results") or []
        for result in results:
            if result.get("resultRef"):
                facts["resultRef"] = result["resultRef"]
                if result.get("dataSourceId"):
                    facts["resultRef:" + result["dataSourceId"]] = result["resultRef"]
    return facts


def _resolve(value, facts):
    if isinstance(value, str) and value.startswith("$"):
        key = value[1:]
        if key not in facts or facts[key] is None:
            raise RuntimeError("SCRIPT_FACT_UNAVAILABLE:" + key)
        return deepcopy(facts[key])
    if isinstance(value, dict):
        return {key: _resolve(item, facts) for key, item in value.items()}
    if isinstance(value, list):
        return [_resolve(item, facts) for item in value]
    return value


class MainFlowScriptedTransport:
    evidence_kind = "deterministic-main-flow"

    def __init__(self, actions, state):
        self.actions = iter(actions)
        self.state = state
        self.calls = 0
        self.tokens = 0
        self.configuration = {"DEEPSEEK_MODEL": "scripted-no-model"}

    def prepare_request(self, request):
        return request

    async def complete(self, request):
        self.calls += 1
        action = next(self.actions, None)
        if action is None:
            return {"choices": [{"message": {"role": "assistant",
                "content": "{{RESPONSE_START}}\n{{PAGE_METADATA_PREVIEW_JSON}}"}}]}
        arguments = _resolve(action["arguments"], _facts(request["messages"], self.state))
        return {"choices": [{"message": {"role": "assistant", "content": None,
            "tool_calls": [{"id": "script-" + uuid4().hex, "type": "function",
                            "function": {"name": action["name"],
                                         "arguments": json.dumps(arguments, ensure_ascii=False)}}]}}]}


def action(name, **arguments):
    return {"name": name, "arguments": {"context_ref": "$context", **arguments}}


def scripted_actions(case, fixture, state):
    if case["workflow"] == "create":
        if case["id"] == "create-complex-report":
            return [
                action("read_page_context"),
                action("discover_data_context", query="Tokens 请求量 失败请求量 区域 模型 统计周期"),
                action("query_data", request={"question": "2026年8月运营概况、区域和模型分布，以及6至8月趋势",
                    "dataContextVersion": "$dataContextVersion", "requests": deepcopy(fixture["complexRequests"])}),
                action("compose_page", expected_version="$workVersion", request={
                    "title": case["expected"]["title"], "layout": case["layout"],
                    "sources": {request["dataSourceId"]: "$resultRef:" + request["dataSourceId"]
                                for request in fixture["complexRequests"]},
                    "sections": deepcopy(fixture["complexSections"])}),
                action("page_metadata_emit_preview", artifact_ref="$artifactRef"),
            ]
        return [
            action("read_page_context"),
            action("discover_data_context", query="Tokens 请求量 区域"),
            action("query_data", request={"question": "2026年8月各区域 Tokens 请求量是多少？",
                "dataContextVersion": "$dataContextVersion", "requests": [deepcopy(fixture["request"])]}),
            action("compose_page", expected_version="$workVersion", request={
                "title": case["expected"]["title"], "layout": case["layout"],
                "sources": {"result": "$resultRef"}, "sections": deepcopy(fixture["sections"])}),
            action("page_metadata_emit_preview", artifact_ref="$artifactRef"),
        ]
    target = state["binding"].get("selectedComponentId")
    if case["id"] == "edit-add-data":
        request = deepcopy(fixture["supplementRequest"])
        return [
            action("read_page_context"),
            action("discover_data_context", query="Tokens 请求量 区域"),
            action("query_data", request={"question": "2026年8月各区域 Tokens 请求量是多少？",
                "dataContextVersion": "$dataContextVersion", "requests": [request]}),
            action("edit_page", page_id="$pageId", expected_version="$workVersion", request={"operations": [{
                "id": "add-supplement-details", "type": "add_result_component",
                "sectionId": "business", "resultRef": "$resultRef",
                "block": {"id": "supplement-details", "type": "data", "source": "supplement",
                    "component": "table", "fields": ["区域", "Tokens请求量"],
                    "title": case["expected"]["addedComponentTitle"], "purpose": "reconciliation"}
            }]}),
            action("page_metadata_emit_preview", artifact_ref="$artifactRef"),
        ]
    title = case["expected"].get("title") or case["expected"]["componentTitle"]
    return [
        action("read_page_context", target_component_id=target),
        action("edit_page", page_id="$pageId", expected_version="$workVersion",
               request={"operations": [{"id": "change-title", "type": "set_title",
                                         "componentId": target, "title": title}]}),
        action("page_metadata_emit_preview", artifact_ref="$artifactRef"),
    ]


def _binding(case, document=None, ref=None):
    raw = None if document is None else json.dumps(document, ensure_ascii=False, separators=(",", ":"))
    page_id = case["pageId"] if document is None else document["id"]
    selected = None
    if document is not None:
        if case["id"] == "edit-dashboard":
            selected = next(component["id"] for section in document["sections"]
                            for component in section["components"] if component["type"] == "barChart")
        else:
            selected = "page-header"
    binding = {"version": "1.0", "contextRef": "current-context", "actorId": "alice",
        "workspaceId": "w", "requestId": "request-" + case["id"], "runId": "main-flow",
        "turnId": "turn-" + case["id"], "pageId": page_id, "capabilityVersion": "1.0",
        "status": "active", "mode": "new" if document is None else "existing", "access": "write",
        "baseRef": deepcopy(ref), "documentSha256": hashlib.sha256(raw.encode()).hexdigest() if raw else None,
        "selectedComponentId": selected}
    return binding, raw


async def _read_asset(base_url, ref):
    async with httpx.AsyncClient(trust_env=False) as client:
        response = await client.get(base_url + "/user-page-metadata/" + ref["resourceId"],
            headers={"X-Auth-Token": "test-only", "X-Operator-Id": "alice"})
    response.raise_for_status()
    value = response.json()
    document = json.loads(value["page_metadata_definition"])
    current = {"pageId": value["page_id"], "revisionId": value["revision_id"],
               "resourceId": value["page_metadata_id"]}
    return document, current


def _stdio(state_path):
    paths = [AUTHORING / "tool", AUTHORING / "test-harness/tests",
             AUTHORING / "test-harness", HERE]
    env = {"PYTHONPATH": os.pathsep.join(str(path) for path in paths),
           "PYTHONDONTWRITEBYTECODE": "1", "NO_PROXY": "127.0.0.1,localhost",
           "no_proxy": "127.0.0.1,localhost", "FASTMCP_CHECK_FOR_UPDATES": "off"}
    return StdioTransport(command=sys.executable, args=[str(SERVER_PATH), str(state_path)],
                          env=env, cwd=str(ROOT))


async def _execute_case(case, fixture, instructions, base_url, output, dependencies, transport):
    folder = output / case["id"]
    folder.mkdir(parents=True)
    before = None
    ref = None
    if case.get("dependsOn"):
        dependency = dependencies.get(case["dependsOn"])
        if dependency is None:
            return {"id": case["id"], "workflow": case["workflow"], "passed": False,
                    "status": "blocked", "reason": "DEPENDENCY_FAILED"}, None
        before, ref = await _read_asset(base_url, dependency["ref"])
        dump(folder / "before.json", before)
    binding, document_json = _binding(case, before, ref)
    state = {"profile": "main-flow-http", "baseUrl": base_url,
             "fixturePath": str(FIXTURE_PATH), "binding": binding,
             "scope": {key: binding[key] for key in SCOPE_KEYS}, "documentJson": document_json}
    state_path = folder / "trusted-state.json"
    dump(state_path, state)
    scripted = transport is None
    active_transport = MainFlowScriptedTransport(scripted_actions(case, fixture, state), state) if scripted else transport
    messages = [{"role": "system", "content": instructions}, {"role": "user", "content": json.dumps({
        "userRequest": case["prompt"], "trustedContext": {"context_ref": "current-context",
        "mode": binding["mode"], "platformProtocolVersion": "2.0"},
        "approvedPlan": {"question": "2026年8月华东区域 Tokens 请求量是多少？" if case["id"] == "edit-add-data" else "2026年8月运营概况、区域和模型分布，以及6至8月趋势" if case["id"] == "create-complex-report" else "2026年8月各区域 Tokens 请求量是多少？",
                         "requests": deepcopy(fixture["complexRequests"]) if case["id"] == "create-complex-report" else [fixture["supplementRequest"] if case["id"] == "edit-add-data" else fixture["request"]]}}, ensure_ascii=False)}]
    trajectory, artifact, final = [], None, ""
    async with Client(_stdio(state_path)) as client:
        definitions = await client.list_tools()
        tools = [{"type": "function", "function": {"name": tool.name,
            "description": tool.description or "", "parameters": tool.inputSchema}}
            for tool in definitions if tool.name in MAIN_FLOW_TOOLS]
        if {tool["function"]["name"] for tool in tools} != MAIN_FLOW_TOOLS:
            raise RuntimeError("MAIN_FLOW_TOOL_SURFACE_INCOMPLETE")
        dump(folder / "tools.json", tools)
        for _ in range(10):
            response = await active_transport.complete(active_transport.prepare_request({"messages": messages, "tools": tools}))
            message = response["choices"][0]["message"]
            messages.append(message)
            calls = message.get("tool_calls") or []
            if not calls:
                final = message.get("content") or ""
                break
            for call in calls:
                name = call["function"]["name"]
                arguments = json.loads(call["function"]["arguments"])
                result = await client.call_tool(name, arguments, raise_on_error=False)
                value = result.structured_content
                if value is None:
                    raise RuntimeError("MODEL_TOOL_INPUT_INVALID")
                envelope = value.get("artifactEnvelope")
                if envelope:
                    artifact = envelope["artifact"]
                summary = value.get("modelSummary", value)
                trajectory.append({"tool": name, "arguments": arguments, "summary": summary})
                dump(folder / "trajectory.json", trajectory)
                messages.append({"role": "tool", "tool_call_id": call["id"],
                                 "content": json.dumps(summary, ensure_ascii=False)})
                secret = "__scripted_no_secret__" if scripted else transport.configuration["DEEPSEEK_API_KEY"]
                audit_v2(messages, secret)
        else:
            raise RuntimeError("MODEL_LOOP_LIMIT")
    if artifact:
        dump(folder / "artifact.json", artifact)
        dump(folder / "document.json", artifact["document"])
    dump(folder / "trajectory.json", trajectory)
    dump(folder / "final.json", {"content": final})
    passed, issues = _assess(case, fixture, before, artifact, trajectory, final)
    result = {"id": case["id"], "workflow": case["workflow"], "passed": passed,
              "status": "pass" if passed else "fail", "issues": issues,
              "toolCalls": len(trajectory), "final": final,
              "ref": deepcopy(artifact.get("ref")) if artifact else None}
    dump(folder / "result.json", result)
    return result, artifact


def _assess(case, fixture, before, artifact, trajectory, final):
    issues = []
    document = artifact.get("document") if artifact else None
    if document is None or validate_page_document(document):
        issues.append("INVALID_OR_MISSING_DOCUMENT")
        return False, issues
    tools = [item["tool"] for item in trajectory]
    if "page_metadata_emit_preview" not in tools or "{{RESPONSE_START}}" not in final or "{{PAGE_METADATA_PREVIEW_JSON}}" not in final:
        issues.append("PREVIEW_NOT_DELIVERED")
    elif trajectory[-1]["arguments"].get("artifact_ref") != artifact.get("artifactRef"):
        issues.append("PREVIEW_ARTIFACT_MISMATCH")
    if case["id"] == "create-complex-report":
        issues.extend(_assess_complex_report(case, fixture, artifact, trajectory))
    elif case["workflow"] == "create":
        if document["layout"] != case["layout"]:
            issues.append("LAYOUT_MISMATCH")
        expected_chain = ["read_page_context", "discover_data_context", "query_data", "compose_page", "page_metadata_emit_preview"]
        if any(tool not in tools for tool in expected_chain) or [tools.index(tool) for tool in expected_chain] != sorted(tools.index(tool) for tool in expected_chain):
            issues.append("CREATE_EVIDENCE_CHAIN_MISSING")
        components = [component for section in document["sections"] for component in section["components"]]
        if not any(component["type"] == "reportHeader" and component.get("props", {}).get("title") == case["expected"]["title"] for component in components):
            issues.append("TITLE_MISMATCH")
        if not {"barChart", "table"}.issubset({component["type"] for component in components}):
            issues.append("REQUIRED_COMPONENTS_MISSING")
        if document.get("schemaVersion") != "6.11":
            issues.append("SCHEMA_VERSION_MISMATCH")
        preview = artifact.get("previewJson", {})
        sources = preview.get("dataSources", {})
        expected_rows = case["expected"]["rows"]
        if not any(source.get("source", {}).get("initial", {}).get("rows") == expected_rows for source in sources.values()):
            issues.append("BUSINESS_ROWS_MISSING")
        fields = [field for source in document.get("dataSources", {}).values() for field in source.get("fields", {}).values()]
        if not any(field.get("queryField") == case["expected"]["metric"] and field.get("unit") == case["expected"]["unit"] for field in fields):
            issues.append("METRIC_UNIT_MISSING")
        queries = [source.get("source", {}).get("query", {}).get("body", {}) for source in document.get("dataSources", {}).values()]
        if not any(query.get("dsl_list", [{}])[0].get("filter", {}).get("time", {}).get("start") == case["expected"]["period"] for query in queries if query.get("dsl_list")):
            issues.append("PERIOD_MISSING")
    elif case["id"] == "edit-add-data":
        old_ids = {component["id"] for section in before["sections"] for component in section["components"]}
        new_components = [component for section in document["sections"] for component in section["components"]]
        if not old_ids.issubset({component["id"] for component in new_components}):
            issues.append("EXISTING_COMPONENT_REMOVED")
        if not any(component.get("props", {}).get("title") == case["expected"]["addedComponentTitle"] for component in new_components):
            issues.append("ADDED_COMPONENT_MISSING")
        if not {"discover_data_context", "query_data", "edit_page"}.issubset(tools):
            issues.append("EDIT_EVIDENCE_CHAIN_MISSING")
        before_components = {component["id"]: component for section in before["sections"] for component in section["components"]}
        after_components = {component["id"]: component for component in new_components}
        if any(after_components.get(component_id) != component for component_id, component in before_components.items()):
            issues.append("EXISTING_COMPONENT_CHANGED")
        if any(document["dataSources"].get(source_id) != source for source_id, source in before["dataSources"].items()):
            issues.append("EXISTING_DATA_SOURCE_CHANGED")
        if len(set(document["dataSources"]) - set(before["dataSources"])) != 1:
            issues.append("ADDED_DATA_SOURCE_COUNT_MISMATCH")
        new_sources = set(document["dataSources"]) - set(before["dataSources"])
        preview_sources = artifact.get("previewJson", {}).get("dataSources", {})
        if not any(preview_sources.get(source_id, {}).get("source", {}).get("initial", {}).get("rows") == case["expected"]["rows"] for source_id in new_sources):
            issues.append("ADDED_DATA_ROWS_MISSING")
    else:
        if "discover_data_context" in tools or "query_data" in tools:
            issues.append("CONFIG_EDIT_QUERIED_DATA")
        expected = deepcopy(before)
        target = "page-header" if case["id"] == "edit-report" else next(component["id"] for section in expected["sections"] for component in section["components"] if component["type"] == "barChart")
        title = case["expected"].get("title") or case["expected"]["componentTitle"]
        next(component for section in expected["sections"] for component in section["components"] if component["id"] == target)["props"]["title"] = title
        if expected != document:
            issues.append("UNAUTHORIZED_DOCUMENT_CHANGE")
    if "PRIVATE SQL" in json.dumps(trajectory, ensure_ascii=False):
        issues.append("PHYSICAL_SQL_LEAKED")
    return not issues, issues


def _assess_complex_report(case, fixture, artifact, trajectory):
    """Check the final document's business structure and its exact DQE evidence."""
    issues = []
    document = artifact["document"]
    expected = case["expected"]
    if document["layout"] != case["layout"] or document.get("schemaVersion") != "6.11":
        issues.append("PAGE_PROTOCOL_MISMATCH")
    sections = document["sections"]
    components = [component for section in sections for component in section["components"]
                  if not component["id"].startswith("structure-")]
    if len(sections) < expected["minimumSections"] or len(components) < expected["minimumComponents"]:
        issues.append("PAGE_COMPLEXITY_TOO_LOW")
    if not any(component["type"] == "reportHeader" and "".join(component.get("props", {}).get("title", "").split()) == "".join(expected["title"].split())
               for component in components):
        issues.append("TITLE_MISMATCH")
    for component_type, minimum in expected["componentTypes"].items():
        if sum(component["type"] == component_type for component in components) < minimum:
            issues.append("COMPONENT_COVERAGE_MISSING:" + component_type)
    visible_provenance = [component.get("props", {}).get("body", "") for component in components
                          if component["type"] == "text"]
    visible_provenance.extend(component.get("props", {}).get("badge", "") for component in components
                              if component["type"] == "reportHeader")
    if not any("本地样例" in value and "生产" in value for value in visible_provenance):
        issues.append("SAMPLE_PROVENANCE_MISSING")
    if any(section["id"] != "header" and (visible := [component for component in section["components"]
            if not component["id"].startswith("structure-")]) and all(component["type"] == "text" for component in visible)
           for section in sections):
        issues.append("TEXT_ONLY_SECTION")
    if not any(any(component["type"] == "text" and "华东" in component.get("props", {}).get("body", "")
                   for component in section["components"])
               and {"barChart", "table"}.issubset({component["type"] for component in section["components"]
                   if component.get("data", {}).get("main") == "region"}) for section in sections):
        issues.append("EAST_FOCUS_NOT_IN_REGION")
    if expected.get("forbidDerivedPercentages") and any(
            re.search(r"\d+(?:\.\d+)?\s*[%％]", component.get("props", {}).get("body", ""))
            for component in components if component["type"] == "text"):
        issues.append("UNAPPROVED_DERIVED_PERCENTAGE")
    if set(document["dataSources"]) != set(expected["dataSources"]):
        issues.append("DATA_SOURCE_SET_MISMATCH")
    preview_sources = artifact.get("previewJson", {}).get("dataSources", {})
    for source_id in expected["dataSources"]:
        source = document["dataSources"].get(source_id, {})
        query = source.get("source", {}).get("query", {}).get("body")
        if query != fixture["complexQueries"][source_id]:
            issues.append("QUERY_SCOPE_MISMATCH:" + source_id)
        rows = preview_sources.get(source_id, {}).get("source", {}).get("initial", {}).get("rows")
        if rows != expected["rows"][source_id]:
            issues.append("BUSINESS_ROWS_MISSING:" + source_id)
        if not any(component.get("data", {}).get("main") == source_id for component in components):
            issues.append("UNUSED_DATA_SOURCE:" + source_id)
    fields = [field for source in document["dataSources"].values() for field in source.get("fields", {}).values()]
    for metric in expected["metrics"]:
        if not any(field.get("queryField") == metric["name"] and field.get("unit") == metric["unit"] for field in fields):
            issues.append("METRIC_UNIT_MISSING:" + metric["name"])
    for component in components:
        if component["type"] not in {"lineChart", "barChart"}:
            continue
        series = component.get("props", {}).get("series", [])
        source_id = component.get("data", {}).get("main")
        if len(series) < 2 or source_id not in document["dataSources"]:
            continue
        source_fields = document["dataSources"][source_id]["fields"]
        rows = expected["rows"].get(source_id, [])
        peaks = []
        for entry in series:
            field = source_fields.get(entry.get("field"), {})
            values = [abs(row.get(field.get("queryField"), 0)) for row in rows]
            peaks.append(max(values, default=0))
        if peaks and min(peaks) > 0 and max(peaks) >= 10 * min(peaks):
            issues.append("CHART_SCALE_COLLAPSES_SERIES:" + component["id"])
    for source_id in ("region", "model"):
        types = {component["type"] for component in components if component.get("data", {}).get("main") == source_id}
        if not {"barChart", "table"}.issubset(types):
            issues.append("COMPARISON_DETAIL_RELATION_MISSING:" + source_id)
        if not any({"barChart", "table"}.issubset({component["type"] for component in section["components"]
                                                     if component.get("data", {}).get("main") == source_id})
                   for section in sections):
            issues.append("COMPARISON_DETAIL_NOT_GROUPED:" + source_id)
    if not any(component["type"] == "lineChart" and component.get("data", {}).get("main") == "trend" for component in components):
        issues.append("TREND_RELATION_MISSING")
    if sum(component["type"] == "metricCard" and component.get("data", {}).get("main") == "summary" for component in components) < 2:
        issues.append("OVERVIEW_METRICS_MISSING")
    source_order = {source_id: next((index for index, section in enumerate(sections)
                                    if any(component.get("data", {}).get("main") == source_id for component in section["components"])),
                                   len(sections)) for source_id in ("summary", "trend")}
    if source_order["summary"] > source_order["trend"]:
        issues.append("READING_ORDER_MISMATCH")
    tools = [item["tool"] for item in trajectory]
    requests = [request for item in trajectory if item["tool"] == "query_data" and item["summary"].get("status") == "ready"
                for request in item["arguments"].get("request", {}).get("requests", [])]
    if sorted(json.dumps(request, ensure_ascii=False, sort_keys=True) for request in requests) != sorted(
            json.dumps(request, ensure_ascii=False, sort_keys=True) for request in fixture["complexRequests"]):
        issues.append("UNAPPROVED_OR_MISSING_DATA_REQUEST")
    chain = ["read_page_context", "discover_data_context", "query_data", "compose_page", "page_metadata_emit_preview"]
    if any(tool not in tools for tool in chain) or [tools.index(tool) for tool in chain] != sorted(tools.index(tool) for tool in chain):
        issues.append("CREATE_EVIDENCE_CHAIN_MISSING")
    return issues


async def run(output: Path, scripted: bool = False, case_ids=None):
    output.mkdir(parents=True, exist_ok=False)
    suite = json.loads(SUITE_PATH.read_text())
    fixture = json.loads(FIXTURE_PATH.read_text())
    cases = suite["cases"]
    requested_case_ids = list(case_ids) if case_ids else [case["id"] for case in cases]
    if case_ids:
        unknown = set(case_ids) - {case["id"] for case in cases}
        if unknown:
            raise ValueError("Unknown case ids: " + ", ".join(sorted(unknown)))
        selected = set(case_ids)
        changed = True
        while changed:
            changed = False
            for case in cases:
                if case["id"] in selected and case.get("dependsOn") and case["dependsOn"] not in selected:
                    selected.add(case["dependsOn"]); changed = True
        cases = [case for case in cases if case["id"] in selected]
    skill = AUTHORING / "skill/metriccanvas-platform-authoring"
    sources = [skill / relative for relative in suite["injectionSources"]]
    missing = [str(path) for path in sources if not path.is_file()]
    if missing:
        raise RuntimeError("Missing Skill sources: " + ", ".join(missing))
    instructions_by_case = {
        case["id"]: "\n\n".join(
            (skill / relative).read_text()
            for relative in case.get("injectionSources", suite["injectionSources"])
        )
        for case in cases
    }
    dump(output / "prompt-sources.json", {str(path.relative_to(ROOT)): sha(path) for path in sources})
    dump(output / "inputs.json", {"suite": sha(SUITE_PATH), "scenario": sha(FIXTURE_PATH)})
    model_client = None if scripted else httpx.AsyncClient(timeout=120)
    shared_transport = None if scripted else HttpTransport(
        config(ROOT / "apps/platform/.env"), 600000, message_auditor=audit_v2,
        client=model_client, input_bytes_per_token=2)
    started = time.monotonic()
    results, artifacts = [], {}
    log_path = output / "http.jsonl"
    try:
        with serve_main_flow(FIXTURE_PATH, log_path) as (_, base_url):
            for case in cases:
                before_lines = log_path.read_text().splitlines() if log_path.exists() else []
                try:
                    result, artifact = await _execute_case(
                        case, fixture, instructions_by_case[case["id"]], base_url,
                        output, artifacts, shared_transport)
                except Exception as error:
                    folder = output / case["id"]
                    folder.mkdir(parents=True, exist_ok=True)
                    reason = str(error) or type(error).__name__
                    blocked = not scripted and (
                        isinstance(error, httpx.HTTPError)
                        or reason in {"MODEL_HTTP_ERROR", "TOKEN_BUDGET_EXHAUSTED"}
                    )
                    result = {"id": case["id"], "workflow": case["workflow"], "passed": False,
                              "status": "blocked" if blocked else "error", "reason": reason,
                              "errorType": type(error).__name__}
                    artifact = None
                    dump(folder / "result.json", result)
                results.append(result)
                if result["passed"] and artifact:
                    artifacts[case["id"]] = artifact
                lines = log_path.read_text().splitlines() if log_path.exists() else []
                (output / case["id"] / "http.jsonl").write_text("\n".join(lines[len(before_lines):]) + ("\n" if len(lines) > len(before_lines) else ""))
    finally:
        if model_client is not None:
            await model_client.aclose()
    model_calls = 0 if scripted else shared_transport.calls
    tokens = 0 if scripted else shared_transport.tokens
    report = {"evidenceKind": "deterministic-main-flow" if scripted else "real-model-local-http-main-flow",
        "model": "scripted-no-model" if scripted else shared_transport.configuration["DEEPSEEK_MODEL"],
        "elapsedSeconds": round(time.monotonic() - started, 3), "modelCalls": model_calls,
        "tokens": tokens, "tokenBudget": 600000,
        "requestReserve": "utf8-bytes/2 + 8192 + max_tokens" if not scripted else "not-applicable",
        "requestedCases": requested_case_ids,
        "executedCases": [case["id"] for case in cases], "cases": results,
        "notRun": [case["id"] for case in suite["cases"] if case not in cases],
        "limitations": ["Local Java, DQE and Relay substitutes", "No production integration evidence"]}
    report["passed"] = bool(results) and all(result["passed"] for result in results)
    dump(output / "report.json", report)
    print(json.dumps({"passed": report["passed"], "model": report["model"],
                      "modelCalls": model_calls, "tokens": tokens,
                      "cases": {item["id"]: item["status"] for item in results}}, ensure_ascii=False))
    return report


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--scripted", action="store_true")
    parser.add_argument("--cases", nargs="+")
    args = parser.parse_args()
    report = await run(args.output, scripted=args.scripted, case_ids=args.cases)
    if not report["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
