"""Closed, host-owned dependency selection; never imports or opens manifest input.

The host verifies source digests before constructing registrations. Assembly compares
those facts; a digest supplied by the manifest is not code authorization. Only the
existing data ports are implemented here. No production registry is installed.
"""
from dataclasses import dataclass, replace
import re
from types import MappingProxyType
from typing import Mapping, Any

from .compose_page import ComposePageDependencies

AUTHOR = 'metriccanvas-platform-authoring'
SERVICE = 'metriccanvas-platform-content'
SKILL_PATH = 'skill/metriccanvas-platform-authoring/SKILL.md'
_METHODS = {'data_context': 'current', 'dqe': 'execute', 'source_description': 'describe'}
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
class Deployment:
    registration_name: str
    bundle_version: str
    skill_source_sha256: str
    contracts_source_sha256: str
    extensions: tuple[Mapping[str, Any], ...]
    dependencies: ComposePageDependencies
    canonical_author: str = AUTHOR
    skill_path: str = SKILL_PATH
    service: str = SERVICE


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
                        contract_version: str) -> Deployment:
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
        if selection['kind'] != 'data': raise DeploymentError('Extension kind unavailable')
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
            if slot not in _METHODS: raise DeploymentError('Core override or unsupported capability')
            if slot in bindings: raise DeploymentError('Conflicting port registrations')
            if not callable(getattr(port, _METHODS[slot], None)):
                raise DeploymentError('Implementation does not provide claimed port')
            bindings[slot] = port
        selected.append(MappingProxyType(dict(selection)))
    return Deployment(manifest['registrationName'], bundle_version, skill_source_sha256,
                      contracts_source_sha256, tuple(selected), replace(base_dependencies, **bindings))
