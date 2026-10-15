<script lang="ts">
  import {usePlatformServices} from './integration/services';
  const services = usePlatformServices();
  const {resolve} = services.navigation;
  import { onMount,untrack } from 'svelte';


  let { children, path }: { children: import('svelte').Snippet; path: string } = $props();
  let work=$state(untrack(()=>services.workSession.snapshot()));
  onMount(() => {
    const stopWork=services.workSession.subscribe(value=>{work=value;});
    return stopWork;
  });

  const NAV = [
    { href: '/create', label: '创作' },
    { href: '/manage', label: '页面管理' }
  ] as const;

  function isActive(href: string): boolean {
    const route = path;
    return route === href || (href !== '/create' && route.startsWith(`${href}/`));
  }

</script>



<div class="platform-app" data-testid="platform-app">
<aside class="global-rail" data-testid="global-rail" aria-label="Platform 全局导航">
  <div class="brand" aria-label="MetricCanvas" title="MetricCanvas" data-contract-shell-label data-contract-critical>M</div>
  <nav aria-label="主导航">
    {#each NAV as item (item.href)}
      <a
        href={item.href==='/create'?(work.tasks.find(task=>task.key===work.current)?.url??resolve('/create')):work.directory}
        class="nav-link"
        class:active={isActive(item.href)}
        aria-current={isActive(item.href) ? 'page' : undefined}
        aria-label={item.label}
        title={item.label}
        data-contract-shell-label
        data-contract-critical
      >
        {#if item.href === '/create'}
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M4 4.75h12v8.5H9l-3.5 2.5v-2.5H4z" />
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
</aside>

<main class="shell-main">{@render children()}</main>
</div>

<style>
  .platform-app,
  .platform-app :global(*),
  .platform-app :global(*::before),
  .platform-app :global(*::after) {
    box-sizing: border-box;
  }
  /* Platform 壳层 token：只服务全局导航与工具面，不覆盖统一运行时 --mc-*。 */
  .platform-app {
    --bg: #f5f5f5;
    --surface: #ffffff;
    --surface-subtle: #f9fafb;
    --line: #f0f0f0;
    --line-soft: #f1f3f5;
    --text: #191919;
    --muted: #6b7280;
    --faint: #9ca3af;
    --accent: #191919;
    --accent-strong: #191919;
    --accent-soft: #f5f5f5;
    --rail: #ffffff;
    --rail-hover: #f5f5f5;
    --rail-active: #f0f0f0;
    --rail-text: #595959;
    --rail-muted: #808080;
    --rail-line: #f0f0f0;
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
    --analysis-rail-w: 400px;
    --inspector-rail-w: 280px;
    /* 横向顶栏已收敛进竖向导航，工作台继续消费唯一满高 token。 */
    --topbar-h: 0px;
  }
  .platform-app {
    position: relative;
    isolation: isolate;
    container: platform / size;
    display: grid;
    grid-template-columns: var(--shell-rail-w) minmax(0, 1fr);
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    color: var(--text);
    background: var(--bg);
    font-family:
      Helvetica, Arial, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    font-size:14px;
    line-height:1.5;
    -webkit-font-smoothing: antialiased;
  }
  .platform-app :global(button),
  .platform-app :global(input),
  .platform-app :global(textarea),
  .platform-app :global(select) {
    font-family: inherit;
  }
  .global-rail {
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    width: var(--shell-rail-w);
    color: var(--rail-text);
    background: var(--rail);
    border-right: 1px solid var(--rail-line);
  }
  .brand {
    display: grid;
    flex: none;
    place-items: center;
    height: var(--contextbar-h);
    color: var(--text);
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
    color: var(--text);
    background: var(--rail-hover);
  }
  .nav-link.active {
    color: var(--text);
    background: var(--rail-active);
  }
  .nav-link:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  .shell-main {
    min-width: 0;
    min-height: 0;
    height: 100%;
    overflow: auto;
  }
</style>
