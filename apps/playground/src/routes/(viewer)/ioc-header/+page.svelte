<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { headerTopics, headerScene, headerSceneHref, resolveHeaderSelection, headerCapabilityGroups, headerPlannedCapabilities, headerStatusLabels } from '$lib/ioc-header-showcase';
  const selection = $derived(resolveHeaderSelection(page.url.searchParams.get('topic'), page.url.searchParams.get('scene')));
  const view = $derived(page.url.searchParams.get('view') === 'capabilities' ? 'capabilities' : 'interactive');
  const entry = $derived(headerScene(selection.scene)!);
  const src = $derived(headerSceneHref(selection.scene));
  let capabilityQuery = $state('');
  const words = $derived(capabilityQuery.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean));
  const groups = $derived(headerCapabilityGroups.map(group => ({ ...group, items: group.items.filter(item => words.every(word => `${group.title} ${item.title} ${item.description} ${item.condition} ${item.refs.join(' ')} ${headerStatusLabels[item.status]}`.toLocaleLowerCase().includes(word))) })).filter(group => group.items.length));
  function change(values: Record<string, string>) {
    const url = new URL(page.url);
    for (const [key, value] of Object.entries(values)) url.searchParams.set(key, value);
    void goto(url, { noScroll: true, keepFocus: true });
  }
</script>

