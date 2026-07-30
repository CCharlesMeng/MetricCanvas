import type {
  CatalogSnapshot,
  Component,
  DataSources,
  EffectiveQuery,
  Page,
  PageSection,
  Row,
  TableColumnNode,
  TableComponent
} from '@metriccanvas/page';
import type { DataGateway } from '@metriccanvas/runtime';

type ActivityKey = 'inspection' | 'visit' | 'summit' | 'inactive';

interface ActivityDefinition {
  key: ActivityKey;
  title: string;
  missingLabel: string;
  recentLabel: string;
  detailTitle: string;
  progressTitle: string;
  progressSubtitle?: string;
  risk: string;
  dangerValues?: string[];
}

const offices = Array.from(
  { length: 153 },
  (_, index) => `XX代表处${String(index + 1).padStart(2, '0')}`
);
const scopes = ['NA', 'TOP100'];
const customerLevels = ['卓越', '战略', '核心'];

const activities: ActivityDefinition[] = [
  {
    key: 'inspection',
    title: '公司考察',
    missingLabel: '无公司考察客户数',
    recentLabel: '最近一次公司考察时间',
    detailTitle: 'XXXX无公司考察客户',
    progressTitle: '重点国代公司考察进展',
    progressSubtitle: '：24年至今无公司考察数',
    dangerValues: ['无考察'],
    risk:
      '1、无公司考察客户共 X 个，占比 xx%；无考察客户数 TOP 代表处：XX代表处（x个未考察）、XX代表处（x个未考察）、XX代表处（x个未考察）；未考察客户占比 TOP 代表处：XX代表处（占比xx）、XX代表处（占比xx）、XX代表处（占比xx）。\n2、26年未考察客户共 X 个，占比 xx%；TOP 代表处为 XX代表处、XX代表处、XX代表处。\n3、TOP100项目客户中无公司考察 X 个，占比 xx%；其中26年无公司考察 X 个，TOP 代表处为 XX代表处、XX代表处、XX代表处。'
  },
  {
    key: 'visit',
    title: '高层拜访',
    missingLabel: '无高层拜访客户数',
    recentLabel: '最近一次高层拜访时间',
    detailTitle: 'XXXX无高层拜访客户',
    progressTitle: '重点国代公司高层拜访进展',
    progressSubtitle: '：24年至今无高层拜访数',
    risk:
      '1、无高层拜访客户共 X 个，占比 xx%；无拜访客户数 TOP 代表处：XX代表处（x个未拜访）、XX代表处（x个未拜访）、XX代表处（x个未拜访）；无拜访客户占比 TOP 代表处：XX代表处（占比xx）、XX代表处（占比xx）、XX代表处（占比xx）。\n2、26年无高层拜访客户共 X 个，占比 xx%；TOP 代表处为 XX代表处、XX代表处、XX代表处。\n3、TOP100项目客户中无高层拜访 X 个，占比 xx%；其中26年无高层拜访 X 个，TOP 代表处为 XX代表处、XX代表处、XX代表处。'
  },
  {
    key: 'summit',
    title: '高层峰会',
    missingLabel: '无高层峰会客户数',
    recentLabel: '最近一次高层峰会时间',
    detailTitle: 'XXXX无高层峰会客户',
    progressTitle: '重点国代公司高层峰会进展',
    progressSubtitle: '：24年至今无高层峰会数',
    risk:
      '1、无高层峰会客户共 X 个，占比 xx%；无峰会客户数 TOP 代表处：XX代表处（x个未开展）、XX代表处（x个未开展）、XX代表处（x个未开展）；无峰会客户占比 TOP 代表处：XX代表处（占比xx）、XX代表处（占比xx）、XX代表处（占比xx）。\n2、26年无高层峰会客户共 X 个，占比 xx%；TOP 代表处为 XX代表处、XX代表处、XX代表处。\n3、TOP100项目客户中无高层峰会 X 个，占比 xx%；其中26年无高层峰会 X 个，TOP 代表处为 XX代表处、XX代表处、XX代表处。'
  },
  {
    key: 'inactive',
    title: '三个重载活动均未开展客户',
    missingLabel: '三个重载活动均未开展客户数',
    recentLabel: '最近一次公司考察时间',
    detailTitle: 'XXXX三个重载活动均未开展客户明细',
    progressTitle: '重点国代26年三个重载活动均未开展客户分布',
    risk:
      '26年三个重载活动均未开展客户共 X 个，占比 xx%；未开展客户数 TOP 代表处：XX代表处（x个）、XX代表处（x个）、XX代表处（x个）；未开展占比 TOP 代表处：XX代表处（占比xx）、XX代表处（占比xx）、XX代表处（占比xx）。'
  }
];

