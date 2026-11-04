"""Choose overridable display defaults after execution; never transform data.

Scale is chosen once per returned field and aligned across same-unit measures.
A fixed one-decimal compact format must not hide a nonzero value. Trusted
percent-point semantics survive partial coverage and provider number suggestions.
"""
from copy import deepcopy
from dataclasses import replace
import math
import json
from metriccanvas_authoring.runtime_assets import bundle_root

_POLICY = json.loads((bundle_root() / "contracts/exported/authoring-presentation-policy.json").read_text())

# Exact unit evidence only: captions such as '流水' are not currency evidence.
_CNY_BASE_UNITS = {'元', '人民币元', '人民币（元）', '人民币(元)', 'CNY', 'RMB'}
_SCALED_UNITS = tuple(_POLICY['scaledUnitMarkers'])


def _percent_points(unit_name, descriptor):
    if descriptor and descriptor.get('scale') not in _POLICY['percentScales']:
        return False
    return unit_name in _POLICY['percentUnits'] or bool(descriptor and descriptor.get('scale') == 'percent')


def _finite_magnitudes(rows, query_field):
    values = [row.get(query_field) for row in rows]
    values = [v for v in values if isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)]
    nonzero = [abs(v) for v in values if v != 0]
    return nonzero, min(nonzero, default=0)


def _precision_warning(unit, key, field, minimum, warnings):
    fmt = field.get('defaultFormat', '')
    if warnings is None or not fmt.startswith('percent-'):
        return
    digits = int(fmt.split('-')[1])
    if 0 < minimum < 0.5 * 10 ** -digits:
        warnings.append({'code': 'PRESENTATION_PRECISION_LIMIT', 'dataSourceId': unit.data_source_id,
                         'fieldId': key, 'format': fmt,
                         'message': '非零百分比在当前精度下显示为零；保留百分号及原值，请用原值明细核对。'})


def _tokens_base(unit_name, descriptor):
    return unit_name.lower() in _POLICY['tokensUnits'] and (descriptor is None or descriptor.get('scale') == 'none')


def _provider_conflict(fmt, unit_name, descriptor, percent, profile):
    if not descriptor or fmt != descriptor.get('defaultFormat'):
        return False
    if percent and str(fmt).startswith('number'):
        return True
    if profile != 'authoring':
        return False
    if fmt in _POLICY['scalingFormats'] and any(marker in unit_name.lower() for marker in _SCALED_UNITS):
        return True
    return fmt in _POLICY['millionFormats'] and not _tokens_base(unit_name, descriptor)


def _choose_format(unit_name, descriptor, complete, nonzero, minimum, profile):
    if _percent_points(unit_name, descriptor):
        return _POLICY['percentFormat']
    if not complete or descriptor and descriptor.get('scale') not in _POLICY['baseScales']:
        return 'number'
    if any(token in unit_name.lower() for token in _SCALED_UNITS):
        return 'number'
    if profile == 'authoring' and _tokens_base(unit_name, descriptor):
        return _POLICY['tokensFormat'] if nonzero and minimum / _POLICY['scaleDivisors'][_POLICY['tokensFormat']] > _POLICY['minimumScaledNonzero'] else 'number'
    return _magnitude_format(nonzero, minimum)


def _magnitude_format(nonzero, minimum):
    if nonzero and max(nonzero) >= 1e8 and minimum / 1e8 > 0.05:
        return 'compact-yi-1'
    if nonzero and max(nonzero) >= 1e4 and minimum / 1e4 > 0.05:
        return 'compact-wan-1'
    return 'number'


def _choose_field(unit, execution, key, field, descriptor, warnings, profile):
    if field.get('role') != 'measure' or field.get('type') not in {'number', 'money'}:
        return False
    unit_name = str(field.get('unit', '')).strip()
    nonzero, minimum = _finite_magnitudes(execution.rows, field['queryField'])
    fmt = field.get('defaultFormat')
    conflict = _provider_conflict(fmt, unit_name, descriptor, _percent_points(unit_name, descriptor), profile)
    if fmt and not conflict:
        _precision_warning(unit, key, field, minimum, warnings)
        return False
    complete = execution.total_count is not None and execution.total_count == len(execution.rows)
    selected = _choose_format(unit_name, descriptor, complete, nonzero, minimum, profile)
    if conflict and warnings is not None:
        warnings.append({'code': 'PRESENTATION_FORMAT_ADJUSTED', 'dataSourceId': unit.data_source_id,
            'fieldId': key, 'from': fmt, 'to': selected,
            'message': ('来源普通数值格式建议与可信百分比刻度不相容；保留原值，默认显示百分号。' if profile == 'legacy'
                        else '来源格式建议与已知单位或刻度不相容；只调整默认展示，保留原值。')})
    field['defaultFormat'] = selected
    _precision_warning(unit, key, field, minimum, warnings)
    return True


def _scale_group(field):
    unit_name = str(field.get('unit', '')).strip()
    currency = unit_name in _CNY_BASE_UNITS or field.get('type') == 'money' and field.get('currency') == 'CNY'
    return 'currency:CNY' if currency else unit_name


def apply_field_presentation(unit, execution, description=None, *, warnings=None, profile="legacy"):
    fields = deepcopy(unit.fields)
    descriptors = {f['queryField']: f for f in (description or {}).get('fields', [])}
    chosen = {}
    order = {'number': 0, 'compact-wan-1': 1, 'compact-yi-1': 2}
    for key, field in fields.items():
        selected = _choose_field(unit, execution, key, field, descriptors.get(field.get('queryField')), warnings, profile)
        group = _scale_group(field)
        if selected and group and field.get('defaultFormat') in order:
            chosen.setdefault(group, []).append(key)
    for keys in chosen.values():
        common = min((fields[key]['defaultFormat'] for key in keys), key=order.__getitem__)
        for key in keys:
            fields[key]['defaultFormat'] = common
    return replace(unit, fields=fields)
