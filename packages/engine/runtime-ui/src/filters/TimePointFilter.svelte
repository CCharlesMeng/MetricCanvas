<script lang="ts">
  import { DatePicker } from '@metriccanvas/ui';
  import { validateTimePointValue } from '@metriccanvas/page/internal';
  interface Props {
    label?: string;
    required?: boolean;
    min?: string;
    readOnly?: boolean;
    granularity: 'month' | 'date';
    value: string | null;
    onchange: (value: string | null) => void;
  }
  let { label, min, granularity, value, onchange, required = false, readOnly = false }: Props = $props();
</script>
<DatePicker {label} {required} {min} precision={granularity} disabled={readOnly}
  value={value ? { from: value, to: value } : null} onchange={next => { if (!next || !validateTimePointValue(next.from, granularity, min)) onchange(next?.from ?? null); }} />