const sharedDimensions = [
  {
    code: 'representative-office',
    name: '代表处',
    valueType: 'string' as const,
    cardinality: offices.length,
    sampleValues: offices.slice(0, 8)
  },
  {
    code: 'customer-scope',
    name: '客户范围',
    valueType: 'string' as const,
    cardinality: scopes.length,
    sampleValues: scopes
  },
  {
    code: 'customer-name',
    name: '客户名称',
    valueType: 'string' as const,
    cardinality: 153
  },
  {
    code: 'customer-level',
    name: '客户等级',
    valueType: 'string' as const,
    cardinality: 3,
    sampleValues: customerLevels
  },
  {
    code: 'owner-name',
    name: '华为责任人',
    valueType: 'string' as const,
    cardinality: 20
  },
  {
    code: 'owner-id',
    name: '责任人工号',
    valueType: 'string' as const,
    cardinality: 20
  },
  {
    code: 'last-inspection',
    name: '最近一次公司考察时间',
    valueType: 'string' as const,
    cardinality: 20
  },
  {
    code: 'last-visit',
    name: '最近一次高层拜访时间',
    valueType: 'string' as const,
    cardinality: 20
  },
  {
    code: 'last-summit',
    name: '最近一次高层峰会时间',
    valueType: 'string' as const,
    cardinality: 20
  }
].map((dimension) => ({ ...dimension, defaultFormat: 'text' as const }));

const allDimensionCodes = sharedDimensions.map((dimension) => dimension.code);

function metric(
  code: string,
  name: string,
  valueType: 'integer' | 'decimal' | 'percent' = 'integer'
): CatalogSnapshot['metrics'][number] {
  return {
    code,
    name,
    valueType,
    defaultFormat: valueType === 'percent' ? 'percent-1' : 'number-grouped',
    availableDimensions: allDimensionCodes,
    availableAggregations: ['sum', 'avg', 'count']
  };
}

const catalogMetrics: CatalogSnapshot['metrics'] = [
  metric('overview-na-excellent', '卓越客户数'),
  metric('overview-na-strategic', '战略客户数'),
  metric('overview-na-core', '核心客户数'),
  metric('overview-top-excellent', 'TOP100卓越客户数'),
  metric('overview-top-strategic', 'TOP100战略客户数'),
  metric('overview-top-core', 'TOP100核心客户数'),
  ...(['inspection', 'visit', 'summit'] as const).flatMap((key) => [
    metric(`${key}-annual-count`, '年累计活动次数'),
    metric(`${key}-monthly-change`, '较上月变化'),
    metric(`${key}-completion-rate`, '完成率', 'percent')
  ]),
  ...activities.flatMap(({ key }) => [
    metric(`${key}-na-total`, 'NA客户数'),
    metric(`${key}-na-missing`, 'NA未开展客户数'),
    metric(`${key}-na-missing-rate`, 'NA未开展占比', 'percent'),
    metric(`${key}-na-year-missing`, 'NA 26年未开展客户数'),
    metric(`${key}-na-year-missing-rate`, 'NA 26年未开展占比', 'percent'),
    metric(`${key}-top-total`, 'TOP100项目客户数'),
    metric(`${key}-top-missing`, 'TOP100未开展客户数'),
    metric(`${key}-top-missing-rate`, 'TOP100未开展占比', 'percent'),
    metric(`${key}-top-year-missing`, 'TOP100 26年未开展客户数'),
    metric(`${key}-top-year-missing-rate`, 'TOP100 26年未开展占比', 'percent'),
    metric(`${key}-detail-row`, '明细序号'),
    metric(`${key}-na-top-row`, 'NA TOP明细序号'),
    metric(`${key}-project-top-row`, 'TOP100项目明细序号')
  ])
];

