import { describe, expect, it } from 'vitest';
import { isDataGateway } from '../src/types';

describe('统一运行时接入配置', () => {
  it('主查询执行必备,候选值端口可选', () => {
    expect(
      isDataGateway({
        async fetchData() {
          return { rows: [] };
        },
        async fetchDimensionValues() {
          return { kind: 'unavailable' };
        }
      })
    ).toBe(true);
    // 候选值能力缺席是合法形状:不支持候选值的数据网关不实现该端口。
    expect(
      isDataGateway({
        async fetchData() {
          return { rows: [] };
        }
      })
    ).toBe(true);
    expect(isDataGateway({})).toBe(false);
    expect(isDataGateway({ fetchData: 'not-a-function' })).toBe(false);
    // 声明了候选值端口就必须是函数(失败关闭)。
    expect(
      isDataGateway({
        async fetchData() {
          return { rows: [] };
        },
        fetchDimensionValues: 'not-a-function'
      })
    ).toBe(false);
  });
});
