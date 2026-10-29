import { expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { parsePage } from '@metriccanvas/page';
import type { TableComponent } from '@metriccanvas/page/internal';
import fixture from '../../../../pages/capabilities/table/table-data-recovery.json';
import { createTableRecoveryPreview } from '../../../../apps/playground/fixtures/table-recovery';
import { initialFilterValues } from '@metriccanvas/data-execution/runtime';
import { prepareTableExport } from '../src/table/export/prepare';
import { encodeTableWorkbook } from '../src/table/export/workbook';

for (const source of ['opinions','rejection-overview']) {
  it(`exports usable ${source} rows with a persistent warning worksheet`, async () => {
    const parsed = parsePage(fixture);
    if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
    const page = parsed.page;
    const component = page.sections.flatMap(section=>section.components).find(component=>component.type==='table'&&component.data.main===source) as TableComponent;
    const data = await prepareTableExport({ page, component, queries:new Map(), controller:new AbortController(),
      gateway:createTableRecoveryPreview().dataGateway,
      state:{currentYear:2026,filters:initialFilterValues(page.filters??[]),tables:{},headerFilters:{}} });
    expect(data.main?.snapshot.rows).toHaveLength(source==='opinions'?6:8);
    const workbook = new ExcelJS.Workbook();
    const bytes = await encodeTableWorkbook(component,data,new AbortController().signal);
    await workbook.xlsx.load(bytes.buffer);
    expect(workbook.worksheets.map(sheet=>sheet.name)).toEqual(['表格数据','数据异常说明']);
    const warnings = workbook.getWorksheet('数据异常说明')!;
    expect(warnings.getCell('A1').text).toContain('可能存在缺项');
    expect(warnings.rowCount).toBeGreaterThan(2);
    expect(JSON.stringify(workbook.getWorksheet('表格数据')!.getSheetValues())).toContain('—');
  });
}
