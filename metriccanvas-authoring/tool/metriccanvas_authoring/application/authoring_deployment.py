"""Compatibility v1 deployment selection for immutable candidate consumers.

Target v2 uses platform_server.create_platform_server and single_save capability.
This v1 manifest must not be used as a v2 readiness gate.
Closed, host-owned dependency selection; never imports or opens manifest input.

The host verifies source digests before constructing registrations. Assembly compares
those facts; a digest supplied by the manifest is not code authorization. The slots select
existing guarded consumers; they cannot replace a state machine. No production registry is installed.
"""
from dataclasses import dataclass, replace
import re
from types import MappingProxyType
from typing import Mapping, Any

from metriccanvas_authoring.pages.composition.compose_page import ComposePageDependencies

AUTHOR = 'metriccanvas-platform-authoring'
SERVICE = 'metriccanvas-platform-content'
SKILL_PATH = 'skill/metriccanvas-platform-authoring/SKILL.md'
_KINDS = {
    'data': {'data_context': ('current',), 'dqe': ('execute',), 'source_description': ('describe',)},
    'business': {'business_interpretation': ('propose',)},
    'component': {'component_policy': ('choose',)},
    'system': {'current_turns': ('current_scope', 'current_turn'), 'candidate_store': ('put', 'get'),
               'execution_records': ('claim', 'update', 'get', 'compare_and_swap'),
               'lifecycle_service': ('save', 'lookup', 'read', 'history', 'verify_document'),
               'lifecycle_programs': ('load', 'store'), 'lifecycle_identities': ('current',),
               'recovery_authority': ('authorize',)},
}
_MANIFEST = {'formatVersion', 'registrationName', 'bundleVersion', 'skillSourceSha256', 'contractsSourceSha256', 'extensions'}
_SELECTION = {'id', 'version', 'kind', 'implementation', 'implementationSourceSha256', 'contractVersion', 'priority'}


class DeploymentError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class RegisteredExtension:
    id: str
    version: str
    kind: str
    implementation: str
    implementation_source_sha256: str
    contract_version: str
    ports: Mapping[str, Any]

    def __post_init__(self):
        # Copy the bindings, not the actual dependency objects or their state.
        object.__setattr__(self, 'ports', MappingProxyType(dict(self.ports)))


@dataclass(frozen=True, slots=True)
class SystemDependencies:
    current_turns: Any
    candidate_store: Any
    execution_records: Any
    lifecycle_service: Any
    lifecycle_programs: Any
    lifecycle_identities: Any
    recovery_authority: Any


@dataclass(frozen=True, slots=True)
class Deployment:
    registration_name: str
    bundle_version: str
    skill_source_sha256: str
    contracts_source_sha256: str
    extensions: tuple[Mapping[str, Any], ...]
    dependencies: ComposePageDependencies
    system: SystemDependencies | None = None
    canonical_author: str = AUTHOR
    skill_path: str = SKILL_PATH
    service: str = SERVICE


    def _system_parts(self):
        from metriccanvas_authoring.work.authoring_candidates import AuthoringCandidates
        from .lifecycle import Lifecycle
        if self.system is None: raise DeploymentError('System dependencies unavailable')
        system = self.system
        return (AuthoringCandidates(system.candidate_store), system.execution_records,
                Lifecycle(system.lifecycle_service, system.lifecycle_programs, system.lifecycle_identities))

    def create_submission(self, *, operation_id=None):
        from metriccanvas_authoring.work.authoring_submission import AuthoringSubmissionCoordinator
        from metriccanvas_authoring.work.authoring_turns import AuthoringTurnGate
        candidates, records, lifecycle = self._system_parts()
        return AuthoringSubmissionCoordinator(candidates, records,
            AuthoringTurnGate(self.system.current_turns), lifecycle, operation_id=operation_id)

    def create_recovery(self, *, clock_ms):
        from metriccanvas_authoring.work.authoring_recovery import AuthoringRecoveryCoordinator
        candidates, records, lifecycle = self._system_parts()
        return AuthoringRecoveryCoordinator(candidates, records, lifecycle,
                                            self.system.recovery_authority, clock_ms=clock_ms)


