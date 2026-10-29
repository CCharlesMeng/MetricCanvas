/** Portable portal contract. No package, framework or build-plugin dependencies. */
export interface PlatformRuntimeConfig {
  dqeEndpoint: string;
  pageMetadataBaseUrl: string;
  authToken: string;
  operatorId: string;
  workspaceId: string;
  cftk?: string;
  /** 列候选原始结果扫描上限；默认1000，批次默认200。 */
  columnCandidatesMaxRows?: number;
}
export interface PlatformEvent {
  code: 'ready' | 'login-required' | 'session-invalidated';
  message: string;
}

/** Portable dialogue contract: SDK implementation remains in the intranet Adapter. */
export interface DialoguePageInput {
  pageId: string | null;
  documentJson: string | null;
  documentSha256: string | null;
  persistedRef: {pageId:string;resourceId:string;revisionId:string} | null;
}
export interface DialoguePageRequest {
  requestId:string; sessionId:string;
  intent:'create'|'adjust'|'publish'|'confirm-save'; question:string;
  input:DialoguePageInput;
}
export interface DialogueAgentPort {
  /** Missing ID creates a real session; supplied ID restores that exact session. */
  openSession(input:{sessionId?:string},signal:AbortSignal):Promise<{sessionId:string}>;
  /** Resolves after the turn and existing component updates have finished, not on enqueue. */
  send(request:DialoguePageRequest,signal:AbortSignal):Promise<{requestId:string;status:'completed'|'failed'|'unknown';message?:string}>;
}
export interface DialogueMountContext {
  sessionId:string;
  /** SDK input must use this entry before sending, including user-typed questions. */
  submit(question:string):Promise<void>;
}
export interface PlatformDialogueAdapter {
  mount(element:HTMLElement,context?:DialogueMountContext):Promise<()=>void>;
  agent?:DialogueAgentPort;
}
export interface PageInfoTarget {pageId:string;resourceId:string}
export interface PageInfoRecord extends PageInfoTarget {
  revisionId:string;title:string;description:string;accessPath?:string;titleIsBound?:boolean;
  /** Optional confirmed provider document; never copied from conversational text. */
  documentJson?:string;
}
export interface PageInfoChanges {title?:string;description?:string;accessPath?:string;replaceBoundTitle?:boolean}
export interface PageInfoPort {
  read(target:PageInfoTarget,signal?:AbortSignal):Promise<PageInfoRecord>;
  update(target:PageInfoTarget&{revisionId:string},changes:PageInfoChanges):Promise<PageInfoRecord>;
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
  dialogueAdapter?: PlatformDialogueAdapter;
  pageInfo?:PageInfoPort;
  /** Optional trusted program adapter; use the repository's AuthoringIntegration type. */
  authoring?: TrustedAuthoring;
  /** Optional engine DisplayInputs; validated at platform composition, no credentials. */
  displayInputs?: unknown;
  /** Optional engine FilterCandidatesGateway, owned by the trusted deployment Adapter. */
  filterCandidates?: unknown;
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
