import { describe, expect, it } from 'vitest';
import { isDataGateway } from '../src/types';

describe('统一运行时接入配置', () => {
  it('按数据网关端口检查两个必需方法', () => {
    expect(
      isDataGateway({
        async fetchData() {
          return [];
        },
        async fetchDimensionValues() {
          return [];
        }
      })
    ).toBe(true);
    expect(isDataGateway({ fetchData() {} })).toBe(false);
  });
});
