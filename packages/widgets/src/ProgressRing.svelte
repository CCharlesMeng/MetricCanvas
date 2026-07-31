<script lang="ts">
  interface Props {
    value: number;
    label?: string;
  }

  let { value, label = '完成率' }: Props = $props();
  const normalized = $derived(Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0)));
  const radius = 29;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75;
</script>

<div class="progress-ring" aria-label={`${label} ${normalized}%`}>
  <svg viewBox="0 0 72 72" role="img">
    <circle
      class="track"
      cx="36"
      cy="36"
      r={radius}
      stroke-dasharray={`${arcLength} ${circumference - arcLength}`}
      transform="rotate(135 36 36)"
    ></circle>
    <circle
      class="value"
      cx="36"
      cy="36"
      r={radius}
      stroke-dasharray={`${arcLength * (normalized / 100)} ${circumference}`}
      transform="rotate(135 36 36)"
    ></circle>
  </svg>
  <div class="number"><strong>{normalized}</strong><span>%</span></div>
  <span class="label">{label}</span>
</div>

<style>
  .progress-ring {
    position: relative;
    display: grid;
    width: 92px;
    height: 76px;
    flex: 0 0 92px;
    place-items: center;
  }
  svg {
    position: absolute;
    inset: 0 10px 4px;
    width: 72px;
    height: 72px;
  }
  circle {
    fill: none;
    stroke-width: 8;
  }
  .track {
    stroke: #e5eaff;
  }
  .value {
    stroke: #5b72ea;
    stroke-linecap: round;
    transition: stroke-dasharray 220ms ease;
  }
  .number {
    z-index: 1;
    display: flex;
    align-items: baseline;
    transform: translateY(-4px);
    color: #0f1a4d;
  }
  .number strong {
    font-size: 18px;
    font-weight: 650;
  }
  .number span {
    margin-left: 2px;
    font-size: 11px;
  }
  .label {
    position: absolute;
    bottom: 3px;
    z-index: 1;
    color: #777;
    font-size: 12px;
  }
</style>
