import { describe, expect, it } from 'vitest';
import type { EffectiveQuery, Row, Widget } from '@metriccanvas/spec-schema';
import { orchestrate } from './index.js';

/** mock 在系统边界(表服务端口),非内部协作者 */
function portReturning(rows: Row[] | Error) {
  const received: EffectiveQuery[] = [];
  return {
    received,
    port: {
      async fetchData(query: EffectiveQuery): Promise<Row[]> {
        received.push(query);
        if (rows instanceof Error) throw rows;
        return rows;
      }
    }
  };
}

const widget: Widget = {
  id: 'w-gmv',
  type: 'metricCard',
  position: { x: 0, y: 0, w: 3, h: 2 },
  query: { metrics: ['gmv'] }
};

async function collect(widgets: Widget[], port: { fetchData(q: EffectiveQuery): Promise<Row[]> }) {
  const timeline: Array<{ widgetId: string; status: string }> = [];
  const final = await orchestrate(widgets, port, (widgetId, snapshot) => {
    timeline.push({ widgetId, status: snapshot.status });
  });
  return { timeline, final };
}

describe('查询编排器(切片1 最简版)', () => {
  it('widget 先收到加载态快照,数据返回后收到就绪快照', async () => {
    const { port } = portReturning([{ gmv: 1000 }]);
    const { timeline, final } = await collect([widget], port);
    expect(timeline).toEqual([
      { widgetId: 'w-gmv', status: 'loading' },
      { widgetId: 'w-gmv', status: 'ready' }
    ]);
    expect(final.get('w-gmv')).toEqual({ status: 'ready', rows: [{ gmv: 1000 }] });
  });

  it('结构化查询被合成为生效查询(切片1 无筛选器,conditions 为空)', async () => {
    const { port, received } = portReturning([{ gmv: 1 }]);
    await collect([widget], port);
    expect(received).toEqual([{ metrics: ['gmv'], conditions: [] }]);
  });

  it('查询结果为空数组时,快照为空态而非就绪态', async () => {
    const { port } = portReturning([]);
    const { final } = await collect([widget], port);
    expect(final.get('w-gmv')).toEqual({ status: 'empty' });
  });

  it('查询失败时,快照为错误态且携带错误信息,不抛出', async () => {
    const { port } = portReturning(new Error('表服务不可达'));
    const { final } = await collect([widget], port);
    expect(final.get('w-gmv')).toEqual({
      status: 'error',
      error: { message: '表服务不可达' }
    });
  });
});
