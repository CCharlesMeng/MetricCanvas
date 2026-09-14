"""Production stdio composition: known HTTP only; future strong ports remain unavailable."""
import os
from pathlib import Path
from metriccanvas_authoring.adapters.inbound.lifecycle_mcp import create_lifecycle_mcp_server
from metriccanvas_authoring.adapters.outbound.lifecycle_http import KnownLifecycleHttp
from metriccanvas_authoring.application.publish_ports import PublicationDependencies
from metriccanvas_authoring.adapters.outbound.publish_unavailable import UnavailablePublicationService, UnavailableHumanConfirmations
from metriccanvas_authoring.adapters.outbound.lifecycle_spool import FileLifecyclePrograms, InjectedLifecycleIdentity


def create_production_lifecycle_server():
    def directory(name):
        value = os.environ.get(name, '').strip()
        return Path(value) if value else None
    return create_lifecycle_mcp_server(
        KnownLifecycleHttp(os.environ.get('METRICCANVAS_LIFECYCLE_COLLECTION_URL','')),
        FileLifecyclePrograms(directory('METRICCANVAS_LIFECYCLE_INPUTS_DIR'),
            directory('METRICCANVAS_LIFECYCLE_OUTPUTS_DIR')),
        InjectedLifecycleIdentity(),
        publication=PublicationDependencies(UnavailablePublicationService(), UnavailableHumanConfirmations()))


def main():
    create_production_lifecycle_server().run()


if __name__ == '__main__':
    main()
