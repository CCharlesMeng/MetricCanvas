/** 两侧共享的对话挂载契约；销毁仅负责本次挂载。 */
export interface DialogueAdapter {
  mount(element: HTMLElement): Promise<() => void>;
}

export const DRAFT_SAVED_EVENT = 'metriccanvas:draft-saved';

/** draftId 指向只读、不可变的精确草稿修订，不是 latest 查询键。 */
export interface DraftSavedDetail {
  readonly draftId: string;
}

/** 事件来自模块边界，只接受非空精确引用，不从对话文本提取引用。 */
export function readDraftSavedDetail(event: Event): DraftSavedDetail | null {
  if (event.type !== DRAFT_SAVED_EVENT || !('detail' in event)) return null;
  const detail: unknown = event.detail;
  if (typeof detail !== 'object' || detail === null || !('draftId' in detail)) return null;
  if (typeof detail.draftId !== 'string' || !detail.draftId.trim()) return null;
  return Object.freeze({ draftId: detail.draftId });
}

declare global {
  interface WindowEventMap {
    'metriccanvas:draft-saved': CustomEvent<DraftSavedDetail>;
  }
}
