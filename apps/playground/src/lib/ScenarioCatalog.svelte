<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { Input, Select, Tabs } from '@metriccanvas/ui';
  import { componentCatalog } from '@metriccanvas/page';
  import { pageRepository } from './services';
  import { rememberDirectoryHref } from './directory-return';
  import { dimensions, directoryTopics, directoryLocation, belongsTo, availableScenes, scenesForTopic, searchScenes, resolveScene, sceneRelations, sceneHomeHref, sceneBreadcrumb, catalogHref, type Dimension } from './scenario-directory';
  import { dataLayout, featuresForLayout, resolveFeature, featureExamples, featureHref, type FeatureView } from './data-directory';
  import DataFeatureDirectory from './DataFeatureDirectory.svelte';
  import ScenarioWorkbench from './ScenarioWorkbench.svelte';
  import type { PlaygroundPageEntry } from './page-entry';
  import type { Scene } from '../../scenarios/catalog';

  let { dimension, topic }: { dimension?: string; topic?: string } = $props();
  const directory = pageRepository.list();
  const location = $derived(directoryLocation(dimension, topic));
  const topics = $derived(directoryTopics(location.dimension));
  const query = $derived(page.url.searchParams.get('q') ?? '');
  $effect(() => rememberDirectoryHref(page.url.pathname + page.url.search));

  function setQuery(value: string) {
    const url = new URL(page.url);
    if (value) url.searchParams.set('q', value); else url.searchParams.delete('q');
    void goto(url, { replaceState: true, noScroll: true, keepFocus: true });
  }

  function changeDimension(value: string) {
    const kind = value as Dimension;
    void goto(catalogHref(kind, directoryTopics(kind)[0]!.id), { keepFocus: true });
  }

  function selectScene(sceneId: string) {
    void goto(catalogHref(location.dimension, location.topic.id, sceneId), { noScroll: true });
  }

  function selectExample(scene: Scene, example: string, search?: string) {
    const target = new URL(catalogHref(location.dimension, location.topic.id, scene.id, example), page.url);
    if (search !== undefined) target.searchParams.set('exampleSearch', search);
    void goto(target, { noScroll: true });
  }
  function selectDataExample(feature: FeatureView, available: Scene[], pages: PlaygroundPageEntry[], id: string, search?: string) {
    const example = featureExamples(feature, available, pages).find(item => item.entry.id === id);
    if (!example) return;
    void goto(featureHref(feature, example.entry.layoutForm, example, search), { noScroll: true, keepFocus: true });
  }
</script>

