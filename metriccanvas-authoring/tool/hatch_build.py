"""Embed runtime contracts for direct wheel builds and reuse them from sdist."""
from pathlib import Path
from hatchling.builders.hooks.plugin.interface import BuildHookInterface


class CustomBuildHook(BuildHookInterface):
    def initialize(self, version, build_data):
        if self.target_name != 'wheel':
            return
        bundle = Path(self.root).parent
        if not (bundle / 'bundle.json').is_file():
            # sdist already contains the complete _bundle inside the package.
            return
        for name in ('bundle.json', 'contract-lock.json', 'contracts', 'contract-snapshot'):
            build_data['force_include'][str(bundle / name)] = 'metriccanvas_authoring/_bundle/' + name
