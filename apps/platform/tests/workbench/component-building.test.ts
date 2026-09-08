import { describe, expect, it } from 'vitest';
import { validate, versionPolicy } from '@metriccanvas/page';
import type { QueryFieldDefinition, DataRow } from '@metriccanvas/page/internal';
import vectors from '../../../../metriccanvas-authoring/test-harness/fixtures/component-building.json';
import { constructComponent, type ComponentInput } from '../../src/lib/workbench/component-building';
import type { ComponentCandidate } from '../../src/lib/workbench/component-selection';
import { changeComponentType, createCanvasAuthoringDraft } from '../../src/lib/workbench/document-edit';

interface Vector {
  type: string;
  fields: unknown;
  rows: unknown;
  totalCount?: number;
  title?: string | null;
}
function input(vector: Vector): ComponentInput {
  const fields = vector.fields as Record<string, QueryFieldDefinition>;
  return {
    dataSourceId: 'result', fields,
    ...(vector.title == null ? {} : { title: vector.title }),
    query: { language: 'dqe', body: { dsl_list: [{
      output_dims: Object.keys(fields).filter((id) => fields[id].role === 'dimension'),
      output_metrics: Object.keys(fields).filter((id) => fields[id].role === 'measure'),
      filter: { dims: [], metrics: [] }, order: {}
    }] } },
    initial: { capturedAt: '2026-09-08T00:00:00Z', rows: vector.rows as DataRow[],
      ...(vector.totalCount === undefined ? {} : { totalCount: vector.totalCount }) }
  };
}

describe('浏览器与 Python 共同的局部组件构造规则（ADR-0074）', () => {
  for (const vector of vectors.accepted) {
    it(`${vector.type}: 固定字段绑定、默认属性与布局保留`, () => {
      const unit = input(vector);
      const built = constructComponent(unit, vector.type as ComponentCandidate['type']);
      expect(built.ok).toBe(true);
      if (!built.ok) throw new Error(built.message);
      expect(built.component.props).toEqual(vector.expectedProps);
      // 用现行页面协议验证局部构造，然后经真实编辑入口验证布局与数据槽保留。
      const document = {
        schemaVersion: versionPolicy.current, id: 'component-example',
        dataSources: { result: { source: { type: 'query', query: unit.query, initial: unit.initial }, fields: unit.fields } },
        sections: [{ id: 'section', components: [{ ...built.component, id: 'kept-id', layout: { span: 5 } }] }]
      };
      expect(validate(document)).toEqual([]);
      const draft = createCanvasAuthoringDraft(document);
      if (!draft.ok) throw new Error(draft.message);
      const original = structuredClone(draft.draft);
      const edited = changeComponentType(draft.draft, { sectionId: 'section', componentId: 'kept-id' }, vector.type as ComponentCandidate['type']);
      if (!edited.ok) throw new Error(edited.message);
      expect(draft.draft).toEqual(original);
      expect(edited.draft.canvasDocument).toEqual(document);
    });
  }
  for (const [index, vector] of vectors.rejected.entries()) {
    it(`${vector.type}: 准入失败 ${index}`, () => {
      expect(constructComponent(input(vector), vector.type as ComponentCandidate['type']).ok).toBe(false);
    });
  }
});
