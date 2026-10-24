"""Deterministic template defaults and diagnostics; caller owns all workflow decisions."""
from copy import deepcopy
from jsonschema import Draft202012Validator

from mc_resources import ContentError, read_json, verify_package, value_digest, issue


def schema_issues(schema, value, prefix=''):
    return [issue('INPUT_SCHEMA_INVALID', prefix + '/' + '/'.join(map(str, error.absolute_path)), message=error.message)
        for error in Draft202012Validator(schema).iter_errors(value)]


def resolve_template(root, reference):
    if not isinstance(reference, dict) or set(reference) != {'scene', 'variant', 'templateVersion'}:
        raise ContentError('TEMPLATE_REFERENCE_INVALID')
    catalog = read_json(root, 'layouts/catalog.json')
    entry = next((entry for entry in catalog['scenes'] if entry['scene'] == reference['scene']), None)
    variant = next((item for item in (entry or {}).get('variants', []) if item['variant'] == reference['variant']), None)
    if variant is None:
        raise ContentError('CATALOG_ENTRY_NOT_FOUND')
    if not entry['executable']:
        raise ContentError('TEMPLATE_NOT_EXECUTABLE', message=entry['executableReason'])
    template = read_json(root, 'layouts/' + variant['templateFile'])
    if any(template.get(key) != value for key, value in reference.items()):
        raise ContentError('TEMPLATE_VERSION_MISMATCH')
    errors = schema_issues(read_json(root, 'layouts/template.schema.json'), template)
    if errors:
        raise ContentError('TEMPLATE_INVALID', errors[0]['path'], errors[0]['message'])
    validate_template(template, read_json(root, 'mc-closed-sets/snapshot.json')['composeSchema'])
    return template


def validate_template(template, compose_schema):
    sections = template['sections']
    ids = [section['id'] for section in sections] + [block['id'] for section in sections for block in section['blocks']]
    if len(ids) != len(set(ids)):
        raise ContentError('TEMPLATE_ID_CONFLICT')
    for pin in template['hardPins']['productMandatory']:
        if pin['id'] not in ids and pin['id'] != 'page-header':
            raise ContentError('TEMPLATE_PIN_UNRESOLVED', pin['id'])
    section_schema = compose_schema['properties']['sections']['items']
    if not Draft202012Validator(section_schema['properties']['pattern']).is_valid(template['defaults']['section'].get('pattern', 'custom')):
        raise ContentError('TEMPLATE_DEFAULT_INVALID', '/defaults/section/pattern')
    # Limit defaulting to presentation; source IDs, fields and nodes always come from the caller.
    validate_common_defaults(template, compose_schema, section_schema)
    for section in sections:
        if not Draft202012Validator(section_schema['properties']['pattern']).is_valid(section['pattern']):
            raise ContentError('TEMPLATE_PATTERN_INVALID', section['id'])
    validate_block_defaults(template, section_schema)


def validate_common_defaults(template, compose_schema, section_schema):
    allowed = {'page': {'layout'}, 'section': {'pattern', 'container'}, 'block': {'width', 'purpose'}}
    rules = {'page': compose_schema['properties'], 'section': section_schema['properties']}
    for level, defaults in template['defaults'].items():
        if set(defaults) - allowed[level]:
            raise ContentError('TEMPLATE_DEFAULT_INVALID', '/defaults/' + level)
        if level in rules:
            for key, value in defaults.items():
                if not Draft202012Validator(rules[level][key]).is_valid(value):
                    raise ContentError('TEMPLATE_DEFAULT_INVALID', f'/defaults/{level}/{key}')


def validate_block_defaults(template, section_schema):
    variants = section_schema['properties']['blocks']['items']['oneOf']
    data_rule = next(rule for rule in variants if rule['properties']['type']['const'] == 'data')
    values = [template['defaults']['block'], *[block for section in template['sections'] for block in section['blocks']]]
    for block in values:
        for key in ('width', 'purpose'):
            if key in block and not Draft202012Validator(data_rule['properties'][key]).is_valid(block[key]):
                raise ContentError('TEMPLATE_DEFAULT_INVALID', '/' + key)


def fill_fields(target, defaults, properties, required, path, adjustments):
    omitted = set()
    for key in list(target):
        if target[key] is None and key not in required:
            del target[key]
            omitted.add(key)
            adjustments.append(issue('OPTIONAL_NULL_OMITTED', path + '/' + key))
    for key, value in defaults.items():
        if key in properties and key not in target and key not in omitted:
            if not Draft202012Validator(properties[key]).is_valid(value):
                adjustments.append(issue('LAYOUT_DEFAULT_NOT_APPLICABLE', path + '/' + key))
                continue
            target[key] = deepcopy(value)
            adjustments.append(issue('LAYOUT_DEFAULT_FILLED', path + '/' + key))


def fill_section(section, model, template, schema, path, adjustments):
    defaults = {**template['defaults']['section'], **{k: v for k, v in model.items() if k in ('pattern', 'container')}}
    fill_fields(section, defaults, schema['properties'], schema['required'], path, adjustments)
    if not isinstance(section.get('blocks'), list):
        raise ContentError('PLAN_SECTION_BLOCKS_REQUIRED', path + '/blocks')
    models = {block['id']: block for block in model.get('blocks', [])}
    variants = schema['properties']['blocks']['items']['oneOf']
    for index, block in enumerate(section['blocks']):
        location = path + f'/blocks/{index}'
        if not isinstance(block, dict) or not isinstance(block.get('id'), str):
            raise ContentError('PLAN_BLOCK_ID_REQUIRED', location)
        variant = next((rule for rule in variants if rule['properties']['type']['const'] == block.get('type')), None)
        if variant is None:
            raise ContentError('PLAN_BLOCK_TYPE_INVALID', location)
        model_block = models.get(block['id'], {})
        values = {**template['defaults']['block'], **{k: v for k, v in model_block.items() if k in ('width', 'purpose')}}
        fill_fields(block, values, variant['properties'], variant['required'], location, adjustments)


