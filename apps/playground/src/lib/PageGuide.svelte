<script lang="ts">
  import { catalogCapabilities, pageCatalogGuide, runtimeInfo } from './page-catalog';
  import { headerSceneKey } from './ioc-header-showcase';
  import { guideConfig } from './page-guide-config';

  let { pageId, document }: { pageId: string; document: unknown } = $props();
  const entry = $derived(pageCatalogGuide(pageId));
  const topics = $derived(catalogCapabilities.filter((topic) => entry?.capabilities.includes(topic.id)));
  const references = $derived([...new Set(topics.flatMap((topic) => topic.docs))]);
  const json = $derived(JSON.stringify(document, null, 2));
</script>

{#if entry}
  {#key pageId}
    <aside class="page-guide" aria-label="示例使用说明">
      {#if entry.group === 'ioc-header'}<a class="header-entry" href={`/ioc-header?scene=${headerSceneKey(pageId)}`} target="_top">IOC 公共页头 · 完整演示与能力一览 →</a>{/if}
      <details>
        <summary><strong>体验与配置说明</strong><span>{entry.displayTitle}</span></summary>
        <div class="guide-content">
          <p class="purpose">{entry.summary}</p>
          <dl class="environment">
            <div><dt>数据性质</dt><dd>{entry.environment.data}</dd></div>
            <div><dt>运行条件</dt><dd>{runtimeInfo(entry.environment.runtime)?.title}</dd></div>
            <div><dt>可体验范围</dt><dd>{entry.environment.scope}</dd></div>
          </dl>
          <p class="startup">启动方式：<code>{runtimeInfo(entry.environment.runtime)?.startup}</code></p>
          <div class="guide-columns">
            <section>
              <h2>如何体验</h2>
              <ol>{#each entry.guide.steps as step}<li>{step}</li>{/each}</ol>
              <h2>适用边界</h2>
              <p>{entry.guide.boundary}</p>
            </section>
            <section>
              <h2>关键配置</h2>
              <p>展开查看当前页面的实际声明；局部片段需结合完整页面使用。</p>
              {#each entry.guide.configPaths as selector}
                <details class="config">
                  <summary><code>{selector}</code></summary>
                  {#each guideConfig(document, selector) as fragment}
                    <p><code>{fragment.path}</code></p>
                    <pre>{JSON.stringify(fragment.value, null, 2)}</pre>
                  {:else}
                    <p>当前文档中未找到此配置；请检查目录说明是否需要更新。</p>
                  {/each}
                </details>
              {/each}
              <a class="download" download={`${pageId}.json`} href={`data:application/json;charset=utf-8,${encodeURIComponent(json)}`}>下载完整 JSON</a>
            </section>
          </div>
          <section class="related">
            <h2>相关示例</h2>
            <ul>{#each entry.guide.related as id}
              {@const related = pageCatalogGuide(id)}
              {#if related}<li><a href={`/pages/${encodeURIComponent(id)}`}>{related.displayTitle}</a></li>{/if}
            {/each}</ul>
          </section>
          <details class="references">
            <summary>协议文档（仓库）</summary>
            <ul>{#each references as reference}
              <li><a href={`https://github.com/CCharlesMeng/MetricCanvas/blob/main/docs/page-metadata/${reference}.md`} target="_blank" rel="noreferrer">{reference}</a></li>
            {/each}</ul>
          </details>
        </div>
      </details>
    </aside>
  {/key}
{/if}

<style>
  .header-entry { display: block; padding: 10px 16px; border-bottom: 1px solid #e4e4e7; }
  .page-guide { margin: 16px 24px; border: 1px solid #d4d4d8; border-radius: 8px; background: white; color: #3f3f46; font-size: 13px; line-height: 1.7; }
  summary { cursor: pointer; padding: 12px 16px; overflow-wrap: anywhere; }
  summary > span { margin-left: 16px; color: #71717a; }
  .guide-content { padding: 0 20px 20px; border-top: 1px solid #e4e4e7; }
  .purpose { font-size: 14px; color: #18181b; }
  .environment { display: flex; gap: 16px 40px; flex-wrap: wrap; }
  dt { font-size: 12px; color: #71717a; }
  dd { margin: 0; }
  .startup { padding: 10px 12px; background: #fafafa; overflow-wrap: anywhere; }
  .guide-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  section { min-width: 0; }
  h2 { font-size: 13px; margin: 16px 0 8px; color: #18181b; }
  ol { padding-left: 22px; }
  li + li { margin-top: 6px; }
  .config { border: 1px solid #e4e4e7; border-radius: 6px; margin-bottom: 8px; }
  .config summary { padding: 8px 12px; }
  .config p { padding: 0 12px; overflow-wrap: anywhere; }
  pre { max-height: 260px; overflow: auto; padding: 12px; margin: 0; background: #fafafa; font-size: 12px; }
  a { color: #4338ca; text-underline-offset: 3px; }
  .download { display: inline-block; margin-top: 8px; }
  .related ul { display: flex; gap: 8px 24px; flex-wrap: wrap; padding-left: 18px; }
  .related li { margin-top: 0; }
  .references summary { padding: 12px 0 0; }
  a:focus-visible, summary:focus-visible { outline: 2px solid #6366f1; outline-offset: 3px; }
  @media (max-width: 700px) {
    .page-guide { margin: 12px; }
    summary > span { display: block; margin-left: 0; }
    .guide-columns { grid-template-columns: minmax(0, 1fr); gap: 0; }
  }
  @media print { .page-guide { display: none; } }
</style>
