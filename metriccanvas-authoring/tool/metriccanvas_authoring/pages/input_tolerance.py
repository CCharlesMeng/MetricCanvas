"""Normalize presentation-only deviations before validating executable input."""
from copy import deepcopy
from jsonschema import Draft202012Validator


def normalize_compose(request, schema):
    value, adjustments = deepcopy(request), []
    if not isinstance(value, dict):
        return value, adjustments

    def optional(target, key, rule, path, default=None):
        if key in target and not Draft202012Validator(rule).is_valid(target[key]):
            target.pop(key)
            if default is not None:
                target[key] = default
            adjustments.append({'code': 'PRESENTATION_DEFAULTED', 'path': path + '/' + key})

    optional(value, 'layout', schema['properties']['layout'], '', 'report')
    section_schema = schema['properties']['sections']['items']
    variants = section_schema['properties']['blocks']['items']['oneOf']
    for si, section in enumerate(value.get('sections', []) if isinstance(value.get('sections'), list) else []):
        if not isinstance(section, dict):
            continue
        path = f'/sections/{si}'
        if 'pattern' not in section:
            section['pattern'] = 'custom'
            adjustments.append({'code': 'PRESENTATION_DEFAULTED', 'path': path + '/pattern'})
        for key, default in (('pattern', 'custom'), ('container', 'panel')):
            optional(section, key, section_schema['properties'][key], path, default)
        for key in ('title', 'businessQuestion', 'businessObject', 'distinctFrom'):
            if section.get(key, False) is None:
                section.pop(key)
                adjustments.append({'code': 'OPTIONAL_NULL_OMITTED', 'path': path + '/' + key})
        for bi, block in enumerate(section.get('blocks', []) if isinstance(section.get('blocks'), list) else []):
            if not isinstance(block, dict):
                continue
            block_path = path + f'/blocks/{bi}'
            variant = next((v for v in variants if v['properties']['type']['const'] == block.get('type')), None)
            if variant is None:
                continue
            for key in ('width', 'purpose'):
                if key in variant['properties']:
                    optional(block, key, variant['properties'][key], block_path)
            if block.get('type') == 'data' and 'component' in block and not block.get('match'):
                rule = variant['properties']['component']
                if not Draft202012Validator(rule).is_valid(block['component']):
                    block['component'] = 'table'
                    adjustments.append({'code': 'COMPONENT_FALLBACK_TABLE', 'path': block_path + '/component'})
            presentation = block.get('presentation')
            if isinstance(presentation, dict) and 'presentation' in variant['properties']:
                styles = variant['properties']['presentation']['oneOf']
                style = next((v for v in styles if v['properties']['kind']['const'] == presentation.get('kind')), None)
                if style:
                    for key in ('variant', 'density', 'horizontal', 'stacked'):
                        if key in style['properties']:
                            optional(presentation, key, style['properties'][key], block_path + '/presentation')
                    columns = presentation.get('columns')
                    if isinstance(columns, list) and 'columns' in style['properties']:
                        properties = style['properties']['columns']['items']['properties']
                        for ci, column in enumerate(columns):
                            if isinstance(column, dict):
                                for key in ('align', 'visual'):
                                    optional(column, key, properties[key], block_path + f'/presentation/columns/{ci}')
            # A null optional presentation carries no field selection or business intent.
            if block.get('presentation', False) is None:
                block.pop('presentation')
                adjustments.append({'code': 'OPTIONAL_NULL_OMITTED', 'path': block_path + '/presentation'})
    return value, adjustments


def compose_envelope(schema):
    """Validate identities and bounds globally; validate each block independently."""
    value = deepcopy(schema)
    value['properties']['sections']['items']['properties']['blocks']['items'] = {
        'type': 'object', 'properties': {'id': deepcopy(schema['properties']['sections']['items']['properties']['id'])},
        'required': ['id']}
    return value


def normalize_edit(request, compose_schema):
    value, adjustments = deepcopy(request), []
    if not isinstance(value, dict) or not isinstance(value.get('operations'), list):
        return value, adjustments
    for index, op in enumerate(value['operations']):
        if not isinstance(op, dict) or op.get('type') not in {'add_result_component', 'add_source_component'} or not isinstance(op.get('block'), dict):
            continue
        normalized, changes = normalize_compose({'sections': [{'pattern': 'custom', 'blocks': [op['block']]}]}, compose_schema)
        op['block'] = normalized['sections'][0]['blocks'][0]
        # Existing edit block contracts require purpose; it is a presentation hint.
        if 'purpose' not in op['block']:
            op['block']['purpose'] = 'reconciliation'
            changes.append({'code': 'PRESENTATION_DEFAULTED', 'path': '/sections/0/blocks/0/purpose'})
        for change in changes:
            change['path'] = change['path'].replace('/sections/0/blocks/0', f'/operations/{index}/block', 1)
            adjustments.append(change)
    return value, adjustments
