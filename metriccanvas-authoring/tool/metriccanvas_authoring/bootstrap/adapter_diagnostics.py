"""Identify loaded implementations without serializing instances or configuration."""
import hashlib
import inspect
from pathlib import Path


def implementation_identity(adapter):
    if adapter is None:
        return {'status': 'unconfigured'}
    kind = type(adapter)
    fingerprint = None
    try:
        source = inspect.getsourcefile(kind)
        if source:
            fingerprint = hashlib.sha256(Path(source).read_bytes()).hexdigest()
    except (OSError, TypeError):
        pass
    return {'status': 'loaded', 'module': kind.__module__, 'class': kind.__qualname__,
            'moduleSha256': fingerprint, 'fingerprintScope': 'class source module only; dependencies and deployment configuration excluded',
            'turnMetadata': getattr(kind, 'turn_metadata_capability', None),
            'verification': 'not_run; capability declarations require contract tests'}


def adapter_identities(adapters):
    return {name: implementation_identity(getattr(adapters, name)) for name in (
        'data_context', 'dqe', 'semantic_catalog', 'current_turns', 'store',
        'analysis_authorization', 'lifecycle_service', 'lifecycle_identities', 'relay_preview')}
