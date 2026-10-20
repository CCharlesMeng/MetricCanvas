<script lang="ts">
  import { DatePicker } from '@metriccanvas/ui';
  import { validateTimePointValue } from '@metriccanvas/page/internal';
  interface Props {
    label?: string;
    required?: boolean;
    max?:string;blockedRanges?:readonly {from:string;to:string}[];
    min?: string;
    disableFuture?: boolean;
    readOnly?: boolean;
    granularity: 'month' | 'date';
    value: string | null;
    onchange: (value: string | null) => void;
  }
  let { label, min, max, blockedRanges, disableFuture = true, granularity, value, onchange, required = false, readOnly = false }: Props = $props();
</script>
<DatePicker {label} {required} {min} {max} {blockedRanges} {disableFuture} precision={granularity} disabled={readOnly}
  value={value ? { from: value, to: value } : null} onchange={next => { if (!next || !validateTimePointValue(next.from, granularity, min, disableFuture)) onchange(next?.from ?? null); }} />
