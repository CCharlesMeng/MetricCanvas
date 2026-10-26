<script lang="ts">
  import { Button, Tabs, Textarea } from '@metriccanvas/ui';
  import { untrack } from 'svelte';
  import { validate } from '@metriccanvas/page';
  import { RuntimeView } from '@metriccanvas/engine/ui';
  import { pageRepository, aiSummary } from './services';
  import { parsePreviewDocument } from './preview-document';
  import { scenarioEnvironment } from './scenario-environment';
  import { exampleHref } from './scenario-directory';
  import { readScenarioGuide } from './scenario-readmes';
  import { sourceFacts, componentConfiguration, isolatedDocument } from './scenario-guide';
  import { sceneCompanions, pageSearchInputs, type Scene } from '../../scenarios/catalog';
  import type { PlaygroundPageEntry } from './page-entry';

  let { scene, entry, relations = [], focus = '', runtimeSearch, onexample }: {
    scene: Scene; entry: PlaygroundPageEntry; focus?: string; runtimeSearch?: string;
    relations?: { title: string; href: string }[];
    onexample?: (id: string, search: string) => void;
  } = $props();
  // The parent keys this component by trusted example, so drafts and adapters cannot leak across examples.
  const initialEntry = untrack(() => entry);
  const initialFocus = untrack(() => focus);
  const isolate = untrack(() => scene.isolateComponents);
  const loaded = pageRepository.load(initialEntry.id).then(document => isolate ? isolatedDocument(document, initialFocus) : document);
  const guide = readScenarioGuide(initialEntry);
  const environment = scenarioEnvironment(initialEntry.id);
  let mode = $state('interactive');
  let source = $state('');
  let original = $state('');
  let revision = $state(0);
  let frame = $state<HTMLIFrameElement>();
  const result = $derived(parsePreviewDocument(source, validate));
  const frameHref = $derived(runtimeSearch === undefined ? exampleHref(entry.id) : `/pages/${encodeURIComponent(entry.id)}${runtimeSearch ? `?${runtimeSearch}` : ''}`);
  const editOptions = [{ value: 'interactive', label: '交互演示' }, { value: 'edit', label: '在此基础上试改' }];

  function initialize(document: unknown) {
    original = JSON.stringify(document, null, 2);
    source = original;
  }
  loaded.then(initialize).catch(() => {});

  function resetDraft() { source = original; revision++; }

  function trackFrame(event: Event) {
    try { trackPage(event.currentTarget as HTMLIFrameElement); } catch { /* External frames cannot supply a catalog example. */ }
  }

  function trackPage(frame: HTMLIFrameElement) {
    const url = frame.contentWindow?.location;
    if (!url || url.origin !== window.location.origin) return;
    const match = /^\/pages\/([^/]+)$/.exec(url.pathname);
    if (!match) return;
    const id = decodeURIComponent(match[1]!);
    if (id !== entry.id && scene.pages.includes(id)) onexample?.(id, url.search.slice(1));
  }

  function trackMessage(event: MessageEvent) {
    if (event.origin !== window.location.origin || event.source !== frame?.contentWindow) return;
    if (event.data?.type !== 'metriccanvas:preview-location') return;
    if (typeof event.data.href !== 'string') return;
    try { if (frame) trackPage(frame); } catch { /* Ignore frames outside the current origin. */ }
  }
</script>

<svelte:window onmessage={trackMessage} />

