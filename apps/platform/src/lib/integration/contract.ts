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
  /** Required for in-place identity changes; omit only with configChanges: 'reload'. */
  subscribeConfig?: (changed: () => void) => () => void;
  /** Explicit deployment guarantee: identity/target changes reload the document. */
  configChanges?: 'subscribe' | 'reload';
  onEvent?: (event: PlatformEvent) => void;
  registerLeaveGuard?: (guard: () => boolean | Promise<boolean>) => () => void;
  dialogueAdapter?: { mount(element: HTMLElement): Promise<() => void> };
  /** Optional trusted program adapter; use the repository's AuthoringIntegration type. */
  authoring?: TrustedAuthoring;
  events?: EventTarget;
}

/** Versioned deployment seam. Implementations live outside the platform repository. */
export interface PlatformDeploymentConnection<TrustedAuthoring = never> {
  props: PlatformPortalProps<TrustedAuthoring>;
  /** Releases only resources owned by this connection, after platform teardown. */
  disconnect?: () => void | Promise<void>;
}
export interface PlatformDeploymentAdapter<TrustedAuthoring = never> {
  contractVersion: '1';
  /** Synchronous local wiring; do not wait for network or shared SDK readiness. */
  connect(input: Readonly<Record<string, unknown>>): PlatformDeploymentConnection<TrustedAuthoring>;
}
