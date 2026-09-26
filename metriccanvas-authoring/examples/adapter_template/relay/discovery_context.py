"""Bridge an authenticated Relay callback, never a model argument or ambient file."""
from copy import deepcopy
from metriccanvas_authoring.data.discovery.contracts import validate


class RelayDiscoveryContext:
    def __init__(self, read_authenticated_invocation):
        self.read_authenticated_invocation = read_authenticated_invocation

    async def current(self, binding):
        # Internal callback must associate this exact invocation with a real user event.
        value = await self.read_authenticated_invocation(deepcopy(binding))
        return deepcopy(validate('invocation', value))
