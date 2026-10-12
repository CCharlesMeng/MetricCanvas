/** Offline presentation audit. Never executes queries or prints result rows. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parsePage } from '../../packages/page/src/index';
import { walkPageComponents } from '../../packages/page/src/component-walk';
import { resolveField, type MainDataSlots } from '../../packages/engine/widgets/src/shared/component-data';
import { barOption } from '../../packages/engine/widgets/src/components/bar-chart/options';
import { lineOption } from '../../packages/engine/widgets/src/components/line-chart/options';
import { formatValue } from '../../packages/engine/widgets/src/shared/value-format';

type Finding = { code: string; path: string; detail?: string };
type Axis = { type?: string; axisLabel?: { show?: boolean; formatter?: (value: number) => string } };

/** Accept a page or one unambiguous previewJson inside a delivery envelope. */
export function extractPreview(input: unknown): unknown {
  if (input && typeof input === 'object' && 'schemaVersion' in input) return input;
  const found: unknown[] = [];
  function visit(value: unknown) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'previewJson') found.push(typeof child === 'string' ? JSON.parse(child) : child);
      else visit(child);
    }
  }
  visit(input);
  if (found.length !== 1) throw new Error(`Expected exactly one previewJson, found ${found.length}`);
  return found[0];
}

export function auditPresentation(input: unknown) {
  const parsed = parsePage(extractPreview(input));
  if (!parsed.ok) return { valid: false, errors: parsed.errors, findings: [], charts: [] };
  const page = parsed.page;
  const findings: Finding[] = [];
  const charts: Array<{ path: string; componentId: string; formats: Array<string | undefined>; axisChecks: unknown[] }> = [];
  for (const [id, source] of Object.entries(page.dataSources)) {
    if (source.source.type === 'query' && source.source.initial) {
      const initial = source.source.initial;
      if (initial.totalCount === undefined || initial.totalCount !== initial.rows.length) {
        findings.push({ code: 'INITIAL_NOT_COMPLETE', path: `/dataSources/${id}/source/initial`,
          detail: `rows=${initial.rows.length}, totalCount=${initial.totalCount ?? 'unknown'}; requires runtime query, not a full offline preview` });
      }
    }
  }
  walkPageComponents(page, (component, path) => {
    if (component.type === 'text' && component.id.startsWith('structure-scope-')) {
      findings.push({ code: 'LEGACY_SCOPE_TEXT', path, detail: 'May be an old artifact; does not by itself prove deployment version' });
    }
    if (component.type !== 'barChart' && component.type !== 'lineChart') return;
    const source = page.dataSources[component.data.main]!;
    // Axis formatting depends on field contracts, not actual data values. Empty rows
    // deliberately avoid treating partial initial or uncomputed rows as full results.
    const data: MainDataSlots = { main: { fields: source.fields, snapshot: { status: 'ready', rows: [] } } };
    const fields = component.props.series.map(series => resolveField(series.field, data));
    const formats = fields.map(field => field.format);
    fields.forEach((field, index) => {
      const fieldPath = `${path}/props/series/${index}/field`;
      if (!field.format || field.format === 'number') findings.push({ code: 'RAW_VALUE_FORMAT', path: fieldPath });
      if (!field.definition || !('unit' in field.definition) || !field.definition.unit) findings.push({ code: 'BUSINESS_UNIT_UNKNOWN', path: fieldPath });
    });
    const option = component.type === 'barChart' ? barOption(data, component.props) : lineOption(data, component.props);
    const axes = component.type === 'barChart' && component.props.horizontal ? option.xAxis : option.yAxis;
    const axisList = (Array.isArray(axes) ? axes : [axes]) as Axis[];
    const groups = new Map<number, typeof formats>();
    component.props.series.forEach((series, index) => {
      const explicit = component.type === 'barChart' && component.props.series.some(s => s.axis !== undefined || s.kind !== undefined);
      const axisIndex = explicit ? ('axis' in series && series.axis === 'secondary' ? 1 : 0)
        : component.props.dualAxis && index > 0 ? 1 : 0;
      groups.set(axisIndex, [...(groups.get(axisIndex) ?? []), formats[index]]);
    });
    const axisChecks = [...groups].map(([axisIndex, group]) => {
      const axis = axisList[axisIndex];
      const hidden = axis?.axisLabel?.show === false;
      const common = group[0] && group.every(format => format === group[0]) ? group[0] : undefined;
      if (new Set(group).size > 1) findings.push({ code: 'AXIS_FORMAT_CONFLICT', path, detail: `axis=${axisIndex}; formats=${JSON.stringify(group)}` });
      const probes = [0, -10000, 10000, 100000000].map(value => ({ value,
        expected: common ? formatValue(value, common) : null,
        actual: axis?.axisLabel?.formatter ? axis.axisLabel.formatter(value) : null }));
      if (!hidden && common && common !== 'number' && probes.some(probe => probe.actual !== probe.expected)) {
        findings.push({ code: 'AXIS_FORMAT_NOT_APPLIED', path, detail: `axis=${axisIndex}` });
      }
      return { axisIndex, hidden, format: common ?? null, probes };
    });
    charts.push({ path, componentId: component.id, formats, axisChecks });
  });
  return { valid: true, errors: [], findings, charts };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = auditPresentation(JSON.parse(readFileSync(process.argv[2]!, 'utf8')));
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = !result.valid || result.findings.length ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
