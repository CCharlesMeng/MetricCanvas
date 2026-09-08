import { createInjectedDqeGateway } from '../runtime-config';
import { createDqeDevDetail } from './dev-detail';

/** 只有工作台开发构建可显式启用查询明细；精确修订预览不经过此入口。 */
export function createWorkbenchDqeGateway(fetchImpl: typeof fetch = fetch) {
  const devDetail = import.meta.env.DEV && import.meta.env.VITE_DQE_DEV_DETAIL === '1'
    ? createDqeDevDetail({
        environment: 'development',
        sampleRate: Number(import.meta.env.VITE_DQE_DEV_DETAIL_SAMPLE_RATE ?? '1'),
        sink: (record) => console.debug('[MetricCanvas DQE dev detail]', record)
      })
    : undefined;
  return createInjectedDqeGateway(fetchImpl, devDetail);
}
