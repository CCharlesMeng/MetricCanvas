import type { FilterValues } from './filter-state';

export interface LastFilterContext { actorId: string; workspaceId: string; targetMetadata: string; clientId: string }
export interface LastFilterRequest extends LastFilterContext {
  operationId: string;
  clientSequence: number;
  filterValues: Record<string, import('./filter-state').FilterValue>;
}
export interface LastFilterPort { recordLastFilters(request: LastFilterRequest, signal?: AbortSignal): Promise<unknown> }
export type LastFilterStatus = { clientSequence: number; status: 'recorded' | 'failed' | 'unavailable' };

/** 每个身份/工作区/metadata/client实例一条序列；服务端仍须裁决跨实例并发。 */
export function createLastFilterRecorder(context: LastFilterContext, port?: LastFilterPort, onStatus?: (status: LastFilterStatus) => void) {
  if ([context.actorId, context.workspaceId, context.targetMetadata, context.clientId].some(v => typeof v !== 'string' || !v)) throw new Error('最后筛选记录缺少可信归属');
  const owner = Object.freeze({...context});
  const pending = new Set<AbortController>();
  let sequence = 0, disposed = false;
  return {
    record(values: FilterValues): void {
      if (disposed) return;
      const clientSequence = ++sequence;
      const request: LastFilterRequest = {...owner, clientSequence, operationId:crypto.randomUUID(), filterValues:structuredClone(Object.fromEntries(values))};
      const emit = (status: LastFilterStatus['status']) => { if (!disposed && clientSequence === sequence) { try { onStatus?.({clientSequence,status}); } catch { /* 宿主观察者不改变记录流程 */ } } };
      if (!port) { emit('unavailable'); return; }
      const controller = new AbortController(); pending.add(controller);
      Promise.resolve().then(()=>{ controller.signal.throwIfAborted(); return port.recordLastFilters(request, controller.signal); }).then(response => {
        const ack = response as {status?: unknown; operationId?:unknown; clientSequence?:unknown} | null;
        emit(ack?.status === 'recorded' && ack.operationId === request.operationId && ack.clientSequence === clientSequence ? 'recorded' : 'failed');
      }, () => emit('failed')).finally(()=>pending.delete(controller));
    },
    dispose(): void { disposed = true; for (const c of pending) c.abort(); pending.clear(); }
  };
}
