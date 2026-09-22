"""TEST ONLY: local-synthetic providers behind the production five-tool factory.

State path is trusted startup configuration, never a model argument or tool.
This adapter establishes no remote identity/latest or restart durability guarantee.
"""
from copy import deepcopy
from dataclasses import replace
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
TESTS = ROOT/'metriccanvas-authoring/test-harness/tests'
sys.path[:0] = [str(ROOT/'metriccanvas-authoring/tool'), str(TESTS)]
from test_authoring_turns import Turns
from authoring_fixtures import dependencies
from metriccanvas_authoring.work.authoring_turns import PreparedAuthoringTurn
from metriccanvas_authoring.work.content_ports import ContentBaseline, ContentBaselineError
from metriccanvas_authoring.pages.editing.edit_page import document_sha256
from metriccanvas_authoring.bootstrap.platform import create_platform_server
from metriccanvas_authoring.adapters.storage.platform_state import SqlitePlatformState
from test_platform_v2 import Authorization, Identities, Service, Preview


class LocalSyntheticTurns:
    def __init__(self, path): self.path = path
    def state(self): return json.loads(self.path.read_text())
    async def current_scope(self): return deepcopy(self.state()['scope'])
    async def current_turn(self):
        state = self.state(); binding = state['binding']; raw = state['documentJson']
        baseline = None if raw is None else ContentBaseline(binding['baseRef'], json.loads(raw), document_sha256(json.loads(raw)))
        return PreparedAuthoringTurn(binding, baseline, raw)


def fixture_server(state_path):
    state = json.loads(state_path.read_text())
    turns = None if state.get('turnProvider') == 'unavailable' else LocalSyntheticTurns(state_path)
    if state.get('profile') == 'main-flow-http':
        from main_flow_host import create_main_flow_server
        return create_main_flow_server(state_path, turns)
    deps = dependencies()  # Existing explicitly synthetic Data Context/DQE/descriptor fixtures.
    if state.get('dataProvider') == 'missing-source': deps = replace(deps, source_description=None)
    if state.get('dataProvider') == 'unavailable':
        from metriccanvas_authoring.bootstrap.environment import unconfigured_data_context, unconfigured_dqe
        deps = replace(deps, data_context=unconfigured_data_context('Local fixture intentionally unavailable'),
                       dqe=unconfigured_dqe('Local fixture intentionally unavailable'), source_description=None)
    return create_platform_server(deps, current_turns=turns,
        store=SqlitePlatformState(state_path.parent/'work.db'), analysis_authorization=Authorization(),
        lifecycle_service=Service(), lifecycle_identities=Identities(), relay_preview=Preview())


if __name__ == '__main__':
    # No model or endpoint configuration is accepted by this process.
    from model_transport import deny_network
    state_path = Path(sys.argv[1])
    state = json.loads(state_path.read_text())
    allowed = []
    if state.get('profile') == 'main-flow-http':
        from urllib.parse import urlsplit
        parsed = urlsplit(state['baseUrl'])
        allowed.append((parsed.hostname, parsed.port))
    deny_network(allowed)
    fixture_server(state_path).run()
