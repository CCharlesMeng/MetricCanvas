import { componentCatalog } from '@metriccanvas/page';

/** Browsing entries include the page header without adding a content component type. */
export const playgroundComponents = [
  ...componentCatalog,
  { type: 'iocHeader' as const, label: 'IOC 页头', aliases: ['IocHeader', '公共页头', '页面页头'],
    purpose: '页面标题、返回与页面级筛选；复用经营概览和页头专题示例。' }
];

export type PlaygroundComponentType = typeof playgroundComponents[number]['type'];
