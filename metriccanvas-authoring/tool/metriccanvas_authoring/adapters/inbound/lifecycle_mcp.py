"""Independent lifecycle tool surface; even structuredContent contains no full page."""
from fastmcp import FastMCP
from metriccanvas_authoring.application.lifecycle import Lifecycle
from .publish_mcp import register_publication_tools


def create_lifecycle_mcp_server(service, programs, identities, *, publication=None):
    app = Lifecycle(service, programs, identities)
    mcp = FastMCP('metriccanvas-lifecycle', instructions=(
        'Use only trusted program request tokens. No raw page, actor or operation key is a model input. '
        'Unknown/pending saves must be queried with the same save token; never create a new operation '
        'to retry. Program tokens are references for the trusted Relay adapter, not page contents. '
        'Publication requires an independent trusted human event and authoritative service. '
        'This server performs no content editing or parameter extraction.'
    ))

    @mcp.tool
    async def save_draft(request_token: str) -> dict:
        """Save the validated immutable request supplied by the trusted program channel."""
        return await app.call('save_draft', request_token)

    @mcp.tool
    async def get_save_result(request_token: str) -> dict:
        """Query the original save operation, retaining its identity and exact payload."""
        return await app.call('get_save_result', request_token)

    @mcp.tool
    async def read_revision(request_token: str) -> dict:
        """Read exactly the requested revision into the trusted program output channel."""
        return await app.call('read_revision', request_token)

    @mcp.tool
    async def list_revisions(request_token: str) -> dict:
        """Read a fixed snapshot/cursor history page; no latest or invented audit fields."""
        return await app.call('list_revisions', request_token)

    register_publication_tools(mcp, publication, programs, identities, service)
    return mcp
