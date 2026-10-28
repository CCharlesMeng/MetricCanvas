<!-- THROWAWAY: all alternatives expanded on one page, as requested for review.
     Decisions stay in memory; copy the review to keep it. No standards adopted yet. -->
<script lang="ts">
  import { Button } from '@metriccanvas/ui';
  import CandidatePreview from '$lib/prototypes/report-layout-review/CandidatePreview.svelte';
  import { groups, candidates, decisions, initialReviews, reviewLabel, type Decision, type Review } from '$lib/prototypes/report-layout-review/model';
  let reviews = $state<Record<string, Review>>(initialReviews());
  let copyState = $state('复制审核记录');
  const reviewed = $derived(Object.values(reviews).filter(review => review.decision).length);
  const records = $derived(candidates.map(option => ({ id: option.id, title: option.title, decision: reviews[option.id]?.decision ?? '待审核', note: reviews[option.id]?.note ?? '' })));
  function choose(id: string, decision: Decision) {
    reviews[id] = { ...reviews[id], decision };
    copyState = '复制审核记录';
  }
  function annotate(id: string, note: string) {
    reviews[id] = { ...reviews[id], note };
    copyState = '复制审核记录';
  }
  async function copyReview() {
    try {
      await navigator.clipboard.writeText(JSON.stringify({ kind: 'report-layout-review', date: '2026-10-27', records }, null, 2));
      copyState = '已复制';
    } catch {
      copyState = '请从底部记录中手动复制';
    }
  }
</script>

<svelte:head><title>Report 布局候选 · 集中审核</title></svelte:head>

