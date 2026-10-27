"""Calendar-valid, precision-preserving query time. No adapter encoding or inference."""
from datetime import date
import re

_PATTERNS = {'year': r'[0-9]{4}', 'month': r'[0-9]{4}-?[0-9]{2}',
             'day': r'(?:[0-9]{8}|[0-9]{4}-[0-9]{2}-[0-9]{2})'}


class TimeRangeError(ValueError):
    def __init__(self, code, field):
        self.code, self.path = code, '/' + field
        super().__init__(code)


def time_value(value, granularity, field):
    pattern = _PATTERNS.get(granularity) if isinstance(granularity, str) else None
    if pattern is None:
        raise TimeRangeError('TIME_GRANULARITY_UNSUPPORTED', 'granularity')
    if not isinstance(value, str) or re.fullmatch(pattern, value) is None:
        raise TimeRangeError('TIME_VALUE_PRECISION_INVALID', field)
    digits = value.replace('-', '')
    year = int(digits[:4])
    month = int(digits[4:6]) if granularity != 'year' else 1
    day = int(digits[6:8]) if granularity == 'day' else 1
    try:
        date(year, month, day)
    except ValueError:
        raise TimeRangeError('TIME_VALUE_CALENDAR_INVALID', field) from None
    return {'year': digits, 'month': f'{digits[:4]}-{digits[4:6]}',
            'day': f'{digits[:4]}-{digits[4:6]}-{digits[6:8]}'}[granularity]


def normalize_time(value):
    """Accept established compact spellings and M only; never truncate precision."""
    granularity = 'month' if value['granularity'] == 'M' else value['granularity']
    start = time_value(value['start'], granularity, 'start')
    end = time_value(value['end'], granularity, 'end')
    if start > end:
        raise TimeRangeError('TIME_RANGE_REVERSED', 'end')
    return {**value, 'granularity': granularity, 'start': start, 'end': end}


def time_issue(value, path):
    if value is None:
        return None
    try:
        normalize_time(value)
    except TimeRangeError as error:
        return {'code': error.code, 'path': path + error.path}
    return None
