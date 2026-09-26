"""Optional discovery seams. No adapter or model is configured implicitly."""
from dataclasses import dataclass
from typing import Protocol
import json
from jsonschema import Draft202012Validator
from metriccanvas_authoring.runtime_assets import bundle_root
from metriccanvas_authoring.work.state import require


class BusinessKnowledgePort(Protocol):
    async def search(self, binding, query, business_domains, limit) -> dict: ...


class CandidateRetrievalPort(Protocol):
    async def retrieve(self, binding, request, metadata_source, budget) -> dict: ...


class DiscoveryInterpretationPort(Protocol):
    async def propose(self, context) -> dict: ...


class TrustedDiscoveryContextPort(Protocol):
    async def current(self, binding) -> dict: ...


@dataclass(frozen=True)
class DiscoveryLimits:
    seconds: float = 10
    ttl_seconds: int = 86400
    lease_seconds: int = 30
    model_calls: int = 2
    requirements: int = 6
    candidates: int = 20
    knowledge_items: int = 20
    events: int = 32

    def __post_init__(self):
        require(all(isinstance(v, (int, float)) and not isinstance(v, bool) and v > 0
                    for v in vars(self).values()), 'DISCOVERY_LIMIT_INVALID')
        require(self.lease_seconds > self.seconds and self.model_calls <= 2
                and self.requirements <= 6 and self.candidates <= 20 and self.knowledge_items <= 20
                and self.events <= 32, 'DISCOVERY_LIMIT_INVALID')


@dataclass(frozen=True)
class DiscoveryDependencies:
    trusted_context: TrustedDiscoveryContextPort | None = None
    knowledge: BusinessKnowledgePort | None = None
    interpreter: DiscoveryInterpretationPort | None = None
    retrieval: CandidateRetrievalPort | None = None
    limits: DiscoveryLimits = DiscoveryLimits()


def validate(kind, value):
    schema = json.loads((bundle_root() / 'contracts/authored/discovery.schema.json').read_text())
    candidate = {'$ref': '#/$defs/' + kind, '$defs': schema['$defs']}
    require(Draft202012Validator(candidate).is_valid(value), 'DISCOVERY_' + kind.upper() + '_INVALID')
    return value
