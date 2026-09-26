"""Public platform authoring tools and their model-visible input schemas."""
from typing import Annotated, Any, Literal
from fastmcp import FastMCP
from fastmcp.tools import ToolResult
from pydantic import Field, WithJsonSchema, BaseModel, ConfigDict
from metriccanvas_authoring.data.results import QUERY_SCHEMA
from metriccanvas_authoring.pages.referenced import COMPOSE_SCHEMA, EDIT_RESULT_SCHEMA
from metriccanvas_authoring.work.content_ports import ContentBaselineError
from metriccanvas_authoring.data.ports import DataContextError
from metriccanvas_authoring.bundle_info import load_bundle_info

QueryRequest = Annotated[dict[str, Any], WithJsonSchema(QUERY_SCHEMA)]
ComposeRequest = Annotated[dict[str, Any], WithJsonSchema(COMPOSE_SCHEMA)]
EditRequest = Annotated[dict[str, Any], WithJsonSchema(EDIT_RESULT_SCHEMA)]


class ParameterTextChoice(BaseModel):
    model_config = ConfigDict(extra='forbid')
    slot_id: Annotated[str, Field(min_length=1, max_length=128)]
    kind: Literal['parameter', 'literal']
    candidate_id: Annotated[str, Field(min_length=1, max_length=128)] | None = None
    text: Annotated[str, Field(max_length=4096)] | None = None


def create_platform_mcp_server(application):
    mcp = FastMCP('metriccanvas-platform-content', instructions=(
        'Platform authoring: query approved analysis plans, compose/edit from result references and save drafts internally. '
        'Read workVersion before editing. Only modelSummary enters the model channel; '
        'authorized bounded query evidence is model-visible. Relay retains artifactEnvelope. '
        'After saved, prepare the exact artifact with page_metadata_emit_preview; preserve Relay placeholders.'))

    async def call(method, *args, mutation=False, parameter=False, **kwargs):
        try:
            result = await method(*args, **kwargs)
            if parameter:
                return ToolResult(content=result['modelSummary'], structured_content=result)
            envelope = None
            if mutation:
                result, value = result
                if value is not None:
                    envelope = {'kind': 'metriccanvas.platform-artifact', 'formatVersion': '2.0', 'artifact': value}
            interaction = result.get('interactionEnvelope')
            summary = {k: v for k, v in result.items() if k != 'interactionEnvelope'}
            output = {'ok': result.get('status') not in {'failed', 'rejected', 'unavailable'}, 'modelSummary': summary, 'artifactEnvelope': envelope}
            if interaction is not None:
                output['interactionEnvelope'] = interaction
            return ToolResult(content=summary, structured_content=output)
        except (ContentBaselineError, DataContextError) as error:
            summary = {'status': 'rejected', 'issues': [{'code': error.code, 'path': ''}]}
        except Exception:
            summary = {'status': 'unavailable', 'issues': [{'code': 'AUTHORING_PROVIDER_UNAVAILABLE', 'path': ''}]}
        return ToolResult(content=summary, structured_content={'ok': False, 'modelSummary': summary, 'artifactEnvelope': None})

    @mcp.resource('metriccanvas://bundle-info')
    def bundle_info():
        return {**load_bundle_info(), 'platformProtocolVersion': '2.0',
                'discoveryProtocolVersion': getattr(application.semantic_catalog, 'discovery_protocol_version', None)}

    @mcp.tool
    async def read_page_context(context_ref: str, target_component_id: str | None = None, use_selection: bool = False,
            offset: Annotated[int, Field(ge=0)] = 0, limit: Annotated[int, Field(ge=1, le=50)] = 20, cursor: str | None = None) -> ToolResult:
        """Read current work configuration and workVersion. No business query or save."""
        return await call(application.read, context_ref, target_component_id=target_component_id, use_selection=use_selection, offset=offset, limit=limit, cursor=cursor)

    @mcp.tool
    async def discover_data_context(context_ref: str, query: str = '', limit: Annotated[int, Field(ge=1, le=50)] = 10,
            detail_refs: list[str] | None = None) -> ToolResult:
        """Find canonical business domains, metrics, dimensions and time granularities; combinations may be unknown."""
        return await call(application.discover, context_ref, query, limit, detail_refs)

    @mcp.tool
    async def query_data(context_ref: str, request: QueryRequest | None = None, result_ref: str | None = None) -> ToolResult:
        """Execute an approved batch or read existing bounded evidence. Exactly one input; no page creation."""
        return await call(application.query, context_ref, request, result_ref)

    @mcp.tool
    async def compose_page(context_ref: str, request: ComposeRequest, expected_version: Annotated[int, Field(ge=0)] = 0) -> ToolResult:
        """Create sections from result references or text; save a valid draft internally."""
        return await call(application.mutate, 'compose', context_ref, request, expected_version, mutation=True)

    @mcp.tool
    async def edit_page(context_ref: str, page_id: Annotated[str, Field(min_length=1)], request: EditRequest, expected_version: Annotated[int, Field(ge=0)]) -> ToolResult:
        """Edit page_id after checking its trusted binding and Java current baseline; save valid changes."""
        return await call(application.mutate, 'edit', context_ref, request, expected_version, page_id=page_id, mutation=True)

    @mcp.tool
    async def page_metadata_emit_preview(context_ref: str, artifact_ref: str) -> ToolResult:
        """Prepare the exact saved artifact through Relay. Does not query data or save again."""
        return await call(application.preview, context_ref, artifact_ref)

    @mcp.tool
    async def extract_page_parameters(context_ref: str, artifact_ref: str | None = None) -> ToolResult:
        """Extract verified parameter choices from current work or a scoped artifact."""
        return await call(application.parameters.extract, context_ref, artifact_ref, parameter=True)

    @mcp.tool
    async def apply_page_parameter_selection(context_ref: str, extraction_ref: str,
            selected_ids: Annotated[list[str], Field(max_length=100)],
            text_choices: Annotated[list[ParameterTextChoice], Field(max_length=200)] = []) -> ToolResult:
        """Prepare an immutable template artifact; does not save or publish."""
        return await call(application.parameters.apply, context_ref, extraction_ref, selected_ids,
                          [choice.model_dump() for choice in text_choices], parameter=True)

    @mcp.tool
    async def resolve_page_parameters(context_ref: str, values: dict[str, Any],
            artifact_ref: str | None = None) -> ToolResult:
        """Fill a temporary instance from work or a template artifact; no query or save."""
        return await call(application.parameters.resolve, context_ref, values, artifact_ref, parameter=True)

    return mcp
