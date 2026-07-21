<script lang="ts">
  import { validate } from '@metriccanvas/page';
  import {
    DEFAULT_PREVIEW_JSON,
    parsePreviewDocument
  } from '$lib/preview-document';
  import { catalogSnapshot } from '$lib/services';
  import PageView from '../pages/[pageId]/+page.svelte';

  let source = $state(DEFAULT_PREVIEW_JSON);
  let result = $derived(
    parsePreviewDocument(source, (document) => validate(document, catalogSnapshot))
  );
</script>

<svelte:head>
  <title>Page JSON 即时预览 · MetricCanvas</title>
</svelte:head>

<div class="preview-page">
  <div class="preview-heading">
    <div>
      <h1>Page JSON 即时预览</h1>
      <p>左侧编辑新版 Page 协议，右侧复用正式页面的校验、数据编排与组件渲染。</p>
    </div>
    <button type="button" onclick={() => (source = DEFAULT_PREVIEW_JSON)}>恢复示例</button>
  </div>

  <div class="workspace">
    <section class="editor-panel" aria-labelledby="editor-title">
      <div class="panel-title">
        <h2 id="editor-title">Page JSON</h2>
        {#if result.status === 'valid'}
          <span class="status valid">契约有效</span>
        {:else}
          <span class="status invalid">需要修复</span>
        {/if}
      </div>

      <textarea
        aria-label="Page JSON 编辑器"
        bind:value={source}
        spellcheck="false"
        autocapitalize="off"
      ></textarea>

      {#if result.status === 'syntax-error'}
        <div class="error-box" role="alert">
          <strong>JSON 语法错误</strong>
          <code>{result.message}</code>
        </div>
      {:else if result.status === 'contract-error'}
        <div class="error-box" role="alert">
          <strong>Page 文档未通过契约校验</strong>
          <ul>
            {#each result.errors as error}
              <li>
                <code>{error.path}</code>
                <span>{error.message}</span>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </section>

    <section class="render-panel" aria-labelledby="render-title">
      <div class="panel-title">
        <h2 id="render-title">即时预览</h2>
      </div>
      <div class="render-surface">
        {#if result.status === 'valid'}
          <PageView document={result.document} />
        {:else}
          <div class="empty-preview">
            <strong>暂时无法渲染</strong>
            <span>修复左侧错误后，预览会自动恢复。</span>
          </div>
        {/if}
      </div>
    </section>
  </div>
</div>

<style>
  .preview-page {
    display: flex;
    min-height: calc(100vh - 100px);
    flex-direction: column;
    gap: 18px;
  }
  .preview-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }
  h1,
  h2,
  p {
    margin: 0;
  }
  h1 {
    font-size: 22px;
  }
  .preview-heading p {
    margin-top: 6px;
    color: #71717a;
    font-size: 14px;
  }
  button {
    flex: none;
    padding: 8px 13px;
    color: #3f3f46;
    background: #fff;
    border: 1px solid #d4d4d8;
    border-radius: 8px;
    cursor: pointer;
  }
  button:hover {
    border-color: #818cf8;
    color: #4338ca;
  }
  .workspace {
    display: grid;
    min-height: 0;
    flex: 1;
    grid-template-columns: minmax(340px, 0.9fr) minmax(480px, 1.1fr);
    gap: 16px;
  }
  .editor-panel,
  .render-panel {
    display: flex;
    min-width: 0;
    min-height: 640px;
    flex-direction: column;
    overflow: hidden;
    background: #fff;
    border: 1px solid #e4e4e7;
    border-radius: 12px;
  }
  .panel-title {
    display: flex;
    min-height: 46px;
    box-sizing: border-box;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-bottom: 1px solid #e4e4e7;
  }
  h2 {
    font-size: 14px;
    font-weight: 650;
  }
  .status {
    padding: 3px 8px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
  }
  .status.valid {
    color: #166534;
    background: #dcfce7;
  }
  .status.invalid {
    color: #991b1b;
    background: #fee2e2;
  }
  textarea {
    width: 100%;
    min-height: 470px;
    box-sizing: border-box;
    flex: 1;
    padding: 16px;
    resize: none;
    color: #27272a;
    background: #fafafa;
    border: 0;
    outline: none;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 13px;
    line-height: 1.55;
    tab-size: 2;
  }
  textarea:focus {
    background: #fff;
    box-shadow: inset 0 0 0 2px rgb(99 102 241 / 0.28);
  }
  .error-box {
    max-height: 190px;
    padding: 12px 14px;
    overflow: auto;
    color: #991b1b;
    background: #fff7f7;
    border-top: 1px solid #fecaca;
    font-size: 13px;
  }
  .error-box strong,
  .error-box > code {
    display: block;
  }
  .error-box > code {
    margin-top: 6px;
    white-space: pre-wrap;
  }
  .error-box ul {
    display: flex;
    flex-direction: column;
    gap: 7px;
    padding: 0;
    margin: 8px 0 0;
    list-style: none;
  }
  .error-box li {
    display: grid;
    gap: 2px;
  }
  .error-box li code {
    color: #52525b;
  }
  .render-surface {
    min-height: 0;
    flex: 1;
    padding: 18px;
    overflow: auto;
    background: #f8fafc;
  }
  .empty-preview {
    display: flex;
    min-height: 300px;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 6px;
    color: #71717a;
    text-align: center;
  }
  .empty-preview strong {
    color: #3f3f46;
  }
  @media (max-width: 900px) {
    .workspace {
      grid-template-columns: minmax(0, 1fr);
    }
    .editor-panel,
    .render-panel {
      min-height: 560px;
    }
    .render-panel {
      min-height: 640px;
    }
  }
  @media (max-width: 600px) {
    .preview-heading {
      align-items: stretch;
      flex-direction: column;
    }
    button {
      align-self: flex-start;
    }
    .editor-panel,
    .render-panel {
      min-height: 520px;
    }
    .render-surface {
      padding: 10px;
    }
  }
</style>
