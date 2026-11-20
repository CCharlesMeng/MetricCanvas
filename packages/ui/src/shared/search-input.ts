const SEARCH_DELAY_MS = 300;

/** Keep the input responsive and apply only the last completed search term. */
export function createSearchInput(
  commit: (value: string) => void,
  draft?: (value: string) => void,
  valueOnClose?: () => string,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;

  function cancel() {
    clearTimeout(timer);
    timer = undefined;
  }

  function set(value: string) {
    draft?.(value);
    cancel();
    timer = setTimeout(() => {
      timer = undefined;
      commit(value);
    }, SEARCH_DELAY_MS);
  }

  function attach(node: HTMLInputElement, enabled = true) {
    const popup = node.closest('[popover]');
    let composing = false;

    function input(event: Event) {
      if (enabled && !composing && !(event as InputEvent).isComposing) set(node.value);
    }

    function startComposition() {
      composing = true;
      cancel();
    }

    function endComposition(event: Event) {
      composing = false;
      input(event);
    }

    function onToggle(event: Event) {
      if ((event as ToggleEvent).newState !== 'closed') return;
      composing = false;
      cancel();
      if (valueOnClose) node.value = valueOnClose();
    }

    node.addEventListener('input', input);
    node.addEventListener('compositionstart', startComposition);
    node.addEventListener('compositionend', endComposition);
    popup?.addEventListener('beforetoggle', onToggle);

    return {
      update(next: boolean) {
        enabled = next;
        if (!enabled) cancel();
      },
      destroy() {
        cancel();
        node.removeEventListener('input', input);
        node.removeEventListener('compositionstart', startComposition);
        node.removeEventListener('compositionend', endComposition);
        popup?.removeEventListener('beforetoggle', onToggle);
      },
    };
  }

  return { attach, set, cancel };
}
