<script lang="ts">
  let draft = $state('');
  let density = $state<'舒适' | '紧凑'>('紧凑');

  function autoGrow(event: Event) {
    const textarea = event.currentTarget as HTMLTextAreaElement;
    textarea.style.height = '0px';
    const maxHeight = 84;
    textarea.style.height = `${Math.max(34, Math.min(textarea.scrollHeight, maxHeight))}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }
</script>

<div class="prototype-shell variant-b">
  <header class="topbar">
    <div class="brand"><span class="brand-cube">MC</span><strong>MetricCanvas</strong></div>
    <div class="breadcrumbs"><span>Platform</span><b>/</b><strong>页面搭建工作台</strong></div>
    <div class="top-actions">
      <button type="button">⌘ K</button>
      <span class="divider"></span>
      <span class="avatar">D2</span>
      <div><strong>developer-2</strong><small>Developer workspace</small></div>
    </div>
  </header>

  <div class="workspace">
    <aside class="analysis-panel">
      <div class="panel-heading">
        <div>
          <span class="overline">ANALYSIS COPILOT</span>
          <h1>页面分析助手</h1>
          <p>将业务问题转成查询、组件与页面。</p>
        </div>
        <button class="new-session" type="button">＋ 新会话</button>
      </div>

      <div class="session-summary">
        <div class="summary-head"><span class="pulse"></span><strong>当前会话</strong><span>00:00</span></div>
        <div class="summary-grid">
          <span><b>0</b>分析轮次</span>
          <span><b>0</b>页面组件</span>
          <span><b>草稿</b>页面状态</span>
        </div>
      </div>

      <div class="timeline">
        <div class="timeline-line"></div>
        <div class="timeline-step active"><span>1</span><div><strong>描述业务目标</strong><p>从自然语言问题开始。</p></div></div>
        <div class="timeline-step"><span>2</span><div><strong>确认查询范围</strong><p>系统会自动识别指标与维度。</p></div></div>
        <div class="timeline-step"><span>3</span><div><strong>组合页面</strong><p>组件将按信息层级加入画布。</p></div></div>
      </div>

      <div class="prompt-library">
        <div class="section-title"><strong>快速开始</strong><span>模板库 12</span></div>
        <button type="button" onclick={() => (draft = '生成本月销售经营概览')}>经营概览 <span>销售额 · 订单 · 趋势</span></button>
        <button type="button" onclick={() => (draft = '分析客户流失风险及影响因素')}>客户风险 <span>留存 · 分群 · 归因</span></button>
      </div>

      <form class="command-card" onsubmit={(event) => event.preventDefault()}>
        <div class="command-head"><span><i>✦</i> AI COMMAND</span><span>12px</span></div>
        <textarea
          bind:value={draft}
          rows="1"
          aria-label="描述业务问题"
          placeholder="输入业务问题，或要求调整当前页面…"
          oninput={autoGrow}
        ></textarea>
        <div class="command-actions">
          <div><button type="button" aria-label="添加上下文">＋</button><button type="button" aria-label="选择组件">▦</button></div>
          <span>Shift+Enter 换行</span>
          <button class="send" type="submit" aria-label="发送" disabled={!draft.trim()}>发送 ↗</button>
        </div>
      </form>
    </aside>

    <main class="studio">
      <div class="studio-nav">
        <nav><button class="active" type="button">编辑</button><button type="button">预览</button><button type="button">数据</button></nav>
        <div class="studio-title"><strong>未命名分析页</strong><span>未保存变更</span></div>
        <div class="studio-actions">
          <button type="button">撤销</button><button type="button">分享</button><button class="publish" type="button">发布</button>
        </div>
      </div>

      <section class="stage">
        <div class="stage-toolbar">
          <div><span class="view-dot"></span><strong>桌面视图</strong><span>1440 × Auto</span></div>
          <div class="density"><span>密度</span><button class:active={density === '舒适'} type="button" onclick={() => (density = '舒适')}>舒适</button><button class:active={density === '紧凑'} type="button" onclick={() => (density = '紧凑')}>紧凑</button></div>
        </div>

        <div class="stage-scroll">
          <article class="page-frame" class:comfortable={density === '舒适'}>
            <div class="page-header">
              <div><span>EXECUTIVE OVERVIEW</span><h2>经营分析页面</h2><p>页面内容将根据分析会话动态组合</p></div>
              <button type="button">本月⌄</button>
            </div>
            <div class="placeholder-grid">
              <div class="metric-placeholder"><span>核心指标</span><strong>—</strong><i></i></div>
              <div class="metric-placeholder"><span>同比变化</span><strong>—</strong><i></i></div>
              <div class="metric-placeholder"><span>目标达成</span><strong>—</strong><i></i></div>
              <div class="chart-placeholder">
                <div><span>趋势分析</span><small>等待 AI 添加查询</small></div>
                <div class="bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
              </div>
              <div class="insight-placeholder"><span class="spark">✦</span><strong>AI 洞察摘要</strong><p>完成第一轮分析后，这里将呈现关键结论与建议。</p></div>
            </div>
          </article>
        </div>

        <aside class="floating-inspector">
          <div class="inspector-handle"></div>
          <div class="inspector-title"><div><span>PAGE SETTINGS</span><strong>页面配置</strong></div><button type="button">×</button></div>
          <label>页面标题<input value="经营分析页面" readonly /></label>
          <label>画布背景<select><option>浅灰工作区</option></select></label>
          <div class="toggle-row"><span><strong>自动排列</strong><small>AI 添加组件时保持栅格</small></span><button class="toggle" type="button" aria-label="切换自动排列"><i></i></button></div>
          <div class="validation"><span>✓</span><div><strong>结构检查通过</strong><p>当前页面符合 12 栏布局约束</p></div></div>
        </aside>
      </section>
    </main>
  </div>
</div>

<style>
  .prototype-shell {
    position: fixed;
    z-index: 1000;
    inset: 0;
    overflow: hidden;
    color: #171b22;
    background: #e9ebef;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  button,
  input,
  textarea,
  select {
    font: inherit;
  }

  button {
    cursor: pointer;
  }

  .topbar {
    display: grid;
    grid-template-columns: 330px 1fr auto;
    align-items: center;
    height: 54px;
    padding: 0 18px;
    color: #f7f8fa;
    background: #15181e;
    border-bottom: 1px solid #30353e;
  }

  .brand,
  .breadcrumbs,
  .top-actions,
  .summary-head,
  .section-title,
  .command-head,
  .command-actions,
  .studio-nav,
  .studio-actions,
  .stage-toolbar,
  .stage-toolbar > div,
  .density,
  .page-header,
  .inspector-title,
  .toggle-row,
  .validation {
    display: flex;
    align-items: center;
  }

  .brand {
    gap: 10px;
    font-size: 13px;
  }

  .brand-cube {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    color: #11141a;
    background: #fff;
    border-radius: 5px;
    font-size: 9px;
    font-weight: 850;
  }

  .breadcrumbs {
    gap: 8px;
    color: #8f98a7;
    font-size: 10.5px;
  }

  .breadcrumbs b {
    color: #4c5360;
  }

  .breadcrumbs strong {
    color: #dfe3e9;
    font-weight: 550;
  }

  .top-actions {
    gap: 9px;
  }

  .top-actions > button {
    padding: 5px 8px;
    color: #aab1bd;
    background: #23272f;
    border: 1px solid #343944;
    border-radius: 5px;
    font-size: 9px;
  }

  .top-actions .divider {
    width: 1px;
    height: 22px;
    background: #343944;
  }

  .top-actions .avatar {
    display: grid;
    place-items: center;
    width: 27px;
    height: 27px;
    color: #d6dafd;
    background: #343953;
    border-radius: 6px;
    font-size: 9px;
    font-weight: 700;
  }

  .top-actions > div {
    display: grid;
    gap: 1px;
    font-size: 9px;
  }

  .top-actions small {
    color: #7f8795;
    font-size: 7.5px;
  }

  .workspace {
    display: grid;
    grid-template-columns: 350px minmax(0, 1fr);
    height: calc(100vh - 54px);
  }

  .analysis-panel {
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: 19px 18px 94px;
    overflow-y: auto;
    background: #fff;
    border-right: 1px solid #d8dce3;
  }

  .panel-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .overline,
  .inspector-title span {
    color: #777f8c;
    font-size: 7.5px;
    font-weight: 750;
    letter-spacing: 0.14em;
  }

  h1,
  h2,
  p {
    margin: 0;
  }

  .panel-heading h1 {
    margin: 5px 0 4px;
    font-size: 17px;
    letter-spacing: -0.025em;
  }

  .panel-heading p {
    color: #858d99;
    font-size: 9.5px;
  }

  .new-session {
    padding: 7px 9px;
    color: #fff;
    background: #22262e;
    border: 1px solid #22262e;
    border-radius: 6px;
    font-size: 9px;
  }

  .session-summary {
    margin-top: 20px;
    padding: 12px;
    background: #f7f8fa;
    border: 1px solid #e4e7ec;
    border-radius: 8px;
  }

  .summary-head {
    gap: 7px;
    color: #59616e;
    font-size: 9px;
  }

  .summary-head > span:last-child {
    margin-left: auto;
    color: #9aa1ac;
    font-variant-numeric: tabular-nums;
  }

  .pulse,
  .view-dot {
    width: 6px;
    height: 6px;
    background: #10b981;
    border-radius: 50%;
    box-shadow: 0 0 0 3px rgb(16 185 129 / 12%);
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-top: 11px;
  }

  .summary-grid span {
    display: grid;
    gap: 3px;
    color: #9aa1ab;
    font-size: 7.5px;
  }

  .summary-grid b {
    color: #3b414c;
    font-size: 12px;
    font-weight: 650;
  }

  .timeline {
    position: relative;
    display: grid;
    gap: 16px;
    margin: 21px 0;
    padding-left: 2px;
  }

  .timeline-line {
    position: absolute;
    top: 14px;
    bottom: 14px;
    left: 13px;
    width: 1px;
    background: #e2e5ea;
  }

  .timeline-step {
    position: relative;
    display: grid;
    grid-template-columns: 24px 1fr;
    gap: 10px;
    align-items: start;
  }

  .timeline-step > span {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    color: #9ca3af;
    background: #fff;
    border: 1px solid #dfe3e8;
    border-radius: 50%;
    font-size: 8px;
  }

  .timeline-step.active > span {
    color: #fff;
    background: #4f46e5;
    border-color: #4f46e5;
  }

  .timeline-step div {
    display: grid;
    gap: 3px;
    padding-top: 2px;
  }

  .timeline-step strong {
    color: #4d5561;
    font-size: 9.5px;
  }

  .timeline-step p {
    color: #9ba2ad;
    font-size: 8.5px;
  }

  .section-title {
    justify-content: space-between;
    margin-bottom: 8px;
    color: #515966;
    font-size: 9px;
  }

  .section-title span {
    color: #9ca3af;
    font-size: 8px;
  }

  .prompt-library {
    display: grid;
    gap: 6px;
  }

  .prompt-library button {
    display: grid;
    gap: 3px;
    padding: 9px 10px;
    color: #4c5460;
    background: #fff;
    border: 1px solid #e1e4e9;
    border-radius: 7px;
    font-size: 9.5px;
    text-align: left;
  }

  .prompt-library button span {
    color: #9aa1ac;
    font-size: 8px;
  }

  .command-card {
    display: grid;
    gap: 7px;
    margin-top: auto;
    padding: 11px;
    color: #e9edf3;
    background: #1b1f27;
    border: 1px solid #2f3540;
    border-radius: 10px;
    box-shadow: 0 8px 24px rgb(23 27 34 / 14%);
  }

  .command-head,
  .command-actions {
    justify-content: space-between;
  }

  .command-head {
    color: #8f98a8;
    font-size: 7.5px;
    letter-spacing: 0.08em;
  }

  .command-head i {
    color: #a5b4fc;
    font-style: normal;
  }

  .command-card textarea {
    width: 100%;
    height: 34px;
    min-height: 34px;
    max-height: 84px;
    padding: 8px 0;
    overflow: hidden;
    color: #f6f7f9;
    background: transparent;
    border: 0;
    outline: 0;
    resize: none;
    font-size: 12px;
    line-height: 17px;
  }

  .command-card textarea::placeholder {
    color: #727b8a;
  }

  .command-card:focus-within {
    border-color: #818cf8;
    box-shadow: 0 0 0 2px rgb(99 102 241 / 16%);
  }

  .command-actions {
    color: #747d8c;
    font-size: 7.5px;
  }

  .command-actions div {
    display: flex;
    gap: 4px;
  }

  .command-actions button {
    height: 24px;
    color: #aeb6c3;
    background: #282d37;
    border: 1px solid #373e4a;
    border-radius: 5px;
    font-size: 8px;
  }

  .command-actions div button {
    width: 24px;
  }

  .command-actions .send {
    padding: 0 9px;
    color: #15181e;
    background: #fff;
    border-color: #fff;
    font-weight: 650;
  }

  .command-actions .send:disabled {
    color: #6d7480;
    background: #303641;
    border-color: #303641;
    cursor: not-allowed;
  }

  .studio {
    display: grid;
    grid-template-rows: 54px minmax(0, 1fr);
    min-width: 0;
  }

  .studio-nav {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    padding: 0 16px;
    background: #fff;
    border-bottom: 1px solid #d9dde3;
  }

  .studio-nav nav {
    display: flex;
    align-self: stretch;
    gap: 1px;
  }

  .studio-nav nav button {
    padding: 0 12px;
    color: #8a929e;
    background: transparent;
    border: 0;
    border-bottom: 2px solid transparent;
    font-size: 9.5px;
  }

  .studio-nav nav .active {
    color: #292f38;
    border-bottom-color: #292f38;
    font-weight: 650;
  }

  .studio-title {
    display: grid;
    justify-items: center;
    gap: 2px;
    font-size: 10px;
  }

  .studio-title span {
    color: #a0a6af;
    font-size: 7.5px;
  }

  .studio-actions {
    justify-content: flex-end;
    gap: 5px;
  }

  .studio-actions button {
    padding: 6px 9px;
    color: #606875;
    background: #fff;
    border: 1px solid #dce0e6;
    border-radius: 5px;
    font-size: 8.5px;
  }

  .studio-actions .publish {
    color: #fff;
    background: #1e2229;
    border-color: #1e2229;
  }

  .stage {
    position: relative;
    display: grid;
    grid-template-rows: 42px minmax(0, 1fr);
    min-height: 0;
  }

  .stage-toolbar {
    justify-content: space-between;
    padding: 0 16px;
    color: #747c89;
    background: #f3f4f6;
    border-bottom: 1px solid #dde1e6;
    font-size: 8.5px;
  }

  .stage-toolbar > div {
    gap: 7px;
  }

  .stage-toolbar span:last-child {
    color: #a0a6af;
  }

  .density {
    gap: 0;
    padding: 2px;
    background: #e5e7eb;
    border-radius: 5px;
  }

  .density > span {
    padding: 0 6px;
    font-size: 7.5px;
  }

  .density button {
    padding: 4px 7px;
    color: #808895;
    background: transparent;
    border: 0;
    border-radius: 4px;
    font-size: 7.5px;
  }

  .density button.active {
    color: #313640;
    background: #fff;
    box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
  }

  .stage-scroll {
    min-height: 0;
    padding: 20px 310px 100px 22px;
    overflow: auto;
    background: #e9ebef;
  }

  .page-frame {
    min-width: 570px;
    min-height: 580px;
    padding: 25px;
    background: #fff;
    border: 1px solid #d9dde3;
    border-radius: 9px;
    box-shadow: 0 12px 32px rgb(25 31 41 / 6%);
  }

  .page-frame.comfortable {
    padding: 35px;
  }

  .page-header {
    align-items: flex-start;
    justify-content: space-between;
    padding-bottom: 18px;
    border-bottom: 1px solid #eceef1;
  }

  .page-header span {
    color: #8b93a0;
    font-size: 7px;
    font-weight: 700;
    letter-spacing: 0.13em;
  }

  .page-header h2 {
    margin: 5px 0 4px;
    font-size: 17px;
  }

  .page-header p {
    color: #9299a4;
    font-size: 8.5px;
  }

  .page-header button {
    padding: 6px 9px;
    color: #626a76;
    background: #fff;
    border: 1px solid #dfe3e8;
    border-radius: 5px;
    font-size: 8.5px;
  }

  .placeholder-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-top: 15px;
  }

  .metric-placeholder,
  .chart-placeholder,
  .insight-placeholder {
    border: 1px solid #e7e9ed;
    border-radius: 7px;
  }

  .metric-placeholder {
    display: grid;
    gap: 7px;
    padding: 14px;
    color: #8b929d;
    font-size: 8px;
  }

  .metric-placeholder strong {
    color: #414752;
    font-size: 21px;
  }

  .metric-placeholder i {
    width: 60%;
    height: 5px;
    background: #eef0f3;
    border-radius: 3px;
  }

  .chart-placeholder {
    grid-column: span 2;
    min-height: 220px;
    padding: 14px;
  }

  .chart-placeholder > div:first-child {
    display: grid;
    gap: 3px;
    color: #5b636f;
    font-size: 9.5px;
  }

  .chart-placeholder small {
    color: #a0a6af;
    font-size: 7.5px;
  }

  .bars {
    display: flex;
    align-items: end;
    gap: 8px;
    height: 140px;
    padding: 22px 8px 0;
    border-bottom: 1px solid #e9ebef;
  }

  .bars i {
    flex: 1;
    background: #eaecf0;
    border-radius: 3px 3px 0 0;
  }

  .bars i:nth-child(1) { height: 35%; }
  .bars i:nth-child(2) { height: 52%; }
  .bars i:nth-child(3) { height: 45%; }
  .bars i:nth-child(4) { height: 70%; }
  .bars i:nth-child(5) { height: 62%; }
  .bars i:nth-child(6) { height: 83%; }
  .bars i:nth-child(7) { height: 74%; }

  .insight-placeholder {
    display: grid;
    align-content: center;
    justify-items: center;
    padding: 20px;
    color: #9ba2ad;
    text-align: center;
  }

  .spark {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    margin-bottom: 9px;
    color: #6366f1;
    background: #eef2ff;
    border-radius: 7px;
  }

  .insight-placeholder strong {
    color: #616975;
    font-size: 9.5px;
  }

  .insight-placeholder p {
    margin-top: 5px;
    font-size: 8px;
    line-height: 1.5;
  }

  .floating-inspector {
    position: absolute;
    top: 58px;
    right: 18px;
    width: 270px;
    padding: 16px;
    background: #fff;
    border: 1px solid #d7dbe1;
    border-radius: 10px;
    box-shadow: 0 16px 42px rgb(19 24 32 / 13%);
  }

  .inspector-handle {
    width: 28px;
    height: 3px;
    margin: -7px auto 12px;
    background: #d5d9df;
    border-radius: 2px;
  }

  .inspector-title {
    justify-content: space-between;
    margin-bottom: 15px;
  }

  .inspector-title div {
    display: grid;
    gap: 3px;
  }

  .inspector-title strong {
    font-size: 12px;
  }

  .inspector-title button {
    width: 26px;
    height: 26px;
    color: #7d8591;
    background: #f6f7f8;
    border: 1px solid #e2e5e9;
    border-radius: 6px;
  }

  .floating-inspector label {
    display: grid;
    gap: 5px;
    margin-top: 10px;
    color: #727a86;
    font-size: 8.5px;
  }

  .floating-inspector input,
  .floating-inspector select {
    width: 100%;
    padding: 8px;
    color: #3b414b;
    background: #fafbfc;
    border: 1px solid #dee2e7;
    border-radius: 6px;
    font-size: 9px;
  }

  .toggle-row {
    justify-content: space-between;
    margin-top: 14px;
    padding-top: 13px;
    border-top: 1px solid #eceef1;
  }

  .toggle-row > span {
    display: grid;
    gap: 2px;
  }

  .toggle-row strong {
    color: #515964;
    font-size: 9px;
  }

  .toggle-row small {
    color: #9aa1ac;
    font-size: 7.5px;
  }

  .toggle {
    position: relative;
    width: 31px;
    height: 17px;
    background: #4f46e5;
    border: 0;
    border-radius: 9px;
  }

  .toggle i {
    position: absolute;
    top: 3px;
    right: 3px;
    width: 11px;
    height: 11px;
    background: #fff;
    border-radius: 50%;
  }

  .validation {
    gap: 8px;
    margin-top: 14px;
    padding: 9px;
    color: #0f766e;
    background: #f0fdfa;
    border: 1px solid #ccfbf1;
    border-radius: 7px;
  }

  .validation > span {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    color: #fff;
    background: #14b8a6;
    border-radius: 50%;
    font-size: 8px;
  }

  .validation div {
    display: grid;
    gap: 2px;
  }

  .validation strong {
    font-size: 8.5px;
  }

  .validation p {
    color: #5f8f8a;
    font-size: 7.5px;
  }

  @media (max-width: 1050px) {
    .workspace {
      grid-template-columns: 320px minmax(680px, 1fr);
      overflow-x: auto;
    }
  }
</style>
