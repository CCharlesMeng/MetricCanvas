"""Inspect an explicitly supplied artifact. Never loads a current page or saves."""
import json
import subprocess

from mc_resources import ContentError, resource, verify_package
from mc_layout_compiler import issue


def inspect_schema(document, *, root=None):
    root, _ = verify_package(root)
    try:
        result = subprocess.run(['node', str(resource(root, 'scripts/inspect-page.mjs')), '--stdin'],
            input=json.dumps(document), text=True, capture_output=True, check=False, timeout=30)
    except (OSError, subprocess.TimeoutExpired) as error:
        raise ContentError('PAGE_INSPECTION_UNAVAILABLE', message=str(error)) from error
    if result.returncode:
        raise ContentError('PAGE_INSPECTION_UNAVAILABLE', message=result.stderr.strip())
    return json.loads(result.stdout)


def component_nodes(document):
    return [(section, component) for section in document.get('sections', [])
        for component in section.get('components', [])]


def bound_field_gap(fields, binding, uses):
    requested = {key for key, field in fields.items() for name in binding['fields']
        if name in (key, field.get('label'), field.get('queryField'))}
    selected = {use['field'] for use in uses if use['componentId'] == binding['id'] and use['source'] == binding['source']}
    missing = sorted(requested - selected)
    return issue('DATA_ROLE_BINDING_GAP', binding['id'], reason='component_fields_changed', missing=missing) if missing else None


def binding_gap(document, nodes, binding, uses):
    found = nodes.get(binding['id'])
    if found is None:
        return issue('DATA_ROLE_BINDING_GAP', binding['id'], reason='component_missing')
    section, component = found
    if section['id'] != binding['sectionId'] or component.get('data', {}).get('main') != binding['source']:
        return issue('DATA_ROLE_BINDING_GAP', binding['id'], reason='container_or_source_changed')
    fields = document.get('dataSources', {}).get(binding['source'], {}).get('fields', {})
    aliases = {name for key, field in fields.items() for name in (key, field.get('label'), field.get('queryField')) if isinstance(name, str)}
    missing = [name for name in binding['fields'] if name not in aliases]
    return issue('DATA_ROLE_BINDING_GAP', binding['id'], missing=missing) if missing else bound_field_gap(fields, binding, uses)


def inspect_assembly(document, specification, *, root=None):
    gaps = []
    try:
        root, manifest = verify_package(root)
        if not isinstance(document, dict) or not isinstance(document.get('sections'), list):
            raise ContentError('ASSEMBLY_INPUT_INVALID')
        if not isinstance(specification, dict) or specification.get('formatVersion') != 1:
            raise ContentError('INSPECTION_SPEC_INVALID')
        if specification.get('contentSha256') != manifest['contentSha256']:
            raise ContentError('INSPECTION_CONTENT_MISMATCH')
        nodes = {component['id']: (section, component) for section, component in component_nodes(document)}
        schema = inspect_schema(document, root=root)
        for pin in specification['requirements']:
            actual = nodes.get(pin['id'], ({}, {}))[1].get('type')
            if actual != pin['mustBe']:
                gaps.append(issue('MANDATORY_COMPONENT_DEGRADED', pin['id'], expected=pin['mustBe'], actual=actual, origin=pin['origin']))
        for binding in specification['bindings']:
            gap = binding_gap(document, nodes, binding, schema['fieldUses'])
            if gap:
                gaps.append(gap)
        return {'status': 'gap' if gaps or not schema['readable'] else 'ok', 'gaps': gaps, 'schema': schema,
            'coverage': ['top-level-component-type', 'container', 'source-and-field-selection', 'product-page-validation'],
            'notVerified': ['visual-quality', 'DQE-execution', 'save-status', 'user-intent-authenticity']}
    except (ContentError, KeyError, TypeError, OSError, ValueError) as error:
        diagnostic = error.issue if isinstance(error, ContentError) else issue('INSPECTION_UNAVAILABLE', message=str(error))
        return {'status': 'not_run', 'gaps': gaps, 'issues': [diagnostic]}
