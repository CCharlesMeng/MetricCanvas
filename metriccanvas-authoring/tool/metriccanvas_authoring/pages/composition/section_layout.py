from __future__ import annotations

from collections.abc import Sequence


SECTION_COLUMN_COUNT = 12


def pack_section_spans(
    ratios: Sequence[int], column_count: int = SECTION_COLUMN_COUNT
) -> list[int]:
    spans: list[int] = []
    for row in _rows_of(ratios):
        spans.extend(_fill_row(row, column_count))
    return spans


def _rows_of(ratios: Sequence[int]) -> list[list[int]]:
    rows: list[list[int]] = []
    row: list[int] = []
    filled = 0
    for ratio in ratios:
        if row and filled + ratio > SECTION_COLUMN_COUNT:
            rows.append(row)
            row = []
            filled = 0
        row.append(ratio)
        filled += ratio
    if row:
        rows.append(row)
    return rows


def _fill_row(row: Sequence[int], column_count: int) -> list[int]:
    total = sum(row)
    exact = [(ratio * column_count) / total for ratio in row]
    spans = [max(1, int(value)) for value in exact]
    leftover = column_count - sum(spans)
    by_remainder = sorted(
        range(len(exact)),
        key=lambda index: (-(exact[index] - int(exact[index])), index),
    )
    for given in range(leftover):
        spans[by_remainder[given % len(by_remainder)]] += 1
    return spans
