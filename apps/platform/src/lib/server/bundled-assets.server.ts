import bundledDataContext from '$fixtures/schema-metadata.example.json';

export const bundledPageModules = import.meta.glob<{ default: unknown }>('$pages/*.json', {
  eager: true
});

export { bundledDataContext };
