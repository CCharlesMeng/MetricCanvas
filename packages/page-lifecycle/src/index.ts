export { createMemoryPageLifecycle } from './memory';
export type { MemoryPageLifecycleOptions } from './memory';
export * from './types';

// 通用工具单点导出:template-library 等下游复用,不再各持字节级副本。
// 注意:只导出与页面/模板治理语义无关的通用件,发布内核不共享(ADR-0024 待决)。
export { hash } from './invariants';
