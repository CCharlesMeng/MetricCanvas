<script lang="ts">
  import DatePicker from './DatePicker.svelte';
  interface Props {
    label?: string;
    required?: boolean;
    readOnly?: boolean;
    granularity: 'month' | 'date';
    value: string | null;
    onchange: (value: string | null) => void;
  }
  let { label, granularity, value, onchange, required = false, readOnly = false }: Props = $props();
</script>
<DatePicker {label} {required} precision={granularity} disabled={readOnly}
  value={value ? { from: value, to: value } : null} onchange={next => onchange(next?.from ?? null)} />
