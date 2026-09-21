"""Publication tools added only to the independent lifecycle MCP."""
from metriccanvas_authoring.application.lifecycle_publish import Publication


def register_publication_tools(mcp, dependencies, programs, identities, sources):
    app = Publication(dependencies, programs, identities, sources)

    @mcp.tool
    async def prepare_candidate(request_token: str) -> dict:
        """Prepare an exact draft's candidate through a trusted program request."""
        return await app.call('prepare', request_token)

    @mcp.tool
    async def read_candidate(request_token: str) -> dict:
        """Read exactly one candidate into the program channel; never expose its document."""
        return await app.call('read', request_token)

    @mcp.tool
    async def revise_candidate(request_token: str) -> dict:
        """Ask the authoritative service to correct selections and revalidate a new version."""
        return await app.call('revise', request_token)

    @mcp.tool
    async def confirm_publish(request_token: str) -> dict:
        """Publish only with an independently authenticated human confirmation record.

        A model's affirmative text, ordinary request token or arbitrary proof string
        is not confirmation. Unknown operations must be queried using the same token.
        """
        return await app.call('publish', request_token)

    @mcp.tool
    async def get_publish_operation_result(request_token: str) -> dict:
        """Query the original prepare, revise or publish operation without submitting writes."""
        return await app.call('lookup', request_token)
