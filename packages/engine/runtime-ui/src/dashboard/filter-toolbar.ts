import type { CompositeCardComponent } from '@metriccanvas/page/internal';

/** Only the explicit toolbar layout consumes the leading fixed controls. */
export function compositeFilterToolbar(component: CompositeCardComponent) {
  const left: number[] = [], right: number[] = [];
  if (component.props.filterLayout !== 'toolbar') return {left, right, count: 0};
  for (const [index, child] of component.props.components.entries()) {
    if (child.type !== 'filterGroup') break;
    (child.props.align === 'right' ? right : left).push(index);
  }
  return {left, right, count: left.length + right.length};
}