export const customerRiskCatalog: CatalogSnapshot = {
  formatVersion: '2.0',
  syncedAt: '2026-02-28T23:59:59+08:00',
  source: '客户活动风险简报内置预览数据服务',
  metrics: catalogMetrics,
  dimensions: sharedDimensions
};

const detailDimensions = [
  'representative-office',
  'customer-scope',
  'customer-name',
  'customer-level',
  'owner-name',
  'owner-id',
  'last-inspection',
  'last-visit',
  'last-summit'
];

function querySource(metrics: string[], dimensions: string[] = [], subscribe: string[] = []) {
  return {
    source: {
      type: 'query' as const,
      query: {
        metrics,
        ...(dimensions.length > 0 ? { dimensions } : {}),
        ...(subscribe.length > 0 ? { filters: { subscribe } } : {})
      }
    }
  };
}

function createDataSources(): DataSources {
  const sources: DataSources = {
    'overview-na': querySource([
      'overview-na-excellent',
      'overview-na-strategic',
      'overview-na-core'
    ]),
    'overview-top': querySource([
      'overview-top-excellent',
      'overview-top-strategic',
      'overview-top-core'
    ]),
    'annual-inspection': querySource([
      'inspection-annual-count',
      'inspection-monthly-change',
      'inspection-completion-rate'
    ]),
    'annual-visit': querySource([
      'visit-annual-count',
      'visit-monthly-change',
      'visit-completion-rate'
    ]),
    'annual-summit': querySource([
      'summit-annual-count',
      'summit-monthly-change',
      'summit-completion-rate'
    ])
  };

  for (const activity of activities) {
    const { key } = activity;
    sources[`${key}-progress`] = querySource(
      [
        `${key}-na-total`,
        `${key}-na-missing`,
        `${key}-na-missing-rate`,
        `${key}-na-year-missing`,
        `${key}-na-year-missing-rate`,
        `${key}-top-total`,
        `${key}-top-missing`,
        `${key}-top-missing-rate`,
        `${key}-top-year-missing`,
        `${key}-top-year-missing-rate`
      ],
      ['representative-office']
    );
    sources[`${key}-detail`] = querySource(
      [`${key}-detail-row`],
      detailDimensions,
      [`${key}-office`, `${key}-scope`]
    );
    sources[`${key}-na-top`] = querySource(
      [`${key}-na-top-row`],
      detailDimensions
    );
    sources[`${key}-project-top`] = querySource(
      [`${key}-project-top-row`],
      detailDimensions
    );
  }
  return sources;
}

function overviewSection(
  id: string,
  title: string,
  source: 'overview-na' | 'overview-top',
  prefix: 'overview-na' | 'overview-top'
): PageSection {
  const levels = [
    ['excellent', '卓越'],
    ['strategic', '战略'],
    ['core', '核心']
  ] as const;
  return {
    id,
    title,
    layout: { type: 'grid', columns: 12 },
    components: levels.map(([field, label], index) => ({
      id: `${id}-${field}`,
      type: 'metricCard',
      layout: { span: 4 },
      data: { main: source },
      props: {
        variant: 'summary',
        rows: [{ label, valueField: `${prefix}-${field}`, unit: '个' }]
      }
    }))
  };
}

function annualMetric(
  key: 'inspection' | 'visit' | 'summit',
  label: string,
  tone: 'danger' | 'positive'
): Component {
  return {
    id: `annual-${key}-card`,
    type: 'metricCard',
    layout: { span: 4 },
    data: { main: `annual-${key}` },
    props: {
      variant: 'activityProgress',
      rows: [
        {
          label: `${label}（年累计）`,
          valueField: `${key}-annual-count`,
          unit: '次',
          changes: [
            {
              label: '较上月',
              field: `${key}-monthly-change`,
              tone
            }
          ]
        }
      ],
      progress: {
        valueField: `${key}-completion-rate`,
        label: '完成率'
      }
    }
  };
}

