"""No confirmed Java publication endpoints or human proof integration exist yet."""
from metriccanvas_authoring.assets.lifecycle_ports import LifecycleError


class UnavailablePublicationService:
    available = False

    async def lookup(self, identity, command):
        raise LifecycleError('CAPABILITY_UNAVAILABLE')

    async def prepare(self, identity, command):
        raise LifecycleError('CAPABILITY_UNAVAILABLE')

    async def read(self, identity, ref):
        raise LifecycleError('CAPABILITY_UNAVAILABLE')

    async def revise(self, identity, command):
        raise LifecycleError('CAPABILITY_UNAVAILABLE')

    async def publish(self, identity, command, candidate, confirmation):
        raise LifecycleError('CAPABILITY_UNAVAILABLE')

    def verify_document(self, document, digest, algorithm):
        return False

    def verify_review(self, candidate):
        return False

    def verify_result(self, identity, command, result):
        return False


class UnavailableHumanConfirmations:
    async def read(self, token, identity):
        raise LifecycleError('CAPABILITY_UNAVAILABLE')
