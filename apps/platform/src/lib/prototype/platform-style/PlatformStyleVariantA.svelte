<script lang="ts">
  let draft = $state('');
  let lastAction = $state('等待输入');

  function autoGrow(event: Event) {
    const textarea = event.currentTarget as HTMLTextAreaElement;
    textarea.style.height = '0px';
    const maxHeight = 88;
    const nextHeight = Math.max(36, Math.min(textarea.scrollHeight, maxHeight));
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }

  function send() {
    if (!draft.trim()) return;
    lastAction = `已模拟发送：${draft.trim().slice(0, 18)}`;
    draft = '';
  }
</script>

<div class="prototype-shell variant-a">
  <header class="topbar">
    <div class="brand-block">
      <span class="brand-mark">M</span>
      <strong>MetricCanvas</strong>
      <span class="product-tag">指标画布</span>
    </div>
    <nav aria-label="主导航">
      <button class="active" type="button">问数工作台</button>
      <button type="button">看板演示</button>
      <button type="button">页面管理</button>
    </nav>
    <div class="identity">
      <span class="environment">DEV</span>
      <span class="avatar">D</span>
      <span>developer-2</span>
      <span aria-hidden="true">⌄</span>
    </div>
  </header>

  <div class="workspace">
    <aside class="analysis-rail">
      <div class="rail-head">
        <div>
          <span class="kicker">AI ANALYSIS SESSION</span>
          <h1>分析会话</h1>
        </div>
        <button class="icon-button" type="button" aria-label="新建分析">＋</button>
      </div>

      <div class="session-content">
        <div class="session-status">
          <span class="status-dot"></span>
          <span>新建分析</span>
          <time>刚刚</time>
        </div>
        <div class="empty-copy">
          <span class="ai-orbit">✦</span>
          <h2>从业务问题开始</h2>
          <p>描述你关注的指标、维度或业务异常，我会组合查询并生成页面。</p>
        </div>
        <div class="suggestions" aria-label="建议问题">
          <button type="button" onclick={() => (draft = '分析本月销售额与上月的变化')}>分析本月销售趋势 <span>↗</span></button>
          <button type="button" onclick={() => (draft = '找出转化率下降最明显的区域')}>定位异常业务区域 <span>↗</span></button>
          <button type="button" onclick={() => (draft = '生成经营概览页面')}>生成经营概览页 <span>↗</span></button>
        </div>
      </div>

      <form class="composer-zone" onsubmit={(event) => { event.preventDefault(); send(); }}>
        <div class="composer-meta">
          <span>AI 指令</span>
          <span class="model">DeepSeek V3 · Online</span>
        </div>
        <div class="composer">
          <textarea
            bind:value={draft}
            rows="1"
            aria-label="描述业务问题"
            placeholder="描述业务问题，或追问维度、筛选和展示…"
            oninput={autoGrow}
          ></textarea>
          <button class="send" type="submit" aria-label="发送" disabled={!draft.trim()}>↑</button>
        </div>
        <div class="composer-foot">
          <span>{lastAction}</span>
          <span>12px · 1–4 行 · Enter 发送</span>
        </div>
      </form>
    </aside>

    <main class="canvas-track">
      <div class="document-bar">
        <div class="document-title">
          <span class="doc-icon">▤</span>
          <div>
            <strong>未命名分析页</strong>
            <span>草稿 · 自动保存</span>
          </div>
        </div>
        <div class="document-actions">
          <button type="button">预览</button>
          <button type="button">版本</button>
          <button class="primary" type="button">发布页面</button>
        </div>
      </div>

      <section class="canvas" aria-label="页面画布">
        <div class="canvas-grid">
          <div class="canvas-heading">
            <span>页面画布</span>
            <div><button type="button">－</button><span>100%</span><button type="button">＋</button></div>
          </div>
          <div class="page-paper">
            <div class="page-toolbar">
              <span>经营分析页面</span>
              <span>12 栏布局 · 自动排列</span>
            </div>
            <div class="metric-row">
              <article><span>销售额</span><strong>—</strong><small>等待数据</small></article>
              <article><span>订单量</span><strong>—</strong><small>等待数据</small></article>
              <article><span>转化率</span><strong>—</strong><small>等待数据</small></article>
            </div>
            <div class="empty-widget">
              <span class="widget-icon">＋</span>
              <strong>通过左侧 AI 创建第一个分析组件</strong>
              <p>指标卡、趋势图、排名表和洞察摘要将在这里组合。</p>
            </div>
          </div>
        </div>
      </section>
    </main>

    <aside class="inspector">
      <div class="inspector-head">
        <div>
          <span class="kicker dark">PROPERTIES</span>
          <h2>页面检查器</h2>
        </div>
        <button class="more" type="button" aria-label="更多">•••</button>
      </div>
      <div class="tabs"><button class="active" type="button">页面</button><button type="button">组件</button></div>
      <section class="property-section">
        <h3>基础信息</h3>
        <label>页面名称<input value="未命名分析页" readonly /></label>
        <label>页面描述<textarea rows="3" placeholder="添加业务背景说明"></textarea></label>
      </section>
      <section class="property-section">
        <h3>画布设置</h3>
        <div class="property-row"><span>布局系统</span><strong>12 栏</strong></div>
        <div class="property-row"><span>组件间距</span><strong>16 px</strong></div>
        <div class="property-row"><span>响应方式</span><strong>自适应</strong></div>
      </section>
      <section class="property-section audit">
        <h3>状态</h3>
        <p><span class="ok-dot"></span> 页面结构有效</p>
        <p><span class="neutral-dot"></span> 尚未绑定数据查询</p>
      </section>
    </aside>
  </div>
