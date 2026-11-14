import { expect, it } from 'vitest';
import type { NamedDataSlots } from '../src/shared/component-data';
import { alignTableRows, alignedCellLoading } from '../src/components/table/rows';

it('distinguishes pending fields from zero, confirmed missing values and failed supplements', () => {
  const data: NamedDataSlots = {
    main: { fields: {}, sourceStatus: 'loading', progress: { pendingFields: ['pending'] },
      snapshot: { status: 'ready', rows: [{ id: 'A', value: 0, missing: null, pending: null }] } },
    extra: { fields: {}, sourceStatus: 'loading', snapshot: { status: 'ready', rows: [] } }
  };
  const row = alignTableRows(data, 'id')[0]!;
  expect(alignedCellLoading('value', data, row)).toBe(false);
  expect(alignedCellLoading('missing', data, row)).toBe(false);
  expect(alignedCellLoading('pending', data, row)).toBe(true);
  expect(alignedCellLoading({ data: 'extra', field: 'amount' }, data, row)).toBe(true);
  data.extra!.sourceStatus = 'error';
  expect(alignedCellLoading({ data: 'extra', field: 'amount' }, data, row)).toBe(false);
  data.extra!.sourceStatus = 'ready';
  expect(alignedCellLoading({ data: 'extra', field: 'amount' }, data, row)).toBe(false);
});
