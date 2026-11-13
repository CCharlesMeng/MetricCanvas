"""Transport to the bundled product validator; no page semantics are defined here."""
from __future__ import annotations
import json
import hashlib
import shutil
import subprocess
from contextlib import contextmanager, suppress
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout
import tempfile
from dataclasses import dataclass
from functools import partial
from pathlib import Path
from typing import Any
from metriccanvas_authoring.runtime_assets import bundle_root
from metriccanvas_authoring.bundle_lock import load_bundle_lock


@dataclass(frozen=True, slots=True)
class NodeValidationResources:
    """Trusted local product resources, resolved by the application, never model input."""
    program: Path
    sha256: str
    schema_version: str
    evaluation: dict[str, str] | None = None


@dataclass(frozen=True, slots=True, kw_only=True)
class _SessionResources(NodeValidationResources):
    process: ValidationProcess


@contextmanager
def compose_validation_session(resources):
    if resources is None:
        yield None
        return
    with ValidationProcess(resources.program, resources.sha256, partial(_checked_program, resources)) as process:
        yield _SessionResources(resources.program, resources.sha256, resources.schema_version, resources.evaluation, process=process)


def _checked_program(resources: NodeValidationResources) -> str:
    node = shutil.which("node")
    if not node or hashlib.sha256(resources.program.read_bytes()).hexdigest() != resources.sha256:
        raise ValueError("Product program unavailable or changed")
    version = subprocess.run([node, "--version"], capture_output=True, text=True, encoding="utf-8", timeout=5, check=True)
    if int(version.stdout.strip().lstrip("v").split(".")[0]) < 22:
        raise ValueError("Node.js 22+ required")
    return node


def validate_with_resources(document: Any, resources: NodeValidationResources):
    """Run an integrity checked prebuilt program; no repository, tsx or network."""
    request = {"document": document}
    if resources.evaluation is not None:
        request["evaluation"] = resources.evaluation
    if isinstance(resources, _SessionResources):
        receipt, returncode = resources.process.request({"operation": "page.validate", "input": request})
    else:
        receipt, returncode = _single_validation(request, resources)
    return _validated_product_receipt(receipt, returncode, resources)


def _single_validation(request, resources):
    node = _checked_program(resources)
    result = subprocess.run([node, str(resources.program.resolve())],
        input=json.dumps({"operation": "page.validate", "input": request}, ensure_ascii=False, allow_nan=False),
        capture_output=True, text=True, encoding="utf-8", timeout=20, check=False)
    return json.loads(result.stdout), result.returncode


def _validated_product_receipt(receipt, returncode, resources):
    if returncode not in (0, 2):
        raise ValueError("Product program failed")
    data = receipt["data"]
    context_issues = _evaluation_issues(receipt, returncode)
    if context_issues is not None:
        return context_issues
    if data.get("schemaVersion") != resources.schema_version:
        raise ValueError("Product Schema mismatch")
    issues = _receipt_issues(data)
    expected_status = "error" if issues else "ok"
    if receipt.get("status") != expected_status or returncode != (2 if issues else 0):
        raise ValueError("Inconsistent product result")
    if receipt.get("diagnostics") != data["errors"]:
        raise ValueError("Inconsistent product diagnostics")
    return issues


def _evaluation_issues(receipt, returncode):
    from .page_validation import PageContractIssue
    diagnostics = receipt.get("diagnostics")
    if not isinstance(diagnostics, list) or not diagnostics:
        return None
    if any(item.get("code") not in {"EVALUATION_CONTEXT_REQUIRED", "INVALID_EVALUATION_CONTEXT"} for item in diagnostics):
        return None
    if receipt.get("status") != "error" or returncode != 2:
        raise ValueError("Inconsistent evaluation refusal")
    return [PageContractIssue(item["code"], item["path"], item["message"]) for item in diagnostics]


def _receipt_issues(receipt):
    from .page_validation import PageContractIssue
    if not isinstance(receipt.get("ok"), bool) or not isinstance(receipt.get("errors"), list):
        raise ValueError("Invalid product receipt")
    issues = [PageContractIssue(item["type"], item["path"], item["message"]) for item in receipt["errors"]]
    if receipt["ok"] != (not issues):
        raise ValueError("Inconsistent product receipt")
    return issues


