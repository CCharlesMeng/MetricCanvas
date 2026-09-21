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
from test_authoring_candidates import MemoryCandidates
from test_unified_content_mcp import dependencies
from metriccanvas_authoring.application.authoring_turns import PreparedAuthoringTurn
from metriccanvas_authoring.application.content_ports import ContentBaseline, ContentBaselineError
from metriccanvas_authoring.application.edit_page import document_sha256
from metriccanvas_authoring.entrypoints.compat.unified_content_mcp import create_unified_content_mcp_server


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
    deps = dependencies()  # Existing explicitly synthetic Data Context/DQE/descriptor fixtures.
    if state.get('dataProvider') == 'missing-source': deps = replace(deps, source_description=None)
    if state.get('dataProvider') == 'unavailable':
        from metriccanvas_authoring.bootstrap.environment import unconfigured_data_context, unconfigured_dqe
        deps = replace(deps, data_context=unconfigured_data_context('Local fixture intentionally unavailable'),
                       dqe=unconfigured_dqe('Local fixture intentionally unavailable'), source_description=None)
    return create_unified_content_mcp_server(deps,
        None if state.get('turnProvider') == 'unavailable' else LocalSyntheticTurns(state_path),
        candidate_store=None if state.get('candidateProvider') == 'unavailable' else MemoryCandidates())


if __name__ == '__main__':
    # No model or endpoint configuration is accepted by this process.
    from model_transport import deny_network
    deny_network()
    fixture_server(Path(sys.argv[1])).run()
