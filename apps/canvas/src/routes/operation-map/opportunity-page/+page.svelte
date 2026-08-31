<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { legacyPageHref } from '$lib/legacy-page-route';

  $effect(() => {
    const href = legacyPageHref(page.url.pathname, page.url.search);
    if (href) void goto(href, { replaceState: true });
  });
</script>

<p class="legacy-redirect" aria-live="polite">正在打开机会点分析页…</p>

<style>
  .legacy-redirect {
    margin: 24px;
    color: #595959;
  }
</style>
