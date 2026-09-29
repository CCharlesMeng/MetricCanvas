"""Choose overridable display defaults after execution; never transform data.

Scale is chosen once per returned field, using its smallest nonzero magnitude
so a large outlier cannot hide small values. Provider formats always win.
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
        elif unit_name in _CNY_BASE_UNITS or (field.get('type') == 'money' and field.get('currency') == 'CNY'):
            # Existing CNY preset rounds sub-yuan amounts to whole yuan.
            fmt = 'number' if 0 < minimum < 1 else 'cny-adaptive'
        elif unit_name in {'%', '％'} or scale == 'percent':
            # Do not assume fractional ratios: percent formats consume percent points.
            fmt = 'number' if 0 < minimum < 0.005 else 'percent-2'
        elif minimum >= 1e8:
            fmt = 'compact-yi-1'
        elif minimum >= 1e4:
            fmt = 'compact-wan-1'
        else:
            fmt = 'number'
        if fmt != 'number':
            field['defaultFormat'] = fmt
    return replace(unit, fields=fields)
