"""Public deployment contract. Company implementations live only in adapters/."""
from dataclasses import dataclass
from metriccanvas_authoring.data.ports import DataContextPort, DqeExecutionPort
from metriccanvas_authoring.data.authorization import AnalysisAuthorizationPort
from metriccanvas_authoring.data.catalog_ports import SemanticCatalogPort
from metriccanvas_authoring.data.source_description_ports import SourceDescriptionPort
from metriccanvas_authoring.data.metric_relations import MetricRelationsPort
from metriccanvas_authoring.assets.lifecycle_ports import LifecycleIdentityPort, LifecycleServicePort
from metriccanvas_authoring.delivery.ports import PreviewPort
from metriccanvas_authoring.work.authoring_turns import CurrentAuthoringTurnPort
from metriccanvas_authoring.work.state import StateStore
from metriccanvas_authoring.pages.parameters.page_parameters import ParameterDependencies

ADAPTER_INTERFACE_VERSION = 'authoring-adapters/1.0'


class AdapterContractError(RuntimeError):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


@dataclass(frozen=True)
class AuthoringAdapters:
    interface_version: str
    current_turns: CurrentAuthoringTurnPort
    store: StateStore
    analysis_authorization: AnalysisAuthorizationPort
    lifecycle_service: LifecycleServicePort
    lifecycle_identities: LifecycleIdentityPort
    relay_preview: PreviewPort
    data_context: DataContextPort
    dqe: DqeExecutionPort
    semantic_catalog: SemanticCatalogPort | None = None
    source_description: SourceDescriptionPort | None = None
    metric_relations: MetricRelationsPort | None = None
    parameter_dependencies: ParameterDependencies | None = None
