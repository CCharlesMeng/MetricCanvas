<svelte:options css="injected" />
<script lang="ts">
  import type { UiOption } from '../../types';
  import Selection from './Selection.svelte';
  let {value = '', options, onchange, disabled = false, label, placeholder = '请选择', searchable = true}:
    {value?: string; options: UiOption[]; onchange?: (value: string) => void; disabled?: boolean; label: string; placeholder?: string; searchable?: boolean} = $props();
</script>
<Selection {options} value={value ? [value] : []} multiple={false} {disabled} {label} {placeholder} {searchable} onchange={next => onchange?.(next[0] ?? '')}/>
