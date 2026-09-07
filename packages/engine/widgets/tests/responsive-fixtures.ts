import type { Component } from '@metriccanvas/page';

export type ResponsiveBehavior = 'fluid' | 'reflow' | 'scroll-owner' | 'layout-owner';

type ComponentType = Component['type'];
type ComponentOf<T extends ComponentType> = Extract<Component, { type: T }>;
type DeclaredVariant<T extends ComponentType> = ComponentOf<T>['props'] extends {
  variant?: infer Variant;
}
  ? Exclude<Variant, undefined>
  : never;
type ResponsiveVariant<T extends ComponentType> = 'default' | DeclaredVariant<T>;

type ResponsiveRegistry = {
  [T in ComponentType]: {
    behavior: ResponsiveBehavior;
    variants: readonly ResponsiveVariant<T>[];
  };
};

/**
 * 测试侧响应契约目录：只描述 schema 分支的覆盖事实，不进入运行时。
 * `satisfies` 拒绝不存在的 type/variant；下方 MissingVariants 让漏登记也编译失败。
 */
export const responsiveFixtures = {
  reportHeader: { behavior: 'reflow', variants: ['default', 'projectDetail'] },
  metricCard: {
    behavior: 'reflow',
    variants: [
      'default',
      'summary',
      'activityProgress',
      'compactSummary',
      'dualSummary',
      'compactStrip',
      'compactStack'
    ]
  },
  barChart: { behavior: 'fluid', variants: ['default', 'reportForecast'] },
  lineChart: { behavior: 'fluid', variants: ['default'] },
  pieChart: { behavior: 'fluid', variants: ['default', 'compactRing'] },
  table: {
    behavior: 'scroll-owner',
    variants: ['default', 'reportCompact', 'embedded', 'forecastMatrix']
  },
  mapChart: { behavior: 'reflow', variants: ['default', 'regionalOverview'] },
  gauge: { behavior: 'fluid', variants: ['default', 'mini'] },
  tabContainer: {
    behavior: 'layout-owner',
    variants: ['default', 'compact', 'analysisStack']
  },
  compositeCard: {
    behavior: 'layout-owner',
    variants: ['default', 'compact', 'projectNorms', 'metricGrid']
  },
  rankingCard: { behavior: 'fluid', variants: ['default'] },
  rankingDetailCard: { behavior: 'fluid', variants: ['default', 'report'] },
  keyValuePanel: {
    behavior: 'reflow',
    variants: ['default', 'counterStrip', 'detailSummary', 'detailNormMatrix']
  },
  categoryBreakdown: {
    behavior: 'scroll-owner',
    variants: ['default', 'compactList']
  },
  fieldText: {
    behavior: 'fluid',
    variants: [
      'default',
      'plain',
      'quote',
      'narrativeShort',
      'narrativeMeeting',
      'narrativeRisk',
      'narrativeProgress'
    ]
  },
  text: {
    behavior: 'fluid',
    variants: ['default', 'plain', 'heading', 'insight', 'reportInline', 'riskNotice']
  },
  aiSummary: { behavior: 'scroll-owner', variants: ['default', 'reportInline'] }
} as const satisfies ResponsiveRegistry;

type MissingVariants = {
  [T in ComponentType]: Exclude<
    ResponsiveVariant<T>,
    (typeof responsiveFixtures)[T]['variants'][number]
  >;
}[ComponentType];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const allSchemaVariantsAreRegistered: MissingVariants extends never ? true : never = true;

export const responsiveQueryContracts = [
  'composite-project-norms-height',
  'key-value-detail-norm-three-columns',
  'key-value-detail-norm-two-columns',
  'map-regional-annotations-flow',
  'metric-panel-local-compact',
  'metric-compact-stack-local-type',
  'metric-summary-local-comfortable',
  'metric-summary-local-tight',
  'metric-activity-progress-local-tight',
  'report-header-project-detail-flow'
] as const;
