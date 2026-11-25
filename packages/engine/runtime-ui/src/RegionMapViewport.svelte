<script lang="ts">
  import { getContext, type Snippet } from 'svelte';
  import {
    REGION_MAP_CONTEXT, resolveRegionMapViewport, selectedViewport, viewportKey,
    type MapViewport, type RegionMapAdapter, type RegionMapContext, type RegionMapViewportRequest
  } from './region-map';

  import type {GeographyInput} from '../../widgets/src/components/map-chart/geography';
  let { enabled, basemap, children }: {
    enabled: boolean;
    basemap: RegionMapViewportRequest['basemap'];
    children: Snippet<[MapViewport | undefined, GeographyInput, ReturnType<RegionMapContext['selection']>]>;
  } = $props();
  const source = getContext<RegionMapContext | undefined>(REGION_MAP_CONTEXT);
  const adapter = $derived(source?.adapter());
  const geography = $derived({
    host: adapter?.geography, page: source?.overrides(), displayNames: adapter?.displayNames
  });
  const selection = $derived(enabled ? source?.selection() : undefined);
  const level = $derived(selection?.level);
  const value = $derived(selection?.value);
  const key = $derived(viewportKey(basemap,level,value));
  let applied = $state.raw<{ key: string; adapter: RegionMapAdapter; viewport: MapViewport }>();

  $effect(() => {
    applied = undefined;
    if (!adapter?.resolveViewport || !level || !value) return;
    const current = { key, adapter };
    const controller = new AbortController();
    void resolveRegionMapViewport(adapter, { basemap, level, value }, controller.signal).then(viewport => {
      if (!controller.signal.aborted && viewport) applied = { ...current, viewport };
    }, () => { /* A missing host viewport leaves the configured basemap view available. */ });
    return () => controller.abort();
  });
  const dynamic = $derived(applied?.key === key && applied.adapter === adapter ? applied.viewport : undefined);
  const viewport = $derived(level && value ? source?.frozenViewport?.(key) ?? selectedViewport(geography,{basemap,level,value},dynamic) : undefined);
  $effect(() => enabled && level && value ? source?.capture?.(key, () => viewport) : undefined);
</script>

{@render children(viewport, geography, selection)}
