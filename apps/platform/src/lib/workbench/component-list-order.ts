import {normalizeAuthoringDropTarget, type AuthoringDraftSection, type AuthoringIntent} from '@metriccanvas/metric-canvas/types';

function positionOf(sections: readonly AuthoringDraftSection[], componentId: string) {
  for (const section of sections) {
    const index = section.componentIds.indexOf(componentId);
    if (index >= 0) return {sectionId: section.id, index, count: section.componentIds.length};
  }
  return null;
}

/** List drop positions use the same pre-removal slots as canvas moves. */
export function componentListMove(
  sections: readonly AuthoringDraftSection[], sourceId: string, targetId: string, after: boolean
): Extract<AuthoringIntent, {type: 'move_component'}> | null {
  const source = positionOf(sections, sourceId), target = positionOf(sections, targetId);
  if (!source || !target) return null;
  const destination = {sectionId: target.sectionId, index: target.index + Number(after)};
  if (normalizeAuthoringDropTarget(source, destination, target.count).kind !== 'move') return null;
  return {type: 'move_component', locator: {sectionId: source.sectionId, componentId: sourceId}, destination};
}
