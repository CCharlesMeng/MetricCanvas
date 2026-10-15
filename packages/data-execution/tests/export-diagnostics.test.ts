import { expect, it } from 'vitest';
import { parsePage } from '@metriccanvas/page';
import cascade from '../../page/fixtures/contract-valid/query-cascade-page.json';
import { describeExportSource } from '../src/source-program/export-diagnostics';

it('locates an upstream query used indirectly by a table through computed results',()=>{
  const parsed=parsePage(cascade);if(!parsed.ok)throw Error('fixture');
  const details=describeExportSource(parsed.page,'project-efficiency-bottom5-stages');
  expect(details).toEqual({
    dataSourceId:'project-efficiency-bottom5-stages',dataSourcePath:'/dataSources/project-efficiency-bottom5-stages',
    components:[expect.objectContaining({componentId:'project-bottom5-table',componentType:'table',
      componentPath:'/sections/0/components/0',bindingPath:'/sections/0/components/0/data/main',
      boundSourceId:'project-efficiency-bottom5',relation:'dependency'})]
  });
  expect(describeExportSource(parsed.page,'unreferenced-source').components).toEqual([]);
});
