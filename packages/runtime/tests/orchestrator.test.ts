import { describe, expect, it } from 'vitest';
import type { EffectiveQuery, Row, Widget } from '@metriccanvas/page';
import { orchestrate } from '../src/orchestrator';
import type { DataGateway } from '../src/ports';

/** mock 在系统边界(数据网关端口),非内部协作者 */
function gatewayReturning(rows: Row[] | Error) {
  const received: EffectiveQuery[] = [];
  const gateway: DataGateway = {
    async fetchData(query: EffectiveQuery): Promise<Row[]> {
      received.push(query);
      if (rows instanceof Error) throw rows;
      return rows;
    }
  };
  return { received, gateway };
}

const widget: Widget = {
  id: 'w-gmv',
  type: 'metricCard',
  position: { x: 0, y: 0, w: 3, h: 2 },
  query: { metrics: ['gmv'] }
};

async function collect(widgets: Widget[], gateway: DataGateway) {
  const timeline: Array<{ widgetId: string; status: string }> = [];
  const final = await orchestrate(widgets, gateway, (widgetId, snapshot) => {
    timeline.push({ widgetId, status: snapshot.status });
  });
  return { timeline, final };
}

describe('查询编排器(切片1 最简版)', () => {
  it('widget 先收到加载态快照,数据返回后收到就绪快照', async () => {
    const { gateway } = gatewayReturning([{ gmv: 1000 }]);
    const { timeline, final } = await collect([widget], gateway);
    expect(timeline).toEqual([
      { widgetId: 'w-gmv', status: 'loading' },
      { widgetId: 'w-gmv', status: 'ready' }
    ]);
    expect(final.get('w-gmv')).toEqual({ status: 'ready', rows: [{ gmv: 1000 }] });
  });

  it('结构化查询被合成为生效查询(切片1 无筛选器,conditions 为空)', async () => {
    const { gateway, received } = gatewayReturning([{ gmv: 1 }]);
    await collect([widget], gateway);
    expect(received).toEqual([{ metrics: ['gmv'], conditions: [] }]);
  });

  it('查询结果为空数组时,快照为空态而非就绪态', async () => {
    const { gateway } = gatewayReturning([]);
    const { final } = await collect([widget], gateway);
    expect(final.get('w-gmv')).toEqual({ status: 'empty' });
  });

  it('查询失败时,快照为错误态且携带错误信息,不抛出', async () => {
    const { gateway } = gatewayReturning(new Error('数据服务不可达'));
    const { final } = await collect([widget], gateway);
    expect(final.get('w-gmv')).toEqual({
      status: 'error',
      error: { message: '数据服务不可达' }
    });
  });
});
