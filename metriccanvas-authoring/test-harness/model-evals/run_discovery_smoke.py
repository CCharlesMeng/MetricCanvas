"""Two-case real-DS smoke test for enhanced semantic discovery interpretation.

This runner exercises the public SemanticCatalog discovery seam with trusted
identity, authorized metadata, and bounded mock knowledge. DeepSeek is used
only through the optional DiscoveryInterpretationPort; credentials are read
into memory and never written to evidence.
"""
from __future__ import annotations

import argparse
import asyncio
from copy import deepcopy
import json
from pathlib import Path
import sys
import time


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
AUTHORING = ROOT / "metriccanvas-authoring"
sys.path[:0] = [str(HERE), str(AUTHORING / "tool"), str(AUTHORING / "examples")]

import httpx
from adapter_template.firstparty.discovery_model_http import HttpDiscoveryInterpreter
from metriccanvas_authoring.adapters.storage.platform_state import SqlitePlatformState
from metriccanvas_authoring.data.discovery import DiscoveryDependencies, DiscoveryLimits
from metriccanvas_authoring.data.discovery.contracts import validate
from metriccanvas_authoring.data.semantic_catalog import SemanticCatalog
from run_local import config


TOKEN_BUDGET = 30_000
KNOWLEDGE_PATH = AUTHORING / "examples/semantic-discovery/business-knowledge.mock.json"