<main>
  <header class="intro">
    <p class="eyebrow">LAYOUT REVIEW <span>临时审核 · PC</span></p>
    <h1>先看效果，再定标准。</h1>
    <p class="lead">五类组合，十二种排法。所有候选都在本页展开；同组沿用相同数据，重点看信息层级、密度和对照是否顺手。</p>
    <div class="scope"><span>11 项通过审核</span><span>已接入 MC 创作参考</span><span>1 项不采用</span></div>
    <p class="boundary">已载入最终审核结论。C1-B 仅变化值补齐红绿；C4-A 同排构成卡已保留。C3-B 仅留档。实际创作按本轮 MC 内容包及工具能力选择可执行表达；所有样本仍为合成数据。</p>
  </header>
  <div class="review-layout">
    <aside class="directory">
      <p>本页目录</p>
      <nav aria-label="候选布局目录">{#each groups as group (group.id)}<a href={`#${group.id}`}><span>{group.number}</span>{group.title}<small>{group.options.length}</small></a>{/each}</nav>
      <div class="review-progress" aria-live="polite"><strong>{reviewed}<span> / 12</span></strong><p>已审核</p></div>
      <Button onclick={copyReview}>{copyState}</Button>
      <p class="save-note">本轮审核结论已落盘。页面中的临时修改可复制；刷新会还原为你提交的结论。</p>
      <a class="old-link" href="/pages/report-layout-patterns-1026" target="_blank" rel="noreferrer">查看上一版展示 ↗</a>
    </aside>
    <div class="options">
      {#each groups as group (group.id)}
        <section class="group" id={group.id} aria-labelledby={`title-${group.id}`}>
          <header class="group-heading"><span>{group.number}</span><div><h2 id={`title-${group.id}`}>{group.title}</h2><p>{group.question}</p></div></header>
          {#each group.options as option (option.id)}
            <article class="candidate" class:rejected={reviews[option.id]?.decision === '不采用'} id={option.id} data-candidate={option.id}>
              <header class="candidate-heading"><div><span class="option-id">{option.id}</span><h3>{option.title}</h3></div><span class="proposal">{reviewLabel(reviews[option.id]?.decision)}</span></header>
              <div class="preview"><CandidatePreview id={option.id} /></div>
              <div class="explanation"><p><span>适用</span>{option.use}</p><p><span>看点</span>{option.change}</p></div>
              <footer>
                <fieldset aria-label={`${option.id} 审核结论`}><legend>你的判断</legend>{#each decisions as decision}<label><input type="radio" name={`decision-${option.id}`} value={decision} checked={reviews[option.id]?.decision === decision} onchange={() => choose(option.id, decision)} />{decision}</label>{/each}</fieldset>
                <input class="note" aria-label={`${option.id} 调整意见`} placeholder="哪里需要调整？（可选）" value={reviews[option.id]?.note ?? ''} oninput={event => annotate(option.id, event.currentTarget.value)} />
              </footer>
            </article>
          {/each}
        </section>
      {/each}
      <section class="review-record"><h2>审核记录</h2><p>可以直接回复编号，例如“C1-A 保留，C4-A 图再大一点”。这里的选择不会自动修改标准或页面。</p><details><summary>展开当前记录 · {reviewed} / 12 已审核</summary><pre>{JSON.stringify(records, null, 2)}</pre></details></section>
    </div>
  </div>
</main>

<style>
  main { max-width: 1400px; margin: 0 auto; padding: 48px 36px 80px; }
  .intro { margin: 0 0 46px 218px; max-width: 960px; }
  .eyebrow { display: flex; align-items: center; gap: 16px; font-size: 11px; letter-spacing: 1.5px; font-weight: 600; color: #5671e8; }
  .eyebrow span { font-weight: 400; color: #8a919e; letter-spacing: 0; }
  h1 { font-size: 34px; font-weight: 600; letter-spacing: -1px; margin: 18px 0; line-height: 1.35; }
  .lead { font-size: 15px; line-height: 1.9; max-width: 800px; color: #646b78; }
  .scope { display: flex; gap: 20px; font-size: 12px; color: #646b78; margin-top: 22px; }
  .scope span + span { border-left: 1px solid #dfe3ea; padding-left: 20px; }
  .boundary { font-size: 12px; line-height: 1.8; color: #8a919e; margin-top: 14px; }
  .review-layout { display: grid; grid-template-columns: 180px minmax(0, 1fr); gap: 38px; align-items: start; }
  .directory { position: sticky; top: 28px; font-size: 13px; }
  .directory > p:first-child { font-size: 11px; color: #8a919e; margin: 0 0 12px; }
  nav { display: grid; gap: 3px; }
  nav a { display: flex; gap: 10px; align-items: center; padding: 10px 0; text-decoration: none; color: #555e6d; }
  nav a:hover { color: #5671e8; }
  nav span { font-size: 11px; color: #9aa1ad; font-variant-numeric: tabular-nums; }
  nav small { margin-left: auto; color: #9aa1ad; }
  .review-progress { border-top: 1px solid #e6e9ef; padding-top: 22px; margin: 22px 0; }
  .review-progress strong { font-size: 26px; font-weight: 500; }
  .review-progress strong span { font-size: 14px; color: #9aa1ad; }
  .review-progress p { font-size: 12px; color: #8a919e; margin: 4px 0 0; }
  .save-note { font-size: 11px; color: #8a919e; line-height: 1.8; margin: 14px 0 22px; }
  .old-link { font-size: 12px; color: #646b78; text-decoration: none; }
  .group { scroll-margin-top: 28px; margin-bottom: 60px; }
  .group-heading { display: flex; gap: 14px; align-items: baseline; margin: 0 0 20px; }
  .group-heading > span { font-size: 13px; color: #5671e8; }
  h2 { font-size: 21px; font-weight: 600; margin: 0 0 7px; }
  .group-heading p { font-size: 13px; color: #8a919e; margin: 0; }
  .candidate { background: #fff; border: 1px solid #e4e8ef; border-radius: 12px; margin-bottom: 24px; overflow: hidden; scroll-margin-top: 24px; }
  .candidate.rejected { border-style: dashed; }
  .candidate.rejected .preview { opacity: .55; }
  .candidate-heading { display: flex; align-items: center; justify-content: space-between; padding: 18px 24px; border-bottom: 1px solid #edf0f5; }
  .candidate-heading > div { display: flex; gap: 12px; align-items: center; }
  .candidate-heading h3 { margin: 0; font-size: 14px; font-weight: 500; }
  .option-id { font-size: 11px; font-variant-numeric: tabular-nums; color: #5671e8; background: #f0f3ff; padding: 3px 7px; border-radius: 4px; }
  .proposal { font-size: 11px; color: #9aa1ad; }
  .preview { padding: 28px; min-width: 0; }
  .explanation { display: grid; gap: 5px; padding: 14px 24px; border-top: 1px solid #edf0f5; background: #fcfcfe; }
  .explanation p { font-size: 12px; line-height: 1.8; color: #646b78; margin: 0; }
  .explanation span { color: #9aa1ad; margin-right: 12px; }
  footer { display: flex; align-items: center; gap: 24px; padding: 14px 24px; border-top: 1px solid #edf0f5; }
  fieldset { display: flex; gap: 14px; border: 0; padding: 0; margin: 0; flex: none; }
  legend { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  fieldset label { display: flex; gap: 5px; align-items: center; font-size: 12px; color: #646b78; cursor: pointer; }
  input[type=radio] { accent-color: #5671e8; margin: 0; }
  .note { width: 100%; min-width: 0; border: 1px solid #e4e8ef; border-radius: 5px; padding: 8px 10px; font: inherit; font-size: 12px; background: #fff; outline-offset: 2px; }
  .note::placeholder { color: #a3a9b4; }
  .review-record { border-top: 1px solid #e4e8ef; padding-top: 24px; }
  .review-record p, summary { font-size: 13px; color: #646b78; line-height: 1.8; }
  summary { cursor: pointer; }
  pre { max-height: 400px; overflow: auto; padding: 20px; font-size: 12px; background: #fff; border: 1px solid #e4e8ef; border-radius: 8px; }
  @media (max-width: 1100px) { main { padding: 32px 24px 60px; } .intro { margin-left: 0; } .review-layout { grid-template-columns: 1fr; } .directory { position: static; } nav { display: flex; flex-wrap: wrap; gap: 20px; } .review-progress, .save-note, .old-link { display: none; } .directory > :global(button) { margin-top: 12px; } }
  @media (max-width: 700px) { .preview { padding: 18px; } footer { flex-wrap: wrap; gap: 12px; } .scope { gap: 10px; flex-wrap: wrap; } h1 { font-size: 28px; } }
</style>