def validate_with_node(document: Any, *, resources: NodeValidationResources | None = None):
    from .page_validation import PageContractIssue
    if resources is not None:
        try:
            return validate_with_resources(document, resources)
        except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError):
            return [PageContractIssue("SCHEMA_ERROR", "/", "产品页面校验不可用：需要匹配的本地预构建程序及 Node.js 22+")]
    bridge = bundle_root() / "scripts" / "page-validation-bridge.mjs"
    node = shutil.which("node")
    unavailable = [PageContractIssue("SCHEMA_ERROR", "/", "产品页面校验不可用：需要 Node.js 22+ 和 Bundle 内的 Node Bridge")]
    if not node or not bridge.is_file():
        return unavailable
    try:
        lock=load_bundle_lock(bundle_root())
        expected=next((item['sha256'] for item in lock['artifacts'] if item['file']=='scripts/page-validation-bridge.mjs'),None)
        if expected!=hashlib.sha256(bridge.read_bytes()).hexdigest():return unavailable
        version = subprocess.run([node, "--version"], capture_output=True, text=True, encoding="utf-8", timeout=5, check=True)
        if int(version.stdout.strip().lstrip("v").split(".")[0]) < 22:
            return unavailable
        result = subprocess.run([node, str(bridge)], input=json.dumps({"document": document}, ensure_ascii=False),
                                capture_output=True, text=True, encoding="utf-8", timeout=20, check=True)
        receipt = json.loads(result.stdout)
        from metriccanvas_authoring.bundle_info import load_bundle_info
        if receipt.get('schemaVersion') != load_bundle_info()['pageSchemaVersion']:
            return unavailable
        return _receipt_issues(receipt)
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError):
        return unavailable


def edit_presentation_with_node(document, operation):
    """Transport a closed presentation operation to the same product implementation."""
    from metriccanvas_authoring.bundle_info import load_bundle_info
    bridge = bundle_root() / "scripts" / "page-validation-bridge.mjs"
    node = shutil.which("node")
    if not node or not bridge.is_file():
        return None
    try:
        lock = load_bundle_lock(bundle_root())
        expected = next((item['sha256'] for item in lock['artifacts'] if item['file'] == 'scripts/page-validation-bridge.mjs'), None)
        if expected != hashlib.sha256(bridge.read_bytes()).hexdigest():
            return None
        result = subprocess.run([node, str(bridge)], input=json.dumps({'document': document, 'operation': operation}, ensure_ascii=False), capture_output=True, text=True, encoding="utf-8", timeout=20, check=True)
        receipt = json.loads(result.stdout)
        if receipt.get('schemaVersion') != load_bundle_info()['pageSchemaVersion']:
            return None
        return receipt
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError):
        return None


class ValidationProcess:
    def __init__(self, program, sha256, checked_node):
        self.program, self.sha256, self.checked_node = program, sha256, checked_node
        self.process = self.executor = self.stderr = None
        self.sequence = 0

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()

    def _start(self):
        if self.process is not None:
            return
        node = self.checked_node()
        self.stderr = tempfile.TemporaryFile()
        try:
            self.process = subprocess.Popen([node, str(self.program.resolve()), '--validation-session'],
                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=self.stderr,
                text=True, encoding='utf-8', bufsize=1)
            self.executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix='mc-page-validation')
        except BaseException:
            self.close()
            raise

    def request(self, request, *, timeout=20):
        try:
            # Detect disk replacement even after the checked process has loaded its code.
            if hashlib.sha256(self.program.read_bytes()).hexdigest() != self.sha256:
                raise ValueError('Product program unavailable or changed')
            self._start()
            self.sequence += 1
            future = self.executor.submit(self._exchange, self.process, self.sequence, request)
            return future.result(timeout=timeout)
        except FutureTimeout as error:
            self.close()
            raise subprocess.TimeoutExpired(str(self.program), timeout) from error
        except BaseException:
            self.close()
            raise

    @staticmethod
    def _exchange(process, sequence, request):
        payload = json.dumps({'sequence': sequence, 'request': request}, ensure_ascii=False, allow_nan=False)
        process.stdin.write(payload + '\n')
        process.stdin.flush()
        line = process.stdout.readline()
        if not line:
            raise ValueError('Product validation process ended without a receipt')
        result = json.loads(line)
        if set(result) != {'sequence', 'returncode', 'receipt'} or result['sequence'] != sequence:
            raise ValueError('Uncorrelated product validation receipt')
        return result['receipt'], result['returncode']

    def close(self):
        process, executor, stderr = self.process, self.executor, self.stderr
        self.process = self.executor = self.stderr = None
        if process is not None:
            with suppress(OSError, subprocess.SubprocessError):
                if process.poll() is None:
                    process.kill()
                process.wait(timeout=5)
        if executor is not None:
            executor.shutdown(wait=True, cancel_futures=True)
        if process is not None:
            with suppress(OSError):
                process.stdin.close()
            process.stdout.close()
        if stderr is not None:
            stderr.close()