</div>

<style>
  .prototype-shell {
    position: fixed;
    z-index: 1000;
    inset: 0;
    overflow: hidden;
    color: #1b1f27;
    background: #eef0f3;
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

  .topbar {
    display: grid;
    grid-template-columns: 320px 1fr auto;
    align-items: center;
    height: 48px;
    padding: 0 16px;
    color: #eef1f5;
    background: #11141a;
    border-bottom: 1px solid #2a303b;
  }

  .brand-block,
  .identity,
  nav,
  .document-actions,
  .document-title,
  .composer-meta,
  .composer-foot,
  .canvas-heading,
  .page-toolbar,
  .property-row {
    display: flex;
    align-items: center;
  }

  .brand-block {
    gap: 9px;
    font-size: 13px;
  }

  .brand-mark {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    color: #0f1217;
    background: #f5f7fa;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 800;
  }

  .product-tag {
    padding-left: 9px;
    color: #8e97a7;
    border-left: 1px solid #343a45;
    font-size: 10px;
  }

  nav {
    justify-content: center;
    gap: 4px;
  }

  nav button {
    padding: 6px 12px;
    color: #9ca5b4;
    background: transparent;
    border: 0;
    border-radius: 6px;
    font-size: 11.5px;
  }

  nav button:hover,
  nav button.active {
    color: #fff;
    background: #272c35;
  }

  nav button:focus-visible,
  .identity:focus-within {
    outline: 2px solid #818cf8;
    outline-offset: 1px;
  }

  .identity {
    gap: 7px;
    color: #c6ccd6;
    font-size: 10.5px;
  }

  .environment {
    padding: 2px 5px;
    color: #a5b4fc;
    background: #272a42;
    border-radius: 4px;
    font-size: 8px;
    font-weight: 700;
  }

  .avatar {
    display: grid;
    place-items: center;
    width: 23px;
    height: 23px;
    color: #1b2030;
    background: #c7d2fe;
    border-radius: 50%;
    font-size: 10px;
    font-weight: 700;
  }

  .workspace {
    display: grid;
    grid-template-columns: 334px minmax(0, 1fr) 286px;
    height: calc(100vh - 48px);
  }

  .analysis-rail {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-width: 0;
    color: #f4f6f9;
    background: #171b22;
    border-right: 1px solid #303642;
  }

  .rail-head,
  .inspector-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 68px;
    padding: 14px 16px;
  }

  .rail-head {
    border-bottom: 1px solid #2c323d;
  }

  .kicker {
    display: block;
    margin-bottom: 4px;
    color: #828c9d;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.13em;
  }

  .kicker.dark {
    color: #8a93a2;
  }

  h1,
  h2,
  h3,
  p {
    margin: 0;
  }

  .rail-head h1,
  .inspector-head h2 {
    font-size: 14px;
    letter-spacing: -0.01em;
  }

  .icon-button,
  .more {
    display: grid;
    place-items: center;
    width: 29px;
    height: 29px;
    color: #c5ccd7;
    background: #222730;
    border: 1px solid #343b47;
    border-radius: 7px;
  }

  .session-content {
    min-height: 0;
    padding: 14px 16px;
    overflow-y: auto;
  }

  .session-status {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 7px;
    align-items: center;
    padding-bottom: 14px;
    color: #aab2c0;
    border-bottom: 1px solid #2b313b;
    font-size: 10px;
  }

  .session-status time {
    color: #6f7888;
    font-size: 9px;
  }

  .status-dot,
  .ok-dot,
  .neutral-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .status-dot,
  .ok-dot {
    background: #34d399;
    box-shadow: 0 0 0 3px rgb(52 211 153 / 12%);
  }

  .neutral-dot {
    background: #94a3b8;
  }

  .empty-copy {
    display: grid;
    justify-items: center;
    padding: 54px 20px 26px;
    text-align: center;
  }

  .ai-orbit {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    margin-bottom: 16px;
    color: #c7d2fe;
    background: #252b37;
    border: 1px solid #384052;
    border-radius: 10px;
    font-size: 15px;
  }

  .empty-copy h2 {
    margin-bottom: 7px;
    font-size: 13px;
  }

  .empty-copy p {
    color: #8d97a7;
    font-size: 10.5px;
    line-height: 1.6;
  }

  .suggestions {
    display: grid;
    gap: 7px;
  }

  .suggestions button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 9px 10px;
    color: #bac2cf;
    background: #1e232c;
    border: 1px solid #2e3540;
    border-radius: 7px;
    font-size: 10.5px;
    text-align: left;
  }

  .suggestions button:hover {
    color: #fff;
    background: #252b36;
    border-color: #465065;
  }

  .composer-zone {
    padding: 12px 14px 14px;
    background: #14181e;
    border-top: 1px solid #2f3540;
  }

  .composer-meta,
  .composer-foot {
    justify-content: space-between;
    color: #727d8e;
    font-size: 8.5px;
  }

  .composer-meta {
    margin-bottom: 7px;
    color: #aeb7c5;
    font-weight: 600;
  }

  .model {
    color: #7dd3a8;
    font-weight: 500;
  }

  .composer {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 30px;
    gap: 7px;
    align-items: end;
    padding: 7px;
    background: #fff;
    border: 1px solid #fff;
    border-radius: 9px;
    box-shadow: 0 5px 18px rgb(0 0 0 / 16%);
  }

  .composer:focus-within {
    border-color: #818cf8;
    box-shadow: 0 0 0 2px rgb(129 140 248 / 20%);
  }

  .composer textarea {
    width: 100%;
    height: 36px;
    min-height: 36px;
    max-height: 88px;
    padding: 8px 6px;
    overflow: hidden;
    color: #20242c;
    background: transparent;
    border: 0;
    outline: 0;
    resize: none;
    font-size: 12px;
    line-height: 18px;
  }

  .composer textarea::placeholder {
    color: #9299a5;
  }

  .send {
    width: 30px;
    height: 30px;
    color: #fff;
    background: #4f46e5;
    border: 0;
    border-radius: 7px;
    font-size: 15px;
    font-weight: 700;
  }

  .send:hover:not(:disabled) {
    background: #4338ca;
  }

  .send:disabled {
    color: #9ca3af;
    background: #e5e7eb;
    cursor: not-allowed;
  }

  .composer-foot {
    margin-top: 7px;
  }

  .canvas-track {
    display: grid;
    grid-template-rows: 55px minmax(0, 1fr);
    min-width: 0;
  }

  .document-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 18px;
    background: #fff;
    border-bottom: 1px solid #dfe3e9;
  }

  .document-title {
    gap: 9px;
  }

  .doc-icon {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    color: #4f46e5;
    background: #eef2ff;
    border-radius: 7px;
  }

  .document-title div {
    display: grid;
    gap: 2px;
  }

  .document-title strong {
    font-size: 11.5px;
  }

  .document-title div span {
    color: #8a919e;
    font-size: 8.5px;
  }

  .document-actions {
    gap: 5px;
  }

  .document-actions button {
    padding: 6px 10px;
    color: #596171;
    background: #fff;
    border: 1px solid #dde1e7;
    border-radius: 6px;
    font-size: 9.5px;
  }

  .document-actions .primary {
    color: #fff;
    background: #20242c;
    border-color: #20242c;
  }

  .canvas {
    min-height: 0;
    padding: 16px 18px 94px;
    overflow: auto;
    background: #eef0f3;
  }

  .canvas-grid {
    min-width: 560px;
  }

  .canvas-heading,
  .page-toolbar {
    justify-content: space-between;
  }

  .canvas-heading {
    margin-bottom: 10px;
    color: #687181;
    font-size: 9.5px;
  }

  .canvas-heading div {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .canvas-heading button {
    width: 22px;
    height: 22px;
    color: #6b7280;
    background: #fff;
    border: 1px solid #d9dde4;
    border-radius: 5px;
  }

  .page-paper {
    min-height: 520px;
    padding: 19px;
    background: #fff;
    border: 1px solid #dfe3e8;
    border-radius: 3px;
    box-shadow: 0 8px 24px rgb(31 41 55 / 5%);
  }

  .page-toolbar {
    padding-bottom: 14px;
    color: #858d9a;
    border-bottom: 1px solid #edf0f3;
    font-size: 9px;
  }

  .page-toolbar span:first-child {
    color: #343a45;
    font-size: 12px;
    font-weight: 650;
  }

  .metric-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-top: 15px;
  }

  .metric-row article {
    display: grid;
    gap: 5px;
    padding: 13px;
    background: #fafbfc;
    border: 1px solid #e7eaee;
    border-radius: 7px;
  }

  .metric-row span,
  .metric-row small {
    color: #7d8592;
    font-size: 9px;
  }

  .metric-row strong {
    color: #363c47;
    font-size: 20px;
  }

  .empty-widget {
    display: grid;
    place-items: center;
    min-height: 250px;
    margin-top: 10px;
    color: #9aa1ad;
    background-image: radial-gradient(#dfe3e9 0.8px, transparent 0.8px);
    background-size: 13px 13px;
    border: 1px dashed #d8dce3;
    border-radius: 7px;
    text-align: center;
  }

  .empty-widget strong {
    margin-top: -54px;
    color: #5f6774;
    font-size: 11px;
  }

  .empty-widget p {
    margin-top: -75px;
    font-size: 9px;
  }

  .widget-icon {
    display: grid;
    place-items: center;
    width: 31px;
    height: 31px;
    margin-top: 55px;
    color: #707887;
    background: #fff;
    border: 1px solid #d9dde4;
    border-radius: 7px;
  }

  .inspector {
    min-width: 0;
    overflow-y: auto;
    background: #fff;
    border-left: 1px solid #dfe3e9;
  }

  .inspector-head {
    min-height: 68px;
    border-bottom: 1px solid #e7e9ed;
  }

  .more {
    color: #687181;
    background: #fff;
    border-color: #e1e4e9;
  }

  .tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 0 14px;
    border-bottom: 1px solid #e8ebef;
  }

  .tabs button {
    padding: 10px;
    color: #8a929f;
    background: transparent;
    border: 0;
    border-bottom: 2px solid transparent;
    font-size: 10px;
  }

  .tabs button.active {
    color: #252a32;
    border-bottom-color: #252a32;
    font-weight: 600;
  }

  .property-section {
    display: grid;
    gap: 10px;
    padding: 16px;
    border-bottom: 1px solid #eceef1;
  }

  .property-section h3 {
    margin-bottom: 2px;
    color: #59616e;
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .property-section label {
    display: grid;
    gap: 5px;
    color: #737b88;
    font-size: 9.5px;
  }

  .property-section input,
  .property-section textarea {
    width: 100%;
    padding: 8px 9px;
    color: #313741;
    background: #fafbfc;
    border: 1px solid #dfe3e8;
    border-radius: 6px;
    outline: 0;
    resize: none;
    font-size: 10px;
  }

  .property-row {
    justify-content: space-between;
    color: #737b88;
    font-size: 9.5px;
  }

  .property-row strong {
    color: #333945;
    font-weight: 550;
  }

  .audit p {
    display: flex;
    align-items: center;
    gap: 7px;
    color: #727a87;
    font-size: 9.5px;
  }

  @media (max-width: 1100px) {
    .workspace {
      grid-template-columns: 300px minmax(500px, 1fr) 250px;
      overflow-x: auto;
    }

    .topbar {
      grid-template-columns: 280px 1fr auto;
    }
  }
</style>
