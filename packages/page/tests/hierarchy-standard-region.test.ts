import { expect, it } from 'vitest';
import raw from '../../../pages/business/dashboard/ioc/approval/authorization-norms.json';
import { parsePage } from '../src/validate';
import { flattenPageComponents, type Page, type TableComponent } from '../src/internal';

function document(): Page {
  const parsed = parsePage(raw);
  if (!parsed.ok) throw Error(JSON.stringify(parsed.errors));
  return parsed.page;
}

it('accepts the authorization page with the built-in three-level Region and no empty default', () => {
  const page = document(), region = page.filters!.find(filter => filter.id === 'region')!;
  expect(region).toMatchObject({ defaultLevel: 'geo', hierarchy: [
    { id: 'geo', dimension: 'geo-pc-code' },
    { id: 'region-dept', dimension: 'region-dept-code' },
    { id: 'office', dimension: 'rep-office-code' }
  ] });
  expect(region.default).toBeUndefined();
});

it.each(['ordinary', 'extra-level', 'wrong-dimension', 'reversed', 'geo-parent'])(
  'retains hierarchy selection restrictions: %s', kind => {
    const page = document(), region = page.filters!.find(filter => filter.id === 'region')!;
    if (region.type !== 'dimension') throw Error('region');
    const table = flattenPageComponents(page).find((component): component is TableComponent => component.type === 'table')!;
    if (kind === 'ordinary') page.sections.shift();
    if (kind === 'extra-level') region.hierarchy!.push({ id: 'extra', dimension: 'extra' });
    if (kind === 'wrong-dimension') region.hierarchy![0]!.dimension = 'other';
    if (kind === 'reversed') region.hierarchy!.reverse();
    if (kind === 'geo-parent') table.props.rowExpansion!.selection!.parentLevel = 'geo';
    const result = parsePage(page);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some(error => error.path.endsWith('/selection/filter'))).toBe(true);
  }
);
