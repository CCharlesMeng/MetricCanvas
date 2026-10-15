export interface ExportViewOptions { signal?: AbortSignal }
export interface PreparedExportView {
  /** Connected, static DOM. Valid until the consumer settles or the supplied signal aborts. */
  target: HTMLElement;
  pageId: string;
  paper: 'A4';
  /** Sections marked as wide; built-in PDF uses landscape, custom consumers choose their pagination. */
  wideElements: readonly HTMLElement[];
  signal: AbortSignal;
}
export type ExportViewConsumer<T> = (view: PreparedExportView) => Promise<T>;
