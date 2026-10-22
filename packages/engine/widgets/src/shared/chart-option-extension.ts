import { chartOptionErrorsFor, type ExtensibleChartType } from '@metriccanvas/page/internal';
import type { EChartsOption } from 'echarts';

export const CHART_OPTION_PATHS = Symbol('metriccanvas.chartOptionPaths');
export interface ChartDiagnostic { componentId: string; componentType: ExtensibleChartType; path: string }
export type ChartStage = 'build' | 'validate' | 'merge' | 'layout' | 'init' | 'apply' | 'resize';
export interface ChartSource {
  base?: EChartsOption;
  extended?: EChartsOption;
  diagnostic?: ChartDiagnostic;
  failure?: { stage: ChartStage; cause: unknown; path?: string };
}
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Copies ordinary option trees while retaining the engine's internal formatter functions. */
export function copyChartOption<T>(value: T): T {
  if (Array.isArray(value)) return value.map(copyChartOption) as T;
  if (!record(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, copyChartOption(child)])) as T;
}

function mergeObject(base: unknown, patch: Record<string, unknown>): Record<string, unknown> {
  const next = record(base) ? copyChartOption(base) : {};
  for (const [key, value] of Object.entries(patch)) next[key] = record(value) ? mergeObject(next[key], value) : copyChartOption(value);
  return next;
}

/** Collection patches preserve the engine's identities and data; all other arrays replace. */
export function mergeChartOption(base: EChartsOption, patch: Record<string, unknown>, seriesOrder?: readonly number[]): EChartsOption {
  const next = mergeObject(base, Object.fromEntries(Object.entries(patch).filter(([key]) => !['series', 'xAxis', 'yAxis'].includes(key))));
  for (const key of ['series', 'xAxis', 'yAxis'] as const) {
    if (!Object.hasOwn(patch, key)) continue;
    const value = base[key];
    const entries = value === undefined ? [] : Array.isArray(value) ? value : [value];
    const patches = Array.isArray(patch[key]) ? patch[key] : [patch[key]];
    const merged = entries.map((entry, index) => {
      const candidate = patches[key === 'series' ? seriesOrder?.[index] ?? index : index];
      return record(candidate) ? mergeObject(entry, candidate) : copyChartOption(entry);
    });
    next[key] = Array.isArray(value) ? merged : merged[0];
  }
  return next as EChartsOption;
}

/** Called inside a reactive derivation: failures become values, never escape before the host can recover. */
export function chartSource(build: () => EChartsOption, props: Record<string, unknown>, diagnostic: ChartDiagnostic, seriesOrder?: readonly number[]): ChartSource {
  let base: EChartsOption;
  try { base = build(); } catch (cause) { return { diagnostic, failure: { stage: 'build', cause } }; }
  if (!Object.hasOwn(props, 'echartsOption') || props.echartsOption === undefined) return { base, diagnostic };
  const errors = chartOptionErrorsFor(diagnostic.componentType, props, diagnostic.path);
  if (errors.length) return { diagnostic, failure: { stage: 'validate', path: errors[0].path, cause: errors } };
  try {
    return { base, extended: mergeChartOption(base, props.echartsOption as Record<string, unknown>, seriesOrder), diagnostic };
  } catch (cause) { return { base, diagnostic, failure: { stage: 'merge', cause } }; }
}

export function logChartFailure(source: ChartSource, stage: ChartStage, cause: unknown, degraded: boolean, path?: string): void {
  const code = degraded ? 'CHART_OPTION_DEGRADED' : stage === 'validate' ? 'CHART_OPTION_INVALID' : 'CHART_RENDER_FAILED';
  const details = { code, ...source.diagnostic, stage, path: path ?? source.diagnostic?.path ?? '/props/echartsOption', cause };
  if (degraded) console.warn(`[MetricCanvas][${code}] 自定义图表配置失败，回退基础配置`, details);
  else console.error(`[MetricCanvas][${code}] 图表绘制失败`, details);
}
