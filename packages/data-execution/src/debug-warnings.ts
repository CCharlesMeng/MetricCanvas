export type DebugWarningSink = (message: string, ...details: unknown[]) => void;

type RuntimeImportMeta = ImportMeta & {
  env?: { DEV?: boolean; VITE_METRICCANVAS_DEBUG_WARNINGS?: string };
};

// Direct Node and non-Vite consumers have no import.meta.env.
function detectDefaultWarningsEnabled(): boolean {
  const env = (import.meta as RuntimeImportMeta).env;
  return env?.DEV === true || env?.VITE_METRICCANVAS_DEBUG_WARNINGS === 'true';
}

export const runtimeWarningsEnabled = detectDefaultWarningsEnabled();

let customSink: DebugWarningSink | null | undefined;

export function setDebugWarningSink(sink: DebugWarningSink | null): void {
  customSink = sink;
}

export function resetDebugWarningSink(): void {
  customSink = undefined;
}

export function debugWarn(message: string, ...details: unknown[]): void {
  if (customSink !== undefined) {
    customSink?.(message, ...details);
    return;
  }
  if (runtimeWarningsEnabled) console.warn(message, ...details);
}
