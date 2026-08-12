import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { componentCatalog, validate } from '../src';

const here = path.dirname(fileURLToPath(import.meta.url));
const pagesDir = path.resolve(here, '../../../pages');

interface MutableFlowComponentFixture {
  [key: string]: unknown;
  id: string;
  type: string;
  props: {
    [key: string]: unknown;
    series?: Array<{ field: string; label?: string; role?: string }>;
    categoryField?: string;
    badgeFields?: string[];
    descriptionField?: string;
    pageSize?: number;
  };
}

interface FlowComponentsFixture {
  [key: string]: unknown;
  sections: Array<{
    [key: string]: unknown;
    components: MutableFlowComponentFixture[];
  }>;
}

function flowComponentsPage(): FlowComponentsFixture {
  return {
    schemaVersion: '5.0',
    id: 'flow-components-contract',
    dataSources: {
      trend: {
        fields: {
          month: { type: 'string', role: 'dimension' },
          coreActual: { type: 'number', role: 'measure', nullable: true },
          communicationActual: { type: 'number', role: 'measure', nullable: true },
          coreForecast: { type: 'number', role: 'measure', nullable: true },
          communicationForecast: { type: 'number', role: 'measure', nullable: true }
        },
        source: {
          type: 'inline',
          rows: [
            {
              month: '1月',
              coreActual: 800,
              communicationActual: 300,
              coreForecast: null,
              communicationForecast: null
            },
            {
              month: '3月',
              coreActual: null,
              communicationActual: null,
              coreForecast: 840,
              communicationForecast: 320
            }
          ]
        }
      },
      ranking: {
        fields: {
          customer: { type: 'string', role: 'dimension' },
          customerType: { type: 'string', role: 'dimension', nullable: true },
          customerLevel: { type: 'string', role: 'dimension', nullable: true },
          revenue: { type: 'number', role: 'measure' },
          change: { type: 'number', role: 'measure' },
          description: { type: 'string', role: 'dimension' }
        },
        source: {
          type: 'inline',
          rows: [
            {
              customer: '客户B',
              customerType: 'SMB',
              customerLevel: '卓越',
              revenue: 2_000_000,
              change: 12.5,
              description: '云通信流水增长'
            }
          ]
        }
      }
    },
    sections: [
      {
        id: 'flow',
        components: [
          {
            id: 'trend',
            type: 'barChart',
            layout: { span: 12 },
            data: { main: 'trend' },
            props: {
              categoryField: 'month',
              stacked: true,
              series: [
                { field: 'coreActual', label: 'Core流水', role: 'actual' },
                { field: 'communicationActual', label: '云通信流水', role: 'actual' },
                { field: 'coreForecast', label: 'Core流水(预测)', role: 'forecast' },
                {
                  field: 'communicationForecast',
                  label: '云通信流水(预测)',
                  role: 'forecast'
                }
              ]
            }
          },
          {
            id: 'ranking',
            type: 'rankingDetailCard',
            layout: { span: 6 },
            data: { main: 'ranking' },
            props: {
              title: 'TOP增长流水客户',
              tone: 'positive',
              nameField: 'customer',
              valueField: { data: 'main', field: 'revenue', format: 'compact-wan-0' },
              changeField: { data: 'main', field: 'change', format: 'percent-1' },
              badgeFields: ['customerType', 'customerLevel'],
              descriptionField: 'description'
            }
          }
        ]
      }
    ]
  };
}

describe('流水报告公共组件契约', () => {
  it('接受实际/预测柱与详细排行，并把详细排行登记进组件目录', () => {
    expect(validate(flowComponentsPage())).toEqual([]);
    expect(componentCatalog.find((entry) => entry.type === 'rankingDetailCard')).toMatchObject({
      title: 'optional',
      defaultSpan: 6,
      requiredProps: ['nameField', 'valueField']
    });
  });

  it('拒绝非法柱系列 role，且 lineChart 不获得该扩展字段', () => {
    const invalidRole = flowComponentsPage();
    invalidRole.sections[0]!.components[0]!.props.series![0]!.role = 'projection';
    expect(validate(invalidRole)).not.toEqual([]);

    const lineWithRole = flowComponentsPage();
    const line = lineWithRole.sections[0]!.components[0]!;
    line.type = 'lineChart';
    line.props = {
      xField: line.props.categoryField,
      series: [{ field: 'coreActual', role: 'actual' }]
    };
    expect(validate(lineWithRole)).not.toEqual([]);
  });

  it('严格拒绝详细排行未知字段、三个徽标和缺失字段绑定', () => {
    const unknownProp = flowComponentsPage();
    unknownProp.sections[0]!.components[1]!.props.pageSize = 5;
    expect(validate(unknownProp)).not.toEqual([]);

    const tooManyBadges = flowComponentsPage();
    tooManyBadges.sections[0]!.components[1]!.props.badgeFields = [
      'customerType',
      'customerLevel',
      'description'
    ];
    expect(validate(tooManyBadges)).not.toEqual([]);

    const missingBinding = flowComponentsPage();
    missingBinding.sections[0]!.components[1]!.props.descriptionField = 'missingDescription';
    expect(validate(missingBinding)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: expect.stringContaining('/descriptionField') })
      ])
    );
  });

  it('拒绝越过报告统计月的实际/预测柱数据', () => {
    const source = JSON.parse(
      readFileSync(path.join(pagesDir, 'flow-analysis-report.json'), 'utf8')
    );
    const pastForecast = structuredClone(source);
    pastForecast.dataSources['overall-monthly-trend'].source.initial.rows[0][
      'core-forecast'
    ] = 1;
    expect(validate(pastForecast)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('统计月及之前不得提供预测系列')
        })
      ])
    );

    const futureActual = structuredClone(source);
    futureActual.dataSources['overall-monthly-trend'].source.initial.rows[2][
      'core-actual'
    ] = 1;
    expect(validate(futureActual)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('统计月之后不得提供实际系列')
        })
      ])
    );
  });

  it('存量正式页面继续通过当前 Schema', () => {
    const pages = readdirSync(pagesDir)
      .filter((name) => name.endsWith('.json'))
      .sort();
    expect(pages.length).toBeGreaterThanOrEqual(5);
    for (const name of pages) {
      const document = JSON.parse(readFileSync(path.join(pagesDir, name), 'utf8'));
      expect(validate(document), name).toEqual([]);
    }
  });
});
