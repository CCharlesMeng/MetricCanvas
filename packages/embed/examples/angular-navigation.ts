import type { NgZone } from '@angular/core';
import type { Params, Router } from '@angular/router';
import type { RuntimeNavigation } from '@metriccanvas/embed';

/** Install once per host; URL synchronization never calls MetricCanvas mount/update. */
export function createAngularNavigation(
  router: Router,
  zone: NgZone,
  preserveSearchParams: readonly string[] = []
): RuntimeNavigation {
  return {
    preserveSearchParams,
    async replaceSearch(search) {
      const target = router.parseUrl(router.url);
      const query = new URLSearchParams(search);
      const params: Params = Object.fromEntries([...new Set(query.keys())].map(key => [key, query.getAll(key)]));
      for (const key of preserveSearchParams) {
        if (!query.has(key) && Object.hasOwn(target.queryParams, key)) params[key] = target.queryParams[key];
      }
      target.queryParams = params;
      if (router.serializeUrl(target) === router.url) return;
      const success = await zone.run(() => router.navigateByUrl(target, { replaceUrl: true }));
      if (!success) throw Error('Angular Router cancelled MetricCanvas URL synchronization');
    }
  };
}
