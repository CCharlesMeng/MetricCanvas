<script lang="ts">
  import { page } from '$app/state';
  import type { LayoutServerData } from './$types';

  let { data, children }: { data: LayoutServerData; children: import('svelte').Snippet } =
    $props();

  const NAV = [
    { href: '/', label: '问数工作台' },
    { href: '/ask', label: '看板演示' },
    { href: '/manage', label: '页面管理' }
  ];

  function isActive(href: string): boolean {
    const path = page.url.pathname;
    return href === '/' ? path === '/' : path.startsWith(href);
  }

  /** 切换 mock 用户:经查询参数触发服务端写 cookie,后续导航保持。 */
  function switchActor(event: Event) {
    const actorId = (event.currentTarget as HTMLSelectElement).value;
    const url = new URL(page.url);
    url.searchParams.set('mock-actor', actorId);
    window.location.assign(url.toString());
  }
</script>

<svelte:head>
  <title>MetricCanvas 指标画布</title>
</svelte:head>

<aside class="global-rail" data-testid="global-rail" aria-label="Platform 全局导航">
  <a
    class="brand"
    href="/"
    aria-label="MetricCanvas"
    title="MetricCanvas"
    data-contract-shell-label
    data-contract-critical
  >M</a>
  <nav aria-label="主导航">
    {#each NAV as item (item.href)}
      <a
        href={item.href}
        class="nav-link"
        class:active={isActive(item.href)}
        aria-current={isActive(item.href) ? 'page' : undefined}
        aria-label={item.label}
        title={item.label}
        data-contract-shell-label
        data-contract-critical
      >
        {#if item.href === '/'}
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M4 4.75h12v8.5H9l-3.5 2.5v-2.5H4z" />
          </svg>
        {:else if item.href === '/ask'}
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M4 15V9m6 6V5m6 10v-8" />
          </svg>
        {:else}
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <rect x="4" y="4" width="5" height="5" rx="1" />
            <rect x="11" y="4" width="5" height="5" rx="1" />
            <rect x="4" y="11" width="5" height="5" rx="1" />
            <rect x="11" y="11" width="5" height="5" rx="1" />
          </svg>
        {/if}
        <span class="sr-only">{item.label}</span>
      </a>
    {/each}
  </nav>
  <div class="who" title={`当前用户：${data.identity.actorId}`} data-contract-critical>
    <span class="avatar" class:admin={data.identity.isAdmin} aria-hidden="true">
      {data.identity.actorId.slice(0, 1).toUpperCase()}
    </span>
    <label class="switcher">
      <span class="sr-only">切换 mock 用户</span>
      <select value={data.identity.actorId} onchange={switchActor}>
        {#each data.mockUsers as user (user.actorId)}
          <option value={user.actorId}>
            {user.actorId}{user.isAdmin ? '(管理员)' : ''}
          </option>
        {/each}
      </select>
    </label>
  </div>
</aside>

<main class="shell-main">{@render children()}</main>

<style>
  :global(*) {
    box-sizing: border-box;
  }
  /* Platform 壳层 token：只服务全局导航与工具面，不覆盖统一运行时 --mc-*。 */
  :global(:root) {
    --bg: #f3f4f6;
    --surface: #ffffff;
    --surface-subtle: #f9fafb;
    --line: #e5e7eb;
    --line-soft: #f1f3f5;
    --text: #111827;
    --muted: #6b7280;
    --faint: #9ca3af;
    --accent: #6366f1;
    --accent-strong: #4f46e5;
    --accent-soft: #eef2ff;
    --rail: #111827;
    --rail-hover: #182231;
    --rail-active: #1f2937;
    --rail-text: #d1d5db;
    --rail-muted: #8b95a5;
    --rail-line: rgb(255 255 255 / 8%);
    --text-on-strong: #fff;
    --control-line: #d1d5db;
    --warn-bg: #fffbeb;
    --warn-line: #fde68a;
    --warn-text: #92400e;
    --ok: #16a34a;
    --down: #dc2626;
    --down-strong: #b91c1c;
    --shell-rail-w: 60px;
    --contextbar-h: 46px;
    --analysis-rail-w: 292px;
    --inspector-rail-w: 260px;
    /* 横向顶栏已收敛进竖向导航，工作台继续消费唯一满高 token。 */
    --topbar-h: 0px;
  }
  :global(body) {
    margin: 0;
    color: var(--text);
    background: var(--bg);
    font-family:
      Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
      "PingFang SC", "Microsoft YaHei", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  :global(button),
  :global(input),
  :global(textarea),
  :global(select) {
    font-family: inherit;
  }
  .global-rail {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 40;
    display: flex;
    flex-direction: column;
    width: var(--shell-rail-w);
    min-height: 100vh;
    color: var(--rail-text);
    background: var(--rail);
    border-right: 1px solid var(--rail-line);
  }
  .brand {
    display: grid;
    flex: none;
    place-items: center;
    height: var(--contextbar-h);
    color: var(--text-on-strong);
    border-bottom: 1px solid var(--rail-line);
    font-size: 16px;
    font-weight: 750;
    text-decoration: none;
    letter-spacing: -0.03em;
  }
  nav {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 9px 8px;
  }
  .nav-link {
    display: grid;
    place-items: center;
    width: 44px;
    height: 40px;
    padding: 0;
    color: var(--rail-muted);
    border-radius: 8px;
    text-decoration: none;
    transition:
      color 0.15s ease,
      background 0.15s ease;
  }
  .nav-link svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.45;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .nav-link:hover {
    color: var(--text-on-strong);
    background: var(--rail-hover);
  }
  .nav-link.active {
    color: var(--text-on-strong);
    background: var(--rail-active);
  }
  .brand:focus-visible,
  .nav-link:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  .who {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    margin: auto 8px 10px;
    border-radius: 9px;
  }
  .who:hover {
    background: var(--rail-hover);
  }
  .who:focus-within {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  .avatar {
    display: grid;
    place-items: center;
    width: 25px;
    height: 25px;
    color: var(--text-on-strong);
    background: var(--accent);
    border: 1px solid rgb(255 255 255 / 22%);
    border-radius: 7px;
    font-size: 10px;
    font-weight: 700;
  }
  .avatar.admin {
    background: #b45309;
  }
  .switcher {
    position: absolute;
    inset: 0;
  }
  .switcher select {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    outline: none;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  .shell-main {
    width: calc(100% - var(--shell-rail-w));
    min-height: calc(100vh - var(--topbar-h));
    margin-left: var(--shell-rail-w);
    overflow-x: clip;
  }
</style>
