<script lang="ts">
  import { tick, untrack } from 'svelte';
  import type { TimeRangeValue } from '@metriccanvas/page/internal';
  import DatePickerIcon from './DatePickerIcon.svelte';
  import { calendarDays, calendarMonths, calendarView, calendarValue, shiftCalendar, moveCalendarValue, calendarDraft, type CalendarPrecision, type CalendarCell } from './date-picker';

  interface Props {
    label?: string;
    precision: CalendarPrecision;
    range?: boolean;
    required?: boolean;
    disabled?: boolean;
    value: TimeRangeValue | null;
    onchange: (value: TimeRangeValue | null) => void;
  }
  let { label, precision, range = false, required = false, disabled = false, value, onchange }: Props = $props();
  const id = $props.id();
  let anchor: HTMLDivElement;
  let panel = $state<HTMLDivElement>();
  let firstInput: HTMLInputElement;
  let open = $state(false);
  let from = $state(untrack(() => value?.from ?? ''));
  let to = $state(untrack(() => value?.to ?? ''));
  let error = $state('');
  let view = $state(untrack(() => calendarView(value?.from ?? '')));
  let level = $state<'date' | 'month' | 'year'>(untrack(() => precision));
  let start = $state('');
  let hover = $state('');
  let active = $state('');
  let left = $state(0);
  let top = $state(0);
  const today = $derived(calendarValue(new Date(), precision));
  const boards = $derived(range ? [view, precision === 'month' ? { year: view.year + 1, month: 1 } : shiftCalendar(view, 1)] : [view]);
  const selectedFrom = $derived(start ? (hover && hover < start ? hover : start) : value?.from ?? '');
  const selectedTo = $derived(start ? (hover && hover > start ? hover : start) : value?.to ?? '');

  function resetDraft() { from = value?.from ?? ''; to = value?.to ?? ''; start = ''; hover = ''; error = ''; }
  $effect(() => { value; precision; range; untrack(() => { resetDraft(); open = false; }); });
  $effect(() => { if (disabled) open = false; });

  function position() {
    if (!anchor || !panel) return;
    const win = anchor.ownerDocument.defaultView;
    if (!win) return;
    const rect = anchor.getBoundingClientRect();
    const viewport = win.visualViewport;
    const x = viewport?.offsetLeft ?? 0;
    const y = viewport?.offsetTop ?? 0;
    const width = viewport?.width ?? win.innerWidth;
    const height = viewport?.height ?? win.innerHeight;
    const panelWidth = Math.min(range ? 558 : 360, width - 16);
    const panelHeight = Math.min(panel.scrollHeight, height - 16);
    left = Math.max(x + 8, Math.min(rect.left, x + width - panelWidth - 8));
    top = rect.bottom + 4 + panelHeight <= y + height - 8 ? rect.bottom + 4 : Math.max(y + 8, rect.top - panelHeight - 4);
    if (rect.bottom < y || rect.top > y + height || rect.right < x || rect.left > x + width) open = false;
  }
  // The top-layer popover stays in its original root: Svelte styles and ShadowRoot
  // inheritance remain intact. Listeners/observer exist only while it is open.
  $effect(() => {
    if (!open || !panel || !anchor) return;
    const openedPanel = panel;
    const doc = anchor.ownerDocument;
    const win = doc.defaultView!;
    openedPanel.showPopover();
    position();
    const outside = (event: Event) => { if (!event.composedPath().includes(anchor) && !event.composedPath().includes(openedPanel)) open = false; };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close(true); } };
    doc.addEventListener('pointerdown', outside, true);
    doc.addEventListener('focusin', outside, true);
    doc.addEventListener('keydown', escape, true);
    doc.addEventListener('scroll', position, true);
    win.addEventListener('resize', position);
    win.visualViewport?.addEventListener('resize', position);
    win.visualViewport?.addEventListener('scroll', position);
    const observer = new ResizeObserver(position);
    observer.observe(anchor);
    return () => {
      if (openedPanel.matches(':popover-open')) openedPanel.hidePopover();
      doc.removeEventListener('pointerdown', outside, true);
      doc.removeEventListener('focusin', outside, true);
      doc.removeEventListener('keydown', escape, true);
      doc.removeEventListener('scroll', position, true);
      win.removeEventListener('resize', position);
      win.visualViewport?.removeEventListener('resize', position);
      win.visualViewport?.removeEventListener('scroll', position);
      observer.disconnect();
    };
  });

  function show() {
    if (disabled || open) return;
    resetDraft(); view = calendarView(value?.from ?? ''); level = precision;
    active = value?.from ?? today; open = true;
  }
  function close(focus = false) { open = false; start = ''; hover = ''; if (focus) firstInput?.focus(); }
  function submit() {
    if (disabled) return;
    const result = calendarDraft(from.trim(), to.trim(), precision, range, required);
    error = result.ok ? '' : result.error;
    if (result.ok) { onchange(result.value); close(); }
  }
  function clear() { if (required || disabled) return; onchange(null); resetDraft(); close(true); }
  function navigate(months: number) {
    const next = shiftCalendar(view, months);
    if (next.year >= 1 && next.year <= 9998) view = next;
  }
  function years() {
    const first = Math.floor(view.year / 10) * 10;
    return Array.from({ length: 3 }, (_, row) => Array.from({ length: 4 }, (_, col) => {
      const year = first + row * 4 + col;
      return { value: String(year), label: year, adjacent: null };
    })).map((row, i) => i === 2 ? row.slice(0, 2) : row);
  }
  function choose(cell: CalendarCell) {
    if (disabled) return;
    if (level === 'year') { view = { ...view, year: cell.label }; level = 'month'; return; }
    if (level === 'month' && precision === 'date') { view = calendarView(cell.value); level = 'date'; return; }
    active = cell.value;
    if (!range) { from = cell.value; submit(); return; }
    if (!start) { start = cell.value; hover = ''; return; }
    from = start < cell.value ? start : cell.value;
    to = start < cell.value ? cell.value : start;
    submit();
  }
  function cellClass(cell: CalendarCell) {
    const picking = level === precision;
    const current = picking && !range && cell.value === value?.from;
    const inRange = picking && range && !!selectedFrom && !!selectedTo && cell.value >= selectedFrom && cell.value <= selectedTo;
    return [cell.adjacent ?? (level === 'date' ? 'available' : ''),
      picking && cell.value === today ? 'today' : '', current ? 'current' : '',
      inRange ? 'in-range' : '', picking && range && cell.value === selectedFrom ? 'start-date' : '',
      picking && range && cell.value === selectedTo ? 'end-date' : ''].filter(Boolean).join(' ');
  }
  async function focusCell(value: string) {
    await tick();
    if (!panel) return;
    const button = [...panel.querySelectorAll<HTMLButtonElement>('[data-calendar-value]')].find(b => b.dataset.calendarValue === value);
    button?.focus();
    button?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  async function inputKey(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') { event.preventDefault(); show(); await tick(); await focusCell(active); }
    else if (event.key === 'Enter') { event.preventDefault(); if (from) submit(); else show(); }
    else if (event.key === 'Escape') { resetDraft(); close(); }
  }
  async function cellKey(event: KeyboardEvent, cell: CalendarCell) {
    const columns = level === 'date' ? 7 : 4;
    const amount = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns }[event.key];
    if (amount !== undefined) {
      event.preventDefault();
      if (level === 'year') { const year = cell.label + amount; if (year < 1 || year > 9998) return; active = String(year); view = { ...view, year }; }
      else { active = moveCalendarValue(cell.value, level, amount); view = calendarView(active); }
      if (start) hover = active;
      await focusCell(active);
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      navigate((event.key === 'PageUp' ? -1 : 1) * (level === 'year' ? 120 : level === 'month' || event.shiftKey ? 12 : 1));
      active = level === 'year' ? String(view.year) : `${String(view.year).padStart(4, '0')}-${String(view.month).padStart(2, '0')}${level === 'date' ? '-01' : ''}`;
      await focusCell(active);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const table = event.currentTarget instanceof HTMLElement ? event.currentTarget.closest('tr') : null;
      const cells = table?.querySelectorAll<HTMLButtonElement>('[data-calendar-value]');
      (event.key === 'Home' ? cells?.[0] : cells?.[cells.length - 1])?.focus();
    }
  }