<svelte:head><title>IOC 公共页头 · 页面试验场</title></svelte:head>
<main class="header-showcase">
  <header class="intro">
    <p class="eyebrow">PLAYGROUND / IOC</p>
    <h1>IOC 公共页头</h1>
    <p>在完整页头中操作筛选，再按四个专题了解具体功能。所有示例使用内置合成数据，无需启动额外服务。</p>
    <nav class="view-switch" aria-label="页头展示内容">
      <button aria-pressed={view === 'interactive'} onclick={() => change({ view: 'interactive' })}>交互演示</button>
      <button aria-pressed={view === 'capabilities'} onclick={() => change({ view: 'capabilities' })}>能力一览</button>
    </nav>
  </header>

  {#if view === 'interactive'}
    <nav class="topics" aria-label="页头功能专题">
      {#each headerTopics as topic}
        <button aria-pressed={selection.topic.id === topic.id} onclick={() => change({ topic: topic.id, scene: topic.scenes[0] })}>{topic.title}</button>
      {/each}
    </nav>
    <section class="topic-content" aria-label={selection.topic.title}>
      <h2>{selection.topic.title}</h2>
      <p>{selection.topic.description}</p>
      {#if selection.topic.scenes.length > 1}
        <label class="scene-selector">选择场景
          <select value={selection.scene} onchange={event => change({ scene: event.currentTarget.value })}>
            {#each selection.topic.scenes as scene}<option value={scene}>{headerScene(scene)?.displayTitle}</option>{/each}
          </select>
        </label>
      {/if}
      {#if selection.topic.id === 'navigation'}
        <p class="flow">① 概览选择期间、币种和区域 → ② 带条件进入清单 → ③ 点击项目进入详情。下方演示会在原窗口内走完整流程；也可切换场景单独查看。</p>
      {/if}
      <div class="preview-heading">
        <div><h3>{entry.displayTitle}</h3><p>{entry.summary}</p></div>
        <a href={src} target="_blank" rel="noreferrer">在新标签页体验 ↗</a>
      </div>
      <details class="steps"><summary>操作提示与接入条件</summary>
        <ol>{#each entry.guide.steps as step}<li>{step}</li>{/each}</ol>
        <p>{entry.guide.boundary}</p>
      </details>
      {#key src}<iframe src={src} title={`交互演示：${entry.displayTitle}`} class="preview-frame"></iframe>{/key}
    </section>
  {:else}
    <section class="capability-overview" aria-label="页头能力一览">
      <h2>当前支持的能力</h2>
      <p>基础呈现是共用结构，其余功能按页面需要组合。这里按使用能力归并展示，展开可查看接入条件及原计划编号。</p>
      <p class="legend"><span>已支持：可按声明使用</span><span>需业务接入：通用能力已支持，具体业务数据和规则待接入</span></p>
      <label class="capability-search">查找能力<input type="search" bind:value={capabilityQuery} placeholder="搜索能力、用途或规划编号，例如 ISO、金额、T08" /></label>
      <p class="capability-count" role="status">{groups.reduce((count, group) => count + group.items.length, 0)} 项使用能力</p>
      {#each groups as group}
        <section class="capability-group" aria-labelledby={`capability-${group.id}`}>
          <h3 id={`capability-${group.id}`}>{group.title}</h3>
          <ul>
            {#each group.items as item}
              <li class="capability-item">
                <div class="item-heading"><h4>{item.title}</h4><span class="status" class:integration={item.status === 'integration'}>{headerStatusLabels[item.status]}</span></div>
                <p>{item.description}</p>
                <div class="item-actions"><details><summary>适用条件与规划来源</summary><p>{item.condition}</p><p>规划编号：{item.refs.join('、')}</p></details>
                  <a href={`?view=interactive&topic=${group.id === 'foundation' ? 'overview' : group.id}&scene=${item.scene}`}>查看演示 →</a></div>
              </li>
            {/each}
          </ul>
        </section>
      {:else}<p class="empty">没有匹配的已支持能力。请尝试其他关键词；未实施项列在下方。</p>{/each}
      <section class="planned" aria-label="规划与暂未支持">
        <h3>规划与暂未支持</h3>
        <p>以下项目未计入上面的已支持能力；原 88 项规划保留，不表示 88 项均已实现。</p>
        <ul>{#each headerPlannedCapabilities as item}
          <li><div class="item-heading"><h4>{item.title}</h4><span class="status planned-status">{headerStatusLabels[item.status]}</span></div><p>{item.description}</p>
            <details><summary>范围说明与规划来源</summary><p>{item.condition}</p>{#if item.refs.length}<p>规划编号：{item.refs.join('、')}</p>{/if}</details>
          </li>
        {/each}</ul>
      </section>
      <p class="evidence-note">演示使用合成数据；真实 DQE、CloudIOC、Relay、门户及业务字段需要分别验收。<a href="https://github.com/CCharlesMeng/MetricCanvas/blob/main/docs/plan/2026-10-16-ioc-header-feature-plan.md" target="_blank" rel="noreferrer">查看完整规划 ↗</a></p>
    </section>
  {/if}
</main>

<style>
  .header-showcase { max-width: 1400px; margin: auto; padding: 32px 24px 64px; color: #27272a; font-size: 14px; line-height: 1.65; }
  .eyebrow { color: #71717a; font-size: 11px; letter-spacing: .12em; margin: 0 0 8px; }
  h1 { margin: 0; font-size: 28px; line-height: 1.4; } h2 { margin: 0; font-size: 20px; } h3 { margin: 0; font-size: 16px; } h4 { margin: 0; font-size: 14px; }
  p { margin: 8px 0 16px; } a { color: #4338ca; text-underline-offset: 3px; }
  button, select, input { font: inherit; } button, summary, select { cursor: pointer; }
  button { border: 1px solid #d4d4d8; background: white; color: #52525b; border-radius: 7px; padding: 9px 16px; }
  button[aria-pressed="true"] { color: #3730a3; border-color: #a5b4fc; background: #eef2ff; }
  .view-switch, .topics { display: flex; flex-wrap: wrap; gap: 8px; }
  .view-switch { margin: 24px 0; border-bottom: 1px solid #e4e4e7; padding-bottom: 16px; }
  .topics { margin-bottom: 20px; }
  .topic-content, .capability-overview { min-width: 0; }
  .scene-selector { display: flex; align-items: center; gap: 12px; margin: 20px 0; }
  select, input { border: 1px solid #d4d4d8; border-radius: 6px; padding: 9px 12px; background: white; color: #27272a; min-width: 0; }
  select { max-width: 100%; }
  .preview-heading { display: flex; align-items: start; justify-content: space-between; gap: 16px; padding: 20px 20px 0; border: 1px solid #e4e4e7; border-radius: 10px 10px 0 0; background: #fafafa; }
  .preview-heading a { flex-shrink: 0; font-size: 13px; }
  .steps { padding: 10px 20px; border: solid #e4e4e7; border-width: 0 1px 1px; background: #fafafa; font-size: 13px; }
  .preview-frame { display: block; width: 100%; height: 850px; border: 1px solid #e4e4e7; border-top: 0; border-radius: 0 0 10px 10px; background: white; box-sizing: border-box; }
  .flow { background: #eef2ff; padding: 12px 16px; border-radius: 6px; color: #3730a3; }
  .legend { display: flex; flex-wrap: wrap; gap: 8px 24px; color: #52525b; font-size: 12px; }
  .capability-search { display: grid; gap: 6px; max-width: 680px; margin: 24px 0 8px; }
  .capability-count { color: #71717a; font-size: 12px; }
  .capability-group { margin-top: 28px; }
  ul { list-style: none; padding: 0; margin: 12px 0 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .capability-item, .planned li { padding: 18px; border: 1px solid #e4e4e7; border-radius: 8px; min-width: 0; overflow-wrap: anywhere; }
  .item-heading { display: flex; justify-content: space-between; align-items: start; gap: 12px; }
  .status { white-space: nowrap; border-radius: 4px; font-size: 11px; padding: 2px 7px; background: #ecfdf5; color: #047857; }
  .status.integration { background: #eff6ff; color: #1d4ed8; }
  .status.planned-status { background: #f4f4f5; color: #71717a; }
  .capability-item p, .planned li p { color: #52525b; margin-bottom: 10px; }
  .item-actions { display: flex; align-items: start; justify-content: space-between; gap: 16px; font-size: 12px; }
  .item-actions a { flex-shrink: 0; } details p { font-size: 12px; } summary { color: #52525b; }
  .planned { border-top: 1px solid #e4e4e7; margin-top: 40px; padding-top: 24px; }
  .evidence-note { font-size: 12px; color: #71717a; margin-top: 28px; }
  button:focus-visible, a:focus-visible, summary:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid #6366f1; outline-offset: 3px; }
  @media(max-width: 700px) {
    .header-showcase { padding: 24px 14px 40px; } .topics button { flex: 1 0 auto; }
    .scene-selector { display: grid; gap: 6px; } .scene-selector select { width: 100%; }
    .preview-heading { flex-direction: column; gap: 0; padding: 16px; } .preview-heading p { margin-bottom: 8px; }
    ul { grid-template-columns: minmax(0, 1fr); } .preview-frame { height: 1100px; }
    .item-heading { flex-wrap: wrap; gap: 6px; } .item-actions { flex-wrap: wrap; }
  }
</style>
