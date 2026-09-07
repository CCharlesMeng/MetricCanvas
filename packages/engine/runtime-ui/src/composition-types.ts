import type { Component, PageSection } from '@metriccanvas/page';
import type { Snippet } from 'svelte';
import type { Attachment } from 'svelte/attachments';
import type { RuntimeViewProps } from './types';

export type ComponentContent = Snippet<[Component]>;

/**
 * 渲染组合接缝：只交出已校验的内容分区与绑定到当前数据快照的渲染片段。
 * 不改变初始化、页面校验、查询或筛选状态的所有权。
 */
export interface RuntimeSurfaceProps extends RuntimeViewProps {
  sectionsContent?: Snippet<[readonly PageSection[], ComponentContent]>;
}

/**
 * 布局盒组合接缝。调用方只装饰本单元格，不改网格结构或组件内部 DOM。
 * attachment 必须返回清理函数以撤销所安装的行为；布局几何仍归 RuntimeSection。
 */
export interface RuntimeSectionProps {
  section: PageSection;
  componentContent: ComponentContent;
  cellAttachment?: (component: Component, index: number) => Attachment<HTMLElement>;
  cellOverlay?: Snippet<[Component, number]>;
  emptyContent?: Snippet;
}
