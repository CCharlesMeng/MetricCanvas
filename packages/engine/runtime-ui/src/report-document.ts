import { abortable } from './report-capture-view';
import { reportThemeProperties } from './report-theme-properties';

/** Only engine-owned styles are injected by the mounted Svelte components.
 * In particular, no parent stylesheet, pseudo-element or background image is copied.
 */
export async function createReportDocument(source: HTMLElement, width: number, signal: AbortSignal) {
  const owner = source.ownerDocument;
  const frame = owner.createElement('iframe');
  frame.dataset.reportExportFrame = '';
  frame.title = '报告独立导出视图';
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.setAttribute('sandbox', 'allow-same-origin');
  frame.style.cssText = `position:fixed;left:-100000px;top:0;width:${width}px;height:1000px;border:0;pointer-events:none;`;
  const loaded = new Promise<void>(resolve => frame.addEventListener('load', () => resolve(), { once: true }));
  frame.srcdoc = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:white}*{box-sizing:border-box}</style></head><body></body></html>';
  try {
    owner.body.append(frame);
    await abortable(loaded, signal);
    signal.throwIfAborted();
    const document = frame.contentDocument;
    if (!document) throw Error('无法创建独立报告文档');
    const base = document.createElement('base');
    base.href = owner.baseURI;
    document.head.append(base);
    // Fonts are resources, not rules copied from the parent's CSS cascade.
    owner.fonts.forEach(font => document.fonts.add(font));
    const holder = document.createElement('div');
    holder.dataset.metriccanvasExportStage = '';
    holder.style.cssText = `width:${width}px;container:mc-runtime / inline-size;`;
    holder.inert = true;
    const content = source.querySelector<HTMLElement>('.page-content') ?? source;
    const computed = getComputedStyle(content);
    for (const name of reportThemeProperties) {
      const value = computed.getPropertyValue(name);
      if (value && !/url\s*\(|image-set\s*\(|(?:javascript|data):/i.test(value)) holder.style.setProperty(name, value);
    }
    for (const name of ['font-family', 'font-size', 'font-weight', 'line-height', 'color', 'background-color']) holder.style.setProperty(name, computed.getPropertyValue(name));
    document.body.append(holder);
    return { holder, dispose: () => frame.remove() };
  } catch (cause) { frame.remove(); throw cause; }
}
