<script lang="ts">
  /**
   * 维度筛选器(纯渲染):候选值快照与当前值由运行时传入,变更只上抛事件,不直接写筛选状态。
   * 候选值按显式状态呈现:加载中、空结果、能力不可用与加载失败各自可区分,
   * 不以空列表伪装任何一种(issue #54)。
   * 四种展示形态共用同一契约:select=下拉多选,tabs=tab 单选(存量 ti-tabs 场景),
   * tree=树形多选(存量 ti-treeselect 场景),search=输入过滤 + 多选(存量 ti-searchbox 场景)。
   */
  import type {
    DimensionValueCandidate,
    DimensionValuesSnapshot
  } from '@metriccanvas/runtime';
  import {
    buildFilterTree,
    nodeState as treeNodeState,
    toggleNodeValues,
    type FilterTreeNode
  } from './tree';

  interface Props {
    label?: string;
    emptyLabel?: string;
    /** 筛选候选值快照,运行时经维度候选值端口加载后传入 */
    candidates: DimensionValuesSnapshot;
    /** 当前选中值;空数组表示不筛选 */
    value: string[];
    display?: 'select' | 'tabs' | 'tree' | 'search';
    onchange: (values: string[]) => void;
  }

  let { label, emptyLabel = '全部', candidates, value, display = 'select', onchange }: Props = $props();

  const options = $derived(candidates.status === 'ready' ? candidates.candidates : []);
  /** 非 ready 状态的显式提示;错误态展示分类标识,消息本身已脱值(issue #51)。 */
  const statusText = $derived(
    candidates.status === 'idle' || candidates.status === 'loading'
      ? '候选项加载中…'
      : candidates.status === 'empty'
        ? '无候选项'
        : candidates.status === 'unavailable'
          ? '候选项不可用'
          : candidates.status === 'error'
            ? `候选项加载失败(${candidates.error.code})`
            : null
  );

  const selected = $derived(new Set(value));

  function toggle(option: DimensionValueCandidate) {
    onchange(
      selected.has(option.value)
        ? value.filter((candidate) => candidate !== option.value)
        : [...value, option.value]
    );
  }

  const labels = $derived(new Map(options.map((option) => [option.value, option.label])));

  const summary = $derived(
    value.length === 0
      ? emptyLabel
      : value.length <= 2
        ? value.map((candidate) => labels.get(candidate) ?? candidate).join('、')
        : `已选 ${value.length} 项`
  );

  // —— 树选:'/' 分隔符约定建层级(纯逻辑在 tree.ts);父节点复选批量作用于后代候选值 ——
  const tree = $derived(display === 'tree' ? buildFilterTree(options) : []);
  /** 折叠的节点路径(缺省全展开,候选值集合本就不大) */
  let collapsed = $state<Record<string, boolean>>({});

  function nodeState(node: FilterTreeNode): 'all' | 'some' | 'none' {
    return treeNodeState(node, selected);
  }

  function toggleNode(node: FilterTreeNode) {
    onchange(toggleNodeValues(node, value, selected));
  }

  // —— 搜索:输入过滤候选 + 多选;已选项即使被过滤掉也仍在筛选状态中 ——
  let keyword = $state('');
  const filtered = $derived(
    keyword.trim() === ''
      ? options
      : options.filter((option) => {
          const needle = keyword.trim().toLowerCase();
          return option.label.toLowerCase().includes(needle) || option.value.toLowerCase().includes(needle);
        })
  );
</script>

