import type { TypedError } from './errors';

/**
 * 页面文件名(去扩展名)须与 Page.id 一致(切片1 评审遗留):
 * 同一性由 id 承载,静态文件仓储按文件名寻址,二者不一致会导致"URL 能开、校验的却是别人"。
 * 文件名属于 Git 存储形态(ADR-0004),不进 validate 签名,由 validate CLI 组合调用。
 */
export function fileNameErrors(fileName: string, document: unknown): TypedError[] {
  const stem = fileName.replace(/\.json$/, '');
  const id = (document as { id?: unknown } | null)?.id;
  // id 缺失或非字符串由结构校验负责报错,这里不重复
  if (typeof id !== 'string' || id === stem) {
    return [];
  }
  return [
    {
      type: 'SCHEMA_ERROR',
      path: '/id',
      message: `页面文件名(${stem})与 Page.id(${id})不一致:同一性由 id 承载,须重命名文件或修改 id`
    }
  ];
}
