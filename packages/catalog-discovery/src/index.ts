import { createHash } from 'node:crypto';
import { canonicalizeJson } from '@metriccanvas/page';
import type {
  CatalogDimension,
  CatalogMetric,
  CatalogSnapshot
} from '@metriccanvas/page';

export interface VersionedCatalog {
  version: string;
  snapshot: CatalogSnapshot;
}

export interface CatalogProvider {
  current(): Promise<VersionedCatalog>;
}

export interface SearchCatalogQuery {
  query: string;
  limit?: number;
}

export type CatalogMatch =
  | ({ kind: 'metric' } & CatalogMetric)
  | ({ kind: 'dimension' } & CatalogDimension);

export interface SearchCatalogResult {
  metadataVersion: string;
  matches: CatalogMatch[];
}

export interface CatalogDiscovery {
  current(): Promise<VersionedCatalog>;
  search(query: SearchCatalogQuery): Promise<SearchCatalogResult>;
}

export function catalogVersionFor(snapshot: CatalogSnapshot): string {
  const semantics = {
    formatVersion: snapshot.formatVersion,
    metrics: snapshot.metrics
      .map((metric) => ({
        ...metric,
        availableDimensions: [...metric.availableDimensions].sort(),
        availableAggregations: [...metric.availableAggregations].sort()
      }))
      .sort((left, right) => left.code.localeCompare(right.code)),
    dimensions: [...snapshot.dimensions].sort((left, right) =>
      left.code.localeCompare(right.code)
    )
  };
  return createHash('sha256').update(canonicalizeJson(semantics)).digest('hex');
}

export function createCatalogDiscovery(provider: CatalogProvider): CatalogDiscovery {
  return {
    current: () => provider.current(),

    async search({ query, limit = 10 }) {
      const catalog = await provider.current();
      const needle = query.trim().toLocaleLowerCase();
      if (needle.length === 0 || limit <= 0) {
        return { metadataVersion: catalog.version, matches: [] };
      }

      const candidates: Array<{ match: CatalogMatch; score: number }> = [
        ...catalog.snapshot.metrics.map((metric) => ({
          match: { kind: 'metric' as const, ...metric },
          score: matchScore(needle, metric.code, metric.name)
        })),
        ...catalog.snapshot.dimensions.map((dimension) => ({
          match: { kind: 'dimension' as const, ...dimension },
          score: matchScore(needle, dimension.code, dimension.name)
        }))
      ];

      return {
        metadataVersion: catalog.version,
        matches: candidates
          .filter(({ score }) => Number.isFinite(score))
          .sort((left, right) => left.score - right.score || left.match.code.localeCompare(right.match.code))
          .slice(0, limit)
          .map(({ match }) => match)
      };
    }
  };
}

function matchScore(needle: string, code: string, name: string): number {
  const normalizedCode = code.toLocaleLowerCase();
  const normalizedName = name.toLocaleLowerCase();
  if (normalizedCode === needle) return 0;
  if (normalizedName === needle) return 1;
  if (normalizedCode.startsWith(needle) || normalizedName.startsWith(needle)) return 2;
  if (normalizedCode.includes(needle) || normalizedName.includes(needle)) return 3;
  return Number.POSITIVE_INFINITY;
}
