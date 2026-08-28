import bundledDataContext from '$fixtures/schema-metadata.example.json';
import type { OfflineTemplateSeed } from './offline-services';

export const bundledPageModules = import.meta.glob<{ default: unknown }>('$pages/*.json', {
  eager: true
});

export const bundledTemplateModules = import.meta.glob<{ default: OfflineTemplateSeed }>(
  '$templates/*.json',
  { eager: true }
);

export { bundledDataContext };
