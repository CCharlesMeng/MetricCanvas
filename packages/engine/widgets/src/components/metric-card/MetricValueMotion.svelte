<script lang="ts">
  import { onDestroy, type Snippet } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { prefersReducedMotion, Tween } from 'svelte/motion';
  import { basicNumberFormat, type FieldValue, type ValueFormat } from '@metriccanvas/page/internal';
  import { finiteNumber } from '../../shared/value-format';

  interface Props {
    value: FieldValue | undefined;
    format?: ValueFormat;
    animate: boolean;
    children: Snippet<[FieldValue | undefined]>;
  }

  let { value, format, animate, children }: Props = $props();

  const nonNumericFormats = new Set(['text', 'date', 'date-month-day', 'period']);
  const enabled = $derived(animate && !prefersReducedMotion.current);
  const numericValue = $derived(
    (typeof value === 'number' || format !== undefined) &&
      typeof format !== 'object' && !nonNumericFormats.has(format ?? '')
      ? finiteNumber(value) : undefined
  );

  const tween = new Tween<number | undefined>(undefined, { easing: cubicOut });
  let previous: number | undefined;

  function decimalPlaces(number: number): number {
    const [mantissa, exponent = '0'] = String(number).split('e');
    return (mantissa?.split('.')[1]?.length ?? 0) - Number(exponent);
  }

  function interpolate(from: number | undefined, to: number | undefined) {
    if (from === undefined || to === undefined) return () => to;
    // Unbounded formats should not gain digits just because a value is in motion.
    const basic = basicNumberFormat(format);
    const unbounded = !format || format === 'percent-raw' || (basic && basic.digits === undefined);
    const digits = unbounded ? Math.max(0, decimalPlaces(from), decimalPlaces(to)) : 6;
    return (progress: number) => {
      const number = from * (1 - progress) + to * progress;
      return Number(digits > 100 ? number.toPrecision(6) : number.toFixed(digits));
    };
  }

  $effect(() => {
    const next = numericValue;
    const useMotion = enabled;
    if (useMotion && next === previous) return;

    const duration = useMotion && previous !== undefined && next !== undefined ? 480 : 0;
    previous = next;
    void tween.set(next, { duration, interpolate });
  });

  onDestroy(() => { void tween.set(undefined, { duration: 0 }); });

  const displayedValue = $derived(
    enabled && numericValue !== undefined && tween.current !== undefined && tween.current !== numericValue
      ? tween.current : value
  );
</script>

{@render children(displayedValue)}
