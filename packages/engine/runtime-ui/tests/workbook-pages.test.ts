import { expect, it } from 'vitest';
import { paginateWorkbookSheets } from '../src/table/export/workbook-pages';
import type { WorkbookSheet } from '../src/table/export/workbook-sheet';

it('continues beyond the physical sheet limit with intact headers and unique names', () => {
  const header = ['地区部'], detail = ['华东'];
  const data: WorkbookSheet['data'] = Array(1_048_575).fill(detail);
  data[0] = header;
  data.push([{ value: '子表', rowSpan: 2 }], [null], ['末行']);
  const sheet = { sheet: '数据', data, columns: [], stickyRowsCount: 1 };
  const sheets = paginateWorkbookSheets([sheet, { ...sheet, sheet: '数据 (2)', data: [] }]);
  expect(sheets.map(part => part.sheet)).toEqual(['数据', '数据 (3)', '数据 (2)']);
  expect(sheets[0]!.data).toHaveLength(1_048_575);
  expect(sheets[1]!.data).toEqual([header, [{ value: '子表', rowSpan: 2 }], [null], ['末行']]);
});
