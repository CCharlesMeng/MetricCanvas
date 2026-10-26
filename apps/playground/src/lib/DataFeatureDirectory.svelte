<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { Select, Tabs } from '@metriccanvas/ui';
  import { dataLayouts, featureHref, featureSearch, resolveFeature, type DataLayout, type FeatureView } from './data-directory';
  import { dataTopics } from './scenario-directory';

  let { features, layout, topic, query }: { features: FeatureView[]; layout: DataLayout; topic: string; query: string } = $props();
  const grouped = $derived(features.filter(feature => feature.topic === topic));
  const selected = $derived(resolveFeature(grouped, page.url.searchParams));
  const matches = $derived(featureSearch(features, query));

  function changeLayout(value: string) {
    const url = new URL(page.url);
    url.searchParams.set('layout', value);
    url.searchParams.delete('example');
    url.searchParams.delete('exampleSearch');
    url.searchParams.delete('scene');
    void goto(url, { noScroll: true, keepFocus: true });
  }

  function selectExample(id: string, search?: string) {
    const feature = selected.feature;
    if (!feature) return;
    const example = feature.entries.find(item => item.entry.id === id);
    if (!example) return;
    void goto(featureHref(feature, layout, example, search), { noScroll: true, keepFocus: true });
  }

  function featureLink(feature: FeatureView) {
    const current = feature.entries.find(example => example.entry.id === selected.example?.entry.id);
    return featureHref(feature, layout, current ?? feature.entries[0], current ? page.url.searchParams.get('exampleSearch') ?? undefined : undefined);
  }

</script>

<div class="data-heading">
  <h2>{query.trim() ? '搜索数据功能' : dataTopics.find(item => item.id === topic)?.title}</h2>
  <Tabs options={dataLayouts} value={layout} onchange={changeLayout} label="数据功能的布局形态" />
</div>
{#if query.trim()}
  <p class="hint" role="status">{layout === 'dashboard' ? '看板' : '报表'} · {matches.length} 项功能 · 不含临时评测</p>
  <ul class="feature-results">
    {#each matches as feature}<li><a href={featureHref(feature, layout, feature.entries[0])}><strong>{feature.title}</strong><span>{dataTopics.find(item => item.id === feature.topic)?.title} · {layout === 'dashboard' ? 'Dashboard' : 'Report'}</span><span>{feature.description}</span></a></li>
    {:else}<li>当前布局形态没有匹配功能，可切换布局形态或修改关键词。</li>{/each}
  </ul>
{:else}
  <nav class="feature-list" aria-label="数据功能">
    {#each grouped as feature}<a class:active={feature.id === selected.feature?.id} aria-current={feature.id === selected.feature?.id ? 'page' : undefined} href={featureLink(feature)}>{feature.title}</a>{/each}
  </nav>
  {#if selected.unavailable}<p class="hint" role="status">所选功能在当前布局形态下暂无演示，已显示可用功能。</p>{/if}
  {#if selected.staleExample}<p class="hint" role="status">原演示不属于当前功能或布局形态，已显示可用演示。</p>{/if}
  {#if selected.feature && selected.example}
    {@const feature = selected.feature}
    {@const example = selected.example}
    <div class="function-heading">
      <div><h3>{feature.title}</h3><p class="hint">{feature.description}</p></div>
      {#if feature.entries.length > 1}<div class="example-choice"><Select label="功能演示" value={example.entry.id} options={feature.entries.map(item => ({ value: item.entry.id, label: item.entry.title }))} onchange={selectExample} /></div>
      {:else}<span class="example-name">演示：{example.entry.title}</span>{/if}
    </div>
  {:else}<p role="status">当前阶段暂无{layout === 'dashboard' ? '看板' : '报表'}功能演示，可切换布局形态或数据阶段。</p>{/if}
{/if}

<style>
  .data-heading{display:flex;align-items:center;justify-content:space-between;gap:8px 20px;flex-wrap:wrap;margin-bottom:8px}.data-heading h2{font-size:20px;margin:0}.feature-list{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px}.feature-list a{font-size:13px;line-height:1.5;padding:7px 10px;border-radius:6px;text-decoration:none;color:#52525b}.feature-list a.active{background:#f0f0f0;color:#191919;font-weight:600}.feature-list a:hover{background:#f5f5f5}.function-heading{display:flex;align-items:center;justify-content:space-between;gap:8px 20px;flex-wrap:wrap;margin-bottom:8px}.function-heading>div{min-width:0}.function-heading h3{font-size:15px;margin:0}.hint,.example-name{font-size:12px;color:#71717a;line-height:1.7;margin:4px 0}.example-choice{width:300px;max-width:100%}.feature-results{list-style:none;padding:0;display:grid;gap:12px}.feature-results a{display:grid;gap:8px;padding:16px;border:1px solid #e4e4e7;border-radius:8px;background:white;text-decoration:none;color:#52525b;font-size:13px}.feature-results span{line-height:1.7;color:#71717a}a:focus-visible{outline:2px solid #191919;outline-offset:3px}@media(max-width:800px){.example-choice{width:100%}}
</style>
