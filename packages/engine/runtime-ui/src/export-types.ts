export interface ExportViewOptions { signal?: AbortSignal }
export interface PreparedExportView {
  /** Connected, static DOM. Valid until the consumer settles or the supplied signal aborts. */
  target: HTMLElement;
  pageId: string;
  paper: 'A4';
  /** Sections marked for a landscape page; host encoder controls PDF pagination. */
  wideElements: readonly HTMLElement[];
  signal: AbortSignal;
}
export type ExportViewConsumer<T> = (view: PreparedExportView) => Promise<T>;