</script>

<div class="mc-date-picker" data-date-picker={range ? `${precision}range` : precision}>
  {#if label}<span class="mc-date-label">{label}</span>{/if}
  <div class="tiny-date-editor" class:tiny-range-editor={range} class:is-active={open} class:is-disabled={disabled} bind:this={anchor}>
    <input bind:this={firstInput} class:tiny-range-input={range} class:tiny-input__inner={!range}
      type="text" autocomplete="off" aria-label={range ? `${label ?? '期间'}开始` : label ?? '日期'}
      role="combobox" aria-haspopup="dialog" aria-expanded={open} aria-controls={id}
      aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
      placeholder={range ? precision === 'month' ? '开始月份' : '开始日期' : precision === 'month' ? '请选择月份' : '请选择日期'}
      {disabled} {required} value={disabled ? value?.from ?? '' : from}
      onclick={show} onkeydown={inputKey} oninput={e => { from = e.currentTarget.value; error = ''; }} onchange={submit} />
    {#if range}
      <span class="tiny-range-separator" aria-hidden="true">-</span>
      <input class="tiny-range-input" type="text" autocomplete="off" aria-label={`${label ?? '期间'}结束`}
        aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
        placeholder={precision === 'month' ? '结束月份' : '结束日期'}
        {disabled} {required} value={disabled ? value?.to ?? '' : to}
        onclick={show} onkeydown={inputKey} oninput={e => { to = e.currentTarget.value; error = ''; }} onchange={submit} />
    {/if}
    <button type="button" class="mc-picker-icon mc-calendar-icon" tabindex="-1" {disabled} aria-label="打开日期选择器" onclick={show}><DatePickerIcon name="calendar" /></button>
    {#if value && !required && !disabled}
      <button type="button" class="mc-picker-icon mc-clear-icon" aria-label={range ? '清除时间范围' : '清除时间点'} title={range ? '清除时间范围' : '清除时间点'} onclick={clear}><DatePickerIcon name="clear" /></button>
    {/if}
  </div>
  {#if error}<span class="mc-date-error" id={`${id}-error`} role="status">{error}</span>{/if}
  {#if open}
    <div class="mc-date-popover" bind:this={panel} {id} popover="manual" role="dialog" aria-label={label ?? '日期选择器'} style:left={`${left}px`} style:top={`${top}px`}>
      <div class="tiny-picker-panel" class:tiny-date-picker={!range} class:tiny-date-range-picker={range}>
        <div class="tiny-picker-panel__body-wrapper"><div class="tiny-picker-panel__body">
          {#if !range}
            <div class="tiny-date-picker__header">
              <button type="button" class="tiny-picker-panel__icon-btn tiny-date-picker__prev-btn" aria-label="前一年" onclick={() => navigate(level === 'year' ? -120 : -12)}><DatePickerIcon name="double-left" /></button>
              {#if level === 'date'}<button type="button" class="tiny-picker-panel__icon-btn tiny-date-picker__prev-btn" aria-label="上个月" onclick={() => navigate(-1)}><DatePickerIcon name="left" /></button>{/if}
              <button type="button" class="tiny-date-picker__header-label" onclick={() => level = 'year'}>{level === 'year' ? `${Math.floor(view.year / 10) * 10} 年 - ${Math.floor(view.year / 10) * 10 + 9} 年` : `${view.year} 年`}</button>
              {#if level !== 'year'}<button type="button" class="tiny-date-picker__header-label" onclick={() => level = 'month'}>{view.month} 月</button>{/if}
              <button type="button" class="tiny-picker-panel__icon-btn tiny-date-picker__next-btn" aria-label="后一年" onclick={() => navigate(level === 'year' ? 120 : 12)}><DatePickerIcon name="double-right" /></button>
              {#if level === 'date'}<button type="button" class="tiny-picker-panel__icon-btn tiny-date-picker__next-btn" aria-label="下个月" onclick={() => navigate(1)}><DatePickerIcon name="right" /></button>{/if}
            </div>
          {/if}
          {#each boards as board, side}
            <div class="tiny-picker-panel__content" class:tiny-date-range-picker__content={range} class:is-left={range && side === 0} class:is-right={range && side === 1}>
              {#if range}
                <div class="tiny-date-range-picker__header">
                  {#if side === 0}
                    <button type="button" class="tiny-picker-panel__icon-btn tiny-icon-d-arrow-left" aria-label="前一年" onclick={() => navigate(-12)}><DatePickerIcon name="double-left" /></button>
                    {#if precision === 'date'}<button type="button" class="tiny-picker-panel__icon-btn tiny-icon-arrow-left" aria-label="上个月" onclick={() => navigate(-1)}><DatePickerIcon name="left" /></button>{/if}
                  {:else}
                    <button type="button" class="tiny-picker-panel__icon-btn tiny-icon-d-arrow-right" aria-label="后一年" onclick={() => navigate(12)}><DatePickerIcon name="double-right" /></button>
                    {#if precision === 'date'}<button type="button" class="tiny-picker-panel__icon-btn tiny-icon-arrow-right" aria-label="下个月" onclick={() => navigate(1)}><DatePickerIcon name="right" /></button>{/if}
                  {/if}
                  <div>{board.year} 年{precision === 'date' ? ` ${board.month} 月` : ''}</div>
                </div>
              {/if}
              <div class:tiny-date-range-picker__table={range} class:tiny-picker-panel__table={!range}>
                <table class:tiny-date-table={level === 'date'} class:tiny-month-table={level === 'month'} class:tiny-year-table={level === 'year'} cellspacing="0" cellpadding="0">
                  <tbody>
                    {#if level === 'date'}<tr class="tiny-date-table__week">{#each ['日','一','二','三','四','五','六'] as day}<th scope="col">{day}</th>{/each}</tr>{/if}
                    {#each level === 'date' ? calendarDays(board) : level === 'month' ? calendarMonths(board.year) : years() as row}
                      <tr class:tiny-date-table__row={level === 'date'}>
                        {#each row as cell}
                          <td class={cellClass(cell)}>
                            <div>
                              {#if level === 'date'}
                                <span><button type="button" class="mc-day" data-calendar-value={cell.value} aria-label={cell.value} aria-pressed={cell.value === selectedFrom || cell.value === selectedTo}
                                  onfocus={() => active = cell.value} onpointerenter={() => { if (start) hover = cell.value; }} onkeydown={e => cellKey(e, cell)} onclick={() => choose(cell)}>{cell.label}</button></span>
                              {:else}
                                <button type="button" class="cell" data-calendar-value={cell.value} aria-label={cell.value} aria-pressed={cell.value === selectedFrom || cell.value === selectedTo}
                                  onfocus={() => active = cell.value} onpointerenter={() => { if (start) hover = cell.value; }} onkeydown={e => cellKey(e, cell)} onclick={() => choose(cell)}>{cell.label}{level === 'month' ? ' 月' : ''}</button>
                              {/if}
                            </div>
                          </td>
                        {/each}
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          {/each}
        </div></div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* OS theme CSS, derived from the frozen official 2026-10-11 assets.
     TinyVue Authors / Huawei Cloud, MIT; see tiny-vue-LICENSE.txt.
     Kept in Svelte so embed emitCss:false installs it in the mounting root. */
  .mc-date-picker { display:flex; align-items:center; flex-wrap:wrap; gap:8px; min-width:0; max-width:100%; color:#191919; font:14px/21px Helvetica,Arial,PingFangSC-Regular,'Hiragino Sans GB','Microsoft YaHei',微软雅黑,'Microsoft JhengHei'; }
  .mc-date-label { display:var(--mc-filter-label-display,inline); white-space:nowrap; color:#71717a; }
  .tiny-date-editor { position:relative; width:var(--mc-date-picker-width,240px); max-width:100%; height:32px; box-sizing:border-box; }
  .tiny-range-editor { display:inline-flex; align-items:center; width:var(--mc-date-picker-width,360px); padding:3px 10px; border:1px solid #c2c2c2; border-radius:6px; background:#fff; }
  .tiny-input__inner { box-sizing:border-box; width:100%; height:32px; padding:0 40px 0 12px; border:1px solid #c2c2c2; border-radius:6px; background:#fff; color:#191919; font:inherit; line-height:32px; outline:0; }
  .tiny-range-input { box-sizing:border-box; width:39%; min-width:0; height:100%; padding:0; border:0; outline:0; background:inherit; color:#191919; font:inherit; line-height:1; text-align:left; }
  input::placeholder { color:#999; opacity:1; }
  .tiny-range-separator { box-sizing:border-box; width:12%; height:100%; padding:0 5px; line-height:22px; text-align:center; }
  .tiny-range-editor:hover,.tiny-range-editor.is-active,.tiny-range-editor:focus-within { border-color:#191919; }
  .tiny-date-editor:hover .tiny-input__inner,.tiny-date-editor.is-active .tiny-input__inner,.tiny-input__inner:focus { border-color:#191919; }
  .tiny-date-editor.is-disabled { color:#c2c2c2; cursor:not-allowed; }
  .is-disabled.tiny-range-editor,.is-disabled .tiny-input__inner { border-color:transparent; background:#f0f0f0; color:#c2c2c2; }
  .is-disabled input { color:#c2c2c2; cursor:not-allowed; }
  .mc-picker-icon { position:absolute; right:12px; top:0; display:flex; align-items:center; justify-content:center; height:32px; width:16px; padding:0; border:0; background:transparent; color:#808080; cursor:pointer; }
  .mc-picker-icon:hover { color:#191919; }
  .mc-picker-icon:disabled { color:#c2c2c2; cursor:not-allowed; }
  .mc-clear-icon { visibility:hidden; }
  .tiny-date-editor:hover .mc-clear-icon,.tiny-date-editor:focus-within .mc-clear-icon,.tiny-date-editor.is-active .mc-clear-icon { visibility:visible; }
  .tiny-date-editor:has(.mc-clear-icon):hover .mc-calendar-icon,.tiny-date-editor:has(.mc-clear-icon):focus-within .mc-calendar-icon,.tiny-date-editor.is-active:has(.mc-clear-icon) .mc-calendar-icon { visibility:hidden; }
  .mc-date-error { flex-basis:100%; color:#b91c1c; font-size:12px; }
  .mc-date-popover { position:fixed; inset:auto; margin:0; padding:0; border:0; border-radius:6px; background:#fff; color:#191919; box-shadow:0 4px 16px rgba(0,0,0,.08); max-width:calc(100vw - 16px); max-height:calc(100dvh - 16px); overflow:auto; font:14px/21px Helvetica,Arial,PingFangSC-Regular,'Hiragino Sans GB','Microsoft YaHei',微软雅黑,'Microsoft JhengHei'; }
  .mc-date-popover::backdrop { background:transparent; }
  :global(.mc-date-picker .tiny-picker-panel *) { box-sizing:border-box; }
  :global(.mc-date-picker .tiny-picker-panel button) { font-family:inherit; font-weight:400; }
  :global(.mc-date-picker .tiny-picker-panel .cell),:global(.mc-date-picker .tiny-picker-panel .mc-day) { border:0; margin:0; font:inherit; background:none; cursor:pointer; }
  :global(.mc-date-picker .tiny-picker-panel .mc-day) { padding:0; width:100%; height:100%; color:inherit; }
  :global(.mc-date-picker .tiny-picker-panel button:focus-visible) { outline:2px solid #1476ff; outline-offset:1px; }
  :global(.mc-date-picker .tiny-date-picker__header-label) { display:inline; border:0; margin:0; background:none; color:inherit; font:inherit; line-height:21px; }

  :global(.mc-date-picker .tiny-date-table) { font-size:14px;-ms-user-select:none;-webkit-user-select:none;-o-user-select:none;-moz-user-select:none;user-select:none }
  :global(.mc-date-picker .tiny-date-table__week) { height:32px;line-height:1.5 }
  :global(.mc-date-picker .tiny-date-table td) { width:36px;height:34px;padding:4px 0;box-sizing:border-box;text-align:center;cursor:pointer;vertical-align:middle;position:relative }
  :global(.mc-date-picker .tiny-date-table td div) { height:28px;min-width:28px;padding:3px 0;box-sizing:border-box }
  :global(.mc-date-picker .tiny-date-table td span) { min-width:28px;height:28px;line-height:28px;display:block;margin:0 auto;position:absolute;left:50%;top:4px;transform:translate(-50%) }
  :global(.mc-date-picker .tiny-date-table td.next-month),:global(.mc-date-picker .tiny-date-table td.pre-month) { color:#808080;cursor:pointer }
  :global(.mc-date-picker .tiny-date-table td.today) { position:relative;color:#191919 }
  :global(.mc-date-picker .tiny-date-table td.today:after) { content:"";width:12px;height:1px;background:transparent;position:absolute;left:0;right:0;margin:auto;bottom:5px }
  :global(.mc-date-picker .tiny-date-table td.today span) { line-height:28px;min-width:28px;height:28px;border-radius:999px;box-shadow:0 0 1px 1px #191919 }
  :global(.mc-date-picker .tiny-date-table td.today.end-date span),:global(.mc-date-picker .tiny-date-table td.today.start-date span) { color:#ffffff }
  :global(.mc-date-picker .tiny-date-table td.available:not(.today):hover span) { background-color:#deecff;border-radius:999px;box-shadow:none }
  :global(.mc-date-picker .tiny-date-table td.current.available:not(.today):hover span) { color:#ffffff;background-color:#1476ff;border-radius:999px;box-shadow:none }
  :global(.mc-date-picker .tiny-date-table td.end-date div),:global(.mc-date-picker .tiny-date-table td.start-date div) { color:#ffffff }
  :global(.mc-date-picker .tiny-date-table td.end-date span),:global(.mc-date-picker .tiny-date-table td.start-date span) { background-color:#1476ff;border-radius:999px;box-shadow:none }
  :global(.mc-date-picker .tiny-date-table td.start-date div) { margin-left:5px;border-top-left-radius:999px;border-bottom-left-radius:999px }
  :global(.mc-date-picker .tiny-date-table td.end-date div) { margin-right:5px;border-top-right-radius:999px;border-bottom-right-radius:999px }
  :global(.mc-date-picker .tiny-date-table td.in-range div) { background-color:#deecff }
  :global(.mc-date-picker .tiny-date-table td.in-range.end-date:hover span),:global(.mc-date-picker .tiny-date-table td.in-range.start-date:hover span) { background-color:#1476ff }
  :global(.mc-date-picker .tiny-date-table td.available) { padding:0 }
  :global(.mc-date-picker .tiny-date-table td.week) { font-size:80%;color:#191919 }
  :global(.mc-date-picker .tiny-date-table th) { color:#808080;font-weight:400;white-space:nowrap;vertical-align:middle }
  :global(.mc-date-picker .tiny-date-table__row td:first-of-type div) { border-top-left-radius:999px;border-bottom-left-radius:999px }
  :global(.mc-date-picker .tiny-date-table__row td:last-of-type div) { border-top-right-radius:999px;border-bottom-right-radius:999px }
  :global(.mc-date-picker .tiny-date-table__row td.pre-month+td.available.in-range div) { border-top-left-radius:999px;border-bottom-left-radius:999px }
  :global(.mc-date-picker .tiny-date-table__row td.available.in-range:has(+td.next-month) div) { border-top-right-radius:999px;border-bottom-right-radius:999px }
  :global(.mc-date-picker .tiny-year-table) { width:100%;font-size:14px;margin:-1px;border-collapse:collapse }
  :global(.mc-date-picker .tiny-year-table tr),:global(.mc-date-picker .tiny-year-table td) { text-align:center;padding:16px 0;cursor:pointer }
  :global(.mc-date-picker .tiny-year-table tr.current),:global(.mc-date-picker .tiny-year-table td.current) { padding-left:3px;padding-right:3px }
  :global(.mc-date-picker .tiny-year-table tr div),:global(.mc-date-picker .tiny-year-table td div) { height:28px;box-sizing:border-box;padding:0 4px }
  :global(.mc-date-picker .tiny-year-table tr.today .cell),:global(.mc-date-picker .tiny-year-table td.today .cell) { color:#191919;box-shadow:0 0 1px 1px #191919 }
  :global(.mc-date-picker .tiny-year-table tr.today.end-date .cell),:global(.mc-date-picker .tiny-year-table td.today.end-date .cell),:global(.mc-date-picker .tiny-year-table tr.today.start-date .cell),:global(.mc-date-picker .tiny-year-table td.today.start-date .cell) { color:#ffffff;box-shadow:none }
  :global(.mc-date-picker .tiny-year-table tr .cell),:global(.mc-date-picker .tiny-year-table td .cell) { width:100%;height:28px;padding:calc((28px - 1.5 * 14px) / 2) 0;line-height:1.5;display:block;color:#191919 }
  :global(.mc-date-picker .tiny-year-table tr .cell:hover),:global(.mc-date-picker .tiny-year-table td .cell:hover) { background:#deecff;box-shadow:none }
  :global(.mc-date-picker .tiny-year-table tr.in-range div),:global(.mc-date-picker .tiny-year-table td.in-range div),:global(.mc-date-picker .tiny-year-table tr.in-range div:hover),:global(.mc-date-picker .tiny-year-table td.in-range div:hover) { background-color:#deecff }
  :global(.mc-date-picker .tiny-year-table tr.in-range:first-of-type div),:global(.mc-date-picker .tiny-year-table td.in-range:first-of-type div) { border-radius:999px 0 0 999px }
  :global(.mc-date-picker .tiny-year-table tr.in-range:first-of-type.end-date div),:global(.mc-date-picker .tiny-year-table td.in-range:first-of-type.end-date div) { border-radius:999px;padding-left:0 }
  :global(.mc-date-picker .tiny-year-table tr.in-range:last-of-type div),:global(.mc-date-picker .tiny-year-table td.in-range:last-of-type div) { border-radius:0 999px 999px 0 }
  :global(.mc-date-picker .tiny-year-table tr.end-date div),:global(.mc-date-picker .tiny-year-table td.end-date div),:global(.mc-date-picker .tiny-year-table tr.start-date div),:global(.mc-date-picker .tiny-year-table td.start-date div) { color:#ffffff }
  :global(.mc-date-picker .tiny-year-table tr.end-date.start-date div),:global(.mc-date-picker .tiny-year-table td.end-date.start-date div),:global(.mc-date-picker .tiny-year-table tr.start-date.start-date div),:global(.mc-date-picker .tiny-year-table td.start-date.start-date div) { border-radius:999px 0 0 999px;padding-left:0 }
  :global(.mc-date-picker .tiny-year-table tr.end-date.end-date div),:global(.mc-date-picker .tiny-year-table td.end-date.end-date div),:global(.mc-date-picker .tiny-year-table tr.start-date.end-date div),:global(.mc-date-picker .tiny-year-table td.start-date.end-date div) { border-radius:0 999px 999px 0;padding-right:0 }
  :global(.mc-date-picker .tiny-year-table tr.end-date .cell),:global(.mc-date-picker .tiny-year-table td.end-date .cell),:global(.mc-date-picker .tiny-year-table tr.start-date .cell),:global(.mc-date-picker .tiny-year-table td.start-date .cell) { color:#ffffff;background-color:#1476ff }
  :global(.mc-date-picker .tiny-year-table tr:not(.in-range) .cell),:global(.mc-date-picker .tiny-year-table td:not(.in-range) .cell) { box-sizing:border-box;width:100%;border-radius:999px }
  :global(.mc-date-picker .tiny-month-table) { width:100%;font-size:14px;margin:-1px;border-collapse:collapse }
  :global(.mc-date-picker .tiny-month-table tr),:global(.mc-date-picker .tiny-month-table td) { text-align:center;padding:16px 0;cursor:pointer }
  :global(.mc-date-picker .tiny-month-table tr.current),:global(.mc-date-picker .tiny-month-table td.current) { padding-left:3px;padding-right:3px }
  :global(.mc-date-picker .tiny-month-table tr div),:global(.mc-date-picker .tiny-month-table td div) { height:28px;box-sizing:border-box;padding:0 4px }
  :global(.mc-date-picker .tiny-month-table tr.today .cell),:global(.mc-date-picker .tiny-month-table td.today .cell) { color:#191919;box-shadow:0 0 1px 1px #191919 }
  :global(.mc-date-picker .tiny-month-table tr.today.end-date .cell),:global(.mc-date-picker .tiny-month-table td.today.end-date .cell),:global(.mc-date-picker .tiny-month-table tr.today.start-date .cell),:global(.mc-date-picker .tiny-month-table td.today.start-date .cell) { color:#ffffff;box-shadow:none }
  :global(.mc-date-picker .tiny-month-table tr .cell),:global(.mc-date-picker .tiny-month-table td .cell) { width:100%;height:28px;padding:calc((28px - 1.5 * 14px) / 2) 0;line-height:1.5;display:block;color:#191919 }
  :global(.mc-date-picker .tiny-month-table tr .cell:hover),:global(.mc-date-picker .tiny-month-table td .cell:hover) { background:#deecff;box-shadow:none }
  :global(.mc-date-picker .tiny-month-table tr.in-range div),:global(.mc-date-picker .tiny-month-table td.in-range div),:global(.mc-date-picker .tiny-month-table tr.in-range div:hover),:global(.mc-date-picker .tiny-month-table td.in-range div:hover) { background-color:#deecff }
  :global(.mc-date-picker .tiny-month-table tr.in-range:first-of-type div),:global(.mc-date-picker .tiny-month-table td.in-range:first-of-type div) { border-radius:999px 0 0 999px }
  :global(.mc-date-picker .tiny-month-table tr.in-range:first-of-type.end-date div),:global(.mc-date-picker .tiny-month-table td.in-range:first-of-type.end-date div) { border-radius:999px;padding-left:0 }
  :global(.mc-date-picker .tiny-month-table tr.in-range:last-of-type div),:global(.mc-date-picker .tiny-month-table td.in-range:last-of-type div) { border-radius:0 999px 999px 0 }
  :global(.mc-date-picker .tiny-month-table tr.end-date div),:global(.mc-date-picker .tiny-month-table td.end-date div),:global(.mc-date-picker .tiny-month-table tr.start-date div),:global(.mc-date-picker .tiny-month-table td.start-date div) { color:#ffffff }
  :global(.mc-date-picker .tiny-month-table tr.end-date.start-date div),:global(.mc-date-picker .tiny-month-table td.end-date.start-date div),:global(.mc-date-picker .tiny-month-table tr.start-date.start-date div),:global(.mc-date-picker .tiny-month-table td.start-date.start-date div) { border-radius:999px 0 0 999px;padding-left:0 }
  :global(.mc-date-picker .tiny-month-table tr.end-date.end-date div),:global(.mc-date-picker .tiny-month-table td.end-date.end-date div),:global(.mc-date-picker .tiny-month-table tr.start-date.end-date div),:global(.mc-date-picker .tiny-month-table td.start-date.end-date div) { border-radius:0 999px 999px 0;padding-right:0 }
  :global(.mc-date-picker .tiny-month-table tr.end-date .cell),:global(.mc-date-picker .tiny-month-table td.end-date .cell),:global(.mc-date-picker .tiny-month-table tr.start-date .cell),:global(.mc-date-picker .tiny-month-table td.start-date .cell) { color:#ffffff;background-color:#1476ff }
  :global(.mc-date-picker .tiny-month-table tr:not(.in-range) .cell),:global(.mc-date-picker .tiny-month-table td:not(.in-range) .cell) { box-sizing:border-box;width:100%;border-radius:999px }
  :global(.mc-date-picker .tiny-date-range-picker.tiny-picker-panel) { width:558px }
  :global(.mc-date-picker .tiny-date-range-picker table) { table-layout:fixed;width:100% }
  :global(.mc-date-picker .tiny-date-range-picker__header) { position:relative;text-align:center;padding:0 16px 12px 16px;line-height:1.5;border-bottom:1px solid #f0f0f0;margin-bottom:12px }
  :global(.mc-date-picker .tiny-date-range-picker__header [class*=arrow-left]) { float:left }
  :global(.mc-date-picker .tiny-date-range-picker__header [class*=arrow-right]) { float:right }
  :global(.mc-date-picker .tiny-date-range-picker__header div) { font-size:14px;font-weight:500;margin-right:50px }
  :global(.mc-date-picker .tiny-date-range-picker__content) { float:left;width:calc(50% - 4px) }
  :global(.mc-date-picker .tiny-date-range-picker__content.is-left) { margin-right:4px;padding-right:4px }
  :global(.mc-date-picker .tiny-date-range-picker__content.is-left .tiny-date-range-picker__table) { padding-left:16px }
  :global(.mc-date-picker .tiny-date-range-picker__content.is-right) { margin-left:4px;padding-left:4px }
  :global(.mc-date-picker .tiny-date-range-picker__content.is-right .tiny-date-range-picker__table) { padding-right:16px }
  :global(.mc-date-picker .tiny-date-range-picker__content .tiny-date-range-picker__header div) { margin-left:50px }
  :global(.mc-date-picker .tiny-date-range-picker__time-picker-wrap) { position:relative;display:table-cell }
  :global(.mc-date-picker .tiny-date-range-picker__time-picker-wrap:first-of-type) { padding-right:16px }
  :global(.mc-date-picker .tiny-picker-panel) { color:#191919;font-size:14px;box-shadow:var(--tv-shadow-3-down, 0 4px 16px 0 rgba(0, 0, 0, .08));background:#ffffff;border-radius:6px;line-height:1.5;margin:4px 0;width:360px }
  :global(.mc-date-picker .tiny-picker-panel__body-wrapper) { position:relative }
  :global(.mc-date-picker .tiny-picker-panel.tiny-month-range) { width:558px }
  :global(.mc-date-picker .tiny-picker-panel__body-wrapper:after),:global(.mc-date-picker .tiny-picker-panel__body:after) { content:"";display:table;clear:both }
  :global(.mc-date-picker .tiny-picker-panel__body) { padding-bottom:8px }
  :global(.mc-date-picker .tiny-picker-panel__body .tiny-date-picker__header) { padding:12.5px 16px;text-align:center }
  :global(.mc-date-picker .tiny-picker-panel__body .tiny-date-picker__header .tiny-date-picker__prev-btn) { float:left }
  :global(.mc-date-picker .tiny-picker-panel__body .tiny-date-picker__header .tiny-date-picker__next-btn) { float:right }
  :global(.mc-date-picker .tiny-picker-panel__body .tiny-date-picker__header-label) { padding:0 4px;cursor:pointer }
  :global(.mc-date-picker .tiny-picker-panel__body .tiny-date-picker__header-label.active),:global(.mc-date-picker .tiny-picker-panel__body .tiny-date-picker__header-label:hover) { color:#1476ff }
  :global(.mc-date-picker .tiny-picker-panel__body .tiny-picker-panel__content) { position:relative;border-top:solid 1px #f0f0f0;padding:12px 0 0 0 }
  :global(.mc-date-picker .tiny-picker-panel__body .tiny-picker-panel__content table) { table-layout:fixed;width:100% }
  :global(.mc-date-picker .tiny-picker-panel .tiny-picker-panel__icon-btn) { height:calc(14px * 1.5);padding:0 4px 0 0;border:0;background:unset;cursor:pointer;outline:0 }
  :global(.mc-date-picker .tiny-picker-panel .tiny-picker-panel__icon-btn .tiny-svg) { font-size:16px;fill:#808080 }
  :global(.mc-date-picker .tiny-picker-panel .tiny-picker-panel__icon-btn .tiny-svg:hover) { fill:#191919 }
  :global(.mc-date-picker .tiny-picker-panel .tiny-picker-panel__table) { padding:0 16px }
  :global(.mc-date-picker .tiny-picker-panel) { margin:0; box-shadow:none; border:0; }
  :global(.mc-date-picker .tiny-month-table td:not(.in-range) .cell),:global(.mc-date-picker .tiny-year-table td:not(.in-range) .cell) { width:100%; }
  :global(.mc-date-picker .tiny-date-table td.current span) { color:#fff; background:#1476ff; border-radius:999px; box-shadow:none; }
  :global(.mc-date-picker .tiny-month-table td.current .cell),:global(.mc-date-picker .tiny-year-table td.current .cell) { color:#fff; background:#1476ff; box-shadow:none; }
  @media print { .mc-date-picker { display:none; } }
</style>
