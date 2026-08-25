import { describe, expect, it } from 'vitest';
import { backdropSafeArea, safeAreaCustomProperties } from '../src/backdrop-safe-area';

const backdrop = { x: 0, y: 0, width: 1000, height: 600 };

describe('backdropSafeArea', () => {
  it('浮层为空时等于 backdrop 自身', () => {
    expect(backdropSafeArea(backdrop, [])).toEqual(backdrop);
  });

  it('单个浮层贴顶时从顶部切,余下整条下半区', () => {
    const safe = backdropSafeArea(backdrop, [{ x: 0, y: 0, width: 1000, height: 200 }]);

    expect(safe).toEqual({ x: 0, y: 200, width: 1000, height: 400 });
  });

  it('单个浮层贴左时从左侧切', () => {
    const safe = backdropSafeArea(backdrop, [{ x: 0, y: 0, width: 300, height: 600 }]);

    expect(safe).toEqual({ x: 300, y: 0, width: 700, height: 600 });
  });

  it('浮层只占一角时取面积最大的那条完整带,而不是随便一条', () => {
    // 右上角 400×200 被占:横带 1000×400(面积 400000)大于竖带 600×600(面积 360000)
    const safe = backdropSafeArea(backdrop, [{ x: 600, y: 0, width: 400, height: 200 }]);

    expect(safe).toEqual({ x: 0, y: 200, width: 1000, height: 400 });
  });

  it('多个浮层按并集切,不是只看第一个', () => {
    const safe = backdropSafeArea(backdrop, [
      { x: 0, y: 0, width: 1000, height: 150 },
      { x: 0, y: 500, width: 1000, height: 100 }
    ]);

    expect(safe).toEqual({ x: 0, y: 150, width: 1000, height: 350 });
  });

  it('浮层铺满 backdrop 时无解', () => {
    expect(backdropSafeArea(backdrop, [{ x: 0, y: 0, width: 1000, height: 600 }])).toBeNull();
  });

  it('浮层并集覆盖整个 backdrop 时无解,即使单个浮层都不铺满', () => {
    const safe = backdropSafeArea(backdrop, [
      { x: 0, y: 0, width: 1000, height: 300 },
      { x: 0, y: 300, width: 1000, height: 300 }
    ]);

    expect(safe).toBeNull();
  });

  it('完全落在 backdrop 之外的浮层不参与切割', () => {
    const safe = backdropSafeArea(backdrop, [{ x: 1200, y: 0, width: 200, height: 600 }]);

    expect(safe).toEqual(backdrop);
  });

  it('backdrop 自身无尺寸时无解', () => {
    expect(backdropSafeArea({ x: 0, y: 0, width: 0, height: 600 }, [])).toBeNull();
  });

  it('局部坐标系:backdrop 不在原点时返回的矩形仍在同一坐标系里', () => {
    const shifted = { x: 40, y: 20, width: 200, height: 100 };
    const safe = backdropSafeArea(shifted, [{ x: 40, y: 20, width: 200, height: 40 }]);

    expect(safe).toEqual({ x: 40, y: 60, width: 200, height: 60 });
  });
});

describe('safeAreaCustomProperties', () => {
  it('矩形映射为 IFC 约定的四个自定义属性,单位 px', () => {
    expect(safeAreaCustomProperties({ x: 12, y: 34, width: 560, height: 78 })).toEqual({
      '--mc-backdrop-safe-x': '12px',
      '--mc-backdrop-safe-y': '34px',
      '--mc-backdrop-safe-w': '560px',
      '--mc-backdrop-safe-h': '78px'
    });
  });

  it('小数按亚像素保留,不四舍五入成整数', () => {
    const properties = safeAreaCustomProperties({
      x: 0,
      y: 141.328125,
      width: 1872,
      height: 320.5
    });

    expect(properties['--mc-backdrop-safe-y']).toBe('141.328125px');
    expect(properties['--mc-backdrop-safe-h']).toBe('320.5px');
  });
});
