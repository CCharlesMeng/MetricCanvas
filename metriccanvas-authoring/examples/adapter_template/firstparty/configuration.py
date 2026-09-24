"""Factory helper: explicit projection loading, no implicit environment lookup."""
from metriccanvas_authoring.data.ports import DataContextError
from .data_context_http import load_projection_config
from .dataset_metadata_http import JavaDatasetMetadataProvider


def create_metadata_provider(base_url, identities, *, projection_path, dataset_ids=None):
    if not isinstance(projection_path, str) or not projection_path.strip():
        raise DataContextError('DATA_CONTEXT_CONFIG_ERROR', 'An explicit projection_path is required',
            diagnostics={'stage': 'projection_configuration', 'issues': [
                {'path': '/projection_path', 'property': 'projection_path', 'reason': 'missing'}],
                'issueCount': 1, 'truncated': False})
    try:
        projection = load_projection_config(projection_path)
    except DataContextError:
        raise DataContextError('DATA_CONTEXT_CONFIG_ERROR', 'Projection configuration could not be loaded',
            diagnostics={'stage': 'projection_configuration', 'issues': [
                {'path': '/projection_path', 'property': 'projection_path', 'reason': 'unreadable_or_invalid'}],
                'issueCount': 1, 'truncated': False}) from None
    return JavaDatasetMetadataProvider(base_url, identities,
                                      dataset_ids=dataset_ids, projection=projection)