function progressColumns(activity: ActivityDefinition): TableColumnNode[] {
  const { key, missingLabel } = activity;
  const selectable = (scope: 'NA' | 'TOP100') => ({
    writes: {
      [`${key}-office`]: { field: 'representative-office' },
      [`${key}-scope`]: { value: scope }
    }
  });

  return [
    { field: 'representative-office', title: '代表处', width: 126, fixed: 'left' },
    {
      kind: 'group',
      id: `${key}-na-group`,
      title: 'NA客户',
      children: [
        { field: `${key}-na-total`, title: 'NA客户数', width: 100, align: 'right' },
        {
          field: `${key}-na-missing`,
          title: missingLabel,
          width: 136,
          align: 'right',
          selection: selectable('NA')
        },
        {
          field: `${key}-na-missing-rate`,
          title: '未开展占比',
          width: 112,
          align: 'right'
        },
        {
          field: `${key}-na-year-missing`,
          title: '26年未开展客户数',
          width: 136,
          align: 'right'
        },
        {
          field: `${key}-na-year-missing-rate`,
          title: '26年未开展占比',
          width: 128,
          align: 'right'
        }
      ]
    },
    {
      kind: 'group',
      id: `${key}-top-group`,
      title: 'TOP100项目客户',
      children: [
        {
          field: `${key}-top-total`,
          title: '客户数',
          width: 96,
          align: 'right'
        },
        {
          field: `${key}-top-missing`,
          title: missingLabel,
          width: 136,
          align: 'right',
          selection: selectable('TOP100')
        },
        {
          field: `${key}-top-missing-rate`,
          title: '未开展占比',
          width: 112,
          align: 'right'
        },
        {
          field: `${key}-top-year-missing`,
          title: '26年未开展客户数',
          width: 136,
          align: 'right'
        },
        {
          field: `${key}-top-year-missing-rate`,
          title: '26年未开展占比',
          width: 128,
          align: 'right'
        }
      ]
    }
  ];
}

function detailColumns(activity: ActivityDefinition): TableColumnNode[] {
  const base: TableColumnNode[] = [
    {
      field: `${activity.key}-detail-row`,
      title: '序号',
      width: 64,
      align: 'right'
    },
    {
      field: 'customer-name',
      badgeField: 'customer-level',
      title: '客户名称',
      width: 164
    },
    { field: 'representative-office', title: '代表处', width: 122 },
    {
      field: 'owner-name',
      secondaryField: 'owner-id',
      title: '华为责任人',
      width: 122
    }
  ];
  if (activity.key === 'inactive') {
    return [
      ...base,
      { field: 'last-inspection', title: '最近一次公司考察时间', width: 154 },
      { field: 'last-visit', title: '最近一次高层拜访时间', width: 154 },
      { field: 'last-summit', title: '最近一次高层峰会时间', width: 154 }
    ];
  }
  const field =
    activity.key === 'inspection'
      ? 'last-inspection'
      : activity.key === 'visit'
        ? 'last-visit'
        : 'last-summit';
  return [
    ...base,
    {
      field,
      title: activity.recentLabel,
      width: 174,
      ...(activity.dangerValues ? { dangerValues: activity.dangerValues } : {})
    }
  ];
}

function topColumns(activity: ActivityDefinition, rowField: string): TableColumnNode[] {
  return detailColumns(activity).map((column) => {
    if ('kind' in column && column.kind === 'group') return column;
    return column.field === `${activity.key}-detail-row`
      ? { ...column, field: rowField }
      : column;
  });
}

function tableComponent(
  id: string,
  source: string,
  title: string,
  columns: TableColumnNode[],
  span: number,
  pagination: TableComponent['props']['pagination'],
  subtitle?: string
): TableComponent {
  return {
    id,
    type: 'table',
    layout: { span },
    data: { main: source },
    props: {
      title,
      ...(subtitle ? { subtitle } : {}),
      columns,
      pagination
    }
  };
}

