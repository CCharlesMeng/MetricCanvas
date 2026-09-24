"""Trusted test integration for the create/edit main-flow stdio server."""

import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str((_Path(__file__).resolve().parent / '../../examples').resolve()))
from copy import deepcopy
import json
from pathlib import Path

from adapter_template.firstparty.data_context_http import DataContextProjection
from adapter_template.firstparty.dataset_metadata_http import JavaDatasetMetadataProvider
from adapter_template.firstparty.dqe_http import DqeHttpExecutionPort
from adapter_template.firstparty.lifecycle_http import KnownLifecycleHttp
from metriccanvas_authoring.data.service_identity import ServiceIdentity
from adapter_template.storage.platform_state import SqlitePlatformState
from metriccanvas_authoring.assets.lifecycle_ports import LifecycleIdentity
from metriccanvas_authoring.bootstrap.platform import create_platform_server
from metriccanvas_authoring.pages.composition.compose_page import ComposePageDependencies
from metriccanvas_authoring.work.state import Limits, digest


class MainFlowIdentities:
    def current(self):
        return LifecycleIdentity("alice", "w", "test-only")


class MainFlowDqeIdentity:
    def current(self):
        return ServiceIdentity("alice", "test-only")


class MainFlowAuthorization:
    def __init__(self, requests):
        self.requests = deepcopy(requests)

    async def authorize(self, binding, request, version):
        actual = deepcopy(request)
        actual_id = actual.pop("dataSourceId", None)
        confirmed = False
        for configured in self.requests:
            expected = deepcopy(configured)
            expected_id = expected.pop("dataSourceId", None)
            if actual_id == expected_id and actual == expected:
                confirmed = True
                break
        return {"binding": deepcopy(binding), "requestSha256": digest(request),
                "dataContextVersion": version, "planConfirmed": confirmed,
                "modelEvidenceAllowed": confirmed}


class MainFlowPreview:
    def __init__(self, output_path: Path):
        self.output_path = output_path

    async def prepare(self, artifact):
        self.output_path.write_text(json.dumps(artifact, ensure_ascii=False, indent=2) + "\n")
        return {"status": "ready", "artifactRef": artifact["artifactRef"],
                "ref": deepcopy(artifact["ref"])}


def create_main_flow_server(state_path: Path, current_turns):
    state = json.loads(state_path.read_text())
    fixture = json.loads(Path(state["fixturePath"]).read_text())
    base_url = state["baseUrl"].rstrip("/")
    identities = MainFlowIdentities()
    metadata = JavaDatasetMetadataProvider(base_url, identities,
        dataset_ids=[fixture["dataset"]["dataset_id"]],
        projection=DataContextProjection.from_mapping(fixture["projection"]))
    dependencies = ComposePageDependencies(
        metadata,
        DqeHttpExecutionPort(base_url, "w", MainFlowDqeIdentity()),
    )
    from metriccanvas_authoring.data.semantic_catalog import SemanticCatalog
    store = SqlitePlatformState(state_path.parent / "work.db")
    return create_platform_server(
        dependencies,
        current_turns=current_turns,
        store=store,
        semantic_catalog=SemanticCatalog(metadata, store),
        analysis_authorization=MainFlowAuthorization(
            [fixture["request"], fixture["supplementRequest"], *fixture.get("complexRequests", [])]),
        lifecycle_service=KnownLifecycleHttp(base_url + "/user-page-metadata"),
        lifecycle_identities=identities,
        relay_preview=MainFlowPreview(state_path.parent / "preview.json"),
        limits=Limits(seconds=120),
    )
