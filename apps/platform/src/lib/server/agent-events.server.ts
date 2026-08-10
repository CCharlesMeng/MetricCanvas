import type { AgentEvent } from './agent/types';

export function validatedAgentDocument(
  events: AgentEvent[]
): Record<string, unknown> | null {
  for (const event of [...events].reverse()) {
    if (
      event.type === 'tool_finished' &&
      event.call.name === 'validate_page' &&
      isRecord(event.result.structuredContent) &&
      event.result.structuredContent.valid === true &&
      isRecord(event.call.input) &&
      isRecord(event.call.input.document)
    ) {
      return event.call.input.document;
    }
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