def _port(slot, port, methods):
    if any(not callable(getattr(port, method, None)) for method in methods):
        raise DeploymentError('Implementation does not provide claimed port')
    if slot == 'lifecycle_service':
        from .lifecycle_ports import LifecycleCapabilities
        caps = getattr(port, 'capabilities', None)
        if not isinstance(caps, LifecycleCapabilities) or any(
            getattr(caps, key) is not True for key in ('stable_save', 'exact_read', 'operation_lookup')):
            raise DeploymentError('Required lifecycle capabilities unavailable')


def _closed(value, fields):
    if not isinstance(value, dict) or set(value) != fields:
        raise DeploymentError('Invalid or unknown manifest fields')


def _text(value):
    if not isinstance(value, str) or not value.strip():
        raise DeploymentError('Expected nonempty version or identifier')


def _hash(value):
    if not isinstance(value, str) or re.fullmatch(r'[0-9a-f]{64}', value) is None:
        raise DeploymentError('Invalid source SHA256')


def assemble_deployment(manifest, registry: Mapping[str, RegisteredExtension],
                        base_dependencies: ComposePageDependencies, *, bundle_version: str,
                        skill_source_sha256: str, contracts_source_sha256: str,
                        contract_version: str, base_system: SystemDependencies | None = None) -> Deployment:
    """Select verified host registrations and return directly injectable dependencies.

    All slot collisions fail, including different priorities: priority is retained
    for rollback, not an implicit permission to override another implementation.
    """
    _closed(manifest, _MANIFEST)
    if manifest['formatVersion'] != '1.0' or manifest['registrationName'] not in (AUTHOR, 'define-report'):
        raise DeploymentError('Unsupported deployment registration')
    for key, expected in (('bundleVersion', bundle_version), ('skillSourceSha256', skill_source_sha256),
                          ('contractsSourceSha256', contracts_source_sha256)):
        _text(expected)
        if key.endswith('Sha256'): _hash(expected)
        if manifest[key] != expected: raise DeploymentError('Deployment source/version mismatch')
    _text(contract_version)
    if not isinstance(manifest['extensions'], list): raise DeploymentError('Invalid extensions')
    selected, bindings, ids = [], {}, set()
    for selection in manifest['extensions']:
        _closed(selection, _SELECTION)
        for key in _SELECTION - {'priority'}: _text(selection[key])
        _hash(selection['implementationSourceSha256'])
        if type(selection['priority']) is not int: raise DeploymentError('Explicit integer priority required')
        if selection['id'] in ids: raise DeploymentError('Duplicate extension ID')
        ids.add(selection['id'])
        if selection['kind'] not in _KINDS: raise DeploymentError('Extension kind unavailable')
        registered = registry.get(selection['implementation'])
        if not isinstance(registered, RegisteredExtension): raise DeploymentError('Unknown implementation')
        for key, actual in (('id', registered.id), ('version', registered.version), ('kind', registered.kind),
                            ('implementation', registered.implementation),
                            ('implementationSourceSha256', registered.implementation_source_sha256),
                            ('contractVersion', registered.contract_version)):
            if selection[key] != actual: raise DeploymentError('Extension metadata mismatch')
        if registered.contract_version != contract_version: raise DeploymentError('Incompatible contract')
        if not registered.ports: raise DeploymentError('Implementation provides no ports')
        for slot, port in registered.ports.items():
            if slot not in _KINDS[selection['kind']]: raise DeploymentError('Core override or unsupported capability')
            if slot in bindings: raise DeploymentError('Conflicting port registrations')
            _port(slot, port, _KINDS[selection['kind']][slot])
            bindings[slot] = port
        selected.append(MappingProxyType(dict(selection)))
    system_bindings = {slot: bindings.pop(slot) for slot in tuple(bindings) if slot in _KINDS['system']}
    system = base_system
    if system is not None and not isinstance(system, SystemDependencies):
        raise DeploymentError('Invalid trusted base system')
    if system_bindings:
        if system is None:
            if set(system_bindings) != set(_KINDS['system']):
                raise DeploymentError('Incomplete system dependencies')
            system = SystemDependencies(**system_bindings)
        else:
            system = replace(system, **system_bindings)
    if system is not None:
        for slot, methods in _KINDS['system'].items(): _port(slot, getattr(system, slot), methods)
    return Deployment(manifest['registrationName'], bundle_version, skill_source_sha256,
                      contracts_source_sha256, tuple(selected), replace(base_dependencies, **bindings), system)
