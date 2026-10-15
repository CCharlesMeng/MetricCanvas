<script lang="ts">
  // PROTOTYPE: year/quarter extensions only. Month uses the existing OS DatePicker. Rolling mode has no picker.
  import { tick, untrack } from 'svelte';
  import { DatePicker } from '../../src';
  import DatePickerIcon from '../../src/components/date-picker/DatePickerIcon.svelte';
  let { mode, anchor, onchange }: { mode: string; anchor: string; onchange: (date: string) => void } = $props();
  let open = $state(false);
  let yearView = $state(false);
  let viewYear = $state(2026);
  let trigger = $state<HTMLButtonElement>(null!);
  let panel = $state<HTMLDivElement>(null!);
  let left = $state(0), top = $state(0);
  const year = $derived(Number(anchor.slice(0,4)));
  const quarter = $derived(Math.ceil(Number(anchor.slice(5,7))/3));
  const decade = $derived(Math.floor(viewYear/10)*10);
  const years = $derived(Array.from({length:12}, (_, i) => decade - 1 + i));
  const text = $derived(mode === 'year' ? `${year} 年` : `${year} 年 Q${quarter}`);
  async function show() {
    viewYear = year; yearView = mode === 'year'; open = true;
    await tick();
    const box = trigger.getBoundingClientRect();
    left = Math.max(8, Math.min(box.left, window.innerWidth - 368));
    top = box.bottom + 6;
    panel.showPopover();
    await tick();
    const height = panel.getBoundingClientRect().height;
    if (top + height > window.innerHeight - 8) top = Math.max(8, box.top - height - 6);
    panel.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
  }
  function close() { if (open) { panel?.hidePopover(); open = false; } }
  function choose(y: number, m: number) {
    const day = Math.min(Number(anchor.slice(8)), new Date(y, m, 0).getDate());
    onchange(`${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`);
    close(); trigger.focus();
  }
  $effect(() => { mode; untrack(close); });
</script>

<svelte:window onpointerdown={e => { if (open && !panel?.contains(e.target as Node) && !trigger?.contains(e.target as Node)) close(); }} onkeydown={e => { if(e.key === 'Escape' && open) { close(); trigger.focus(); } }} onresize={close} />

{#if mode === 'month'}
  {#key mode}
    <div class="shared-picker">
      <DatePicker precision="month" required
        label="选择月份"
        value={{from: anchor.slice(0,7), to: anchor.slice(0,7)}}
        onchange={v => { if(v) onchange(`${v.from}-01`); }} />
    </div>
  {/key}
{:else}
  <button class="date-input" bind:this={trigger!} aria-label={mode === 'year' ? '选择年份' : '选择季度'} aria-haspopup="dialog" aria-expanded={open} onclick={() => open ? close() : show()}>
    <span>{text}</span><DatePickerIcon name="calendar" />
  </button>
  {#if open}
    <div class="period-panel" bind:this={panel!} role="dialog" aria-label={mode === 'year' ? '年份选择器' : '季度选择器'} popover="manual" style:left={`${left}px`} style:top={`${top}px`}>
      <header>
        <button class="arrow" aria-label={yearView ? '前十年' : '上一年'} onclick={() => viewYear -= yearView ? 10 : 1}><DatePickerIcon name={yearView ? 'double-left' : 'left'} /></button>
        <button class="heading" onclick={() => yearView = true}>{yearView ? `${decade} 年 — ${decade + 9} 年` : `${viewYear} 年`}</button>
        <button class="arrow" aria-label={yearView ? '后十年' : '下一年'} onclick={() => viewYear += yearView ? 10 : 1}><DatePickerIcon name={yearView ? 'double-right' : 'right'} /></button>
      </header>
      {#if yearView}
        <div class="year-grid">
          {#each years as y}
            <button class:muted={y < decade || y > decade + 9} aria-pressed={y === year} onclick={() => { if(mode === 'year') choose(y,Number(anchor.slice(5,7))); else {viewYear = y; yearView = false;} }}>{y}</button>
          {/each}
        </div>
      {:else}
        <div class="quarter-grid">
          {#each [1,2,3,4] as q}
            <button aria-pressed={viewYear === year && q === quarter} onclick={() => choose(viewYear,(q-1)*3+1)}><span>Q{q}</span><small>{(q-1)*3+1} — {q*3} 月</small></button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
{/if}

<style>
  .shared-picker { --mc-date-picker-width:220px; --mc-filter-label-display:none; }
  button { font:inherit; cursor:pointer; color:#191919; }
  button:focus-visible { outline:2px solid #1476ff; outline-offset:2px; }
  .date-input { box-sizing:border-box; display:flex; align-items:center; justify-content:space-between; height:32px; width:220px; padding:0 12px; background:#fff; border:1px solid #c2c2c2; border-radius:6px; font-size:14px; }
  .date-input :global(svg) { color:#808080; }
  .date-input:hover,.date-input[aria-expanded=true] { border-color:#191919; }
  .period-panel { position:fixed; inset:auto; margin:0; width:360px; max-width:calc(100vw - 16px); padding:0; border:0; border-radius:6px; background:#fff; color:#191919; box-shadow:0 4px 16px #00000014; font:14px/1.5 Helvetica,Arial,'PingFang SC','Microsoft YaHei',sans-serif; }
  header { display:flex; align-items:center; justify-content:space-between; padding:12.5px 16px; border-bottom:1px solid #f0f0f0; }
  .arrow,.heading { padding:0; border:0; background:none; line-height:21px; }
  .arrow { color:#808080; }
  .heading:hover { color:#1476ff; }
  .year-grid { display:grid; grid-template-columns:repeat(4,1fr); padding:12px 16px 20px; row-gap:32px; }
  .year-grid button { border:0; background:none; border-radius:999px; height:28px; }
  .year-grid button.muted { color:#808080; }
  .year-grid button:hover { background:#deecff; }
  .year-grid button[aria-pressed=true] { background:#1476ff; color:#fff; }
  .quarter-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; padding:20px 16px; }
  .quarter-grid button { display:grid; gap:4px; padding:12px; border:1px solid #f0f0f0; border-radius:6px; background:#fff; }
  .quarter-grid small { color:#808080; font-size:12px; }
  .quarter-grid button:hover { background:#deecff; }
  .quarter-grid button[aria-pressed=true] { background:#deecff; color:#1476ff; border-color:#1476ff; }
  .quarter-grid button[aria-pressed=true] small { color:#1476ff; }
</style>