function activitySection(activity: ActivityDefinition): PageSection {
  const { key } = activity;
  const topTitles =
    key === 'inactive'
      ? ['TOP三个重载活动均未开展NA', 'TOP项目客户三个重载活动均未开展NA']
      : [
          `重点国-无${activity.title}NA（TOP10）`,
          `TOP100项目-无${activity.title}NA（TOP10）`
        ];

  return {
    id: `${key}-section`,
    title: activity.title,
    layout: { type: 'grid', columns: 12 },
    components: [
      {
        id: `${key}-risk-summary`,
        type: 'text',
        layout: { span: 12 },
        props: {
          heading: '风险总结',
          body: activity.risk,
          variant: 'insight'
        }
      },
      tableComponent(
        `${key}-progress-table`,
        `${key}-progress`,
        activity.progressTitle,
        progressColumns(activity),
        12,
        { mode: 'paged', pageSize: 10, totalCount: 153, numbered: true },
        activity.progressSubtitle
      ),
      tableComponent(
        `${key}-detail-table`,
        `${key}-detail`,
        activity.detailTitle,
        detailColumns(activity),
        12,
        { mode: 'paged', pageSize: 10, totalCount: 153, numbered: true }
      ),
      tableComponent(
        `${key}-na-top-table`,
        `${key}-na-top`,
        topTitles[0],
        topColumns(activity, `${key}-na-top-row`),
        6,
        { mode: 'none' }
      ),
      tableComponent(
        `${key}-project-top-table`,
        `${key}-project-top`,
        topTitles[1],
        topColumns(activity, `${key}-project-top-row`),
        6,
        { mode: 'none' }
      )
    ]
  };
}

export const customerRiskPreviewPage: Page = {
  schemaVersion: '2.0',
  id: 'customer-activity-risk-briefing',
  meta: {
    description: '云战地助手自动生成的客户活动风险简报'
  },
  filters: activities.flatMap(({ key }) => [
    {
      id: `${key}-office`,
      type: 'dimension' as const,
      dimension: 'representative-office',
      visible: false,
      default: [offices[0]!]
    },
    {
      id: `${key}-scope`,
      type: 'dimension' as const,
      dimension: 'customer-scope',
      visible: false,
      default: ['NA']
    }
  ]),
  dataSources: createDataSources(),
  sections: [
    {
      id: 'report-heading',
      layout: { type: 'grid', columns: 12 },
      components: [
        {
          id: 'report-header',
          type: 'reportHeader',
          layout: { span: 12 },
          props: {
            title: '客户活动风险简报',
            generatedBy: '报告由云战地助手生成',
            asOf: {
              label: '数据统计时间截至',
              value: '2026年2月28日'
            },
            decoration: 'shortBar'
          }
        }
      ]
    },
    overviewSection('na-overview', 'NA客户概况', 'overview-na', 'overview-na'),
    overviewSection(
      'top-overview',
      'TOP100项目客户概况',
      'overview-top',
      'overview-top'
    ),
    {
      id: 'annual-activities',
      layout: { type: 'grid', columns: 12 },
      components: [
        annualMetric('inspection', '公司考察', 'danger'),
        annualMetric('visit', '高层拜访', 'danger'),
        annualMetric('summit', '高层峰会', 'positive')
      ]
    },
    ...activities.map(activitySection),
    {
      id: 'report-footer',
      layout: { type: 'grid', columns: 12 },
      components: [
        {
          id: 'footer-title',
          type: 'text',
          layout: { span: 12 },
          props: {
            heading: '客户活动风险简报'
          }
        }
      ]
    }
  ]
};

function queryMetric(query: EffectiveQuery, suffix: string): string | undefined {
  return query.metrics.find((code) => code.endsWith(suffix));
}

function conditionValue(query: EffectiveQuery, dimension: string, fallback: string): string {
  const condition = query.conditions.find((candidate) => candidate.dimension === dimension);
  if (!condition) return fallback;
  const value = condition.value;
  return String(Array.isArray(value) ? (value[0] ?? fallback) : value);
}

function windowRows(rows: Row[], query: EffectiveQuery): Row[] {
  const offset = query.offset ?? 0;
  return rows.slice(offset, query.limit === undefined ? undefined : offset + query.limit);
}

