<script lang="ts">
  import PlatformStyleVariantA from './PlatformStyleVariantA.svelte';
  import PlatformStyleVariantB from './PlatformStyleVariantB.svelte';
  import PlatformStyleVariantC from './PlatformStyleVariantC.svelte';
  import PrototypeSwitcher from './PrototypeSwitcher.svelte';

  // PROTOTYPE — three Platform style variants on the existing / route, switchable via ?variant=.
  let { variant }: { variant: 'A' | 'B' | 'C' } = $props();

  const variants = [
    {
      key: 'A',
      name: 'Command Rail',
      summary: '深色顶栏 + 深色分析轨 + 白色工作区；输入字号 12px，1–4 行自适应。'
    },
    {
      key: 'B',
      name: 'Workspace Frame',
      summary: '白色分析面板 + 深色输入卡 + 框架化画布；信息更克制、工具感更强。'
    },
    {
      key: 'C',
      name: 'Focus Canvas',
      summary: '紧凑画布优先布局；AI 自动识别当前页面上下文，输入文字 11px。'
    }
  ] as const;
</script>

<svelte:head>
  <title>PROTOTYPE — Platform 企业级风格</title>
</svelte:head>

{#if variant === 'A'}
  <PlatformStyleVariantA />
{:else if variant === 'B'}
  <PlatformStyleVariantB />
{:else}
  <PlatformStyleVariantC />
{/if}

<PrototypeSwitcher {variant} {variants} />
