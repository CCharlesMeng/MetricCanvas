/** Portable portal contract. No package, framework or build-plugin dependencies. */
export interface PlatformRuntimeConfig {
  dqeEndpoint: string;
  pageMetadataBaseUrl: string;
  authToken: string;
  operatorId: string;
  workspaceId: string;
  cftk?: string;
}
export interface PlatformEvent {
  code: 'ready' | 'login-required' | 'session-invalidated';
  message: string;
}
export interface PlatformPortalProps<TrustedAuthoring = never> {
  routeBase: string;
  readConfig: () => Partial<PlatformRuntimeConfig> | null | undefined;
  subscribeConfig: (changed: () => void) => () => void;
  onEvent?: (event: PlatformEvent) => void;
  registerLeaveGuard?: (guard: () => boolean | Promise<boolean>) => () => void;
  dialogueAdapter?: { mount(element: HTMLElement): Promise<() => void> };
  /** Optional trusted program adapter; use the repository's AuthoringIntegration type. */
  authoring?: TrustedAuthoring;
  events?: EventTarget;
}
