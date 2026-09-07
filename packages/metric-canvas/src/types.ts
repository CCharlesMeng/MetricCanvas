export interface AuthoringComponentLocator {
  sectionId: string;
  componentId: string;
}

/** 内容分区 12 列自动流中的目标插槽；index 范围为 0..components.length。 */
export interface AuthoringDropTarget {
  sectionId: string;
  index: number;
}

export interface AuthoringComponentPosition {
  sectionId: string;
  index: number;
}

/**
 * 创作态内容分区排布。这里只携带稳定身份和组件顺序；组件实体仍取自
 * 已通过正式 Page Schema 的 Runtime document，避免草稿绕过数据编排校验。
 */
export interface AuthoringDraftSection {
  id: string;
  title?: string;
  container?: 'plain' | 'panel' | 'card';
  componentIds: readonly string[];
}

export type NormalizedAuthoringDropTarget =
  | { kind: 'invalid' }
  | { kind: 'unchanged' }
  | { kind: 'move'; destination: AuthoringDropTarget };

/** 把拖拽前的插槽换算为移除 source 后唯一的插入位置。 */
export function normalizeAuthoringDropTarget(
  source: AuthoringComponentPosition,
  destination: AuthoringDropTarget,
  destinationComponentCount: number
): NormalizedAuthoringDropTarget {
  if (
    !Number.isInteger(destination.index) ||
    destination.index < 0 ||
    destination.index > destinationComponentCount
  ) {
    return { kind: 'invalid' };
  }
  if (
    source.sectionId === destination.sectionId &&
    (destination.index === source.index || destination.index === source.index + 1)
  ) {
    return { kind: 'unchanged' };
  }
  return {
    kind: 'move',
    destination: {
      sectionId: destination.sectionId,
      index:
        source.sectionId === destination.sectionId &&
        destination.index > source.index
          ? destination.index - 1
          : destination.index
    }
  };
}

export type AuthoringIntent =
  | { type: 'select_component'; locator: AuthoringComponentLocator }
  | {
      type: 'move_component';
      locator: AuthoringComponentLocator;
      destination: AuthoringDropTarget;
    }
  | {
      type: 'edit_component';
      locator: AuthoringComponentLocator;
      edit: { title?: string; detail?: string; span?: number };
    };

export interface AuthoringOptions {
  selected?: AuthoringComponentLocator;
  /** 允许空内容分区的画布草稿排布；不进入正式页面解析、查询或发布。 */
  draftSections?: readonly AuthoringDraftSection[];
  /**
   * 是否在画布内展示选中组件的行内控件条(标题/宽度)。缺省 true 保持
   * canvas 编辑器既有行为;工作台等把编辑收进外部配置面板的宿主传 false,
   * 选中与拖拽交互不受影响。
   */
  inlineControls?: boolean;
  onintent(intent: AuthoringIntent): void;
}
