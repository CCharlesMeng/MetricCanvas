type AdaptiveMoneyFormat = 'cny-adaptive-trimmed' | 'cny-adaptive-trimmed-no-yuan' | 'usd-adaptive-km';
interface MoneyBand { divisor: number; digits: number; unit: string }

// 使用原始绝对值选档；显示舍入不触发第二次选档。
function cnyBand(magnitude: number, withYuan: boolean): MoneyBand {
  if (magnitude < 10_000) return { divisor: 1, digits: 0, unit: withYuan ? '元' : '' };
  if (magnitude < 100_000) return { divisor: 1e4, digits: 1, unit: '万' };
  if (magnitude < 100_000_000) return { divisor: 1e4, digits: 0, unit: '万' };
  if (magnitude < 1_000_000_000) return { divisor: 1e8, digits: 2, unit: '亿' };
  return { divisor: 1e8, digits: 1, unit: '亿' };
}

function usdBand(magnitude: number): MoneyBand {
  if (magnitude < 10_000) return { divisor: 1, digits: 0, unit: '$' };
  if (magnitude < 1_000_000) return { divisor: 1e3, digits: 1, unit: 'K' };
  if (magnitude < 100_000_000) return { divisor: 1e3, digits: 0, unit: 'K' };
  return { divisor: 1e6, digits: 0, unit: 'M' };
}

/** 对绝对值舍入后恢复符号，零不带负号；不修改原始金额或执行换汇。 */
export function formatAdaptiveMoney(value: number, format: AdaptiveMoneyFormat): string {
  const magnitude = Math.abs(value);
  const band = format === 'usd-adaptive-km' ? usdBand(magnitude) : cnyBand(magnitude, format === 'cny-adaptive-trimmed');
  const body = new Intl.NumberFormat('en-US', {
    useGrouping: true, minimumFractionDigits: 0, maximumFractionDigits: band.digits
  }).format(magnitude / band.divisor);
  const sign = value < 0 && Number(body.replaceAll(',', '')) !== 0 ? '-' : '';
  return `${sign}${body}${band.unit}`;
}
