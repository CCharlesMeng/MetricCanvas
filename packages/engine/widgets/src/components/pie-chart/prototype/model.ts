import type { EChartsOption } from 'echarts';

// THROWAWAY: validate a pie's table legend, not a page-protocol implementation.
export type Order = 'stable' | 'desc' | 'asc' | 'custom';
export type Position = 'right' | 'left';
export interface CustomerBand { name: string; count: number; share: number; color: string }
export interface Settings { position: Position; order: Order; ring: boolean; columns: string; suppliedShare: boolean }

// Synthetic values and interval labels; the business query owns actual boundaries.
export const bands: CustomerBand[] = [
  { name: '0–25%', count: 96, share: 24, color: '#5b72ea' },
  { name: '25–50%', count: 184, share: 46, color: '#3cc6c1' },
  { name: '50–75%', count: 72, share: 18, color: '#fec72a' },
  { name: '75–125%', count: 48, share: 12, color: '#4ba0f7' }
];

export const variants = [
  { key: 'A', name: '右侧环形图', note: '默认方案 · 图形与数据并排' },
  { key: 'B', name: '左侧饼图', note: '先读数据，再看构成' },
  { key: 'C', name: '窄卡片', note: '空间不足，图例完整移至下方' }
];

export function orderedBands(order: Order, custom: string[]): CustomerBand[] {
  if (order === 'stable') return [...bands];
  if (order === 'custom') return custom.flatMap(name => bands.filter(band => band.name === name));
  const direction = order === 'desc' ? -1 : 1;
  return [...bands].sort((a, b) => direction * (a.count - b.count));
}

export function moveBand(rows: CustomerBand[], index: number, direction: number): string[] {
  const names = rows.map(row => row.name);
  const next = index + direction;
  if (next < 0 || next >= names.length) return names;
  [names[index], names[next]] = [names[next]!, names[index]!];
  return names;
}

export function legendColumns(mode: string) {
  const count = { key: 'count', label: '客户数量', width: 82 };
  const share = { key: 'share', label: '占比', width: 70 };
  if (mode === 'count') return [count];
  if (mode === 'share-first') return [share, count];
  return [count, share];
}

export function makeOption(width: number, settings: Settings, rows: CustomerBand[]): EChartsOption {
  const columns = legendColumns(settings.columns);
  const total = bands.reduce((sum, row) => sum + row.count, 0);
  const stacked = width < 620;
  const categoryWidth = 100;
  const tableWidth = 13 + categoryWidth + columns.reduce((sum, column) => sum + column.width, 0);
  const tableX = settings.position === 'left' ? 12 : width - tableWidth - 12;
  const legendX = stacked ? (width - tableWidth) / 2 : tableX;
  const legendY = stacked ? 286 : 114;
  const plotX = settings.position === 'left' ? tableWidth + (width - tableWidth) / 2 : (width - tableWidth) / 2;
  const center: [number, number] = [stacked ? width / 2 : plotX, stacked ? 136 : 166];
  const radius = stacked ? 104 : Math.min(124, (width - tableWidth - 36) / 2);
  const lookup = new Map(rows.map(row => [row.name, row]));
  const shareValue = (row: CustomerBand) => settings.suppliedShare ? row.share : row.count / total * 100;
  const cell = (row: CustomerBand, key: string) => key === 'count' ? row.count.toLocaleString('zh-CN') : `${shareValue(row).toFixed(1)}%`;
  let headerX = legendX + 13 + categoryWidth;
  const headings = columns.map(column => {
    headerX += column.width;
    return { type: 'text' as const, x: headerX, y: legendY - 26,
      style: { text: column.label, fill: '#595959', font: '12px sans-serif', align: 'right' as const } };
  });
  return {
    animation: false,
    tooltip: { trigger: 'item', formatter: item => {
      const entry = Array.isArray(item) ? item[0]! : item;
      const row = lookup.get(String(entry.name))!;
      return `${row.name}<br/>客户数量：${row.count} 户<br/>占比：${shareValue(row).toFixed(1)}%`;
    } },
    legend: {
      orient: 'vertical', left: legendX, top: legendY, padding: 0,
      itemWidth: 8, itemHeight: 8, itemGap: 16, icon: 'circle', align: 'left',
      selectedMode: false,
      data: rows.map(row => ({ name: row.name, itemStyle: { color: row.color } })),
      formatter: name => {
        const row = lookup.get(name)!;
        return `{category|${name}}${columns.map(column => `{${column.key}|${cell(row, column.key)}}`).join('')}`;
      },
      textStyle: { color: '#595959', fontSize: 14, lineHeight: 22, rich: {
        category: { width: categoryWidth, align: 'left', fontSize: 14 },
        count: { width: 82, align: 'right', color: '#191919', fontSize: 14, fontWeight: 500 },
        share: { width: 70, align: 'right', color: '#191919', fontSize: 14, fontWeight: 500 }
      } }
    },
    graphic: [ ...headings, ...(settings.ring ? [
      { type: 'text' as const, x: center[0], y: center[1] - 20, silent: true,
        style: { text: String(total), fill: '#191919', font: '500 30px sans-serif', align: 'center' as const } },
      { type: 'text' as const, x: center[0], y: center[1] + 20, silent: true,
        style: { text: '客户总数', fill: '#999', font: '12px sans-serif', align: 'center' as const } }
    ] : []) ],
    series: [{ type: 'pie', clockwise: true, startAngle: 90, center,
      radius: settings.ring ? [radius * 0.66, radius] : radius,
      label: { show: false }, labelLine: { show: false },
      emphasis: { scale: true, scaleSize: 6 },
      data: rows.map(row => ({ name: row.name, value: row.count, itemStyle: { color: row.color } }))
    }]
  };
}
