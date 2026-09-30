import { describe, it, expect } from 'vitest';
import type { Page } from '../src/page';
import { validate } from '../src/validate';
const fixture = (): Page => ({ schemaVersion: '6.12', id: 'sections', dataSources: {},
  sectionGroups: [{ id: 'a', label: '组A', sectionIds: ['a'] }, { id: 'b', label: '组B', sectionIds: ['b'] }],
  defaultSectionGroup: 'a', sectionAnchors: [{ sectionId: 'b', label: '内容B' }],
  sections: ['a', 'b', 'common'].map(id => ({ id, components: [{ id: `${id}-text`, type: 'text', layout: { span: 12 }, props: { body: id } }] })) });
describe('6.12 内容分区引用', () => {
  it('入口参数属于内容组初始化消费者', () => {
    const page = fixture();
    page.params = [{ id: 'tab', type: 'string', required: false, default: 'b' }];
    page.sectionGroupParam = 'tab';
    expect(validate(page)).toEqual([]);
  });
  it('有限组与锚点可校验；6.11不能行使新能力', () => {
    const page = fixture(); expect(validate(page)).toEqual([]);
    page.schemaVersion = '6.11'; expect(validate(page).some(error => error.message.includes('6.12'))).toBe(true);
  });
  it.each(['missing', 'duplicate', 'default', 'anchor'])('拒绝无效引用 %s', kind => {
    const page = fixture();
    if (kind === 'missing') page.sectionGroups![0].sectionIds = ['missing'];
    if (kind === 'duplicate') page.sectionGroups![1].sectionIds = ['a'];
    if (kind === 'default') page.defaultSectionGroup = 'missing';
    if (kind === 'anchor') page.sectionAnchors![0].sectionId = 'missing';
    expect(validate(page).length).toBeGreaterThan(0);
  });
});
