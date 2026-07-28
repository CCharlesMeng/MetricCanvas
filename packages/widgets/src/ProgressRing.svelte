<script lang="ts">
  interface Props {
    value: number;
    label?: string;
  }

  let { value, label = '完成率' }: Props = $props();
  const normalized = $derived(Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0)));
  const radius = 29;
  const circumference = 2 * Math.PI * radius;
</script>

<div class="progress-ring" aria-label={`${label} ${normalized}%`}>
  <svg viewBox="0 0 72 72" role="img">
    <circle class="track" cx="36" cy="36" r={radius}></circle>
    <circle
      class="value"
      cx="36"
      cy="36"
      r={radius}
      stroke-dasharray={circumference}
      stroke-dashoffset={circumference * (1 - normalized / 100)}
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
    height: 92px;
    flex: 0 0 92px;
    place-items: center;
  }
  svg {
    position: absolute;
    inset: 0 10px 18px;
    width: 72px;
    height: 72px;
    transform: rotate(-90deg);
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
    transition: stroke-dashoffset 220ms ease;
  }
  .number {
    z-index: 1;
    display: flex;
    align-items: baseline;
    margin-top: -15px;
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
    bottom: 0;
    color: #777;
    font-size: 12px;
  }
</style>
