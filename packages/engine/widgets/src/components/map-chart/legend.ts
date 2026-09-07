import type { MapChartProps } from '@metriccanvas/page';
import type { ColorList } from '../../shared/chart-palette';
import type { MapProjectionRect } from './options';

type MapLegend = NonNullable<MapChartProps['legend']>;
export type MapLegendBand = MapLegend['bands'][number];

export interface MapLegendLevel {
  label: string;
  /** 档位下界(含)。 */
  from: number;
  /** 档位上界(不含);最高档开口向上,因此缺席。 */
  to?: number;
  /** 分档色板里对应的那一级;色板缺席即缺席(报表形态没有分档色)。 */
  color?: string;
}

/**
 * 把 DOM 图例的定位参照物收进与地图投影相同的安全区。
 *
 * 安全区缺席或没有正面积时不写局部几何，由组件 CSS 的 `inset: 0`
 * 回退覆盖整个地图 frame。返回完整 style 字符串，避免 Svelte 模板再复制
 * 四个几何字段的有效性判断。
 */
export function mapLegendFrameStyle(
  projection: MapProjectionRect | undefined
): string | undefined {
  if (!projection || projection.width <= 0 || projection.height <= 0) return undefined;
  return `left:${projection.x}px;top:${projection.y}px;width:${projection.width}px;height:${projection.height}px;`;
}

/**
 * 档位声明 → 展示档位。
 *
 * 协议侧一档只写 `label` 与下界 `from`,上界由下一档的 `from` 隐含,最后一档
 * 开口向上——这个语义只有在按 `from` 升序时成立,所以这里先按 `from` 归一,
 * 不指望声明顺序。返回的是**展示序**:从高到低,与分档色列同序
 * (`--mc-chart-map-scale-colors` 也是从高档到低档),两边因此按同一个下标配对。
 *
 * 档数多于色数时,多出来的低档一律取最低那一级色,而不是回卷到高档色:
 * 回卷会让一个高档与一个低档撞色,分档着色就读不出高低。
 */
export function mapLegendLevels(
  bands: readonly MapLegendBand[],
  scale?: ColorList
): MapLegendLevel[] {
  const ascending = [...bands].sort((left, right) => left.from - right.from);
  const descending = ascending
    .map((band, index) => {
      const upper = ascending[index + 1]?.from;
      return {
        label: band.label,
        from: band.from,
        ...(upper === undefined ? {} : { to: upper })
      };
    })
    .reverse();

  return descending.map((level, index) => {
    const color =
      scale && scale.length > 0 ? scale[Math.min(index, scale.length - 1)] : undefined;
    return { ...level, ...(color === undefined ? {} : { color }) };
  });
}

export interface MapLegendPiece {
  gte: number;
  lt?: number;
  label: string;
  color?: string;
}

/**
 * 展示档位 → ECharts 分段视觉映射的 `pieces`。
 *
 * 档位是**分档着色的契约**而不是一张图片:区域颜色必须由行的取值落在哪一档
 * 决定,否则图例写着「80% 以上」而底图按取值区间均分着色,图例就在说谎。
 */
export function mapLegendPieces(levels: readonly MapLegendLevel[]): MapLegendPiece[] {
  return levels.map((level) => ({
    gte: level.from,
    ...(level.to === undefined ? {} : { lt: level.to }),
    label: level.label,
    ...(level.color === undefined ? {} : { color: level.color })
  }));
}
