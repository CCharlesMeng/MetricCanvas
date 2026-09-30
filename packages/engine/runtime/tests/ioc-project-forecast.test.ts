import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePage } from '@metriccanvas/page';
import { applyComputation } from '../src/compute';
import { formatValue } from '../../widgets/src/shared/value-format';

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function load() {
  const result = parsePage(JSON.parse(readFileSync(new URL('../../../../pages/ioc-project-detail.json', import.meta.url), 'utf8')));
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.page;
}

describe('项目详情全年销售预测', () => {
  it('12个月的客观/提拉/合计全部绑定到表格，表头不误标固定万元', () => {
    const page = load();
    const table = page.sections.find(section => section.id === 'sales-forecast')?.components[0];
    if (table?.type !== 'table') throw new Error('缺少销售预测表');
    const groups = table.props.columns.filter(column => column.kind === 'group');
    expect(groups.map(group => group.title)).toEqual(months.map((_, index) => `${index + 1}月`));
    for (const [index, group] of groups.entries()) {
      expect(group.children.map(column => column.kind === 'group' ? undefined : column.field)).toEqual(
        ['object', 'lift', 'total'].map(prefix => `${prefix}-forecast-${months[index]}`)
      );
    }
    expect(groups.flatMap(group => group.children)).toHaveLength(36);
  });

  it.each(months)('%s 小计和总计不重复累加，零值、负值及缺失明细保留', month => {
    const source = load().dataSources['sales-forecast']!;
    const measures = ['object', 'lift', 'total'].map(prefix => `${prefix}-forecast-${month}`);
    const inputs = [
      { 'business-type': 'A', [measures[0]!]: 100, [measures[1]!]: 0, [measures[2]!]: 100 },
      { 'business-type': 'A', [measures[0]!]: -20, [measures[1]!]: null, [measures[2]!]: -20 },
      { 'business-type': 'B', [measures[0]!]: 40, [measures[1]!]: 10, [measures[2]!]: 50 }
    ];
    const frozen = structuredClone(inputs);
    const rows = applyComputation(source.compute ?? [], inputs);
    expect(inputs).toEqual(frozen);
    expect(rows.filter(row => row['row-kind'] === 'subtotal')).toHaveLength(2);
    expect(rows.find(row => row['row-kind'] === 'subtotal')).toMatchObject({
      [measures[0]!]: 80, [measures[1]!]: 0, [measures[2]!]: 80
    });
    expect(rows.at(-1)).toMatchObject({ 'row-kind': 'total',
      [measures[0]!]: 120, [measures[1]!]: 10, [measures[2]!]: 130
    });
    expect(rows[1]?.[measures[1]!]).toBeNull();
  });

  it('沿用金额契约的自适应单位，显示不修改元计量的原始值', () => {
    const source = load().dataSources['sales-forecast']!;
    const format = source.fields['object-forecast-dec']!.defaultFormat;
    expect(format).toBe('cny-adaptive');
    expect(formatValue(5000000, format)).toBe('500万');
    expect(formatValue(100000000, format)).toBe('1.00亿');
    expect(formatValue(0, format)).toBe('0元');
    expect(formatValue(null, format)).toBe('--');
  });
});