function progressRows(key: ActivityKey): Row[] {
  const activityOffset = activities.findIndex((activity) => activity.key === key) * 7;
  return offices.map((office, index) => {
    const naTotal = 1320 + ((index * 37 + activityOffset) % 780);
    const naMissing = 180 + ((index * 29 + activityOffset) % 540);
    const naYearMissing = 90 + ((index * 17 + activityOffset) % 320);
    const topTotal = 640 + ((index * 23 + activityOffset) % 480);
    const topMissing = 80 + ((index * 19 + activityOffset) % 260);
    const topYearMissing = 40 + ((index * 13 + activityOffset) % 180);
    return {
      'representative-office': office,
      [`${key}-na-total`]: naTotal,
      [`${key}-na-missing`]: naMissing,
      [`${key}-na-missing-rate`]: Number(((naMissing / naTotal) * 100).toFixed(1)),
      [`${key}-na-year-missing`]: naYearMissing,
      [`${key}-na-year-missing-rate`]: Number(
        ((naYearMissing / naTotal) * 100).toFixed(1)
      ),
      [`${key}-top-total`]: topTotal,
      [`${key}-top-missing`]: topMissing,
      [`${key}-top-missing-rate`]: Number(((topMissing / topTotal) * 100).toFixed(1)),
      [`${key}-top-year-missing`]: topYearMissing,
      [`${key}-top-year-missing-rate`]: Number(
        ((topYearMissing / topTotal) * 100).toFixed(1)
      )
    };
  });
}

function detailRows(
  key: ActivityKey,
  metricCode: string,
  office: string,
  scope: string
): Row[] {
  return Array.from({ length: 153 }, (_, index) => {
    const sequence = index + 1;
    const noInspection = key === 'inspection' && sequence % 5 === 0;
    return {
      [metricCode]: sequence,
      'customer-name': `XX客户名称${String(sequence).padStart(3, '0')}`,
      'customer-level': customerLevels[index % customerLevels.length]!,
      'representative-office': office,
      'customer-scope': scope,
      'owner-name': '李四',
      'owner-id': `00${String(123456 + (index % 20)).padStart(6, '0')}`,
      'last-inspection': noInspection ? '无考察' : 'XXXX',
      'last-visit': 'XXXX',
      'last-summit': 'XXXX'
    };
  });
}

class CustomerRiskPreviewGateway implements DataGateway {
  async fetchDimensionValues(dimension: string): Promise<string[]> {
    if (dimension === 'representative-office') return offices;
    if (dimension === 'customer-scope') return scopes;
    if (dimension === 'customer-level') return customerLevels;
    return [];
  }

  async fetchData(query: EffectiveQuery): Promise<Row[]> {
    if (query.metrics.includes('overview-na-excellent')) {
      return [
        {
          'overview-na-excellent': 2000,
          'overview-na-strategic': 2000,
          'overview-na-core': 2000
        }
      ];
    }
    if (query.metrics.includes('overview-top-excellent')) {
      return [
        {
          'overview-top-excellent': 2000,
          'overview-top-strategic': 2000,
          'overview-top-core': 2000
        }
      ];
    }

    const annual = query.metrics.find((code) => code.endsWith('-annual-count'));
    if (annual) {
      const key = annual.replace('-annual-count', '') as 'inspection' | 'visit' | 'summit';
      return [
        {
          [`${key}-annual-count`]: 2000,
          [`${key}-monthly-change`]: key === 'summit' ? 888 : -888,
          [`${key}-completion-rate`]: 98.2
        }
      ];
    }

    const progressMetric = queryMetric(query, '-na-total');
    if (progressMetric) {
      const key = progressMetric.replace('-na-total', '') as ActivityKey;
      return windowRows(progressRows(key), query);
    }

    const detailMetric = queryMetric(query, '-detail-row');
    if (detailMetric) {
      const key = detailMetric.replace('-detail-row', '') as ActivityKey;
      const office = conditionValue(query, 'representative-office', offices[0]!);
      const scope = conditionValue(query, 'customer-scope', 'NA');
      return windowRows(detailRows(key, detailMetric, office, scope), query);
    }

    const topMetric = query.metrics.find(
      (code) => code.endsWith('-na-top-row') || code.endsWith('-project-top-row')
    );
    if (topMetric) {
      const project = topMetric.endsWith('-project-top-row');
      const key = topMetric.replace(/-(?:na|project)-top-row$/, '') as ActivityKey;
      const office = project ? offices[2]! : offices[1]!;
      return windowRows(
        detailRows(key, topMetric, office, project ? 'TOP100' : 'NA').slice(0, 10),
        query
      );
    }

    return [];
  }
}

export const customerRiskGateway: DataGateway = new CustomerRiskPreviewGateway();
