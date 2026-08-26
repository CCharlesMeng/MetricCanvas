<script lang="ts">
  /**
   * 布尔筛选器(纯渲染):勾选才生成条件,未勾选无条件。
   * 「未勾选」与「勾选为否」是同一件事,不提供三态。
   */
  interface Props {
    label?: string;
    value: boolean;
    onchange: (checked: boolean) => void;
  }

  let { label, value, onchange }: Props = $props();
</script>

<label class="filter">
  <input type="checkbox" checked={value} onchange={(e) => onchange(e.currentTarget.checked)} />
  {#if label}<span class="label">{label}</span>{/if}
</label>

<style>
  /* 只吃字号那一档:勾选框的标签就是控件的全部所指,不是可以隐去的外置字段名,
     所以这里刻意不接 --mc-filter-label-display。 */
  .filter {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--mc-filter-font-size, 13px);
    color: #18181b;
    cursor: pointer;
  }
  .label {
    color: #3f3f46;
    white-space: nowrap;
  }
</style>
