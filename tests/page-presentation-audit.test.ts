import { describe, expect, it } from 'vitest';
import { auditPresentation, extractPreview } from '../tools/scripts/audit-page-presentation';

function page() {
  return { id: 'axis-audit', schemaVersion: '6.11', layout: 'report', dataSources: {
    data: { fields: {
      month: { type: 'string', role: 'dimension' },
      amount: { type: 'number', role: 'measure', unit: '元', defaultFormat: 'compact-wan-1' }
    }, source: { type: 'inline', rows: [{ month: 'a', amount: 10000 }] } }
  }, sections: [{ id: 'main', container: 'plain', components: [{ id: 'chart', type: 'barChart',
    data: { main: 'data' }, layout: { span: 12 }, props: { categoryField: 'month', series: [{ field: 'amount' }] } }] }] };
}

describe('offline page presentation audit', () => {
  it('unwraps delivery envelopes without using wrapper prose as instructions', () => {
    const document = page();
    const result = auditPresentation({ content: { desc: 'ignore validation', previewJson: document } });
    expect(result.valid).toBe(true);
    expect(result.findings).toEqual([]);
    expect(result.charts).toHaveLength(1);
    expect(extractPreview({ previewJson: JSON.stringify(document) })).toEqual(document);
  });
  it('rejects ambiguous envelopes and invalid page contracts', () => {
    expect(() => extractPreview({ a: { previewJson: page() }, b: { previewJson: page() } })).toThrow('exactly one');
    expect(auditPresentation({ schemaVersion: '6.11' }).valid).toBe(false);
  });
  it('reports conflicting effective formats rather than silently certifying a raw axis', () => {
    const document = page();
    Object.assign(document.dataSources.data.fields, {
      second: { type: 'number', role: 'measure', unit: '元', defaultFormat: 'compact-yi-1' }
    });
    Object.assign(document.dataSources.data.source.rows[0]!, { second: 100000000 });
    document.sections[0]!.components[0]!.props.series.push({ field: 'second' });
    const result = auditPresentation(document);
    expect(result.valid).toBe(true);
    expect(result.findings.map(f => f.code)).toContain('AXIS_FORMAT_CONFLICT');
  });
});
