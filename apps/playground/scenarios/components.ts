import { componentCatalog } from '@metriccanvas/page';

export const playgroundComponents = [...componentCatalog];
export type PlaygroundComponentType = typeof playgroundComponents[number]['type'];
