import type { Presentation } from '../../runtime/src/presentation';
export const PRESENTATION_CONTEXT=Symbol('metriccanvas.presentation');
export type PresentationReader=()=>Presentation|null;
