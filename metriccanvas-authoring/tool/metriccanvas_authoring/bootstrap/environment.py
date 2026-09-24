"""Compatibility delegation; platform startup loads only adapters.factory."""
from metriccanvas_authoring.adapters.environment import (  # noqa: F401
    CONTENT_BASELINES_DIRECTORY_ENV,
    configure_data_context, configure_dqe, configure_content_baselines,
    configure_summary_config, configure_lifecycle_service,
    configure_lifecycle_programs, configure_lifecycle_identities,
    unconfigured_data_context, unconfigured_dqe,
)
