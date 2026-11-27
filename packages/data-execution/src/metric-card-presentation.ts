import { evaluateCondition, fieldBindingLeaves, fieldName, fieldSlot, type ConditionContext, type MetricCardComponent, type MetricCardRow } from '@metriccanvas/page/internal';
import { referencedStrings } from './compute-demand';
import { projectPresentationData } from './presentation-data';

export function hasConditionalChanges(card: MetricCardComponent): boolean {
  const rows = [...card.props.rows, ...(card.props.secondaryRows ?? [])];
  return rows.some(row => row.changes?.some(change => change.visibleWhen !== undefined));
}

function visibleChanges(rows: MetricCardRow[], context: ConditionContext): MetricCardRow[] {
  return rows.map(row => row.changes ? {
    ...row, changes: row.changes.filter(change => evaluateCondition(change.visibleWhen, context).status === 'allow')
  } : row);
}

/** Keep the primary slot and any supplementary slot referenced by the projected card. */
export function metricCardPresentation(card: MetricCardComponent, context: ConditionContext): MetricCardComponent {
  if (!hasConditionalChanges(card)) return card;
  const props = { ...card.props, rows: visibleChanges(card.props.rows, context) };
  if (props.secondaryRows) props.secondaryRows = visibleChanges(props.secondaryRows, context);
  return projectPresentationData({ ...card, props }, true);
}

/** A name in another slot is a different field. Row matches and navigation
 * payloads are consumers too, even when their values aren't printed. */
export function metricCardFields(card: MetricCardComponent, slot: string): Set<string> {
  const fields = referencedStrings(card.props.actions);
  const rows = [...card.props.rows, ...(card.props.secondaryRows ?? [])];
  const bindings = rows.flatMap(row => [row.valueField, ...(row.changes ?? []).map(change => change.field)]);
  if (card.props.progress) bindings.push(card.props.progress.valueField);
  for (const binding of bindings.flatMap(fieldBindingLeaves)) {
    if (fieldSlot(binding) !== slot) continue;
    fields.add(fieldName(binding));
    if (typeof binding !== 'string' && binding.match) fields.add(binding.match.field);
  }
  return fields;
}
