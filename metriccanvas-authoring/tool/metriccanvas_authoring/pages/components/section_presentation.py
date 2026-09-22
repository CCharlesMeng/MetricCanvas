"""Expand semantic metric groups into existing renderer contracts; no query or inference."""
from copy import deepcopy
from metriccanvas_authoring.pages.composition.page_structure import StructureError, field_id


def present_metric_summary(block, source, component, relations):
    fields = source['fields']
    initial = source['source'].get('initial', {})
    rows = initial.get('rows', [])
    match = block.get('match')
    if initial.get('totalCount', len(rows)) != len(rows):
        raise StructureError('STRUCTURE_ROW_SELECTION_UNVERIFIED')
    if not match and len(rows) != 1:
        raise StructureError('STRUCTURE_ROW_SELECTION_AMBIGUOUS')
    match_id = field_id(fields, match['field']) if match else None
    selected = [r for r in rows if r.get(fields[match_id].get('queryField', match_id)) == match['equals']] if match else rows
    if len(selected) != 1:
        raise StructureError('STRUCTURE_ROW_SELECTION_AMBIGUOUS')
    allowed = {field_id(fields, ref) for ref in block['fields']}

    def binding(key):
        value = {'data': 'main', 'field': key}
        if match:
            value['match'] = {'field': match_id, 'equals': match['equals']}
        if fields[key].get('defaultFormat'):
            value['format'] = fields[key]['defaultFormat']
        return value

    metrics, consumed = [], set()
    for item in block['presentation']['metrics']:
        primary = field_id(fields, item['field'])
        if primary not in allowed or fields[primary]['role'] != 'measure' or primary in consumed:
            raise StructureError('STRUCTURE_PRIMARY_FIELD_INVALID')
        consumed.add(primary)
        row = {'label': item.get('label', fields[primary].get('label', primary)), 'valueField': binding(primary)}
        changes = []
        for change in item.get('changes', []):
            auxiliary = field_id(fields, change['field'])
            if auxiliary not in allowed or auxiliary in consumed or fields[auxiliary]['role'] != 'measure':
                raise StructureError('STRUCTURE_CHANGE_FIELD_INVALID')
            raw_primary = fields[primary].get('queryField', primary)
            raw_auxiliary = fields[auxiliary].get('queryField', auxiliary)
            matching = [r for r in relations if r['evidenceRef'] == change['evidenceRef']
                        and r['primaryField'] == raw_primary and r['changeField'] == raw_auxiliary
                        and (not r.get('match') or (match and r['match'] == {
                            'field': fields[match_id].get('queryField', match_id), 'equals': match['equals']}))]
            if len(matching) != 1:
                raise StructureError('STRUCTURE_CHANGE_RELATION_UNVERIFIED')
            if fields[auxiliary].get('unit') != '%' or fields[auxiliary].get('type') != 'number':
                raise StructureError('STRUCTURE_CHANGE_UNIT_INVALID')
            consumed.add(auxiliary)
            changes.append({'label': change['label'], 'field': binding(auxiliary)})
        if changes:
            row['changes'] = changes
        metrics.append(row)
    if consumed != allowed:
        raise StructureError('STRUCTURE_PRESENTATION_FIELDS_UNUSED')
    from metriccanvas_authoring.pages.composition.page_structure import PATTERNS
    recipe = PATTERNS['presentations'][block['presentation']['kind']]
    result = deepcopy(component)
    result['props'] = {'variant': block['presentation'].get('variant', recipe['variant']), 'rows': metrics}
    # Exact same-level automatic labels may be suppressed; explicitly authored row labels stay.
    if not (len(metrics) == 1 and metrics[0]['label'] == block['title']
            and 'label' not in block['presentation']['metrics'][0]):
        result['props']['title'] = block['title']
    return result


def pack_section(components, blocks):
    """Normalize unpinned relative widths within each visual row, preserving source order."""
    authored = {b['id']: b for b in blocks}
    adjustments, row = [], []
    def flush():
        if not row: return
        total = sum(c['layout']['span'] for c in row)
        if total != 12 and not any('width' in authored.get(c['id'], {}) for c in row):
            weights = [c['layout']['span'] * 12 / total for c in row]
            spans = [int(w) for w in weights]
            for i in sorted(range(len(row)), key=lambda i: -(weights[i]-spans[i]))[:12-sum(spans)]: spans[i] += 1
            for c, span in zip(row, spans):
                c['layout']['span'] = span
                adjustments.append({'rule':'proportional-row-packing','objectId':c['id'],'span':span})
        row.clear()
    for c in components:
        span=c['layout']['span']
        if sum(x['layout']['span'] for x in row) + span > 12: flush()
        row.append(c)
        if sum(x['layout']['span'] for x in row) == 12: flush()
    flush()
    return adjustments
