"""Definition/preview separation and exact-artifact Relay handoff."""
from copy import deepcopy
from metriccanvas_authoring.work.state import digest, require

RESPONSE_START = '{{RESPONSE_START}}'
PAGE_METADATA_PREVIEW_JSON = '{{PAGE_METADATA_PREVIEW_JSON}}'


def definition(document):
    result = deepcopy(document)
    for source in result.get('dataSources', {}).values():
        if source.get('source', {}).get('type') == 'query':
            source['source'].pop('initial', None)
    return result


def artifact(prepared, preview, receipt, operation_id):
    document = definition(preview)
    require(receipt['status'] == 'saved' and receipt['document'] == document, 'PREVIEW_DEFINITION_MISMATCH')
    value = {'binding': deepcopy(dict(prepared.binding)), 'operationId': operation_id,
             'document': document, 'previewJson': deepcopy(preview), 'ref': deepcopy(receipt['ref'])}
    value['artifactRef'] = 'artifact-' + digest(value)
    return value


async def prepare_preview(adapter, prepared, value, artifact_ref):
    require(adapter is not None, 'RELAY_PREVIEW_UNAVAILABLE')
    require(value is not None and value['artifactRef'] == artifact_ref and value['binding'] == dict(prepared.binding), 'PREVIEW_ARTIFACT_MISMATCH')
    require(definition(value['previewJson']) == value['document'], 'PREVIEW_DEFINITION_MISMATCH')
    # Adapter owns actual compose_page_result injection and card envelope. This
    # consumer deliberately does not fabricate an external Relay card protocol.
    result = await adapter.prepare(deepcopy(value))
    require(isinstance(result, dict) and result.get('artifactRef') == artifact_ref and result.get('ref') == value['ref'] and result.get('status') == 'ready', 'RELAY_PREVIEW_MISMATCH')
    return {'status': 'ready', 'artifactRef': artifact_ref, 'ref': deepcopy(value['ref'])}
