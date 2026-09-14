import type { DialogueAdapter } from './port';

export interface PanguResourceConfig {
  resourceUrl: string;
  version: string;
}

export interface PanguInstance {
  renderChat(): void | Promise<void>;
}

export interface PanguRuntime {
  instance(id: string): PanguInstance;
}

declare global {
  interface Window {
    __METRICCANVAS_PANGU__?: PanguResourceConfig;
    pangu?: PanguRuntime;
  }
}

/** GitHub 侧的独立 stub。真实资源加载和 SDK 适配由本地/codehub 侧维护。 */
export const panguDialogueAdapter: DialogueAdapter = {
  async mount(element) {
    const placeholder = element.ownerDocument.createElement('p');
    placeholder.setAttribute('role', 'status');
    placeholder.textContent = '对话服务尚未接通。';
    element.appendChild(placeholder);
    return () => placeholder.remove();
  }
};