<div class="filter">
  {#if label}<span class="label">{label}</span>{/if}

  {#if display === 'tabs'}
    <div class="tabs" role="tablist">
      <button
        type="button"
        role="tab"
        class="tab"
        class:active={value.length === 0}
        aria-selected={value.length === 0}
        onclick={() => onchange([])}
      >
        {emptyLabel}
      </button>
      {#each options as option (option.value)}
        <button
          type="button"
          role="tab"
          class="tab"
          class:active={selected.has(option.value)}
          aria-selected={selected.has(option.value)}
          onclick={() => onchange([option.value])}
        >
          {option.label}
        </button>
      {/each}
    </div>
    {@render statusHint()}
  {:else if display === 'tree'}
    <details class="select">
      <summary>
        <span>{summary}</span>
        <span class="caret" aria-hidden="true">▾</span>
      </summary>
      <div class="menu" role="tree">
        {#each tree as node (node.path)}
          {@render treeRow(node, 0)}
        {:else}
          {@render statusHint()}
        {/each}
        {#if value.length > 0}
          <button type="button" class="clear" onclick={() => onchange([])}>清除筛选</button>
        {/if}
      </div>
    </details>
  {:else if display === 'search'}
    <details class="select">
      <summary>
        <span>{summary}</span>
        <span class="caret" aria-hidden="true">▾</span>
      </summary>
      <div class="menu">
        <input
          class="search-input"
          type="search"
          placeholder="输入过滤候选项…"
          bind:value={keyword}
        />
        {#each filtered as option (option.value)}
          <label class="option">
            <input
              type="checkbox"
              checked={selected.has(option.value)}
              onchange={() => toggle(option)}
            />
            <span>{option.label}</span>
          </label>
        {:else}
          {#if candidates.status === 'ready'}
            <span class="empty">无匹配候选项</span>
          {:else}
            {@render statusHint()}
          {/if}
        {/each}
        {#if value.length > 0}
          <button type="button" class="clear" onclick={() => onchange([])}>清除筛选</button>
        {/if}
      </div>
    </details>
  {:else}
    <details class="select">
      <summary>
        <span>{summary}</span>
        <span class="caret" aria-hidden="true">▾</span>
      </summary>
      <div class="menu">
        {#each options as option (option.value)}
          <label class="option">
            <input
              type="checkbox"
              checked={selected.has(option.value)}
              onchange={() => toggle(option)}
            />
            <span>{option.label}</span>
          </label>
        {:else}
          {@render statusHint()}
        {/each}
        {#if value.length > 0}
          <button type="button" class="clear" onclick={() => onchange([])}>清除筛选</button>
        {/if}
      </div>
    </details>
  {/if}
</div>

{#snippet statusHint()}
  {#if statusText}
    <span
      class="empty"
      class:failed={candidates.status === 'error'}
      role={candidates.status === 'error' ? 'alert' : 'status'}
      data-candidates-status={candidates.status}
    >
      {statusText}
    </span>
  {/if}
{/snippet}

{#snippet treeRow(node: FilterTreeNode, depth: number)}
  {@const state = nodeState(node)}
  <div class="tree-row" role="treeitem" aria-selected={state === 'all'} style="padding-left: {depth * 16}px;">
    {#if node.children.length > 0}
      <button
        type="button"
        class="expander"
        aria-label={collapsed[node.path] ? '展开' : '折叠'}
        onclick={() => (collapsed = { ...collapsed, [node.path]: !collapsed[node.path] })}
      >
        {collapsed[node.path] ? '▸' : '▾'}
      </button>
    {:else}
      <span class="expander" aria-hidden="true"></span>
    {/if}
    <label class="option">
      <input
        type="checkbox"
        checked={state === 'all'}
        indeterminate={state === 'some'}
        onchange={() => toggleNode(node)}
      />
      <span>{node.label}</span>
    </label>
  </div>
  {#if node.children.length > 0 && !collapsed[node.path]}
    {#each node.children as child (child.path)}
      {@render treeRow(child, depth + 1)}
    {/each}
  {/if}
{/snippet}

<style>
  /* 控件铬(字号、盒子、描边、圆角)与外置字段名标签的可见性两档形态取值不同,
     七个筛选控件横跨多个文件共用同一组 --mc-filter-* 量,真源在统一运行时根部;
     缺省值即报表形态的既有观感,不在任一控件里改字面量。 */
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
  .tabs {
    display: flex;
    background: #f4f4f5;
    border-radius: 8px;
    padding: 2px;
    gap: 2px;
  }
  .tab {
    border: 0;
    background: transparent;
    padding: 5px 12px;
    border-radius: 6px;
    font-size: var(--mc-filter-font-size, 13px);
    color: #52525b;
    cursor: pointer;
  }
  .tab.active {
    background: #fff;
    color: #18181b;
    font-weight: var(--mc-tab-active-font-weight, 600);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
  }
  .select {
    position: relative;
  }
  .select summary {
    box-sizing: border-box;
    list-style: none;
    display: flex;
    align-items: center;
    gap: 6px;
    height: var(--mc-filter-control-height, auto);
    padding: 6px 12px;
    background: #fff;
    border: 1px solid var(--mc-filter-control-border-color, #e4e4e7);
    border-radius: var(--mc-filter-control-radius, 8px);
    cursor: pointer;
    user-select: none;
    min-width: var(--mc-filter-control-min-width, 96px);
  }
  .select summary::-webkit-details-marker {
    display: none;
  }
  .caret {
    margin-left: auto;
    color: #a1a1aa;
    font-size: 11px;
  }
  .menu {
    position: absolute;
    z-index: 10;
    top: calc(100% + 4px);
    left: 0;
    min-width: 160px;
    max-height: 260px;
    overflow: auto;
    background: #fff;
    border: 1px solid #e4e4e7;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.1);
    padding: 6px;
    display: flex;
    flex-direction: column;
  }
  .search-input {
    margin: 2px 2px 6px;
    padding: 6px 8px;
    border: 1px solid #e4e4e7;
    border-radius: 6px;
    font-size: 13px;
    outline: none;
  }
  .search-input:focus {
    border-color: #93c5fd;
  }
  .option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
  }
  .option:hover {
    background: #f4f4f5;
  }
  .tree-row {
    display: flex;
    align-items: center;
  }
  .tree-row .option {
    flex: 1;
  }
  .expander {
    width: 18px;
    flex: none;
    border: 0;
    background: transparent;
    color: #a1a1aa;
    font-size: 11px;
    cursor: pointer;
    padding: 0;
  }
  .empty {
    padding: 6px 8px;
    color: #a1a1aa;
  }
  .empty.failed {
    color: #b91c1c;
  }
  .clear {
    margin-top: 4px;
    border: 0;
    border-top: 1px solid #f4f4f5;
    background: transparent;
    padding: 8px;
    color: #2563eb;
    font-size: 13px;
    cursor: pointer;
  }
</style>
