/** 仪表刻度:把原始值夹到 [min, max] 并换算成 0–1 进度。 */
export function gaugeProgress(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return 0;
  }
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

export function gaugeArc(progress: number, radius: number): string {
  const clamped = Math.min(1, Math.max(0, progress));
  const start = (-Math.PI * 5) / 4;
  const sweep = (Math.PI * 3) / 2;
  const end = start + sweep * clamped;
  const startPoint = polar(radius, start);
  const endPoint = polar(radius, end);
  const large = sweep * clamped > Math.PI ? 1 : 0;
  return `M ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 ${large} 1 ${endPoint.x} ${endPoint.y}`;
}

function polar(radius: number, angle: number): { x: number; y: number } {
  return {
    x: Number((Math.cos(angle) * radius).toFixed(3)),
    y: Number((Math.sin(angle) * radius).toFixed(3))
  };
}
