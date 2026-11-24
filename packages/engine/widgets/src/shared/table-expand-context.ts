export const TABLE_EXPAND_CONTEXT = Symbol('table-expand');

export interface TableExpandControl {
  available(anchor: HTMLElement): boolean;
  expanded(anchor: HTMLElement): boolean;
  toggle(anchor: HTMLElement): void;
}
