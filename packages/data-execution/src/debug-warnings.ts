type RuntimeImportMeta = ImportMeta & {
  env?: { DEV?: boolean; VITE_METRICCANVAS_DEBUG_WARNINGS?: string };
};

// Direct Node and non-Vite consumers have no import.meta.env.
const env = (import.meta as RuntimeImportMeta).env;
export const runtimeWarningsEnabled = env?.DEV === true || env?.VITE_METRICCANVAS_DEBUG_WARNINGS === 'true';

export function debugWarn(message: string, ...details: unknown[]): void {
  if (runtimeWarningsEnabled) console.warn(message, ...details);
}
