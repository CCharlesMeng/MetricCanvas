<script lang="ts">
  import { dev } from '$app/environment';
  import { Button } from '@metriccanvas/ui';
  let { variants, value, onchange }: {
    variants: { key: string; name: string }[]; value: string; onchange: (value: string) => void;
  } = $props();
  const current = $derived(variants.findIndex(variant => variant.key === value));
  function cycle(direction: number) {
    onchange(variants[(current + direction + variants.length) % variants.length]!.key);
  }
  function keyboard(event: KeyboardEvent) {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('input, textarea, select, button, [contenteditable], [role="combobox"], [role="tablist"]')) return;
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    cycle(event.key === 'ArrowRight' ? 1 : -1);
  }
</script>

<svelte:window onkeydown={keyboard} />
{#if dev}
  <aside class="switcher" aria-label="原型方案切换">
    <Button ariaLabel="上一个方案" onclick={() => cycle(-1)}>←</Button>
    <span><small>原型 {value} / {variants.length}</small>{variants[current]?.name}</span>
    <Button ariaLabel="下一个方案" onclick={() => cycle(1)}>→</Button>
  </aside>
{/if}

<style>
  .switcher { position: fixed; z-index: 30; bottom: 22px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 20px; background: #18181b; color: white; padding: 10px 14px; border-radius: 12px; box-shadow: 0 8px 30px #0002; }
  span { min-width: 118px; display: grid; gap: 3px; text-align: center; font-size: 13px; }
  small { color: #aaa; font-size: 10px; }
  @media print { .switcher { display: none; } }
</style>
