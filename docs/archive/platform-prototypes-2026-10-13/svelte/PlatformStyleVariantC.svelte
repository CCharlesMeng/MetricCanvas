<script lang="ts">
  let draft = $state('');
  let inspectorOpen = $state(true);

  function autoGrow(event: Event) {
    const textarea = event.currentTarget as HTMLTextAreaElement;
    textarea.style.height = '0px';
    const maxHeight = 78;
    textarea.style.height = `${Math.max(32, Math.min(textarea.scrollHeight, maxHeight))}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }
</script>

<div class="prototype-shell variant-c">
  <aside class="global-rail">
    <div class="logo">M</div>
    <nav aria-label="全局导航">
      <button class="active" type="button"><span>✦</span><small>问数</small></button>
      <button type="button"><span>▦</span><small>看板</small></button>
      <button type="button"><span>□</span><small>页面</small></button>
    </nav>
    <div class="rail-bottom"><button type="button" aria-label="帮助">?</button><span class="avatar">D</span></div>
  </aside>

  <section class="application">
    <header class="context-bar">
      <div class="context-title"><strong>页面搭建工作台</strong><span>／</span><span>未命名分析页</span><i>草稿</i></div>
      <div class="context-actions">
        <span class="saved">✓ 已保存</span>
        <button type="button">预览</button>
        <button type="button" onclick={() => (inspectorOpen = !inspectorOpen)}>检查器 {inspectorOpen ? '收起' : '展开'}</button>
        <button class="publish" type="button">发布</button>
      </div>
    </header>

    <div class="work-area">
      <aside class="ai-panel">
        <div class="ai-heading">
          <div><h1>分析与搭建</h1><p>AI 页面助手</p></div>
          <button class="new-session" type="button" aria-label="新建会话">＋</button>
        </div>

        <div class="conversation">
          <div class="date-separator"><span>新会话</span></div>
          <article class="guide-card">
            <span class="guide-index">01</span>
            <div><strong>说明你的业务目标</strong><p>例如：比较华东各城市本月销售额，并标记下降区域。</p></div>
          </article>
          <article class="guide-card">
            <span class="guide-index">02</span>
            <div><strong>AI 组合查询与页面</strong><p>你可以继续追问维度、筛选和展示方式。</p></div>
          </article>
          <div class="example-prompts">
            <span>TRY A PROMPT</span>
            <button type="button" onclick={() => (draft = '按区域分析本月销售额，并生成趋势图')}>按区域分析本月销售额</button>
            <button type="button" onclick={() => (draft = '对比渠道转化率并找出异常点')}>对比渠道转化率</button>
          </div>
        </div>

        <form class="composer-wrap" onsubmit={(event) => event.preventDefault()}>
          <div class="context-chip"><span>⌁</span>当前页面</div>
          <div class="composer">
            <textarea
              bind:value={draft}
              rows="1"
              aria-label="描述业务问题"
              placeholder="输入问题或页面调整指令…"
              oninput={autoGrow}
            ></textarea>
            <div class="composer-actions">
              <span>11px · 最多 4 行</span>
              <button class="send" type="submit" aria-label="发送" disabled={!draft.trim()}>↑</button>
            </div>
          </div>
        </form>
      </aside>

      <main class="canvas-zone">
        <div class="canvas-tools">
          <div><button type="button">↶</button><button type="button">↷</button><span></span><button type="button">＋ 组件</button></div>
          <div><button type="button">适应画布</button><strong>100%</strong><button type="button">－</button><button type="button">＋</button></div>
        </div>

        <div class="canvas-scroll" class:inspector-open={inspectorOpen}>
          <article class="page">
            <header class="page-heading">
              <div><span>BUSINESS PERFORMANCE</span><h2>经营分析</h2><p>由 AI 动态生成的业务页面</p></div>
              <div class="page-filters"><button type="button">2026 年 8 月⌄</button><button type="button">全部区域⌄</button></div>
            </header>
            <div class="metric-band">
              <article><span>本月销售额</span><strong>—</strong><small>等待查询</small></article>
              <article><span>订单量</span><strong>—</strong><small>等待查询</small></article>
              <article><span>目标达成率</span><strong>—</strong><small>等待查询</small></article>
              <button class="add-metric" type="button">＋ 添加指标</button>
            </div>
            <div class="content-grid">
              <div class="empty-chart">
                <div class="chart-head"><strong>趋势组件</strong><button type="button">•••</button></div>
                <div class="chart-axis"><i></i><i></i><i></i><i></i><i></i><span></span></div>
                <p>向左侧 AI 描述需要分析的指标</p>
              </div>
              <div class="empty-table">
                <div class="chart-head"><strong>明细组件</strong><button type="button">•••</button></div>
                <div class="table-line head"><span></span><span></span><span></span></div>
                <div class="table-line"><span></span><span></span><span></span></div>
                <div class="table-line"><span></span><span></span><span></span></div>
                <div class="table-line"><span></span><span></span><span></span></div>
              </div>
            </div>
          </article>
        </div>

        {#if inspectorOpen}
          <aside class="inspector-drawer">
            <div class="drawer-head"><div><span>INSPECTOR</span><strong>页面属性</strong></div><button type="button" onclick={() => (inspectorOpen = false)}>×</button></div>
            <div class="drawer-tabs"><button class="active" type="button">属性</button><button type="button">结构</button></div>
            <section><h3>页面</h3><label>标题<input value="经营分析" readonly /></label><label>描述<input value="由 AI 动态生成的业务页面" readonly /></label></section>
            <section><h3>布局</h3><div class="option-row"><span>画布宽度</span><strong>Fluid</strong></div><div class="option-row"><span>栅格</span><strong>12 columns</strong></div><div class="option-row"><span>间距</span><strong>16 px</strong></div></section>
            <section class="layers"><h3>页面结构</h3><button type="button"><span>▤</span> 页面标题</button><button type="button"><span>▦</span> 指标区域</button><button type="button"><span>□</span> 内容区域</button></section>
          </aside>
        {/if}
      </main>
    </div>
  </section>
</div>

<style>
  .prototype-shell {
    position: fixed;
    z-index: 1000;
    inset: 0;
    display: grid;
    grid-template-columns: 60px minmax(0, 1fr);
    overflow: hidden;
    color: #1b2028;
    background: #e7e9ed;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  button,
  input,
  textarea {
    font: inherit;
  }

  button {
    cursor: pointer;
  }

  .global-rail {
    display: grid;
    grid-template-rows: 56px 1fr auto;
    justify-items: center;
    color: #dce1e8;
    background: #11151b;
    border-right: 1px solid #2b313a;
  }

  .logo {
    display: grid;
    place-items: center;
    width: 27px;
    height: 27px;
    margin-top: 12px;
    color: #14171c;
    background: #fff;
    border-radius: 7px;
    font-size: 10px;
    font-weight: 850;
  }

  .global-rail nav {
    display: grid;
    align-content: start;
    gap: 6px;
    padding-top: 14px;
  }

  .global-rail nav button {
    display: grid;
    justify-items: center;
    gap: 3px;
    width: 42px;
    padding: 7px 0 6px;
    color: #727c8b;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 7px;
  }

  .global-rail nav button span {
    font-size: 12px;
  }

  .global-rail nav button small {
    font-size: 7.5px;
  }

  .global-rail nav button.active,
  .global-rail nav button:hover {
    color: #fff;
    background: #252b34;
    border-color: #343c48;
  }

  .rail-bottom {
    display: grid;
    gap: 9px;
    justify-items: center;
    padding-bottom: 17px;
  }

  .rail-bottom button {
    width: 25px;
    height: 25px;
    color: #818b99;
    background: transparent;
    border: 1px solid #303742;
    border-radius: 7px;
  }

  .avatar {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    color: #eef1f5;
    background: #3b4250;
    border-radius: 8px;
    font-size: 9px;
    font-weight: 700;
  }

  .application {
    display: grid;
    grid-template-rows: 46px minmax(0, 1fr);
    min-width: 0;
  }

  .context-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px 0 15px;
    background: #fff;
    border-bottom: 1px solid #dadee4;
  }

  .context-title,
  .context-actions,
  .ai-heading,
  .composer-actions,
  .canvas-tools,
  .canvas-tools > div,
  .page-heading,
  .page-filters,
  .chart-head,
  .drawer-head,
  .option-row {
    display: flex;
    align-items: center;
  }

  .context-title {
    gap: 6px;
    color: #818995;
    font-size: 9.5px;
  }

  .context-title strong {
    color: #2d333d;
    font-size: 11px;
  }

  .context-title i {
    padding: 2px 5px;
    color: #777f8c;
    background: #f0f1f3;
    border-radius: 4px;
    font-size: 7.5px;
    font-style: normal;
  }

  .context-actions {
    gap: 5px;
  }

  .context-actions .saved {
    margin-right: 5px;
    color: #6b7280;
    font-size: 8px;
  }

  .context-actions button {
    padding: 5px 8px;
    color: #616976;
    background: #fff;
    border: 1px solid #dce0e5;
    border-radius: 5px;
    font-size: 8.5px;
  }

  .context-actions .publish {
    color: #fff;
    background: #20242b;
    border-color: #20242b;
  }

  .work-area {
    display: grid;
    grid-template-columns: 292px minmax(0, 1fr);
    min-height: 0;
  }

  .ai-panel {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-width: 0;
    background: #fff;
    border-right: 1px solid #d9dde3;
  }

  .ai-heading {
    justify-content: space-between;
    gap: 10px;
    padding: 11px 12px;
    border-bottom: 1px solid #e6e8ec;
  }

  .ai-heading > div {
    display: grid;
    gap: 2px;
  }

  .example-prompts > span,
  .page-heading span,
  .drawer-head span {
    color: #8a929f;
    font-size: 7px;
    font-weight: 700;
    letter-spacing: 0.12em;
  }

  h1,
  h2,
  h3,
  p {
    margin: 0;
  }

  .ai-heading h1 {
    font-size: 12px;
  }

  .ai-heading p {
    color: #9299a4;
    font-size: 7.5px;
  }

  .ai-heading .new-session {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    color: #6f7784;
    background: #f7f8f9;
    border: 1px solid #e0e3e8;
    border-radius: 5px;
    font-size: 8px;
  }

  .ai-heading .new-session:hover {
    color: #343a44;
    background: #eef0f3;
  }

  .conversation {
    min-height: 0;
    padding: 12px;
    overflow-y: auto;
  }

  .date-separator {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    color: #a2a8b1;
    font-size: 7.5px;
  }

  .date-separator::before,
  .date-separator::after {
    height: 1px;
    background: #eceef1;
    content: '';
    flex: 1;
  }

  .guide-card {
    display: grid;
    grid-template-columns: 25px 1fr;
    gap: 8px;
    padding: 9px 0;
    border-bottom: 1px solid #eef0f3;
  }

  .guide-index {
    display: grid;
    place-items: center;
    width: 25px;
    height: 25px;
    color: #777f8b;
    background: #f3f4f6;
    border-radius: 6px;
    font-size: 7px;
    font-weight: 700;
  }

  .guide-card div {
    display: grid;
    gap: 4px;
  }

  .guide-card strong {
    color: #4d5561;
    font-size: 9px;
  }

  .guide-card p {
    color: #9299a4;
    font-size: 8px;
    line-height: 1.5;
  }

  .example-prompts {
    display: grid;
    gap: 5px;
    margin-top: 15px;
  }

  .example-prompts button {
    padding: 7px 8px;
    color: #626a76;
    background: #fafbfc;
    border: 1px solid #e4e7eb;
    border-radius: 6px;
    font-size: 8.5px;
    text-align: left;
  }

  .composer-wrap {
    padding: 8px 10px 78px;
    background: #fafbfc;
    border-top: 1px solid #e1e4e9;
  }

  .context-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    margin-bottom: 5px;
    padding: 3px 6px;
    color: #4f46e5;
    background: #eef2ff;
    border: 1px solid #dfe4ff;
    border-radius: 5px;
    font-size: 7.5px;
  }

  .composer {
    padding: 5px 6px;
    background: #fff;
    border: 1px solid #daddE3;
    border-radius: 7px;
    box-shadow: 0 4px 14px rgb(26 32 42 / 6%);
  }

  .composer:focus-within {
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgb(99 102 241 / 13%);
  }

  .composer textarea {
    width: 100%;
    height: 32px;
    min-height: 32px;
    max-height: 78px;
    padding: 5px 3px;
    overflow: hidden;
    color: #2f3540;
    background: transparent;
    border: 0;
    outline: 0;
    resize: none;
    font-size: 11px;
    line-height: 16px;
  }

  .composer textarea::placeholder {
    color: #9aa1ac;
  }

  .composer-actions {
    gap: 5px;
    color: #a0a6af;
    font-size: 7px;
  }

  .composer-actions button {
    width: 23px;
    height: 23px;
    color: #747c88;
    background: #f5f6f8;
    border: 1px solid #e2e5e9;
    border-radius: 5px;
  }

  .composer-actions span {
    color: #a0a6af;
  }

  .composer-actions .send {
    margin-left: auto;
    color: #fff;
    background: #4f46e5;
    border-color: #4f46e5;
  }

  .composer-actions .send:disabled {
    color: #9ca3af;
    background: #e7e9ed;
    border-color: #e7e9ed;
    cursor: not-allowed;
  }

  .canvas-zone {
    position: relative;
    display: grid;
    grid-template-rows: 38px minmax(0, 1fr);
    min-width: 0;
    min-height: 0;
  }

  .canvas-tools {
    justify-content: space-between;
    padding: 0 11px;
    background: #f6f7f8;
    border-bottom: 1px solid #dce0e5;
  }

  .canvas-tools > div {
    gap: 4px;
  }

  .canvas-tools button {
    padding: 4px 6px;
    color: #727a87;
    background: #fff;
    border: 1px solid #dce0e5;
    border-radius: 5px;
    font-size: 8px;
  }

  .canvas-tools strong {
    min-width: 36px;
    color: #69717e;
    font-size: 8px;
    text-align: center;
  }

  .canvas-tools div:first-child span {
    width: 1px;
    height: 18px;
    margin: 0 4px;
    background: #d9dde3;
  }

  .canvas-scroll {
    min-height: 0;
    padding: 14px 18px 88px;
    overflow: auto;
    transition: padding-right 0.15s ease;
  }

  .canvas-scroll.inspector-open {
    padding-right: 278px;
  }

  .page {
    min-width: 590px;
    min-height: 570px;
    padding: 22px;
    background: #fff;
    border: 1px solid #d9dde3;
    box-shadow: 0 8px 26px rgb(20 26 35 / 5%);
  }

  .page-heading {
    align-items: flex-start;
    justify-content: space-between;
    padding-bottom: 14px;
    border-bottom: 1px solid #eceef1;
  }

  .page-heading h2 {
    margin: 5px 0 3px;
    font-size: 17px;
    letter-spacing: -0.025em;
  }

  .page-heading p {
    color: #9299a4;
    font-size: 8.5px;
  }

  .page-filters {
    gap: 5px;
  }

  .page-filters button {
    padding: 5px 7px;
    color: #6f7784;
    background: #fff;
    border: 1px solid #dfe2e7;
    border-radius: 5px;
    font-size: 8px;
  }

  .metric-band {
    display: grid;
    grid-template-columns: repeat(3, 1fr) 70px;
    gap: 8px;
    margin-top: 12px;
  }

  .metric-band article {
    display: grid;
    gap: 5px;
    padding: 11px;
    background: #fafbfc;
    border: 1px solid #e6e9ed;
    border-radius: 6px;
  }

  .metric-band span,
  .metric-band small {
    color: #89919d;
    font-size: 8px;
  }

  .metric-band strong {
    color: #3f4651;
    font-size: 18px;
  }

  .add-metric {
    color: #949ba6;
    background: #fff;
    border: 1px dashed #d7dbe1;
    border-radius: 6px;
    font-size: 7.5px;
  }

  .content-grid {
    display: grid;
    grid-template-columns: 1.6fr 1fr;
    gap: 8px;
    margin-top: 8px;
  }

  .empty-chart,
  .empty-table {
    min-height: 230px;
    padding: 11px;
    border: 1px solid #e5e8ec;
    border-radius: 6px;
  }

  .chart-head {
    justify-content: space-between;
    color: #606874;
    font-size: 9px;
  }

  .chart-head button {
    color: #9198a3;
    background: transparent;
    border: 0;
  }

  .chart-axis {
    position: relative;
    display: flex;
    align-items: end;
    gap: 10px;
    height: 145px;
    margin: 10px 7px 0;
    border-bottom: 1px solid #e3e6ea;
    border-left: 1px solid #e3e6ea;
  }

  .chart-axis::before,
  .chart-axis::after {
    position: absolute;
    right: 0;
    left: 0;
    height: 1px;
    background: #f0f2f4;
    content: '';
  }

  .chart-axis::before { top: 33%; }
  .chart-axis::after { top: 66%; }

  .chart-axis i {
    z-index: 1;
    flex: 1;
    height: 10%;
    background: #edf0f3;
    border-radius: 3px 3px 0 0;
  }

  .chart-axis i:nth-child(2) { height: 22%; }
  .chart-axis i:nth-child(3) { height: 17%; }
  .chart-axis i:nth-child(4) { height: 28%; }
  .chart-axis i:nth-child(5) { height: 20%; }

  .empty-chart > p {
    margin-top: 12px;
    color: #a1a7b0;
    font-size: 8px;
    text-align: center;
  }

  .table-line {
    display: grid;
    grid-template-columns: 1.4fr 1fr 0.8fr;
    gap: 8px;
    padding: 10px 0;
    border-bottom: 1px solid #eff1f3;
  }

  .table-line.head {
    margin-top: 9px;
    background: #fafbfc;
  }

  .table-line span {
    height: 5px;
    background: #eceef1;
    border-radius: 3px;
  }

  .inspector-drawer {
    position: absolute;
    z-index: 3;
    top: 38px;
    right: 0;
    bottom: 0;
    width: 260px;
    padding-bottom: 70px;
    overflow-y: auto;
    background: #fff;
    border-left: 1px solid #d9dde3;
    box-shadow: -12px 0 28px rgb(26 31 40 / 7%);
  }

  .drawer-head {
    justify-content: space-between;
    padding: 12px;
    border-bottom: 1px solid #e5e8ec;
  }

  .drawer-head div {
    display: grid;
    gap: 3px;
  }

  .drawer-head strong {
    font-size: 11px;
  }

  .drawer-head button {
    width: 25px;
    height: 25px;
    color: #7c8490;
    background: #f7f8f9;
    border: 1px solid #e2e5e9;
    border-radius: 5px;
  }

  .drawer-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 0 12px;
    border-bottom: 1px solid #e7e9ed;
  }

  .drawer-tabs button {
    padding: 7px;
    color: #9299a4;
    background: transparent;
    border: 0;
    border-bottom: 2px solid transparent;
    font-size: 8.5px;
  }

  .drawer-tabs button.active {
    color: #343a44;
    border-bottom-color: #343a44;
    font-weight: 650;
  }

  .inspector-drawer section {
    display: grid;
    gap: 9px;
    padding: 12px;
    border-bottom: 1px solid #e9ebee;
  }

  .inspector-drawer h3 {
    color: #777f8b;
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .inspector-drawer label {
    display: grid;
    gap: 4px;
    color: #7f8792;
    font-size: 8px;
  }

  .inspector-drawer input {
    width: 100%;
    padding: 7px 8px;
    color: #444b56;
    background: #fafbfc;
    border: 1px solid #dfe3e7;
    border-radius: 5px;
    font-size: 8.5px;
  }

  .option-row {
    justify-content: space-between;
    color: #818995;
    font-size: 8px;
  }

  .option-row strong {
    color: #4e5661;
    font-weight: 550;
  }

  .layers button {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 7px;
    color: #626a76;
    background: #fafbfc;
    border: 1px solid #e8eaed;
    border-radius: 5px;
    font-size: 8.5px;
    text-align: left;
  }

  @media (max-width: 1050px) {
    .application {
      min-width: 980px;
    }

    .prototype-shell {
      overflow-x: auto;
    }
  }
</style>
