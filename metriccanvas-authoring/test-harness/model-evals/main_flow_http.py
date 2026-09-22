"""Local HTTP substitute for the create/edit Skill main-flow evaluation.

The server implements only the scenario declared in platform-main-flow.json.
Unknown DQE requests fail explicitly, and page assets remain stateful for the
life of this server so independent stdio processes can create and then edit.
"""
from __future__ import annotations

import argparse
from contextlib import contextmanager
from copy import deepcopy
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
from threading import Lock, Thread
from urllib.parse import unquote, urlsplit


API_ROOT = "/rest/cdi/cdinl2databuilderservice/v1"
METADATA_PATH = API_ROOT + "/dataset-detail/query-dataset-from-lab"
DQE_PATH = API_ROOT + "/dsl/execute"
ASSETS_PATH = API_ROOT + "/user-page-metadata"


class MainFlowState:
    def __init__(self, fixture_path: Path, log_path: Path):
        self.fixture = json.loads(fixture_path.read_text())
        self.log_path = log_path
        self.assets: dict[str, dict] = {}
        self.lock = Lock()

    def seed(self, artifact_path: Path):
        artifact = json.loads(artifact_path.read_text())
        ref = artifact["ref"]
        number = int(str(ref["revisionId"]).removeprefix("r"))
        self.assets[ref["resourceId"]] = {"resourceId": ref["resourceId"],
            "pageId": ref["pageId"], "revisionId": ref["revisionId"],
            "revisionNumber": number, "document": deepcopy(artifact["document"])}

    def record(self, method: str, path: str, body, status: int, *, saved: bool = False):
        entry = {"method": method, "path": path, "body": body, "status": status}
        if saved:
            entry["saved"] = True
        with self.lock:
            with self.log_path.open("a") as stream:
                stream.write(json.dumps(entry, ensure_ascii=False, separators=(",", ":")) + "\n")

    def receipt(self, asset: dict) -> dict:
        return {
            "retCode": "CBC.0000",
            "retDesc": None,
            "page_metadata_id": asset["resourceId"],
            "page_id": asset["pageId"],
            "revision_id": asset["revisionId"],
            "revision_number": asset["revisionNumber"],
            "page_metadata_definition": json.dumps(asset["document"], ensure_ascii=False, separators=(",", ":")),
            "is_draft": True,
            "created_at": "2026-09-22T00:00:00.000Z",
            "updated_at": "2026-09-22T00:00:00.000Z",
        }


