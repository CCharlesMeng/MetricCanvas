import type { ModelProvider, ModelResponse } from '../../src/lib/server/agent/types';

/**
 * 测试替身,不是生产入口的一部分(ADR-0024):按调用顺序回放预设响应。
 * 生产侧的确定性回退是 `createComponentSelectingScriptedProvider`
 * (src/lib/server/scripted-model.server.ts),语义不同,不要混用。
 */
export function createScriptedModelProvider(responses: ModelResponse[]): ModelProvider {
  const queue = structuredClone(responses);
  return {
    async complete() {
      const next = queue.shift();
      if (!next) {
        throw new Error('scripted model 响应已耗尽');
      }
      return structuredClone(next);
    }
  };
}
