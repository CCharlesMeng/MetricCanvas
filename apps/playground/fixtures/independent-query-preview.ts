import { createDqeGateway } from '@metriccanvas/engine/dqe';

/** Synthetic transport: the first five queries take 5s; later queries take 100ms. */
export function createIndependentRequestsPreview() {
  return { dataGateway: createDqeGateway({ fetchImpl: async (_url, init) => {
    const body = JSON.parse(String(init?.body)) as { dsl_list: { output_metrics: string[] }[] };
    if (body.dsl_list.length !== 1) throw new Error('演示请求必须只有一条查询');
    const field = body.dsl_list[0]!.output_metrics[0]!;
    const index = Number(field.slice(-2));
    await new Promise<void>((resolve, reject) => {
      const signal = init?.signal;
      function abort() { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }
      const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, index <= 5 ? 5000 : 100);
      if (signal?.aborted) abort();
      else signal?.addEventListener('abort', abort, { once: true });
    });
    return Response.json({ retCode: 'CBC.0000', results: [{ code: 'SUCCESS', data: [{ [field]: index }], total_count: 1 }] });
  } }) };
}
