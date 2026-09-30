import { describe, expect, it } from 'vitest';
import type { Page } from '@metriccanvas/page';
import { initialSectionGroup, selectedSectionGroup, sectionGroupFor, visibleSections } from '../src/section-navigation';

const page: Page = {
  schemaVersion: '6.12', id: 'navigation', dataSources: {},
  sectionGroups: [
    { id: 'a', label: 'A', sectionIds: ['a'] },
    { id: 'b', label: 'B', sectionIds: ['b'] }
  ],
  sections: ['common', 'a', 'b'].map(id => ({ id, components: [] }))
};
describe('page instance section selection', () => {
  it('defaults to the first or explicit group and keeps ungrouped sections in document order', () => {
    expect(selectedSectionGroup(page)).toBe('a');
    expect(selectedSectionGroup({ ...page, defaultSectionGroup: 'b' })).toBe('b');
    expect(visibleSections(page, 'b').map(section => section.id)).toEqual(['common', 'b']);
    expect(visibleSections(page, 'a').map(section => section.id)).toEqual(['common', 'a']);
  });
  it('resolves a hidden anchor group without changing the page or ungrouped selection', () => {
    expect(sectionGroupFor(page, 'b')).toBe('b');
    expect(sectionGroupFor(page, 'common')).toBeUndefined();
    expect(selectedSectionGroup(page, 'unknown')).toBe('a');
    expect(page.sections).toHaveLength(3);
  });
  it('preserves all sections for existing pages', () => {
    expect(visibleSections({ ...page, sectionGroups: undefined })).toEqual(page.sections);
  });
});

it('entry tab parameter selects only a declared group without guessing an unknown value', () => {
  const document = { ...page, sectionGroupParam: 'tab' };
  expect(initialSectionGroup(document, new Map([['tab', 'b']]))).toBe('b');
  expect(initialSectionGroup(document, new Map())).toBe('a');
  expect(() => initialSectionGroup(document, new Map([['tab', 'unknown']]))).toThrow('不存在');
});