def _handler(state: MainFlowState):
    class Handler(BaseHTTPRequestHandler):
        server_version = "MetricCanvasMainFlow/1"

        def log_message(self, format, *args):
            return

        def _body(self):
            length = int(self.headers.get("Content-Length", "0"))
            if not length:
                return None
            try:
                return json.loads(self.rfile.read(length))
            except (UnicodeDecodeError, json.JSONDecodeError):
                return None

        def _send(self, status: int, body=None, *, saved: bool = False, request_body=None):
            raw = b"" if body is None else json.dumps(body, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin", "*"))
            self.send_header("Access-Control-Allow-Credentials", "true")
            self.send_header("Access-Control-Allow-Headers", "Content-Type,X-Auth-Token,X-Operator-Id,X-Workspace-Id")
            self.send_header("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS")
            if raw:
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            if raw:
                self.wfile.write(raw)
            state.record(self.command, urlsplit(self.path).path, request_body, status, saved=saved)

        def _authorized(self, *, dqe=False):
            valid = self.headers.get("X-Auth-Token") == "test-only" and self.headers.get("X-Operator-Id") == "alice"
            if dqe:
                valid = valid and self.headers.get("X-Workspace-Id") == "w"
            if not valid:
                self._send(401, {"retCode": "CBC.0401", "retDesc": "unauthorized"})
            return valid

        def do_OPTIONS(self):
            self._send(204)

        def do_GET(self):
            path = urlsplit(self.path).path
            if path == "/__health":
                self._send(200, {"status": "ok", "service": "metriccanvas-main-flow"})
                return
            if not path.startswith(ASSETS_PATH) or not self._authorized():
                if not path.startswith(ASSETS_PATH):
                    self._send(404, {"retCode": "CBC.0404"})
                return
            if path == ASSETS_PATH:
                with state.lock:
                    values = [state.receipt(asset) for asset in state.assets.values()]
                self._send(200, {"retCode": "CBC.0000", "page_metadata_list": values,
                                 "total": len(values), "page_no": 0, "page_size": 0})
                return
            resource_id = unquote(path[len(ASSETS_PATH) + 1:])
            with state.lock:
                asset = deepcopy(state.assets.get(resource_id))
            self._send(200, state.receipt(asset)) if asset else self._send(404, {"retCode": "CBC.0404"})

        def do_POST(self):
            path = urlsplit(self.path).path
            body = self._body()
            if path == METADATA_PATH:
                if not self._authorized():
                    return
                expected_ids = [state.fixture["dataset"]["dataset_id"]]
                valid = isinstance(body, dict) and body.get("workspaceId") == "w" and body.get("datasetIds", expected_ids) == expected_ids
                payload = {"retCode": "CBC.0000", "dataset_details": [deepcopy(state.fixture["dataset"])]} if valid else {"retCode": "CBC.0400", "dataset_details": []}
                self._send(200 if valid else 400, payload, request_body=body)
                return
            if path == DQE_PATH:
                if not self._authorized(dqe=True):
                    return
                rows = None
                if body == state.fixture["query"]:
                    rows = state.fixture["rows"]
                elif body == state.fixture["supplementQuery"]:
                    rows = state.fixture["supplementRows"]
                item = {"code": "SUCCESS", "data": deepcopy(rows), "total_count": len(rows)} if rows is not None else {"code": "NO_MATCH", "data": [], "total_count": 0, "message": "unsupported fixture query"}
                self._send(200, {"retCode": "CBC.0000", "retDesc": None, "results": [item]}, request_body=body)
                return
            if path == ASSETS_PATH:
                if not self._authorized():
                    return
                valid = isinstance(body, dict) and isinstance(body.get("page_id"), str) and isinstance(body.get("page_metadata_definition"), dict) and body.get("is_draft") is True
                if not valid or body["page_metadata_definition"].get("id") != body["page_id"]:
                    self._send(400, {"retCode": "CBC.0400"}, request_body=body)
                    return
                resource_id = "resource-" + body["page_id"]
                with state.lock:
                    duplicate = resource_id in state.assets
                    if not duplicate:
                        asset = {"resourceId": resource_id, "pageId": body["page_id"], "revisionId": "r1",
                                 "revisionNumber": 1, "document": deepcopy(body["page_metadata_definition"])}
                        state.assets[resource_id] = asset
                if duplicate:
                    self._send(409, {"retCode": "CBC.0409"}, request_body=body)
                    return
                self._send(200, state.receipt(asset), saved=True, request_body=body)
                return
            self._send(404, {"retCode": "CBC.0404"}, request_body=body)

        def do_PUT(self):
            path = urlsplit(self.path).path
            body = self._body()
            if not path.startswith(ASSETS_PATH + "/"):
                self._send(404, {"retCode": "CBC.0404"}, request_body=body)
                return
            if not self._authorized():
                return
            resource_id = unquote(path[len(ASSETS_PATH) + 1:])
            with state.lock:
                current = state.assets.get(resource_id)
                valid = current is not None and isinstance(body, dict) and body.get("base_revision_id") == current["revisionId"] and body.get("is_draft") is True and isinstance(body.get("page_metadata_definition"), dict) and body["page_metadata_definition"].get("id") == current["pageId"]
                if valid:
                    number = current["revisionNumber"] + 1
                    asset = {**current, "revisionId": "r" + str(number), "revisionNumber": number,
                             "document": deepcopy(body["page_metadata_definition"])}
                    state.assets[resource_id] = asset
                else:
                    asset = None
            self._send(200, state.receipt(asset), saved=True, request_body=body) if asset else self._send(409, {"retCode": "CBC.0409"}, request_body=body)

    return Handler


@contextmanager
def serve_main_flow(fixture_path: Path, log_path: Path):
    state = MainFlowState(fixture_path, log_path)
    server = ThreadingHTTPServer(("127.0.0.1", 0), _handler(state))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        host, port = server.server_address
        yield state, f"http://{host}:{port}{API_ROOT}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fixture", type=Path, required=True)
    parser.add_argument("--log", type=Path, required=True)
    parser.add_argument("--seed", type=Path)
    parser.add_argument("--ready", type=Path, required=True)
    args = parser.parse_args()
    state = MainFlowState(args.fixture, args.log)
    if args.seed:
        state.seed(args.seed)
    server = ThreadingHTTPServer(("127.0.0.1", 0), _handler(state))
    host, port = server.server_address
    args.ready.write_text(json.dumps({"baseUrl": f"http://{host}:{port}{API_ROOT}"}) + "\n")
    try:
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
