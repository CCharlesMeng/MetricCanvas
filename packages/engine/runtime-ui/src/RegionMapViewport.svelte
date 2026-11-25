<script lang="ts">
  import { getContext, type Snippet } from 'svelte';
  import {
    REGION_MAP_CONTEXT, resolveRegionMapViewport,
    type MapViewport, type RegionMapAdapter, type RegionMapContext, type RegionMapViewportRequest
  } from './region-map';

  let { enabled, basemap, children }: {
    enabled: boolean;
    basemap: RegionMapViewportRequest['basemap'];
    children: Snippet<[MapViewport | undefined]>;
  } = $props();
  const source = getContext<RegionMapContext | undefined>(REGION_MAP_CONTEXT);
  const adapter = $derived(enabled ? source?.adapter() : undefined);
  const selection = $derived(enabled && adapter ? source?.selection() : undefined);
  const level = $derived(selection?.level);
  const value = $derived(selection?.value);
  const key = $derived(JSON.stringify([basemap, level, value]));
  let applied = $state.raw<{ key: string; adapter: RegionMapAdapter; viewport: MapViewport }>();

  $effect(() => {
    applied = undefined;
    if (!adapter || !level || !value) return;
    const current = { key, adapter };
    const controller = new AbortController();
    void resolveRegionMapViewport(adapter, { basemap, level, value }, controller.signal).then(viewport => {
      if (!controller.signal.aborted && viewport) applied = { ...current, viewport };
    }, () => { /* A missing host viewport leaves the configured basemap view available. */ });
    return () => controller.abort();
  });
</script>

{@render children(applied?.key === key && applied.adapter === adapter ? applied.viewport : undefined)}
