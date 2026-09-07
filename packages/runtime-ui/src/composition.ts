/** 跨包组合 Interface，须由 #100 纳入发布兼容门禁；不从默认入口导出。 */
export { default as RuntimeSurface } from './RuntimeSurface.svelte';
export { default as RuntimeSection } from './RuntimeSection.svelte';
export type { ComponentContent, RuntimeSectionProps, RuntimeSurfaceProps } from './composition-types';
export { sectionGridColumnCount } from './section-grid';
