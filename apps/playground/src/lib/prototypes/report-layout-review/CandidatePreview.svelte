<!-- THROWAWAY: native widgets plus explicitly scoped proposals for review. -->
<script lang="ts">
  import { MetricCard, Table, RankingDetailCard, PieChart, CategoryBreakdown, LineChart, BarChart, TabContainer } from '@metriccanvas/engine/widgets';
  import { objectData, objectProps, matrixData, matrixProps, growthData, declineData, rankingProps, rankingData, rankingTable, stageData, groupedTable, stages, stageTable, categoryData, breakdownProps, categoryTable, history, historyTable, tableView, revenueCompositions, revenueBreakdownProps } from './model';
  let { id }: { id: string } = $props();
</script>

{#snippet historyChart()}
  <div class="trend"><LineChart data={history} props={{ xField: 'month', series: [{ field: 'tickets', label: '工单量（件）' }] }} /></div>
{/snippet}

<div class="sample" class:composition-proposal={id === 'C4-A' || id === 'C4-B'} data-sample={id}>
  {#if id === 'C1-A'}
    <h3>服务组本期概况</h3>
    <div class="two-columns">{#each objectData as object (object.title)}<MetricCard data={object} props={objectProps(object.title)} />{/each}</div>
  {:else if id === 'C1-B'}
    <h3>服务组指标对照</h3><div class="matrix-colors"><Table data={matrixData} props={matrixProps} view={tableView} interactive={false} /></div>
    <p class="color-note">仅变化值着色：时长下降绿、上升红；工单量增加绿、减少红，仅表示增减。</p>
  {:else if id === 'C2-A'}
    <h3>重点客户变化</h3><div class="two-columns"><RankingDetailCard data={growthData} props={rankingProps('positive')} /><RankingDetailCard data={declineData} props={rankingProps('negative')} /></div>
  {:else if id === 'C2-B'}
    <h3>重点客户变化及原因</h3><Table data={rankingData} props={rankingTable} view={tableView} interactive={false} />
  {:else if id === 'C3-A'}
    <h3>批次时长与各阶段参与量</h3><Table data={stageData} props={groupedTable} view={tableView} interactive={false} />
  {:else if id === 'C3-B'}
    <h3>批次时长与各阶段参与量</h3>
    <p class="context">累计时长：北城批次 A 9.4 小时 · 南城批次 B 7.5 小时</p>
    <div class="three-columns">{#each stages as stage (stage.id)}<section><h4>{stage.name}</h4><Table data={stageData} props={stageTable(stage.id)} view={tableView} interactive={false} /></section>{/each}</div>
  {:else if id === 'C4-A'}
    <div class="composition-row">
      {#each revenueCompositions as group (group.title)}
        <div class="horizontal-card" data-composition-module>
          <div class="card-heading"><h3>{group.title}</h3></div>
          <div class="ring-detail">
            <div class="ring"><PieChart data={group.data} props={{ categoryField: 'category', valueField: 'count', ring: '50%', labelLine: false }} /><div class="ring-total"><strong>{group.total}</strong><span>万元</span></div></div>
            <div class="breakdown"><CategoryBreakdown data={group.data} props={revenueBreakdownProps} /></div>
          </div>
        </div>
      {/each}
    </div>
  {:else if id === 'C4-B'}
    <div class="composition-card" class:narrow={id === 'C4-B'}>
      <div class="card-heading"><h3>业务工单构成</h3><span>2026 年 10 月</span></div>
      <div class="ring-detail" class:stacked={id === 'C4-B'}>
        <div class="ring"><PieChart data={categoryData} props={{ categoryField: 'category', valueField: 'count', ring: '50%', labelLine: false }} /><div class="ring-total"><strong>60</strong><span>工单总量 · 件</span></div></div>
        <div class="breakdown"><CategoryBreakdown data={categoryData} props={breakdownProps} /></div>
      </div>
    </div>
  {:else if id === 'C4-C'}
    <div class="card-heading"><h3>各类业务工单量</h3><span>合计 60 件</span></div>
    <div class="bar-detail"><div class="bar"><BarChart data={categoryData} props={{ categoryField: 'category', horizontal: true, series: [{ field: 'count', label: '工单量（件）' }] }} /></div><CategoryBreakdown data={categoryData} props={{ ...breakdownProps, swatches: false }} /></div>
  {:else if id === 'C4-D'}
    <div class="plain-detail"><div class="card-heading"><h3>业务工单构成</h3><span>合计 60 件 · 100%</span></div><Table data={categoryData} props={categoryTable} view={tableView} interactive={false} /></div>
  {:else if id === 'C5-A'}
    <h3>近三个月工单量</h3><TabContainer tabs={[{ id: 'overview', label: '概览' }, { id: 'details', label: '逐月明细' }]} defaultTab="overview">
      {#snippet children(tab)}{#if tab === 'overview'}{@render historyChart()}{:else}<div class="tab-detail"><Table data={history} props={historyTable} view={tableView} interactive={false} /></div>{/if}{/snippet}
    </TabContainer>
  {:else if id === 'C5-B'}
    <h3>近三个月工单量</h3>{@render historyChart()}<div class="continuous-detail"><h4>对应月份明细</h4><Table data={history} props={historyTable} view={tableView} interactive={false} /></div>
  {/if}
</div>

<style>
  .sample { color: #191919; font-size: 14px; line-height: 1.6; min-width: 0;
    --mc-card-title-font-size: 16px; --mc-card-title-font-weight: 500; --mc-card-title-line-height: 24px; --mc-card-title-color: #191919;
    --mc-table-header-surface: #f6f7f9; --mc-table-row-height: 46px;
    --mc-color-report-text: #191919; --mc-color-report-description: #646b78;
  }
  .composition-proposal { --mc-chart-categorical-colors: #5671e8, #33a8a3, #b0bce8; }
  /* Local visual proposal only: production rules must follow field semantics,
     not table positions. This fixed fixture has time first, volume second. */
  .matrix-colors :global(tbody tr:first-child td:nth-child(3)),
  .matrix-colors :global(tbody tr:nth-child(2) td:nth-child(3)) { color: var(--mc-color-positive, #52c41a); }
  .matrix-colors :global(tbody tr:first-child td:nth-child(5)),
  .matrix-colors :global(tbody tr:nth-child(2) td:nth-child(5)) { color: var(--mc-color-negative, #f5222d); }
  .color-note { margin: 14px 0 0; font-size: 12px; color: #8a919e; }
  h3 { margin: 0 0 22px; font-size: 16px; font-weight: 600; }
  h4 { margin: 0 0 12px; font-size: 14px; font-weight: 500; }
  .two-columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
  .three-columns { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }
  .three-columns > section { min-width: 0; }
  .context { margin: -8px 0 22px; font-size: 13px; color: #646b78; }
  .card-heading { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 18px; }
  .card-heading h3 { margin: 0; }
  .card-heading > span { font-size: 12px; color: #7a818f; white-space: nowrap; }
  .composition-card { max-width: 720px; margin: auto; }
  .composition-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
  .horizontal-card { min-width: 0; padding: 18px; border: 1px solid #e5e8ee; border-radius: 10px; }
  .horizontal-card .card-heading { margin-bottom: 10px; }
  .horizontal-card .card-heading h3 { font-size: 14px; }
  .horizontal-card .ring-detail { gap: 12px; }
  .horizontal-card .ring { width: 148px; height: 148px; }
  .horizontal-card .ring-total strong { font-size: 24px; }
  .horizontal-card .ring-total span { font-size: 10px; }
  .horizontal-card .breakdown { flex: 1; width: auto; }
  .horizontal-card :global(.category-breakdown .category + .measure),
  .horizontal-card :global(.category-breakdown .measure + .measure) { padding-left: 12px; }
  .ring-detail { display: flex; align-items: center; justify-content: center; gap: 36px; padding: 4px 0; }
  .ring { position: relative; display: flex; width: 208px; height: 208px; flex: none; }
  .ring-total { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; }
  .ring-total strong { font-size: 30px; font-weight: 600; line-height: 1.25; font-variant-numeric: tabular-nums; }
  .ring-total span { margin-top: 6px; font-size: 11px; color: #7a818f; }
  .breakdown { width: 310px; min-width: 0; }
  .narrow { width: 360px; max-width: 100%; padding: 20px 24px; border: 1px solid #e5e8ee; border-radius: 10px; box-sizing: border-box; }
  .narrow .card-heading { flex-direction: column; align-items: start; gap: 3px; }
  .stacked { flex-direction: column; gap: 14px; padding: 0; }
  .stacked .ring { width: 190px; height: 190px; }
  .stacked .breakdown { width: 100%; }
  .bar-detail { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 24px; align-items: center; max-width: 800px; margin: auto; }
  .bar { display: flex; height: 208px; min-width: 0; }
  .plain-detail { max-width: 640px; margin: auto; }
  .trend { display: flex; height: 230px; }
  .tab-detail { padding: 20px 0; }
  .continuous-detail { border-top: 1px solid #eef0f4; padding-top: 18px; margin-top: 6px; }
  @media (max-width: 1050px) { .three-columns { grid-template-columns: 1fr; } .two-columns { grid-template-columns: 1fr; } }
  @media (max-width: 700px) { .ring-detail { flex-direction: column; gap: 20px; } .bar-detail, .composition-row { grid-template-columns: 1fr; } }
</style>