def fill_plan(plan, template, schema, adjustments):
    if not isinstance(plan, dict) or 'sections' not in plan:
        raise ContentError('PLAN_SECTIONS_REQUIRED')
    if not isinstance(plan['sections'], list) or not plan['sections']:
        raise ContentError('PLAN_SECTIONS_EMPTY')
    fill_fields(plan, template['defaults']['page'], schema['properties'], schema['required'], '', adjustments)
    models = {section['id']: section for section in template['sections']}
    ids = []
    for index, section in enumerate(plan['sections']):
        path = f'/sections/{index}'
        if not isinstance(section, dict) or not isinstance(section.get('id'), str):
            raise ContentError('PLAN_SECTION_ID_REQUIRED', path)
        fill_section(section, models.get(section['id'], {}), template, schema['properties']['sections']['items'], path, adjustments)
        ids.extend([section['id'], *[block['id'] for block in section['blocks']]])
    if len(ids) != len(set(ids)):
        raise ContentError('PLAN_ID_CONFLICT')


def inspection_spec(plan, template, requirements, manifest):
    pins = [{**pin, 'origin': 'productMandatory'} for pin in template['hardPins']['productMandatory']]
    pins.extend({**pin, 'origin': 'userRequired'} for pin in requirements)
    bindings = [{'id': block['id'], 'sectionId': section['id'], 'source': block['source'], 'fields': block['fields']}
        for section in plan['sections'] for block in section['blocks'] if block['type'] == 'data']
    return {'formatVersion': 1, 'contentSha256': manifest['contentSha256'],
        'templateRef': {key: template[key] for key in ('scene', 'variant', 'templateVersion')},
        'requirements': pins, 'bindings': bindings}


def declared_gaps(plan, specification, template):
    nodes = {block['id']: block for section in plan['sections'] for block in section['blocks']}
    nodes['page-header'] = {'component': 'reportHeader'}
    gaps = [issue('DECLARED_REQUIREMENT_GAP', pin['id'], origin=pin['origin'], expected=pin['mustBe'],
        actual=nodes.get(pin['id'], {}).get('component')) for pin in specification['requirements']
        if nodes.get(pin['id'], {}).get('component') != pin['mustBe']]
    for binding in specification['bindings']:
        if binding['source'] not in plan['sources']:
            gaps.append(issue('DATA_ROLE_BINDING_GAP', binding['id'], source=binding['source']))
    patterns = {section['pattern'] for section in template['sections']}
    if not patterns.intersection(section['pattern'] for section in plan['sections']):
        gaps.append(issue('SCENE_MISMATCH_GAP', '/sections', severity='advice'))
    return gaps


def compile_layout(envelope, *, root=None):
    adjustments = []
    try:
        root, manifest = verify_package(root)
        if not isinstance(envelope, dict) or set(envelope) - {'templateRef', 'plan', 'userRequirements', 'targetVersions', 'requestId'}:
            raise ContentError('COMPILER_INPUT_INVALID')
        request_id = envelope.get('requestId')
        if request_id is not None and (not isinstance(request_id, str) or not request_id):
            raise ContentError('COMPILER_REQUEST_ID_INVALID')
        requested = envelope.get('targetVersions', {})
        if not isinstance(requested, dict) or set(requested) - set(manifest['alignedWith']):
            raise ContentError('TARGET_VERSIONS_INVALID')
        if any(manifest['alignedWith'][key] != value for key, value in requested.items()):
            raise ContentError('CONTENT_VERSION_MISMATCH')
        template = resolve_template(root, envelope.get('templateRef'))
        plan = deepcopy(envelope.get('plan'))
        schema = read_json(root, 'mc-closed-sets/snapshot.json')['composeSchema']
        fill_plan(plan, template, schema, adjustments)
        errors = schema_issues(schema, plan)
        requirements = envelope.get('userRequirements', [])
        pin_schema = read_json(root, 'layouts/template.schema.json')['$defs']['pin']
        errors.extend(schema_issues({'type': 'array', 'items': pin_schema}, requirements, '/userRequirements'))
        if errors:
            return {'status': 'invalid', 'plan': None, 'adjustments': adjustments, 'gaps': errors}
        specification = inspection_spec(plan, template, requirements, manifest)
        specification['correlation'] = {'requestId': request_id, 'compileInputSha256': value_digest(envelope),
            'planSha256': value_digest(plan)}
        gaps = declared_gaps(plan, specification, template)
        return {'status': 'gap' if gaps else 'ok', 'plan': plan, 'adjustments': adjustments, 'gaps': gaps,
            'inspectionSpec': specification, 'contentSha256': manifest['contentSha256'],
            'deploymentAlignment': 'checked' if requested else 'not_run', 'checkedVersionFields': sorted(requested),
            'deploymentEvidence': {'status': 'not_run', 'comparedFields': sorted(requested),
                'note': 'Only supplied version values were compared; no live service or deployed artifact identity was observed'}}
    except ContentError as error:
        return {'status': 'invalid', 'plan': None, 'adjustments': adjustments, 'gaps': [error.issue]}
