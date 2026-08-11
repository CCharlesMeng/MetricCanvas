import { describe, expect, it } from 'vitest';
import type { RankingDetailCardProps } from '@metriccanvas/page';
import type { MainDataSlots } from '../src/shared/component-data';
import { buildRankingDetailRows } from '../src/components/ranking-detail-card/rows';

const data: MainDataSlots = {
  main: {
    fields: {
      customer: { type: 'string', role: 'dimension' },
      customerType: { type: 'string', role: 'dimension' },
      customerLevel: { type: 'string', role: 'dimension' },
      revenue: { type: 'number', role: 'measure', defaultFormat: 'compact-wan-0' },
      change: { type: 'number', role: 'measure', defaultFormat: 'percent-1' },
      description: { type: 'string', role: 'dimension' },
      attributions: {
        type: 'recordList',
        role: 'detail',
        items: {
          fields: {
            service: { type: 'string', role: 'dimension' },
            delta: { type: 'number', role: 'measure', defaultFormat: 'compact-wan-1' },
            reason: { type: 'string', role: 'dimension' }
          }
        }
      }
    },
    snapshot: {
      status: 'ready',
      rows: [
        {
          customer: '客户B',
          customerType: 'SMB',
          customerLevel: '卓越',
          revenue: 2_000_000,
          change: 12.5,
          description: '云通信流水增长20万',
          attributions: [
            { service: 'ModelArts', delta: -120_000, reason: '到期未续订' },
            { service: '对象存储服务', delta: 30_000, reason: '用量增加' }
          ]
        },
        {
          customer: '客户A',
          customerType: '',
          customerLevel: '核心',
          revenue: 1_800_000,
          change: -4.5,
          description: '一次性流水下降18万'
        },
        {
          customer: '客户E',
          customerType: 'KA',
          customerLevel: '',
          revenue: 1_600_000,
          change: 0,
          description: '流水持平'
        },
        {
          customer: '客户C',
          customerType: 'SMB',
          customerLevel: '卓越',
          revenue: 1_400_000,
          change: 2,
          description: 'Core流水增长'
        },
        {
          customer: null,
          customerType: null,
          customerLevel: null,
          revenue: 1_200_000,
          change: -1,
          description: '名称缺失仍保留本行'
        }
      ]
    }
  }
};

const props = {
  tone: 'positive',
  nameField: 'customer',
  valueField: 'revenue',
  changeField: 'change',
  badgeFields: ['customerType', 'customerLevel'],
  descriptionField: 'description',
  details: {
    field: 'attributions',
    titleField: 'service',
    valueField: { field: 'delta' },
    descriptionField: 'reason'
  }
} satisfies RankingDetailCardProps;

describe('buildRankingDetailRows', () => {
  it('保持查询顺序和全部五行，不排序也不截断', () => {
    const rows = buildRankingDetailRows(data, props);

    expect(rows).toHaveLength(5);
    expect(rows.map((row) => row.name)).toEqual([
      '客户B',
      '客户A',
      '客户E',
      '客户C',
      '—'
    ]);
    expect(rows.map((row) => row.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it('映射金额、变化极性、说明，并过滤空徽标', () => {
    const rows = buildRankingDetailRows(data, props);

    expect(rows[0]).toMatchObject({
      value: '200万',
      badges: ['SMB', '卓越'],
      change: { text: '12.5%', polarity: 'positive' },
      description: '云通信流水增长20万'
    });
    expect(rows[1]).toMatchObject({
      badges: ['核心'],
      change: { text: '-4.5%', polarity: 'negative' }
    });
    expect(rows[2]).toMatchObject({
      badges: ['KA'],
      change: { text: '0.0%', polarity: 'neutral' }
    });
    expect(rows[4]).toMatchObject({ name: '—', badges: [] });
  });

  it('字段未声明时只省略对应可选内容，不抛出整页错误', () => {
    const minimal = buildRankingDetailRows(data, {
      nameField: 'customer',
      valueField: 'revenue',
      tone: 'neutral'
    });

    expect(minimal[0]).toEqual({
      rank: 1,
      name: '客户B',
      value: '200万',
      badges: []
    });
  });

  it('按项字段契约格式化嵌套归因明细', () => {
    const rows = buildRankingDetailRows(data, props);

    expect(rows[0]?.details).toEqual({
      defaultExpanded: false,
      items: [
        { title: 'ModelArts', value: '-12.0万', description: '到期未续订' },
        { title: '对象存储服务', value: '3.0万', description: '用量增加' }
      ]
    });
    expect(rows[1]?.details).toBeUndefined();
  });

  it('把 semanticHtml 作为行内说明解析，不生成可展开明细', () => {
    const semanticData = structuredClone(data);
    semanticData.main.fields.attributions = {
      type: 'semanticHtml',
      role: 'detail'
    };
    semanticData.main.snapshot.rows[0]!.attributions =
      '<span class="detail-title">ModelArts</span>：<span class="detail-description">到期未续订</span><span class="detail-value tone-negative">（-12.0万）</span>';

    const rows = buildRankingDetailRows(semanticData, {
      nameField: 'customer',
      valueField: 'revenue',
      semanticDescriptionField: 'attributions'
    });

    expect(rows[0]?.details).toBeUndefined();
    expect(rows[0]?.semanticDescription?.nodes).toBeDefined();
  });
});
