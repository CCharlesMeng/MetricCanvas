/** Data-only authoring checks use actual field resolution. No DOM or viewport evidence. */
import { type Page, type TableComponent, type ResolvedFieldDefinition } from '../../../packages/page/src/internal';
import { scanPresentationBindings } from '../page/data-scan';
import { pageSchema } from '../../../packages/page/src/schema';
import { rowExpansionPage } from '../../../packages/page/src/table/expansion';
import { walkPageComponents, flattenPageComponents } from '../../../packages/page/src/component-walk';
import { resolveField, type FieldResolutionSlots } from '../../../packages/page/src/field-resolution';
import { canonicalizeJson } from '../../../packages/page/src/canonical-json';
import policy from './policy.json';

export type PresentationFinding = { code: string; path: string; componentId: string; sourceId?: string; fieldId?: string; format?: string; evidence: string };


export function formatApplicability(field: ResolvedFieldDefinition, format: string | undefined): string | undefined {
  if (!format || field.role !== 'measure') return undefined;
  const unit = ('unit' in field ? field.unit?.trim().toLowerCase() : '') ?? '';
  if (policy.scalingFormats.includes(format) && policy.scaledUnitMarkers.some(marker => unit.includes(marker))) return 'PRESENTATION_DOUBLE_SCALE';
  if (policy.millionFormats.includes(format) && !policy.tokensUnits.includes(unit)) return unit ? 'PRESENTATION_TOKENS_SCALE_CONFLICT' : 'PRESENTATION_SCALE_UNVERIFIED';
  if (policy.percentUnits.includes(unit) && !format.startsWith('percent-') && format !== 'points-1-signed') return 'PRESENTATION_PERCENT_UNIT_CONFLICT';
  return undefined;
}

function slots(page: Page, data: Record<string, string | undefined>): FieldResolutionSlots {
  return Object.fromEntries(Object.entries(data).flatMap(([slot, id]) => id ? [[slot, {
    fields: page.dataSources[id]!.fields
  }]] : []));
}

/** Applies only the AI authoring policy; it does not tighten legal page formats. */
export interface PresentationAuditOptions { baseline?: Page; rawValuePaths?: readonly string[] }

export function inspectAuthoringPresentation(page: Page, options: PresentationAuditOptions = {}): { scope: 'data-only'; findings: PresentationFinding[] } {
  const findings: PresentationFinding[] = [];
  walkPageComponents(page, (component, path) => {
    if (component.type === 'table') findings.push(...expansionFindings(page, component, path, options));
    if (!('data' in component) || !component.data) return;
    const references = component.data;
    const data = slots(page, references);
    for (const { binding, path: bindingPath } of scanPresentationBindings(component, pageSchema, path)) {
      const resolved = resolveField(binding, data);
      if (!resolved.definition) continue;
      const format = typeof resolved.format === 'string' ? resolved.format : undefined;
      const code = formatApplicability(resolved.definition, format);
      const sourceId = Object.entries(references).find(([name]) => name === resolved.data)?.[1];
      const rawIntent = code === 'PRESENTATION_PERCENT_UNIT_CONFLICT' && format?.startsWith('number') && options.rawValuePaths?.includes(bindingPath);
      if (code && !rawIntent) findings.push({ code, componentId: component.id, path: bindingPath, sourceId, fieldId: resolved.field,
        format, evidence: 'declared field unit and effective binding; explicit overrides retained' });
    }
  });
  const prior = options.baseline ? inspectAuthoringPresentation(options.baseline, { rawValuePaths: options.rawValuePaths }).findings : [];
  return { scope: 'data-only', findings: newFindings(page, options.baseline, findings, prior) };
}

function findingKey(finding: PresentationFinding): string {
  const rolePath = finding.path.slice(finding.path.lastIndexOf('/props/')).replace(/\/\d+(?=\/|$)/g, '/*');
  return canonicalizeJson([finding.code, finding.componentId, rolePath, finding.sourceId ?? '', finding.fieldId ?? '', finding.format ?? '']);
}

function contractKey(page: Page, finding: PresentationFinding): string {
  const source = page.dataSources[finding.sourceId!];
  if (!source) return '';
  const field = source.fields[finding.fieldId!] as unknown as Record<string, unknown>;
  const numeric = Object.fromEntries(['type', 'role', 'unit', 'currency', 'defaultFormat', 'queryField'].map(key => [key, field?.[key]]));
  const raw = Object.fromEntries(Object.entries(source.source).filter(([key]) => !['rows', 'initial'].includes(key)));
  return canonicalizeJson([numeric, raw]);
}

function expansionFindings(page: Page, component: TableComponent, path: string, options: PresentationAuditOptions): PresentationFinding[] {
  if (!component.props.rowExpansion) return [];
  const scope = rowExpansionPage(page, component).page;
  const prior = options.baseline ? flattenPageComponents(options.baseline).find(c => c.id === component.id) : undefined;
  const baseline = prior?.type === 'table' && prior.props.rowExpansion ? rowExpansionPage(options.baseline!, prior).page : undefined;
  const prefix = `${path}/props/rowExpansion/table`;
  const child = '/sections/0/components/0/props';
  const rawValuePaths = options.rawValuePaths?.map(value => value.replace(prefix, child));
  return inspectAuthoringPresentation(scope, { baseline, rawValuePaths }).findings.map(finding => ({ ...finding,
    path: finding.path.replace(child, prefix) }));
}

function newFindings(page: Page, baseline: Page | undefined, findings: PresentationFinding[], prior: PresentationFinding[]): PresentationFinding[] {
  if (!baseline) return findings;
  const available = new Map<string, number>();
  for (const old of prior) {
    if (!baseline.dataSources[old.sourceId!]) continue; // Row-expansion private scopes already compare their own baseline.
    const key = findingKey(old) + contractKey(baseline, old);
    available.set(key, (available.get(key) ?? 0) + 1);
  }
  return findings.filter(finding => {
    const key = findingKey(finding) + contractKey(page, finding);
    const count = available.get(key) ?? 0;
    if (!count) return true;
    available.set(key, count - 1);
    return false;
  });
}
