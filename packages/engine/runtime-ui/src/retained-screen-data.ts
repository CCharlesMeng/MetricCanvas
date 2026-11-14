import { canonicalizeJson, type Component, type DataSnapshot, type Page } from '@metriccanvas/page/internal';
import type { NamedDataSlots } from '../../widgets/src/shared/component-data';
import type { TableRenderBinding } from './component-render';

export const RETAINED_SCREEN_DATA = Symbol('retained-screen-data');
type TablePresentation = Pick<TableRenderBinding, 'view' | 'pagination' | 'paginationConfig'>;
interface Receipt { shape: string; data: NamedDataSlots; table?: TablePresentation }
export interface ScreenData { data: NamedDataSlots; retained: boolean; table?: TablePresentation }

function dataShape(component: Component, data: NamedDataSlots): string {
  return canonicalizeJson([component.type, component.data ?? null, Object.entries(data).map(([slot, value]) => [slot, value?.fields ?? null])]);
}

function frozenTable(table: TableRenderBinding | undefined): TablePresentation | undefined {
  if (!table) return;
  return JSON.parse(JSON.stringify({ view: table.view, pagination: table.pagination, paginationConfig: table.paginationConfig }));
}

function rowCount(data: NamedDataSlots): number {
  return Object.values(data).reduce((count, slot) => count + (slot?.snapshot.rows.length ?? 0), 0);
}

/** Display receipts only. Never seed query execution, computations, candidates or exports. */
export function createRetainedScreenData() {
  const pages = new Map<string, Map<string, Receipt>>();
  let current = new Map<string, Receipt>();
  let owner: object | undefined;
  function clear() { pages.clear(); current = new Map(); }
  return {
    clear,
    forget(componentId:string){current.delete(componentId);},
    select(page: Page, gateway: object | undefined, revision: string | undefined) {
      if (gateway !== owner) { clear(); owner = gateway; }
      const key = canonicalizeJson([page, revision ?? null]);
      current = pages.get(key) ?? new Map();
      pages.delete(key); pages.set(key, current);
      while (pages.size > 4) pages.delete(pages.keys().next().value!);
    },
    read(component: Component, data: NamedDataSlots, snapshot: DataSnapshot, table?: TableRenderBinding): ScreenData {
      const shape = dataShape(component, data);
      const previous = current.get(component.id);
      if (data.main?.progress) { current.delete(component.id); return { data, retained: false }; }
      if (snapshot.status === 'error') current.delete(component.id);
      if (snapshot.status === 'ready' || snapshot.status === 'empty') {
        current.set(component.id, { shape, data, table: frozenTable(table) });
        // Bound retained row references per page without serializing business data on every render.
        while ([...current.values()].reduce((count, receipt) => count + rowCount(receipt.data), 0) > 20_000)
          current.delete(current.keys().next().value!);
        return { data, retained: false };
      }
      if (snapshot.status !== 'loading' || previous?.shape !== shape) return { data, retained: false };
      // A component advances as one display unit; never mix old supplementary slots with new main rows.
      const retained = { ...previous.data };
      if (retained.main) retained.main = { ...retained.main, sourceStatus: 'loading' };
      return { data: retained, retained: true, table: previous.table };
    }
  };
}
export type RetainedScreenData = ReturnType<typeof createRetainedScreenData>;
