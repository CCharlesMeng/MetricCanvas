import type { DialogueAdapter } from './port';

/** Explicit SDK-free stub for tests; normal workbench mounting uses runtime.ts. */
export const stubDialogueAdapter: DialogueAdapter = {
  async mount(element) {
    const placeholder = element.ownerDocument.createElement('p');
    placeholder.setAttribute('role', 'status');
    placeholder.textContent = '对话服务尚未接通。';
    element.appendChild(placeholder);
    return () => placeholder.remove();
  }
};
