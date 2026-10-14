/** Generic composition example, authored from the public schema, never from an IOC result. */
export function overviewMapLedExample(schemaVersion: string) {
  const measure = (label: string) => ({type: 'number', role: 'measure', label, defaultFormat: 'number'});
  const dimension = (label: string) => ({type: 'string', role: 'dimension', label});
  const distribution = (rows: Array<{category: string; count: number}>) => ({
    fields: {category: dimension('分类'), count: measure('数量')}, source: {type: 'inline', rows}
  });
  const card = (id: string, title: string, metric: string, categories: string) => ({
    id, type: 'compositeCard', layout: {span: 4}, props: {title, variant: 'metricGrid', components: [
      {id: `${id}-headline`, type: 'metricCard', layout: {span: 12}, data: {main: 'totals'},
        props: {variant: 'compactStrip', rows: [{label: '本期数量', valueField: metric}]}},
      {id: `${id}-distribution`, type: 'pieChart', layout: {span: 5}, data: {main: categories},
        props: {variant: 'compactRing', categoryField: 'category', valueField: 'count'}},
      {id: `${id}-breakdown`, type: 'categoryBreakdown', layout: {span: 7}, data: {main: categories},
        props: {variant: 'compactList', categoryField: 'category', columns: [{label: '数量', field: 'count'}], swatches: true}}
    ]}
  });
  const table = (id: string) => ({id, type: 'table', layout: {span: 12}, data: {main: 'markets'}, props: {
    columns: [{field: 'country', title: '国家'}, {field: 'count', title: '数量', sortable: true}],
    fit: 'container'
  }});
  return {
    schemaVersion, id: 'overview-map-led', layout: 'dashboard', meta: {title: '市场概览（布局演示）'},
    dashboardToolbar: 'visible',
    dataSources: {
      totals: {fields: {visits: measure('访问'), orders: measure('订单'), completed: measure('完成')},
        source: {type: 'inline', rows: [{visits: 240, orders: 60, completed: 18}]}},
      'visit-groups': distribution([{category: '搜索', count: 80}, {category: '直达', count: 80}, {category: '伙伴', count: 80}]),
      'order-groups': distribution([{category: '新购', count: 20}, {category: '续购', count: 25}, {category: '扩容', count: 15}]),
      'service-groups': distribution([{category: '咨询', count: 6}, {category: '交付', count: 7}, {category: '支持', count: 5}]),
      markets: {fields: {country: dimension('国家底图名称'), count: measure('数量')}, source: {type: 'inline', rows: [
        {country: 'Canada', count: 12}, {country: 'Germany', count: 21}, {country: 'Japan', count: 27}
      ]}}
    },
    sections: [
      {id: 'summary-cards', container: 'plain', components: [
        card('traffic', '流量概况', 'visits', 'visit-groups'),
        card('orders', '订单进度', 'orders', 'order-groups'),
        card('service', '服务复盘', 'completed', 'service-groups')
      ]},
      {id: 'detail-and-map', container: 'plain', components: [
        {id: 'details', type: 'tabContainer', layout: {span: 4}, props: {defaultTab: 'overview', tabs: [
          {id: 'overview', label: '概览', component: table('overview-table')},
          {id: 'detail', label: '明细', component: table('detail-table')}
        ]}},
        {id: 'market-map', type: 'mapChart', layout: {span: 8}, data: {main: 'markets'},
          props: {title: '国家样例分布', map: 'world', nameField: 'country', valueField: 'count'}}
      ]}
    ]
  };
}
