"""Inspect an explicitly supplied artifact. Never loads a current page or saves."""

from mc_resources import ContentError, resource, verify_package, issue


def inspect_schema(document, *, root=None):
    from mc_runtime import run_node
    root, _ = verify_package(root)
    return run_node([str(resource(root, 'scripts/inspect-page.mjs')), '--stdin'], document,
        failure_code='PAGE_INSPECTION_UNAVAILABLE')


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
    component = found
    if component['sectionId'] != binding['sectionId'] or component.get('data', {}).get(binding.get('slot', 'main')) != binding['source']:
        return issue('DATA_ROLE_BINDING_GAP', binding['id'], reason='container_or_source_changed')
    fields = document.get('dataSources', {}).get(binding['source'], {}).get('fields', {})
    aliases = {name for key, field in fields.items() for name in (key, field.get('label'), field.get('queryField')) if isinstance(name, str)}
    missing = [name for name in binding['fields'] if name not in aliases]
    return issue('DATA_ROLE_BINDING_GAP', binding['id'], missing=missing) if missing else bound_field_gap(fields, binding, uses)


def inspect_assembly(document, specification, *, root=None, correlation=None):
    gaps = []
    try:
        root, manifest = verify_package(root)
        if not isinstance(document, dict) or not isinstance(document.get('sections'), list):
            raise ContentError('ASSEMBLY_INPUT_INVALID')
        if not isinstance(specification, dict) or specification.get('formatVersion') != 1:
            raise ContentError('INSPECTION_SPEC_INVALID')
        if specification.get('contentSha256') != manifest['contentSha256']:
            raise ContentError('INSPECTION_CONTENT_MISMATCH')
        schema = inspect_schema(document, root=root)
        nodes = {component['id']: component for component in schema['components']}
        association = inspect_correlation(document, specification, correlation)
        for pin in specification['requirements']:
            actual = nodes.get(pin['id'], {}).get('type')
            if actual != pin['mustBe']:
                gaps.append(issue('MANDATORY_COMPONENT_DEGRADED', pin['id'], expected=pin['mustBe'], actual=actual, origin=pin['origin']))
        for binding in specification['bindings']:
            gap = binding_gap(document, nodes, binding, schema['fieldUses'])
            if gap:
                gaps.append(gap)
        return {'status': 'gap' if gaps or not schema['readable'] else 'ok', 'gaps': gaps, 'schema': schema,
            'correlation': association,
            'coverage': ['product-component-tree', 'container', 'declared-data-slot-and-field-selection', 'product-page-validation', 'schema-driven-data-scan'],
            'notVerified': ['visual-quality', 'DQE-execution', 'save-status', 'user-intent-authenticity', 'undeclared-binding-intent', 'compute-business-semantics']}
    except (ContentError, KeyError, TypeError, OSError, ValueError) as error:
        diagnostic = error.issue if isinstance(error, ContentError) else issue('INSPECTION_UNAVAILABLE', message=str(error))
        return {'status': 'not_run', 'gaps': gaps, 'issues': [diagnostic]}


def inspect_correlation(document, specification, correlation):
    from mc_resources import value_digest
    if correlation is None:
        return {'status': 'not_run', 'reason': 'No trusted caller association supplied'}
    proof = specification.get('correlation')
    if not isinstance(correlation, dict) or not isinstance(proof, dict) or not proof.get('requestId'):
        raise ContentError('INSPECTION_CORRELATION_REQUIRED')
    checks = [proof.get('requestId') == correlation.get('requestId'),
        proof.get('compileInputSha256') == value_digest(correlation.get('compileInput')),
        correlation.get('documentSha256') == value_digest(document),
        correlation.get('inspectionSpecSha256') == value_digest(specification)]
    if not all(checks):
        raise ContentError('INSPECTION_CORRELATION_MISMATCH')
    return {'status': 'checked', 'documentSha256': correlation['documentSha256'],
        'requestId': correlation['requestId'], 'note': 'Caller association only; not authentication or a save/preview receipt'}


def inspect_artifact(artifact, specification, *, artifact_ref, binding, association, root=None):
    """No lookup of latest artifacts. Inputs must come from the trusted program channel."""
    from mc_resources import value_digest
    try:
        if not isinstance(artifact, dict) or artifact.get('artifactRef') != artifact_ref or artifact.get('binding') != binding:
            raise ContentError('INSPECTION_ARTIFACT_MISMATCH')
        payload = {key: value for key, value in artifact.items() if key != 'artifactRef'}
        if artifact_ref != 'artifact-' + value_digest(payload):
            raise ContentError('INSPECTION_ARTIFACT_MISMATCH')
        if not isinstance(association, dict) or association.get('artifactRef') != artifact_ref:
            raise ContentError('INSPECTION_CORRELATION_REQUIRED')
        result = inspect_assembly(artifact['document'], specification, root=root, correlation=association)
        result['artifactRef'] = artifact_ref
        return result
    except (ContentError, KeyError, TypeError, ValueError) as error:
        diagnostic = error.issue if isinstance(error, ContentError) else issue('INSPECTION_ARTIFACT_MISMATCH')
        return {'status': 'not_run', 'issues': [diagnostic]}
