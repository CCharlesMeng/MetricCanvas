import { adaptLegacyPageDocument } from './legacy-compatibility';
import { walkDocumentComponents } from './component-walk';
import { normalizePageDocument } from './validate';
import { capabilityFloorErrors, versionPolicy } from './version';
import type { PageDocument } from './page-document';
import type { TypedError } from './errors';
import { upgradeChartFilters } from './upgrade-chart-filters';
import { canonicalizeJson } from './canonical-json';
import { migrationError, object, type JsonObject, type MigrationChange } from './upgrade-types';

export type MigrationReport = {
  fromVersion?: string; toVersion: string; changes: MigrationChange[];
  warnings: string[]; errors: TypedError[];
};
export type PageUpgrade = MigrationReport & (
  { ok: true; changed: boolean; document: PageDocument } | { ok: false }
);
function sourceVersionErrors(document: unknown, target: string): TypedError[] {
  if (target !== versionPolicy.current) return [migrationError('/schemaVersion', `此工具仅写出 ${versionPolicy.current}，目标运行时必须支持该版本；不提供降级`)];
  const version = object(document)?.schemaVersion;
  if (typeof version !== 'string') return [migrationError('/schemaVersion', '迁移需要明确的 schemaVersion，不能根据结构猜版本')];
  const supported = /^5\.[0-4]$/.test(version) || /^6\.(0|[1-9]\d*)$/.test(version) && Number(version.split('.')[1]) <= versionPolicy.minor;
  return supported ? capabilityFloorErrors(document) : [migrationError('/schemaVersion', `没有 ${version} 到 ${target} 的迁移规则；支持 5.0—5.4 和 6.0—${versionPolicy.current}`)];
}

/** Known version-dependent semantics must be resolved before changing the declaration. */
function semanticMigrationErrors(document: JsonObject): TypedError[] {
  const errors: TypedError[] = [];
  if (['6.5', '6.6'].includes(String(document.schemaVersion)) && Array.isArray(document.params) && document.params.length) {
    errors.push(migrationError('/params', '6.5/6.6 数组参数具有旧写入语义；请先显式迁移参数及其查询引用，保留固定值与 initial，再重试'));
  }
  if (['6.13', '6.14'].includes(String(document.schemaVersion))) walkDocumentComponents(document, (component, path) => {
    const ids = object(component.props)?.filterIds;
    if (component.type === 'reportHeader' && Array.isArray(ids) && ids.length) errors.push(migrationError(`${path}/props/filterIds`, '旧页头自动显示筛选期间；需人工确认并显式迁移 asOf.value 的筛选文本引用、组合和无选值文案。此工具暂不自动迁移该语义，不写出结果'));
  });
  return errors;
}

/** Explicit authoring migration only. Runtime acceptance and historical revisions stay unchanged. */
export function upgradePageDocument(input: unknown, target = versionPolicy.current): PageUpgrade {
  const report: MigrationReport = {
    fromVersion: typeof object(input)?.schemaVersion === 'string' ? String(object(input)!.schemaVersion) : undefined,
    toVersion: target, changes: [], warnings: [], errors: sourceVersionErrors(input, target)
  };
  if (report.errors.length) return { ...report, ok: false };
  const original = input as JsonObject;
  report.errors = semanticMigrationErrors(original);
  if (report.errors.length) return { ...report, ok: false };
  const adapted = adaptLegacyPageDocument(input);
  const document = JSON.parse(JSON.stringify(adapted)) as JsonObject;
  report.errors = upgradeChartFilters(document, report.changes);
  if (report.errors.length) return { ...report, ok: false };
  if (canonicalizeJson(input) !== canonicalizeJson(adapted)) report.changes.push({ rule: 'legacy-navigation', path: '/sections', message: '按现有 5.x 兼容规则转换站内导航为 href/query；部署路径需预览核对' });
  document.schemaVersion = target;
  const normalized = normalizePageDocument(document);
  if (!normalized.ok) return { ...report, ok: false, errors: normalized.errors };
  if ('layoutForm' in original) report.changes.push({ rule: 'layout', path: '/layoutForm', message: '旧布局声明转为 layout，保留原形态' });
  if (report.fromVersion !== target) report.changes.push({ rule: 'version', path: '/schemaVersion', message: `${report.fromVersion} → ${target}；已检查能力下限、已知语义断点及完整目标协议` });
  const changed = canonicalizeJson(input) !== canonicalizeJson(normalized.document);
  if (changed && !report.changes.length) report.changes.push({ rule: 'normalization', path: '/', message: '按现有读取边界规范化布局或导出配置' });
  if (changed) report.warnings.push('迁移通过是目标协议静态校验结果；继续开发前预览受影响交互，查询及真实服务需单独验证。');
  return { ...report, ok: true, changed, document: normalized.document };
}
