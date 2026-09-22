/** Explicit local fixture. Never loaded by the normal workbench or SDK adapter. */
import { DRAFT_SAVED_EVENT, type DialogueAdapter, type ReadSavedDraft } from './port';
export function createDialogueFixture(target: EventTarget): { adapter: DialogueAdapter; read: ReadSavedDraft } {
  return {
    adapter: {
      async mount(element) {
        const label = document.createElement('p');
        label.textContent = '受控替身：非真实盘古，不保存页面';
        element.append(label);
        for (const id of ['draft-a', 'draft-b', 'slow', 'failure', 'invalid']) {
          const button = document.createElement('button');
          button.textContent = id;
          button.onclick = () => target.dispatchEvent(new CustomEvent(DRAFT_SAVED_EVENT, { detail: { draftId: id } }));
          element.append(button);
        }
        return () => element.replaceChildren();
      }
    },
    async read(draftId) {
      // Deliberately ignore abort to test late provider responses.
      if (draftId === 'slow') await new Promise((resolve) => setTimeout(resolve, 500));
      if (draftId === 'failure') throw new Error('替身读取失败，保留当前页面。');
      return {
        draftId, ref: { pageId: 'fixture-page', revisionId: draftId, resourceId: 'fixture-resource' },
        document: {
          schemaVersion: '6.5', layout: 'report', id: 'fixture-page', dataSources: {},
          sections: draftId === 'invalid' ? [] : [{
            id: 'main', title: '测试', container: 'panel',
            components: [{ id: 'summary', type: 'text', layout: { span: 12 }, props: { title: draftId, body: `页面 ${draftId}` } }]
          }]
        }
      };
    }
  };
}
