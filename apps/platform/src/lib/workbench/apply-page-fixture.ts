import type { DialogueAdapter } from '../dialogue/port';
import type { PageRevision } from '../page-assets/contract';
import { confirmedPageAssetCapabilities, type AuthoringPort } from './authoring-coordinator';
import { APPLY_PAGE_EVENT } from './apply-page';

/** Standalone manual fixture: no SDK, backend, DQE or production writes. */
export function createApplyPageFixture(target: EventTarget) {
  let version = 0;
  let fail = false;
  const pageId = 'mock-page-001';
  const read = async (): Promise<PageRevision> => {
    await new Promise(resolve => setTimeout(resolve, 200));
    if (fail) { fail = false; throw Error('模拟读取失败，保留当前页面。'); }
    return {
      pageId, resourceId: 'mock-resource', revisionId: `mock-r${version}`, revisionNumber: version,
      baseRevisionId: null, contentHash: '', dataContextVersion: null, createdBy: 'mock', createdAt: '',
      document: { schemaVersion: '6.1', layout: 'report', id: pageId, dataSources: {},
        sections: [{ id: 'main', title: '确认结果', container: 'panel', components: [
          { id: 'summary', type: 'text', layout: { span: 12 }, props: { title: `模拟页面第 ${version} 版`, body: '确认卡片后，工作台重新读取当前页面。此内容使用 inline 场景，不请求业务数据。' } }
        ] }] }
    };
  };
  const port: AuthoringPort = {
    capabilities: confirmedPageAssetCapabilities, getLatest: read, getRevision: read,
    async saveRevision() { throw Error('模拟入口不提供保存，请刷新入口重置手工修改。'); }
  };
  const adapter: DialogueAdapter = {
    async mount(element) {
      const label = document.createElement('p');
      label.textContent = '工作台接入模拟：非真实盘古。生成后点确认，观察右侧画布；可重复生成。';
      const card = document.createElement('section');
      const description = document.createElement('p');
      const confirm = document.createElement('button'); confirm.textContent = '确认'; confirm.disabled = true;
      const dispatch = (id = pageId) => target.dispatchEvent(new CustomEvent(APPLY_PAGE_EVENT, { detail: { pageId: id } }));
      confirm.onclick = () => { dispatch(); };
      card.append(description, confirm);
      const add = (text: string, action: () => void) => {
        const button = document.createElement('button'); button.textContent = text; button.onclick = action; element.append(button);
      };
      element.append(label);
      add('生成下一版卡片', () => { version++; description.textContent = `本次修改：将页面标题更新为「模拟页面第 ${version} 版」。`; confirm.disabled = false; });
      add('模拟读取失败', () => { fail = true; dispatch(); });
      add('模拟其他页面通知', () => { dispatch('other-page'); });
      add('模拟非法通知', () => { target.dispatchEvent(new CustomEvent(APPLY_PAGE_EVENT, { detail: { pageId: '' } })); });
      element.append(card);
      return () => element.replaceChildren();
    }
  };
  return { port, adapter };
}
