<script lang="ts">
  /**
   * 搜索筛选器(纯渲染):自由文本,跨字段模糊匹配属于查询谓词,
   * 控件本身只上抛当前字符串。
   */
  interface Props {
    label?: string;
    value: string;
    onchange: (query: string) => void;
  }

  let { label, value, onchange }: Props = $props();
</script>

<div class="filter">
  {#if label}<span class="label">{label}</span>{/if}
  <input
    type="search"
    value={value}
    placeholder={label ?? '搜索'}
    oninput={(e) => onchange(e.currentTarget.value)}
  />
</div>

<style>
  /* 控件铬与外置字段名标签的可见性经 --mc-filter-* 下发,真源在统一运行时根部。
     标签隐去后字段名仍由 placeholder 承担,搜索框不会失去它的所指。 */
  .filter {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--mc-filter-font-size, 13px);
  }
  .label {
    display: var(--mc-filter-label-display, inline);
    color: #71717a;
    white-space: nowrap;
  }
  input {
    min-width: 220px;
    height: var(--mc-filter-control-height, auto);
    padding: 5px 8px;
    border: 1px solid var(--mc-filter-control-border-color, #e4e4e7);
    border-radius: var(--mc-filter-control-radius, 8px);
    background: #fff;
    font-size: var(--mc-filter-font-size, 13px);
    color: #18181b;
    font-family: inherit;
  }
</style>
