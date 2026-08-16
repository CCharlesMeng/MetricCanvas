<script lang="ts">
  import { dev } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';

  type Variant = {
    key: string;
    name: string;
    summary: string;
  };

  let {
    variant,
    variants
  }: {
    variant: string;
    variants: readonly Variant[];
  } = $props();

  const currentIndex = $derived(Math.max(0, variants.findIndex((item) => item.key === variant)));
  const current = $derived(variants[currentIndex]);

  function switchTo(offset: number) {
    const nextIndex = (currentIndex + offset + variants.length) % variants.length;
    const nextUrl = new URL(page.url);
    nextUrl.searchParams.set('variant', variants[nextIndex].key);
    void goto(nextUrl, { replaceState: true, noScroll: true, keepFocus: true });
  }

  function handleKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (target?.matches('input, textarea, [contenteditable="true"]')) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      switchTo(-1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      switchTo(1);
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if dev}
  <aside class="prototype-switcher" aria-label="原型方案切换器">
    <button type="button" aria-label="上一个方案" onclick={() => switchTo(-1)}>←</button>
    <div class="prototype-state" aria-live="polite">
      <span class="eyebrow">THROWAWAY PROTOTYPE · {currentIndex + 1}/{variants.length}</span>
      <strong>{current.key} — {current.name}</strong>
      <span>{current.summary}</span>
    </div>
    <button type="button" aria-label="下一个方案" onclick={() => switchTo(1)}>→</button>
  </aside>
{/if}

<style>
  .prototype-switcher {
    position: fixed;
    z-index: 2000;
    left: 50%;
    bottom: 18px;
    display: grid;
    grid-template-columns: 38px minmax(340px, 520px) 38px;
    gap: 10px;
    align-items: center;
    width: min(680px, calc(100vw - 32px));
    padding: 9px;
    color: #f8fafc;
    background: rgb(9 12 18 / 94%);
    border: 1px solid rgb(255 255 255 / 14%);
    border-radius: 14px;
    box-shadow: 0 18px 48px rgb(0 0 0 / 28%);
    backdrop-filter: blur(16px);
  }

  button {
    display: grid;
    place-items: center;
    height: 38px;
    color: #f8fafc;
    background: #242a35;
    border: 1px solid #343c4a;
    border-radius: 9px;
    font-size: 18px;
    cursor: pointer;
  }

  button:hover,
  button:focus-visible {
    background: #343c4a;
    outline: 2px solid #818cf8;
    outline-offset: 1px;
  }

  .prototype-state {
    display: grid;
    gap: 2px;
    min-width: 0;
    text-align: center;
  }

  .prototype-state strong {
    font-size: 12px;
    letter-spacing: 0.01em;
  }

  .prototype-state > span:last-child {
    overflow: hidden;
    color: #aab2c1;
    font-size: 10.5px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .eyebrow {
    color: #818cf8;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.11em;
  }

  @media (max-width: 760px) {
    .prototype-switcher {
      grid-template-columns: 38px minmax(0, 1fr) 38px;
    }

    .prototype-state > span:last-child {
      display: none;
    }
  }
</style>
