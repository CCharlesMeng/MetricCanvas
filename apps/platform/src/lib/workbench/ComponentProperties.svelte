<script lang="ts">
  import type { PropertyControl, PropertyEdit } from './property-edit';
  let { controls, busy = false, onEdit }: { controls: PropertyControl[]; busy?: boolean; onEdit: (edit: PropertyEdit) => void } = $props();
  const valueText = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  function submit(control: PropertyControl, raw: string) {
    let value: unknown = raw;
    if (control.kind === 'boolean') value = raw === '' ? undefined : raw === 'true';
    else if (control.kind === 'number') value = raw.trim() === '' ? undefined : Number(raw);
    else if (control.kind === 'choice') value = raw === '' ? undefined : raw;
    else if (control.kind === 'tags') value = raw.split('\n').map((item) => item.trim()).filter(Boolean);
    onEdit({ ...control.target, value });
  }
</script>
{#if controls.length}
  <section aria-label="展示属性">
    <h5>展示属性</h5>
    {#each controls as control (control.id)}
      <label>
        <span>{control.label}</span>
        {#if control.kind === 'boolean' || control.kind === 'choice'}
          <select aria-label={control.label} disabled={busy} value={control.value === undefined ? '' : String(control.value)} onchange={(event) => submit(control, event.currentTarget.value)}>
            <option value="">默认</option>
            {#if control.kind === 'boolean'}<option value="true">开启</option><option value="false">关闭</option>
            {:else}{#each control.choices ?? [] as choice}<option value={choice}>{({ content: '按内容', container: '适配容器', left: '左侧', right: '右侧' } as Record<string, string>)[choice] ?? choice}</option>{/each}{/if}
          </select>
        {:else if control.kind === 'tags'}
          <textarea aria-label={control.label} disabled={busy} value={Array.isArray(control.value) ? control.value.map(valueText).join('\n') : ''} onchange={(event) => submit(control, event.currentTarget.value)}></textarea>
        {:else}
          <input aria-label={control.label} type={control.kind === 'number' ? 'number' : 'text'} min={control.kind === 'number' ? 1 : undefined} step={control.kind === 'number' ? 1 : undefined} disabled={busy} value={valueText(control.value)} onchange={(event) => submit(control, event.currentTarget.value)} />
        {/if}
        {#if control.value && typeof control.value === 'object' && (!Array.isArray(control.value) || control.value.some((item) => item && typeof item === 'object'))}<small>此值含参数引用，编辑此项将替换为固定文字。</small>{/if}
      </label>
    {/each}
  </section>
{/if}
<style>
  section { display: grid; gap: 10px; }
  h5 { margin: 0; color: #52525b; font-size: 11px; }
  label { display: grid; gap: 5px; font-size: 11.5px; color: #52525b; }
  input, select, textarea { width: 100%; min-height: 30px; padding: 5px 8px; border: 1px solid #d4d4d8; border-radius: 8px; font: inherit; background: white; }
  textarea { min-height: 60px; resize: vertical; }
  small { color: var(--muted); }
</style>
