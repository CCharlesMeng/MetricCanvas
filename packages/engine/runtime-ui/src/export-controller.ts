import { ExportViewError } from '../../runtime/src/export-snapshots';
export interface ExportTaskState { busy: boolean; error?: string; }
/** Task lifecycle only. Capture and data/DOM/file adapters stay at their existing seams. */
export function createExportController(changed: (state: Record<string, ExportTaskState>) => void) {
  const tasks = new Map<string, AbortController>();
  let states: Record<string, ExportTaskState> = {}, generation = 0;
  return {
    async run<T>(id: string, task: (controller: AbortController) => Promise<T>): Promise<T> {
      if (tasks.has(id)) throw new ExportViewError('EXPORT_BUSY', '该导出任务正在执行');
      const controller = new AbortController(), token = generation; tasks.set(id, controller);
      states = { ...states, [id]: { busy: true } }; changed(states);
      try {
        const result = await task(controller);
        if (token === generation) { states = { ...states, [id]: { busy: false } }; changed(states); }
        return result;
      } catch (cause) {
        if (token === generation) { states = { ...states, [id]: { busy: false, error: controller.signal.aborted ? (controller.signal.reason instanceof Error ? controller.signal.reason.message : '导出已取消') : cause instanceof Error ? cause.message : '导出失败' } }; changed(states); }
        throw cause;
      } finally { if (tasks.get(id) === controller) tasks.delete(id); }
    },
    cancel(id: string) { tasks.get(id)?.abort(new ExportViewError('EXPORT_CANCELLED', '导出已取消')); },
    reset() { generation++; for (const controller of tasks.values()) controller.abort(new ExportViewError('EXPORT_CANCELLED', '页面实例已更新')); tasks.clear(); states = {}; changed(states); }
  };
}
