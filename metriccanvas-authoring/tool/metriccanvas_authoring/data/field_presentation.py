"""Choose overridable display defaults after execution; never transform data.

Scale is chosen once per returned field and aligned across same-unit measures.
A fixed one-decimal format must not hide a nonzero value. Provider formats win.
"""
from copy import deepcopy
from dataclasses import replace
import math

# Exact unit evidence only: captions such as '流水' are not currency evidence.
_CNY_BASE_UNITS = {'元', '人民币元', '人民币（元）', '人民币(元)', 'CNY', 'RMB'}
_SCALED_UNITS = ('万', '亿', '百万', '千', 'million', 'billion', 'thousand')


def apply_field_presentation(unit, execution, description=None):
    fields = deepcopy(unit.fields)
    descriptors = {f['queryField']: f for f in (description or {}).get('fields', [])}
    chosen = {}
    for key, field in fields.items():
        if field.get('role') != 'measure' or field.get('type') not in {'number', 'money'} or field.get('defaultFormat'):
            continue
        descriptor = descriptors.get(field['queryField'])
        scale = descriptor.get('scale') if descriptor else None
        unit_name = str(field.get('unit', '')).strip()
        complete = execution.total_count is not None and execution.total_count == len(execution.rows)
        values = [row.get(field['queryField']) for row in execution.rows]
        values = [v for v in values if isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)]
        nonzero = [abs(v) for v in values if v != 0]
        minimum = min(nonzero, default=0)
        # Unknown/already scaled provider values must not be scaled a second time.
        if not complete:
            fmt = 'number'
        elif descriptor and scale not in {'none', 'currency-base', 'percent'}:
            fmt = 'number'
        elif any(token in unit_name.lower() for token in _SCALED_UNITS):
            fmt = 'number'
        elif unit_name in {'%', '％'} or scale == 'percent':
            # Do not assume fractional ratios: percent formats consume percent points.
            fmt = 'number' if 0 < minimum < 0.005 else 'percent-2'
        elif nonzero and max(nonzero) >= 1e8 and minimum / 1e8 > 0.05:
            fmt = 'compact-yi-1'
        elif nonzero and max(nonzero) >= 1e4 and minimum / 1e4 > 0.05:
            fmt = 'compact-wan-1'
        else:
            fmt = 'number'
        field['defaultFormat'] = fmt
        # Missing units do not prove that unrelated measures share a scale.
        currency = unit_name in _CNY_BASE_UNITS or (field.get('type') == 'money' and field.get('currency') == 'CNY')
        group = 'currency:CNY' if currency else unit_name
        if group and fmt in {'number', 'compact-wan-1', 'compact-yi-1'}:
            chosen.setdefault(group, []).append(key)
    scale_order = {'number': 0, 'compact-wan-1': 1, 'compact-yi-1': 2}
    for keys in chosen.values():
        common = min((fields[key]['defaultFormat'] for key in keys), key=scale_order.__getitem__)
        for key in keys:
            fields[key]['defaultFormat'] = common
    return replace(unit, fields=fields)
