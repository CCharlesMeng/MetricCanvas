import { describe, expect, it } from 'vitest';
import { dimensionValuesFor } from '../src/dimension-value-surface';

describe('DQE Sim 维度候选值闭集', () => {
  it('IOC 五维不扩入问数语义面，仍由候选值专用闭集确定性返回', () => {
    expect(dimensionValuesFor('cloud-class')).toEqual([
      { value: '公有云', label: '公有云' }
    ]);
    expect(dimensionValuesFor('project-initiation-level')).toEqual(
      ['L1', 'L2', 'L3', 'L4'].map((value) => ({ value, label: value }))
    );
    expect(dimensionValuesFor('geo-pc-code')).toEqual([
      { value: 'R05', label: '欧洲' },
      { value: 'TBD-APAC', label: '亚太' },
      { value: 'TBD-NAF', label: '北部非洲' },
      { value: 'TBD-MECA', label: '中东中亚' },
      { value: 'R99', label: '中国' },
      { value: 'TBD-LATAM', label: '拉美' },
      { value: 'TBD-SAF', label: '南部非洲' },
      { value: 'TBD-RU', label: '俄罗斯' }
    ]);
    expect(dimensionValuesFor('region-dept-code')).toEqual([
      { value: 'CN-BJ', label: '北京' },
      { value: 'CN-SH', label: '上海' },
      { value: 'CN-GD', label: '广东' }
    ]);
    expect(dimensionValuesFor('rep-office-code')).toEqual([
      { value: 'SH-01', label: '上海代表处' },
      { value: 'BJ-01', label: '北京代表处' },
      { value: 'GD-01', label: '广东代表处' },
      { value: 'SZ-01', label: '深圳代表处' },
      { value: 'HZ-01', label: '杭州代表处' },
      { value: 'CD-01', label: '成都代表处' },
      { value: 'SG-01', label: '新加坡代表处' },
      { value: 'TJ-01', label: '天津代表处' }
    ]);
  });

  it('语义面同名维度按声明顺序并集去重', () => {
    expect(dimensionValuesFor('区域')).toEqual(
      ['华东', '华南', '华北', '西南', '华中', '东北', '西北'].map((value) => ({
        value,
        label: value
      }))
    );
    expect(dimensionValuesFor('客户级别')).toEqual(
      ['卓越', '战略', '核心', '成长'].map((value) => ({ value, label: value }))
    );
  });

  it('未知维度和对象原型属性名均失败关闭，不读取继承属性', () => {
    for (const name of ['仿真面外维度', 'toString', 'constructor', '__proto__']) {
      expect(() => dimensionValuesFor(name)).not.toThrow();
      expect(dimensionValuesFor(name)).toBeUndefined();
    }
  });
});
