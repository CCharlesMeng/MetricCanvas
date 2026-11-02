import {rowCellFallback, type DataRow, type DataWarning} from '@metriccanvas/page/internal';
import {ComputationError} from './error';

export interface ComputationDiagnostics {
  sourceId: string;
  warnings: DataWarning[];
  rowCountChanged?: boolean;
}

/** 先验证整组键，再判断缺失，避免另一空键掩盖类型异常。 */
function missingKey(row: DataRow, fields: readonly string[]): boolean {
  let missing = false;
  for (const field of fields) {
    const value = row[field];
    if (rowCellFallback(row, field)) throw new ComputationError('组织键类型不合法');
    if (value == null || (typeof value === 'string' && !value.trim())) {
      missing = true;
      continue;
    }
    if (!['string','number','boolean'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value))) {
      throw new ComputationError('组织键类型不合法');
    }
  }
  return missing;
}

export function keyRows(rows: readonly DataRow[], fields: string[],
  sourceId: string, diagnostics?: ComputationDiagnostics): readonly DataRow[] {
  const usable = rows.filter(row => !missingKey(row, fields));
  const count = rows.length - usable.length;
  if (count && diagnostics) recordSkipped(diagnostics.warnings, sourceId, fields, count);
  return usable;
}

function recordSkipped(warnings: DataWarning[], sourceId: string, fields: string[], count: number): void {
  const identity = JSON.stringify([...fields].sort());
  const previous = warnings.find(warning => warning.code === 'COMPUTE_MISSING_KEY_ROWS' && warning.sourceId === sourceId && JSON.stringify(warning.fields) === identity);
  // 并集和后续关联读取同一来源、同一键组，不重复累计跳过数量。
  if (previous) previous.count = Math.max(previous.count, count);
  else warnings.push({code:'COMPUTE_MISSING_KEY_ROWS',sourceId,fields:[...fields].sort(),message:'已跳过组织键为空的数据行',count});
}