<section class="scene-workbench" aria-label={scene.title}>
  <div class="actions">
    <Tabs options={editOptions} value={mode} onchange={value => mode = value} label="演示与试改" />
    <a href={frameHref} target="_blank" rel="noreferrer">独立打开当前页面 ↗</a>
    <details class="scene-notes">
      <summary>场景说明</summary>
      <p class="question">{scene.question}</p>
      <nav class="relations" aria-label="关联目录"><span>也可从这里查找：</span>{#each relations as relation}<a href={relation.href}>{relation.title}</a>{/each}</nav>
      <nav class="companions" aria-label="相关专题">{#each sceneCompanions[scene.id] ?? [] as companion}<a href={companion.href}>{companion.title} →</a>{/each}</nav>
      <p class="environment">
        数据：{entry.dataKind === 'inline' ? '内联合成数据，无需额外服务' : '包含查询，请查看下方运行条件'}。
        试改使用当前场景的网关与输入；不会保存页面文件。
      </p>
    </details>
  </div>
  {#if mode === 'interactive'}
    {#if isolate}
      {#await loaded}<p role="status">加载组件演示…</p>{:then document}
        <div class="draft-preview"><RuntimeView {document} dataGateway={environment.dataGateway} {aiSummary} /></div>
      {:catch error}<p role="alert">演示加载失败：{String(error)}</p>{/await}
    {:else}<iframe bind:this={frame} title={`交互演示：${entry.title}`} src={frameHref} onload={trackFrame}></iframe>{/if}
  {:else}
    <div class="draft-tools"><Button onclick={resetDraft}>恢复当前示例</Button><span role="status">{result.status === 'valid' ? '契约有效' : '需要修复'}</span></div>
    {#if 'setFact' in environment}
      <div class="draft-tools" aria-label="模拟事实输入">
        <Button onclick={() => environment.setFact?.('allow')}>允许</Button>
        <Button onclick={() => environment.setFact?.('deny')}>拒绝</Button>
        <Button onclick={() => environment.setFact?.('pending')}>等待</Button>
        <Button onclick={() => environment.setFact?.('error')}>输入错误</Button>
      </div>
    {/if}
    <div class="draft-workspace">
      <div class="editor"><Textarea label="当前场景 JSON" value={source} oninput={value => source = value} rows={20} /></div>
      <div class="draft-preview">
        {#if result.status === 'valid'}
          {#key revision}<RuntimeView document={result.document} dataGateway={environment.dataGateway}
            displayInputs={'displayInputs' in environment ? environment.displayInputs : undefined}
            initialSearch={runtimeSearch ?? pageSearchInputs[entry.id] ?? ''} {aiSummary} />{/key}
        {:else if result.status === 'syntax-error'}<p role="alert">JSON 语法错误：{result.message}</p>
        {:else}<ul role="alert">{#each result.errors as error}<li><code>{error.path}</code> {error.message}</li>{/each}</ul>{/if}
      </div>
    </div>
    <p class="note">试改渲染正式页面文档；跨页流程请使用交互演示。场景专属的外层组合界面不写入 JSON。</p>
  {/if}
  <div class="documentation">
    <section aria-label="操作与预期结果">
      <h3>操作与预期结果</h3>
      {#await guide}<p role="status">加载场景说明…</p>{:then blocks}
        {#each blocks as block}
          {#if block.kind === 'heading'}<h4>{block.text}</h4>
          {:else if block.kind === 'code'}<pre>{block.text}</pre>
          {:else}<p class="guide-line">{block.text}</p>{/if}
        {:else}<p>当前目录尚无独立操作说明。可先查看实际数据关系与配置。</p>{/each}
      {:catch}<p role="alert">说明加载失败，请重试。</p>{/await}
    </section>
    {#await loaded}<p role="status">读取运行配置…</p>{:then document}
      <section aria-label="数据关系与配置">
        <h3>数据关系</h3>
        <p class="note">以下信息直接读取当前页面文档。查询条件、关联口径和输出范围以场景说明为准。</p>
        {#each sourceFacts(document) as fact}
          <details><summary>{fact.id} · {fact.kind}</summary>
            <p>字段：{fact.fields.join('、')}</p><p>绑定条件：{fact.conditions.join('、') || '无显式查询筛选绑定'}</p>
            <p>直接消费者：{fact.consumers.join('、') || '由其他数据源或生成能力引用'}</p>
          </details>
        {:else}<p>本页没有页面数据源，交互声明与传入条件见完整 JSON。</p>{/each}
        <details><summary>{focus ? '当前组件配置' : '完整页面 JSON'}</summary><pre>{JSON.stringify(componentConfiguration(document, focus), null, 2)}</pre></details>
        {#if focus}<details><summary>完整页面 JSON</summary><pre>{JSON.stringify(document, null, 2)}</pre></details>{/if}
        <a download={`${entry.id}.json`} href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(document, null, 2))}`}>下载当前页面 JSON</a>
      </section>
    {:catch error}<p role="alert">配置加载失败：{String(error)}</p>{/await}
  </div>
</section>

<style>
  .scene-workbench{min-width:0}.question{font-size:15px;line-height:1.7;margin:12px 0}.actions{display:flex;align-items:center;gap:8px 16px;flex-wrap:wrap;margin-bottom:8px}.actions a,a{color:#52525b;font-size:13px}.environment,.note{font-size:12px;line-height:1.7;color:#71717a;margin:12px 0}iframe{display:block;width:100%;height:760px;border:1px solid #e4e4e7;background:white;box-sizing:border-box}.documentation{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:24px}.documentation section{min-width:0}h3{font-size:16px}h4{font-size:14px}.guide-line,p{overflow-wrap:anywhere}.guide-line{font-size:13px;line-height:1.8;white-space:pre-wrap}pre{max-height:420px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;background:#fafafa;padding:12px;font-size:12px;line-height:1.6}details{border-top:1px solid #e4e4e7;padding:10px 0;font-size:13px;overflow-wrap:anywhere}summary{cursor:pointer}.scene-notes{border:0;padding:0;margin-left:auto;color:#52525b}.scene-notes[open]{flex-basis:100%;margin-left:0;padding:8px 0}.relations,.companions{display:flex;gap:8px 16px;flex-wrap:wrap;line-height:1.8}.relations{color:#71717a}.companions:empty{display:none}.companions{margin-top:8px}.scene-notes .environment{margin-bottom:0}.draft-tools{display:flex;gap:16px;align-items:center;margin:16px 0}.draft-workspace{display:grid;grid-template-columns:minmax(260px,1fr) minmax(0,2fr);gap:16px}.editor,.draft-preview{min-width:0}.draft-preview{overflow:auto;border:1px solid #e4e4e7;padding:12px;background:white}.editor :global(textarea){min-height:620px;font-family:ui-monospace,monospace;font-size:12px}a:focus-visible,summary:focus-visible{outline:2px solid #191919;outline-offset:3px}@media(max-width:1000px){.documentation,.draft-workspace{grid-template-columns:minmax(0,1fr)}.editor :global(textarea){min-height:300px}}@media(max-width:600px){iframe{height:680px}.actions{gap:12px}}
</style>