def dump(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
    path.chmod(0o600)


class Metadata:
    """Complete authorized source; no SQL or business rows are exposed."""

    async def search(self, binding, query, limit):
        del binding, query, limit
        return deepcopy({
            "dataContextVersion": "discovery-smoke-v1",
            "models": [
                {
                    "id": "operations",
                    "workspace_id": "w",
                    "caption": "运营分析",
                    "logical_schema": {"field_schema": {
                        "metrics": [
                            {
                                "id": "tokens", "name": "Tokens请求量",
                                "synonyms": ["请求数"],
                                "definition": "统计期内的模型调用请求次数", "unit": "次",
                            }
                        ],
                        "dimensions": [
                            {"id": "region", "name": "区域", "dimension_type": "stringDimension"},
                            {"id": "period", "name": "统计周期", "dimension_type": "strDateTypeDimension",
                             "hierarchies": [{"levels": [{"levelType": "monthLevel"}]}]},
                        ],
                    }},
                },
                {
                    "id": "commerce",
                    "workspace_id": "w",
                    "caption": "电商经营",
                    "logical_schema": {"field_schema": {
                        "metrics": [
                            {
                                "id": "paid", "name": "支付金额", "synonyms": ["销售额"],
                                "definition": "统计期内已支付订单金额，未扣除退款", "unit": "元",
                            },
                            {
                                "id": "net", "name": "净实收金额", "synonyms": [],
                                "definition": "统计期内支付金额扣除退款金额后的金额", "unit": "元",
                            },
                            {
                                "id": "refund", "name": "退款金额", "synonyms": [],
                                "definition": "统计期内已退款订单金额", "unit": "元",
                            },
                        ],
                        "dimensions": [
                            {"id": "commerce-period", "name": "统计周期",
                             "dimension_type": "strDateTypeDimension",
                             "hierarchies": [{"levels": [{"levelType": "monthLevel"}]}]},
                        ],
                    }},
                },
            ],
            "coverage": {"complete": True, "scope": "authorized", "truncated": False},
            "issues": [],
        })

    async def detail(self, binding, source):
        del binding, source
        return None


class Knowledge:
    def __init__(self):
        self.value = validate("knowledge", json.loads(KNOWLEDGE_PATH.read_text()))

    async def search(self, binding, query, business_domains, limit):
        del binding, query
        value = deepcopy(self.value)
        if business_domains:
            value["items"] = [
                item for item in value["items"]
                if set(item["businessDomains"]) & set(business_domains)
            ]
        value["items"] = value["items"][:limit]
        return value


class TrustedContext:
    def __init__(self, case):
        self.case = case

    async def current(self, binding):
        return {
            "formatVersion": "1.0",
            "actorId": binding["actorId"],
            "workspaceId": binding["workspaceId"],
            "sessionRef": "session-" + self.case["id"],
            "requestEventId": "event-" + self.case["id"],
            "messageRef": "message-" + self.case["id"],
            "messageText": self.case["question"],
            "receivedAt": "2026-09-26T08:00:00+08:00",
            "timezone": "Asia/Shanghai",
            "invocationKind": "new",
            "businessDomains": self.case["businessDomains"],
        }


class ModelUsage:
    def __init__(self, evidence_root):
        self.evidence_root = evidence_root
        self.calls = 0
        self.tokens = 0


class RecordingTransport(httpx.AsyncBaseTransport):
    """Record bodies without headers while delegating the actual HTTPS request."""

    def __init__(self, usage):
        self.usage = usage

    async def handle_async_request(self, request):
        self.usage.calls += 1
        folder = self.usage.evidence_root / f"model-{self.usage.calls}"
        payload = json.loads(request.content)
        reserve = (len(request.content) + 1) // 2 + 8192 + payload["max_tokens"]
        if self.usage.tokens + reserve > TOKEN_BUDGET:
            raise RuntimeError("TOKEN_BUDGET_EXHAUSTED")
        dump(folder / "request.json", payload)
        started = time.monotonic()
        transport = httpx.AsyncHTTPTransport()
        try:
            response = await transport.handle_async_request(request)
            body = await response.aread()
        finally:
            await transport.aclose()
        value = json.loads(body) if body else {}
        dump(folder / "response.json", value)
        dump(folder / "timing.json", {"elapsedSeconds": round(time.monotonic() - started, 3),
                                       "httpStatus": response.status_code})
        usage = value.get("usage", {}).get("total_tokens")
        if response.status_code == 200 and (not isinstance(usage, int) or isinstance(usage, bool) or usage < 0):
            raise RuntimeError("TOKEN_USAGE_UNAVAILABLE")
        if isinstance(usage, int) and not isinstance(usage, bool):
            self.usage.tokens += usage
        headers = {key: value for key, value in response.headers.items()
                   if key.lower() not in {"content-encoding", "content-length", "transfer-encoding"}}
        return httpx.Response(response.status_code, headers=headers, content=body,
                              extensions=response.extensions, request=request)


class EvidenceInterpreter:
    def __init__(self, delegate, folder):
        self.delegate = delegate
        self.folder = folder

    async def propose(self, context):
        dump(self.folder / "interpreter-input.json", context)
        proposal = await self.delegate.propose(context)
        dump(self.folder / "proposal.json", proposal)
        return proposal


CASES = [
    {
        "id": "explicit-sentence",
        "question": "请查看 2026 年 8 月各区域的 Tokens请求量。",
        "businessDomains": ["运营分析"],
    },
    {
        "id": "ambiguous-knowledge-expression",
        "question": "比较销售额和实际收到的钱。",
        "businessDomains": ["电商经营"],
    },
]


def assess(case, result):
    issues = []
    expected_interpretation = "not_needed" if case["id"] == "explicit-sentence" else "applied"
    if result.get("interpretationStatus") != expected_interpretation:
        issues.append("INTERPRETATION_NOT_APPLIED")
    if result.get("knowledgeStatus") != "ready":
        issues.append("KNOWLEDGE_NOT_READY")
    requirements = result.get("discovery", {}).get("requirements", [])
    matches = {item["metricRef"]: item for item in result.get("matches", []) if item.get("kind") == "metric"}
    by_expression = {item["expression"]: item for item in requirements}
    if case["id"] == "explicit-sentence":
        need = by_expression.get("Tokens请求量")
        selected = matches.get(need.get("selectedRef")) if need else None
        if not need or need.get("status") != "resolved" or need.get("selectedBy") != "rule":
            issues.append("EXPLICIT_METRIC_NOT_RULE_RESOLVED")
        if not selected or selected.get("name") != "Tokens请求量":
            issues.append("EXPLICIT_METRIC_WRONG_SELECTION")
    else:
        sales = by_expression.get("销售额")
        colloquial = by_expression.get("实际收到的钱")
        sales_names = {matches[ref]["name"] for ref in (sales or {}).get("candidateRefs", []) if ref in matches}
        colloquial_names = {matches[ref]["name"] for ref in (colloquial or {}).get("candidateRefs", []) if ref in matches}
        if not sales or sales.get("status") not in {"needs_choice", "needs_scope"} or sales_names != {"支付金额", "净实收金额"}:
            issues.append("AMBIGUOUS_SALES_CHOICE_MISSING")
        if not colloquial or "净实收金额" not in colloquial_names:
            issues.append("KNOWLEDGE_EXPRESSION_NOT_GROUNDED")
        relationships = result.get("discovery", {}).get("relationships", [])
        if not any(item.get("kind") == "comparison" and len(item.get("requirementIds", [])) == 2
                   for item in relationships):
            issues.append("COMPARISON_RELATION_MISSING")
        envelope = result.get("interactionEnvelope")
        if not envelope or envelope.get("kind") != "metriccanvas.discovery-review":
            issues.append("DISCOVERY_REVIEW_MISSING")
    return issues


async def run(output: Path, case_ids=None):
    requested_case_ids = list(case_ids) if case_ids else [case["id"] for case in CASES]
    unknown = set(requested_case_ids) - {case["id"] for case in CASES}
    if unknown:
        raise ValueError("Unknown case ids: " + ", ".join(sorted(unknown)))
    selected_cases = [case for case in CASES if case["id"] in set(requested_case_ids)]
    output.mkdir(parents=True, exist_ok=False)
    cfg = config(ROOT / "apps/platform/.env")
    usage = ModelUsage(output)
    results = []
    started = time.monotonic()
    for index, case in enumerate(selected_cases, 1):
        folder = output / case["id"]
        folder.mkdir()
        binding = {
            "actorId": "alice", "workspaceId": "w", "pageId": "page-" + case["id"],
            "requestId": "request-" + case["id"], "runId": "discovery-smoke",
            "turnId": "turn-" + case["id"],
        }
        store = SqlitePlatformState(folder / "state.db")
        interpreter = EvidenceInterpreter(
            HttpDiscoveryInterpreter(
                cfg["DEEPSEEK_BASE_URL"], model=cfg["DEEPSEEK_MODEL"], api_key=cfg["DEEPSEEK_API_KEY"],
                timeout_seconds=25, transport=RecordingTransport(usage),
            ),
            output / f"model-{index}",
        )
        catalog = SemanticCatalog(
            Metadata(),
            store,
            discovery=DiscoveryDependencies(
                trusted_context=TrustedContext(case),
                knowledge=Knowledge(),
                interpreter=interpreter,
                limits=DiscoveryLimits(seconds=60, lease_seconds=90, model_calls=1),
            ),
        )
        try:
            value = await catalog.discover(binding, case["question"], 20, [])
            dump(folder / "result.json", value)
            issues = assess(case, value)
            result = {"id": case["id"], "status": "pass" if not issues else "fail", "issues": issues}
        except Exception as error:
            reason = str(error) or type(error).__name__
            result = {"id": case["id"], "status": "blocked" if "HTTP" in reason else "error",
                      "reason": reason, "errorType": type(error).__name__}
        dump(folder / "assessment.json", result)
        results.append(result)
    report = {
        "evidenceKind": "real-model-discovery-interpreter",
        "model": cfg["DEEPSEEK_MODEL"],
        "modelCalls": usage.calls,
        "tokens": usage.tokens,
        "tokenBudget": TOKEN_BUDGET,
        "elapsedSeconds": round(time.monotonic() - started, 3),
        "requestedCases": requested_case_ids,
        "executedCases": [case["id"] for case in selected_cases],
        "notRun": [case["id"] for case in CASES if case not in selected_cases],
        "cases": results,
        "passed": bool(results) and all(item["status"] == "pass" for item in results),
        "limitations": [
            "Authorized metadata, knowledge, identity and state are local fixtures",
            "No production Relay, Java, knowledge-base, DQE or page integration evidence",
        ],
    }
    dump(output / "report.json", report)
    print(json.dumps({"passed": report["passed"], "model": report["model"],
                      "modelCalls": report["modelCalls"], "tokens": report["tokens"],
                      "cases": {item["id"]: item["status"] for item in results}}, ensure_ascii=False))
    return report


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--cases", nargs="+")
    args = parser.parse_args()
    report = await run(args.output, args.cases)
    if not report["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
