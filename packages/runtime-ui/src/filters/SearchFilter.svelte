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
  .filter {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
  .label {
    color: #71717a;
    white-space: nowrap;
  }
  input {
    min-width: 220px;
    padding: 5px 8px;
    border: 1px solid #e4e4e7;
    border-radius: 8px;
    background: #fff;
    font-size: 13px;
    color: #18181b;
    font-family: inherit;
  }
</style>
