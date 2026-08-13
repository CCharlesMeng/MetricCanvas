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

<header>
  <a class="brand" href="/">MetricCanvas</a>
  <nav>
    {#each NAV as item (item.href)}
      <a href={item.href} class:active={isActive(item.href)}>{item.label}</a>
    {/each}
  </nav>
  <div class="who">
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
</header>

<main>{@render children()}</main>

<style>
  :global(*) {
    box-sizing: border-box;
  }
  /* 平台设计 token(原型 ask-workbench.v2 的变量体系):页面样式引用
     token,不再各自硬编码色值。 */
  :global(:root) {
    --bg: #f4f4f5;
    --surface: #fff;
    --line: #e4e4e7;
    --line-soft: #f4f4f5;
    --text: #18181b;
    --muted: #71717a;
    --faint: #a1a1aa;
    --accent: #4f46e5;
    --accent-strong: #4338ca;
    --accent-soft: #eef2ff;
    --warn-bg: #fffbeb;
    --warn-line: #fde68a;
    --warn-text: #92400e;
    --ok: #16a34a;
    --down: #dc2626;
    /* 顶栏高度唯一声明:页面满高布局引用它,不各自硬编码。 */
    --topbar-h: 44px;
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
  header {
    display: flex;
    align-items: center;
    gap: 20px;
    height: var(--topbar-h);
    padding: 0 20px;
    color: var(--text);
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }
  .brand {
    color: var(--text);
    font-weight: 700;
    font-size: 13.5px;
    text-decoration: none;
    letter-spacing: -0.01em;
  }
  nav {
    display: flex;
    gap: 4px;
  }
  nav a {
    padding: 4px 11px;
    color: var(--muted);
    border-radius: 999px;
    font-size: 12.5px;
    font-weight: 500;
    text-decoration: none;
    transition:
      color 0.15s ease,
      background 0.15s ease;
  }
  nav a:hover {
    color: var(--text);
  }
  nav a.active {
    color: #3730a3;
    background: var(--accent-soft);
    font-weight: 600;
  }
  .who {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }
  .avatar {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    color: #fff;
    background: var(--accent);
    border-radius: 999px;
    font-size: 10.5px;
    font-weight: 700;
  }
  .avatar.admin {
    background: #b45309;
  }
  .switcher select {
    padding: 3px 8px;
    color: var(--text);
    background: var(--surface);
    border: 1px solid #d4d4d8;
    border-radius: 8px;
    font: inherit;
    font-size: 12px;
    cursor: pointer;
    transition: border-color 0.15s ease;
  }
  .switcher select:hover {
    border-color: var(--faint);
  }
  .switcher select:focus-visible {
    outline: none;
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgb(99 102 241 / 12%);
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  main {
    min-height: calc(100vh - var(--topbar-h));
  }
</style>
