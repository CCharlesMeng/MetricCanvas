export interface ComposerKeydownState {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
}

export function shouldSubmitComposerKeydown(event: ComposerKeydownState): boolean {
  return event.key === 'Enter' && !event.shiftKey && !event.isComposing;
}

export function canSubmitComposer(value: string, running: boolean): boolean {
  return !running && value.trim().length > 0;
}
