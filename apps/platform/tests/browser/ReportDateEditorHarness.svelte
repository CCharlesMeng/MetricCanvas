<script lang="ts">
  import { RuntimeView } from '@metriccanvas/engine/ui';
  import type { RuntimeDataGateway } from '@metriccanvas/engine';
  import fixture from '../../../../packages/page/fixtures/contract-valid/report-date-filters-page.json';
  import ReportDateProperties from '../../src/lib/workbench/ReportDateProperties.svelte';
  import { createCanvasAuthoringDraft, type CanvasAuthoringDraft } from '../../src/lib/workbench/document-edit';
  import { editReportDate, type ReportDateEdit } from '../../src/lib/workbench/report-date-edit';
  function initial():CanvasAuthoringDraft {const result=createCanvasAuthoringDraft(fixture);if(!result.ok)throw Error(result.message);return result.draft;}
  let draft=$state(initial());let error=$state('');
  function editDate(edit:ReportDateEdit) {const result=editReportDate(draft,{sectionId:'header',componentId:'page-header'},edit);if(!result.ok){error=result.message;return;}draft=result.draft;error='';}
  const gateway:RuntimeDataGateway={async fetchData(query){const offset=query.pagination?.offset??0;const limit=query.pagination?.limit??53;return {rows:Array.from({length:Math.min(limit,53-offset)},(_,i)=>({entry:`项目 ${i+offset+1}`,amount:i+offset+1})),totalCount:53};}};
</script>
<main>
  <aside><h1>人工日期配置验收</h1><p>正式属性面板、编辑纯函数及运行时；本地合成数据。</p>
    <ReportDateProperties {draft} locator={{sectionId:'header',componentId:'page-header'}} onEdit={editDate}/>
    {#if error}<p role="alert">{error}</p>{/if}
  </aside>
  <RuntimeView document={draft.pageDocument} dataGateway={gateway}/>
</main>
<style>
  main { display:grid; grid-template-columns:340px minmax(0,1fr); gap:24px; padding:24px; font-family:system-ui; }
  aside { padding:16px; border:1px solid #e4e4e7; border-radius:8px; background:#fff; }
  h1 { font-size:18px; } p { font-size:13px; } [role=alert] {color:#b91c1c;}
  @media(max-width:700px){main{grid-template-columns:minmax(0,1fr);}}
</style>
