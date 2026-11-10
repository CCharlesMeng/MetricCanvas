import { walkDocumentComponents } from '../component-walk';
import { visitTableColumns } from './columns';
import { object, type JsonObject, type MigrationChange } from '../upgrade-types';

/** Earlier pages always showed search for dynamic candidates, never for fixed enums. */
export function legacyTableCandidateSearch(schemaVersion: string): boolean {
  return /^5\.[0-4]$/.test(schemaVersion) || /^6\.\d+$/.test(schemaVersion) && Number(schemaVersion.split('.')[1]) < 112;
}

type VisitSearch = (filterable: JsonObject, path: string) => void;

function visitSearchColumns(columns: unknown, path: string, visit: VisitSearch): void {
  if (!Array.isArray(columns)) return;
  visitTableColumns(columns, path, (column, own) => {
    const node = object(column), filterable = object(node?.filterable);
    if (filterable?.mode === 'select' && node?.enumValues === undefined) visit(filterable, own+'/filterable/showSearch');
  });
}

function visitSearchFilters(document: unknown, visit: VisitSearch): void {
  walkDocumentComponents(document, (component, path) => {
    if (component.type !== 'table') return;
    const props = object(component.props);
    visitSearchColumns(props?.columns, path+'/props/columns', visit);
    visitSearchColumns(object(object(props?.rowExpansion)?.table)?.columns, path+'/props/rowExpansion/table/columns', visit);
  });
}

/** Normalization cannot silently adopt the new omission while old search is still implicit. */
export function hasLegacyTableCandidateSearch(document: unknown): boolean {
  if (!legacyTableCandidateSearch(String(object(document)?.schemaVersion))) return false;
  let implicit = false;
  visitSearchFilters(document, filterable => { if (filterable.showSearch === undefined) implicit = true; });
  return implicit;
}

/** Resolve the old omission before raising the document version; never rewrite source input. */
export function upgradeTableCandidateSearch(document: JsonObject, changes: MigrationChange[]): void {
  if (!legacyTableCandidateSearch(String(document.schemaVersion))) return;
  visitSearchFilters(document, (filterable, path) => {
    if (filterable.showSearch !== undefined) return;
    filterable.showSearch = true;
    changes.push({rule:'table-filter-search',path,message:'显式保留旧页面的动态候选搜索框；新页面省略时默认隐藏'});
  });
}
