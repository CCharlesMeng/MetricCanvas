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
    gap: 22px;
    height: 54px;
    padding: 0 22px;
    color: #f4f4f5;
    background: #18181b;
  }
  .brand {
    color: #fff;
    font-weight: 700;
    font-size: 14px;
    text-decoration: none;
    letter-spacing: -0.01em;
  }
  nav {
    display: flex;
    gap: 4px;
  }
  nav a {
    padding: 5px 11px;
    color: #a1a1aa;
    border-radius: 999px;
    font-size: 12.5px;
    font-weight: 500;
    text-decoration: none;
    transition:
      color 0.15s ease,
      background 0.15s ease;
  }
  nav a:hover {
    color: #f4f4f5;
  }
  nav a.active {
    color: #fff;
    background: rgb(255 255 255 / 12%);
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
    width: 24px;
    height: 24px;
    color: #fff;
    background: var(--accent);
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
  }
  .avatar.admin {
    background: #b45309;
  }
  .switcher select {
    padding: 4px 8px;
    color: #e4e4e7;
    background: rgb(255 255 255 / 8%);
    border: 1px solid rgb(255 255 255 / 14%);
    border-radius: 8px;
    font: inherit;
    font-size: 12px;
    cursor: pointer;
    transition: border-color 0.15s ease;
  }
  .switcher select:hover {
    border-color: rgb(255 255 255 / 32%);
  }
  .switcher select:focus-visible {
    outline: 2px solid rgb(99 102 241 / 60%);
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  main {
    min-height: calc(100vh - 54px);
  }
</style>