<svelte:head><title>{location.topic.title} · 页面试验场</title></svelte:head>
<main class="catalog-page">
  <header class="catalog-heading">
    <h1>页面试验场</h1>
    <nav aria-label="其他示例"><a href="/files?scope=business">业务示例</a><a href="/files?scope=temporary">临时评测</a><a href="/files">全部文件</a><a href="/preview">JSON 即时预览</a></nav>
  </header>
  <div class="catalog-tools"><Tabs options={dimensions} value={location.dimension} onchange={changeDimension} label="浏览维度" />
    <div class="search"><Input type="search" label={location.dimension === 'data' ? '搜索数据功能' : '搜索推荐场景'} placeholder="搜索组件、功能或页面 ID" value={query} oninput={setQuery} /></div>
  </div>
  {#await directory}<p role="status">加载推荐场景…</p>{:then pages}
    {@const available = availableScenes(pages)}
    {@const layout = dataLayout(available, pages, page.url.searchParams)}
    {@const dataEntries = featuresForLayout(available, pages, layout)}
    {@const matches = searchScenes(available, pages, query)}
    {@const grouped = scenesForTopic(available, pages, location.dimension, location.topic.id)}
    {@const dataSelected = resolveFeature(dataEntries.filter(feature => feature.topic === location.topic.id), page.url.searchParams)}
    {@const selected = location.dimension === 'data' ? { scene: dataSelected.example?.scene, example: dataSelected.example?.entry.id } : resolveScene(grouped, page.url.searchParams.get('scene'), page.url.searchParams.get('example'))}
    <div class="catalog-body">
      <aside><nav aria-label={dimensions.find(item => item.value === location.dimension)?.label + '目录'}>
        {#each topics as item}
          <a class:active={location.topic.id === item.id} aria-current={location.topic.id === item.id ? 'page' : undefined}
            href={catalogHref(location.dimension, item.id) + (location.dimension === 'data' ? `?layout=${layout}` : '')}><span>{item.title}</span><small>{location.dimension === 'data' ? dataEntries.filter(feature => feature.topic === item.id).length : available.filter(scene => belongsTo(scene, location.dimension, item.id)).length}</small></a>
        {/each}
      </nav></aside>
      <div class="catalog-content">
        {#if query.trim() && location.dimension === 'data'}
          <DataFeatureDirectory features={dataEntries} {layout} topic={location.topic.id} {query} />
        {:else if query.trim()}
          <div class="section-heading"><h2>搜索推荐场景</h2><p role="status">{matches.length} 个场景 · 不含临时评测</p></div>
          <ul class="search-results">{#each matches as scene}<li><a href={sceneHomeHref(scene)}><strong>{scene.title}</strong><span>{sceneBreadcrumb(scene)}</span><span>{scene.question}</span></a></li>{:else}<li>没有找到匹配场景。可以修改关键词，或到<a href="/files">全部文件</a>查找。</li>{/each}</ul>
        {:else}
          {#if location.dimension !== 'data'}<div class="section-heading"><h2>{location.topic.title}</h2><p>{location.topic.description}</p></div>{/if}
          {#if location.invalid}<p role="status">原目录已失效，已显示可用目录。</p>{/if}
          {#if selected.scene && selected.example}
            {@const scene = selected.scene}
            {@const entry = pages.find(item => item.id === selected.example)!}
            {#if location.dimension !== 'data' && ((page.url.searchParams.has('scene') && page.url.searchParams.get('scene') !== scene.id) || (page.url.searchParams.has('example') && page.url.searchParams.get('example') !== entry.id))}
              <p role="status">原场景或变体已失效，已显示当前目录的可用演示。</p>
            {/if}
            {#if location.dimension === 'data'}
              <DataFeatureDirectory features={dataEntries} {layout} topic={location.topic.id} {query} />
            {:else}
            <div class="selectors">
              <div><Select label="能力场景" value={scene.id} options={grouped.map(item => ({ value: item.id, label: item.title }))} onchange={selectScene} /></div>
              <div><Select label="演示变体" value={entry.id} options={scene.pages.map(id => ({ value: id, label: pages.find(item => item.id === id)!.title }))} onchange={value => selectExample(scene, value)} /></div>
            </div>
            {/if}
            {#key `${entry.id}-${scene.isolateComponents && location.dimension === 'components' ? location.topic.id : ''}`}<ScenarioWorkbench {scene} {entry}
              relations={sceneRelations(scene, entry.id, page.url.searchParams.get('exampleSearch') ?? undefined)}
              runtimeSearch={page.url.searchParams.get('example') === entry.id ? page.url.searchParams.get('exampleSearch') ?? undefined : undefined}
              onexample={(id, search) => location.dimension === 'data' ? selectDataExample(dataSelected.feature!, available, pages, id, search) : selectExample(scene, id, search)}
              focus={location.dimension === 'components' ? location.topic.id : ''} />{/key}
          {:else if location.dimension === 'data'}
            <DataFeatureDirectory features={dataEntries} {layout} topic={location.topic.id} {query} />
          {:else}
            <p role="status">该目录暂缺独立演示，已列入待补场景。</p>
            <a href={`/files?component=${encodeURIComponent(location.topic.id)}`}>查看包含该组件的全部页面</a>
          {/if}
        {/if}
      </div>
    </div>
    <footer>{componentCatalog.length} 类组件 · {available.length} 个推荐场景 · {pages.length} 份页面文档。原页面地址继续可用。</footer>
  {:catch error}<p role="alert">推荐目录加载失败：{String(error)}</p>{/await}
</main>

<style>
  .catalog-page{max-width:1600px;margin:0 auto;padding:16px 24px 48px}.catalog-heading{display:flex;justify-content:space-between;align-items:center;gap:24px;margin-bottom:8px}h1{font-size:20px;margin:0}.catalog-heading nav{display:flex;gap:16px;flex-wrap:wrap}.catalog-heading a,a{font-size:13px;color:#52525b;text-underline-offset:3px}.catalog-tools{display:flex;justify-content:space-between;align-items:center;gap:24px;border-bottom:1px solid #e4e4e7;margin-bottom:12px;padding-bottom:4px}.search{width:320px;max-width:100%}.catalog-body{display:grid;grid-template-columns:190px minmax(0,1fr);gap:28px}aside nav{display:grid;gap:4px}aside a{display:flex;justify-content:space-between;gap:8px;padding:10px 12px;text-decoration:none;border-radius:6px;line-height:1.5}aside a.active{background:#f0f0f0;color:#191919;font-weight:600}aside a:hover{background:#f5f5f5}small{font-size:11px;font-weight:400;color:#808080}.catalog-content{min-width:0}.section-heading{display:flex;align-items:baseline;gap:8px 16px;flex-wrap:wrap;margin-bottom:12px}.section-heading h2{font-size:20px;margin:0}.section-heading p{font-size:13px;color:#71717a;line-height:1.7;margin:0}.selectors{display:grid;grid-template-columns:minmax(160px,1fr) minmax(180px,2fr);gap:16px;margin-bottom:8px}.selectors>div{min-width:0}.search-results{list-style:none;padding:0;margin:0;display:grid;gap:12px}.search-results li>a{display:grid;gap:8px;padding:16px;border:1px solid #e4e4e7;border-radius:8px;background:white;text-decoration:none}.search-results span{line-height:1.7;color:#71717a}footer{font-size:12px;color:#71717a;border-top:1px solid #e4e4e7;margin-top:32px;padding-top:16px}a:focus-visible{outline:2px solid #191919;outline-offset:3px}@media(max-width:800px){.catalog-page{padding:16px}.catalog-heading,.catalog-tools{align-items:flex-start;flex-direction:column;gap:8px}.search{width:100%}.catalog-body{grid-template-columns:minmax(0,1fr);gap:20px}aside nav{display:flex;flex-wrap:wrap;gap:4px}aside a{padding:7px 10px}.selectors{grid-template-columns:minmax(0,1fr)}}
</style>
