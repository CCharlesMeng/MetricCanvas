/**
 * 页面协议的对外契约面（ADR-0071）。
 *
 * 这里的每个名字都是对集成应用的稳定承诺，因此只放外部自行校验页面文档真正
 * 需要的东西。其余一切——组件属性类型、查询与字段类型、行与快照类型、导航与
 * 计算辅助——都在 `./internal`，仅供本仓自用，不承诺稳定。
 *
 * 错误闭集不在这里：`TypedError` 已经带着它，要给 `err.type` 命名写
 * `TypedError['type']` 即可。运行时数组 `ERROR_TYPES` 是跨语言契约的真源，
 * 但 Java 与 Python 读的是 `contracts/metriccanvas/` 生成的快照而非 npm
 * （ADR-0061），所以它不需要出现在这个面上。
 */
export type { Page } from './page';
export type { PageDocument } from './page-document';
export type { TypedError } from './errors';
export { parsePage, validate } from './validate';
export { versionPolicy, supportedVersions } from './version';
export { pageSchema } from './schema';
export { componentCatalog } from './component-catalog';
export { canonicalizeJson } from './canonical-json';
