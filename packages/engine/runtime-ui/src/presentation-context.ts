import type { Presentation } from '../../runtime/src/internal';
export const PRESENTATION_CONTEXT=Symbol('metriccanvas.presentation');
export type PresentationReader=()=>Presentation|null;
