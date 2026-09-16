import type { LanguagePort, createAuthoringLanguage } from '../workbench/authoring-language';
/** Deployment-owned authenticated Relay adapter. Functions, never model-supplied JSON. */
export interface AuthoringIntegration { language: LanguagePort; connect?(controller: ReturnType<typeof createAuthoringLanguage>): void | (() => void) }
declare global { var __METRICCANVAS_AUTHORING__: AuthoringIntegration | undefined; }
export function readAuthoringIntegration(): AuthoringIntegration | undefined {
  const value = globalThis.__METRICCANVAS_AUTHORING__;
  if (!value) return undefined;
  if (typeof value.language?.prepare !== 'function' || typeof value.language.run !== 'function' || typeof value.language.lookup !== 'function' || typeof value.language.read !== 'function') throw Error('创作程序 Adapter 配置不完整。');
  return value;
}
