<script lang="ts">
  import { DatePicker } from '@metriccanvas/ui';
  import { validateTimePointValue } from '@metriccanvas/page/internal';
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
  value={value ? { from: value, to: value } : null} onchange={next => { if (!next || !validateTimePointValue(next.from, granularity)) onchange(next?.from ?? null); }} />
