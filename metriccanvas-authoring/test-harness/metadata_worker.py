"""Independent-process fixture for public metadata-session integration tests."""
import asyncio
import json
import sys
import logging
from pathlib import Path
from types import SimpleNamespace
import httpx
from adapter_template.storage.platform_state import SqlitePlatformState
from metriccanvas_authoring.data.metadata_session import metadata_session, read_turn_metadata


async def main():
    config = json.loads(sys.argv[1])
    if config.get('waitMarker'):
        class WaitMarker(logging.Handler):
            def emit(self, record):
                if record.args and record.args[0] == 'wait':
                    Path(config['waitMarker']).write_text('waiting')
        logger = logging.getLogger('metriccanvas_authoring.data.metadata_session')
        logger.setLevel(logging.INFO)
        logger.addHandler(WaitMarker())
    class Gate:
        async def require(self, ref):
            return SimpleNamespace(binding=config['binding'])
        async def unchanged(self, prepared):
            if prepared.binding != config['binding']:
                raise RuntimeError('changed')
    class App:
        gate = Gate()
        state = SimpleNamespace(store=SqlitePlatformState(config['db']))
        @metadata_session
        async def read(self, context_ref):
            async def load():
                async with httpx.AsyncClient(timeout=10, trust_env=False) as client:
                    response = await client.get(config['url'])
                    response.raise_for_status()
                    return response.json()
            return await read_turn_metadata(config['source'], load, retain_partial=True)
    print(json.dumps(await App().read('context')))


if __name__ == '__main__':
    asyncio.run(main())
