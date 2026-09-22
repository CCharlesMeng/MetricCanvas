export function propertyFixture() {
  const data = { main: 'data' }, layout = { span: 12 };
  const actions = [{ on: 'click', navigate: { href: 'https://example.com/details' } }];
  return {
    schemaVersion: '6.5', id: 'properties-page', layout: 'report',
    dataSources: { data: { fields: { category: { type: 'string', role: 'dimension', nullable: false }, value: { type: 'number', role: 'measure', nullable: false }, delta: { type: 'number', role: 'measure', nullable: false } }, source: { type: 'inline', rows: [{ category: '甲', value: 120, delta: 3 }] } } },
    sections: [{ id: 's', components: [
      { id: 'header', type: 'reportHeader', layout, props: { title: '属性测试报告', subtitle: '原副标题', badge: '原徽标', tags: ['原标签'], asOf: { label: '截至', value: '2026-09' }, decoration: 'shortBar' } },
      { id: 'metric', type: 'metricCard', layout, data, props: { title: '指标属性', rows: [{ label: '销售', context: '本月', valueField: { data: 'main', field: 'value', format: 'compact-yi-1' }, unit: '元', changes: [{ label: '同比', field: 'delta', tone: 'positive' }] }], secondaryRows: [{ label: '辅助', valueField: 'delta' }], showTrendArrows: true, actions } },
      { id: 'bar', type: 'barChart', layout, data, props: { title: '柱状属性', categoryField: 'category', series: [{ field: 'value', label: '金额', role: 'actual', stackOrder: 1 }], dualAxis: true, actions } },
      { id: 'line', type: 'lineChart', layout, data, props: { title: '折线属性', xField: 'category', series: [{ field: 'value', label: '趋势' }], stacked: true, actions } },
      { id: 'pie', type: 'pieChart', layout, data, props: { title: '饼图属性', categoryField: 'category', valueField: 'value', ring: '40%', actions } },
      { id: 'table', type: 'table', layout, data, props: { title: '表格属性', subtitle: '表格说明', columns: [{ kind: 'group', id: 'group', title: '分组', children: [{ field: 'category', title: '类别', sortable: true }, { field: 'value', title: '金额', width: 120, align: 'right', visual: 'signed' }] }], pagination: { mode: 'local', pageSize: 10 }, actions } }
    ] }]
  };
}
