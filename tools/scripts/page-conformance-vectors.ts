/**
 * 页面校验 conformance 向量的定义（ADR-0062）。
 *
 * 每条不变式登记：它在哪些合法样例里被实际行使（正例），以及若干从合法样例出发的
 * 单点破坏（反例）。反例的 `expected` 由 TypeScript 校验器产出，Java 校验器必须在同一
 * 输入上给出逐条相同的 `type/path/message`。`expect` 是每个反例的自检：破坏后至少有
 * 一条错误命中它，防止反例因为别的原因失败而被误记为覆盖。
 *
 * 结构错误由 ajv 产出，这里也登记少量结构反例，用来钉住 Java 侧对 ajv 文案与顺序的复现。
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = any;

export interface ConformanceCase {
  case: string;
  base: string;
  expect: RegExp;
  mutate(document: Doc): void;
}

export interface InvariantDefinition {
  id: string;
  description: string;
  valid: string[];
  cases: ConformanceCase[];
}

const ALL_VALID = [
  'inline-report',
  'mixed-page',
  'query-dashboard',
  'filters-page',
  'compute-page',
  'grouped-fields-page',
  'params-page',
  'composite-page',
  'map-page',
  'forecast-page'
];

function firstComponent(document: Doc, section = 0, index = 0): Doc {
  return document.sections[section].components[index];
}

function longString(length: number): string {
  return 'x'.repeat(length);
}

export const invariants: InvariantDefinition[] = [
  // ---------------------------------------------------------------- 结构与版本
  {
    id: 'schema-structure',
    description: 'Page Schema 结构校验（ajv allErrors 文案与顺序）',
    valid: ALL_VALID,
    cases: [
      {
        case: 'missing-schema-version',
        base: '__missing-schema-version__',
        expect: /缺少必填字段 schemaVersion/,
        mutate: () => undefined
      },
      {
        case: 'unknown-top-level-field',
        base: 'inline-report',
        expect: /存在未定义字段 widgets/,
        mutate: (document) => {
          document.widgets = [];
        }
      },
      {
        case: 'layout-span-out-of-range',
        base: 'inline-report',
        expect: /must be <= 12/,
        mutate: (document) => {
          firstComponent(document, 0, 1).layout.span = 13;
        }
      },
      {
        case: 'field-id-pattern',
        base: 'inline-report',
        expect: /property name must be valid/,
        mutate: (document) => {
          document.dataSources.overview.fields['1-bad'] = { type: 'number', role: 'measure' };
          document.dataSources.overview.source.rows[0]['1-bad'] = 1;
        }
      },
      {
        case: 'sections-empty',
        base: 'inline-report',
        expect: /must NOT have fewer than 1 items/,
        mutate: (document) => {
          document.sections = [];
        }
      }
    ]
  },
  {
    id: 'schema-version-supported',
    description: 'schemaVersion 必须是当前主版本内的受支持次版本',
    valid: ALL_VALID,
    cases: [
      {
        case: 'version-major-unsupported',
        base: 'query-dashboard',
        expect: /不支持的文档格式版本 4\.0/,
        mutate: (document) => {
          document.schemaVersion = '4.0';
        }
      },
      {
        case: 'version-minor-ahead',
        base: 'query-dashboard',
        expect: /高于运行时当前次版本/,
        mutate: (document) => {
          document.schemaVersion = '5.9';
        }
      }
    ]
  },
  {
    id: 'capability-floor',
    description: '文档使用的能力不得高于其声明的次版本',
    valid: ALL_VALID,
    cases: [
      {
        case: 'capability-floor-field-text-on-5-0',
        base: 'forecast-page',
        expect: /字段绑定长文本组件 由 5\.1 引入/,
        mutate: (document) => {
          document.schemaVersion = '5.0';
        }
      },
      {
        case: 'capability-floor-composite-page-on-5-1',
        base: 'composite-page',
        expect: /组合卡:组件级分组容器\(ADR-0053\) 由 5\.2 引入/,
        mutate: (document) => {
          document.schemaVersion = '5.1';
        }
      }
    ]
  },
  {
    id: 'composite-card-pure-container',
    description: '组合卡是纯容器：不声明 data / actions、至少一个子组件、不嵌套容器、子组件在白名单内',
    valid: ['composite-page'],
    cases: [
      {
        case: 'composite-card-with-data',
        base: 'composite-page',
        expect: /不得声明 data/,
        mutate: (document) => {
          firstComponent(document, 0, 1).data = { main: 'summary' };
        }
      },
      {
        case: 'composite-card-with-actions',
        base: 'composite-page',
        expect: /不得声明 actions/,
        mutate: (document) => {
          firstComponent(document, 0, 1).props.actions = [
            { on: 'click', navigate: { page: 'x' } }
          ];
        }
      },
      {
        case: 'composite-card-empty',
        base: 'composite-page',
        expect: /至少要有一个子组件/,
        mutate: (document) => {
          firstComponent(document, 0, 1).props.components = [];
        }
      },
      {
        case: 'composite-card-nested-container',
        base: 'composite-page',
        expect: /不得再嵌套容器组件:tabContainer/,
        mutate: (document) => {
          firstComponent(document, 0, 1).props.components.push(
            structuredClone(firstComponent(document, 1, 0))
          );
        }
      },
      {
        case: 'composite-card-child-not-whitelisted',
        base: 'composite-page',
        expect: /子组件不在白名单内:table/,
        mutate: (document) => {
          firstComponent(document, 0, 1).props.components.push(
            structuredClone(firstComponent(document, 1, 0).props.tabs[1].components[0])
          );
        }
      }
    ]
  },

  // ---------------------------------------------------------------- 页面参数
  {
    id: 'page-param-id-unique',
    description: '页面参数 id 唯一',
    valid: ['params-page'],
    cases: [
      {
        case: 'duplicate-page-param-id',
        base: 'params-page',
        expect: /页面参数 id 重复:customer/,
        mutate: (document) => {
          document.params.push({ id: 'customer', type: 'string', required: true });
        }
      }
    ]
  },
  {
    id: 'page-param-not-filter-name',
    description: '页面参数不得与筛选器同名',
    valid: ['params-page', 'filters-page'],
    cases: [
      {
        case: 'page-param-named-like-filter',
        base: 'params-page',
        expect: /页面参数与筛选器同名:customer/,
        mutate: (document) => {
          document.filters = [{ id: 'customer', type: 'search' }];
        }
      }
    ]
  },
  {
    id: 'page-param-default-type',
    description: '页面参数默认值符合声明类型',
    valid: ['params-page'],
    cases: [
      {
        case: 'page-param-default-type-mismatch',
        base: 'params-page',
        expect: /默认值不符合参数类型 number/,
        mutate: (document) => {
          document.params[1].default = '2026';
        }
      }
    ]
  },
  {
    id: 'text-value-param-declared',
    description: '文本取值只能引用已声明的页面参数',
    valid: ['params-page'],
    cases: [
      {
        case: 'text-value-unknown-param',
        base: 'params-page',
        expect: /引用了未声明的页面参数:missing/,
        mutate: (document) => {
          firstComponent(document, 0, 0).props.badge = { param: 'missing' };
        }
      }
    ]
  },
  {
    id: 'text-value-format-compatible',
    description: '文本取值引用的展示格式与参数类型相容',
    valid: ['params-page'],
    cases: [
      {
        case: 'text-value-format-mismatch',
        base: 'params-page',
        expect: /格式 date 与页面参数 year 的类型 number 不相容/,
        mutate: (document) => {
          firstComponent(document, 0, 0).props.tags[0].format = 'date';
        }
      }
    ]
  },
  {
    id: 'page-param-consumed',
    description: '每个页面参数至少被一处文本取值消费',
    valid: ['params-page'],
    cases: [
      {
        case: 'page-param-unconsumed',
        base: 'params-page',
        expect: /页面参数 unused 没有任何消费者/,
        mutate: (document) => {
          document.params.push({ id: 'unused', type: 'string', required: false });
        }
      }
    ]
  },
  {
    id: 'optional-param-not-in-required-text',
    description: '必填文本属性只能引用必需参数',
    valid: ['params-page'],
    cases: [
      {
        case: 'required-title-references-optional-param',
        base: 'params-page',
        expect: /可选页面参数缺失时引用处整体消失/,
        mutate: (document) => {
          firstComponent(document, 0, 0).props.title = { param: 'note' };
        }
      }
    ]
  },

  // ---------------------------------------------------------------- 解析接缝
  {
    id: 'grouped-query-fields-unique',
    description: '按角色分组的查询字段在维度组与度量组之间不得重名',
    valid: ['grouped-fields-page'],
    cases: [
      {
        case: 'grouped-field-duplicate',
        base: 'grouped-fields-page',
        expect: /页面字段重复声明:customer/,
        mutate: (document) => {
          document.dataSources.grouped.fields.measures.customer = {
            queryField: 'customer_dup',
            type: 'number'
          };
        }
      }
    ]
  },
  {
    id: 'grouped-query-field-label-not-id',
    description: '分组查询字段的 label 与字段 id 相同时应省略',
    valid: ['grouped-fields-page'],
    cases: [
      {
        case: 'grouped-field-label-equals-id',
        base: 'grouped-fields-page',
        expect: /label 与字段 id 相同，应省略:customer/,
        mutate: (document) => {
          document.dataSources.grouped.fields.dimensions.customer.label = 'customer';
        }
      }
    ]
  },
  {
    id: 'query-initial-rows-normalize',
    description: 'DQE 内嵌初始行按 queryField 归一化并满足结果字段契约',
    valid: ['filters-page', 'compute-page', 'grouped-fields-page', 'map-page', 'forecast-page'],
    cases: [
      {
        case: 'initial-row-missing-query-field',
        base: 'grouped-fields-page',
        expect: /DQE 内嵌初始行缺少映射字段:customer_name/,
        mutate: (document) => {
          delete document.dataSources.grouped.source.initial.rows[0].customer_name;
        }
      },
      {
        case: 'initial-row-null-not-allowed',
        base: 'filters-page',
        expect: /DQE 字段 region 为 null，页面字段 region 声明 nullable=false/,
        mutate: (document) => {
          document.dataSources.orders.source.initial.rows[0].region = null;
        }
      },
      {
        case: 'initial-row-type-mismatch',
        base: 'filters-page',
        expect: /DQE 字段 amount 不符合页面字段 amount 的类型 money/,
        mutate: (document) => {
          document.dataSources.orders.source.initial.rows[0].amount = '120';
        }
      },
      {
        case: 'initial-row-date-invalid',
        base: 'filters-page',
        expect: /DQE 字段 stat_date 不符合页面字段 stat-date 的类型 date/,
        mutate: (document) => {
          document.dataSources.orders.source.initial.rows[0].stat_date = '2026-02-30';
        }
      },
      {
        case: 'initial-row-semantic-html-too-large',
        base: 'compute-page',
        expect: /DQE 语义 HTML 字段 reason 最多允许 64000 字符/,
        mutate: (document) => {
          document.dataSources.customers.source.initial.rows[0].reason = longString(64001);
        }
      },
      {
        case: 'initial-row-detail-missing-query-field',
        base: 'compute-page',
        expect: /DQE 嵌套明细项缺少映射字段:event_title/,
        mutate: (document) => {
          delete document.dataSources.customers.source.initial.rows[0].events[0].event_title;
        }
      },
      {
        case: 'initial-row-detail-null-not-allowed',
        base: 'compute-page',
        expect: /DQE 嵌套明细字段 event_impact 为 null，页面字段 impact 声明 nullable=false/,
        mutate: (document) => {
          document.dataSources.customers.source.initial.rows[0].events[0].event_impact = null;
        }
      },
      {
        case: 'initial-row-detail-type-mismatch',
        base: 'compute-page',
        expect: /DQE 嵌套明细字段 event_impact 不符合页面字段 impact 的类型 number/,
        mutate: (document) => {
          document.dataSources.customers.source.initial.rows[0].events[0].event_impact = '3';
        }
      }
    ]
  },

  // ---------------------------------------------------------------- 筛选器
  {
    id: 'filter-id-unique',
    description: '筛选器 id 唯一',
    valid: ['filters-page', 'map-page'],
    cases: [
      {
        case: 'duplicate-filter-id',
        base: 'filters-page',
        expect: /筛选器 id 重复:keyword/,
        mutate: (document) => {
          document.filters.push({ id: 'keyword', type: 'search' });
        }
      }
    ]
  },
  {
    id: 'time-range-default-calendar',
    description: 'timeRange 绝对默认值须为合法公历值、精度一致且 from 不晚于 to',
    valid: ['filters-page'],
    cases: [
      {
        case: 'time-range-from-format',
        base: 'filters-page',
        expect: /时间范围 from 须为 YYYY-MM-DD 格式/,
        mutate: (document) => {
          document.filters[2].default.from = '2026/07/01';
        }
      },
      {
        case: 'time-range-to-calendar',
        base: 'filters-page',
        expect: /时间范围 to 不是有效的公历日期/,
        mutate: (document) => {
          document.filters[2].default.to = '2026-02-30';
        }
      },
      {
        // 未声明 precision 时校验按 date 代入，因此「from 与 to 精度不一致」在页面校验里不可达，
        // 这里钉住的是省略 precision 后 datetime 端点被按 date 格式拒绝。
        case: 'time-range-datetime-without-precision',
        base: 'filters-page',
        expect: /时间范围 to 须为 YYYY-MM-DD 格式/,
        mutate: (document) => {
          delete document.filters[2].precision;
          document.filters[2].default.to = '2026-07-31T10:00';
        }
      },
      {
        case: 'time-range-from-after-to',
        base: 'filters-page',
        expect: /时间范围 from 不得晚于 to/,
        mutate: (document) => {
          document.filters[2].default = { from: '2026-07-31', to: '2026-07-01' };
        }
      }
    ]
  },
  {
    id: 'relative-time-anchor',
    description: '结构化相对时间的 anchor 须为合法公历日期',
    valid: ['filters-page'],
    cases: [
      {
        case: 'relative-time-anchor-invalid',
        base: 'filters-page',
        expect: /时间点不是有效的公历日期/,
        mutate: (document) => {
          document.filters[3].default.anchor = '2026-13-01';
        }
      }
    ]
  },
  {
    id: 'time-point-default',
    description: 'timePoint 默认值符合其粒度的格式与日历',
    valid: ['filters-page'],
    cases: [
      {
        case: 'time-point-month-format',
        base: 'filters-page',
        expect: /时间点须为 YYYY-MM 格式/,
        mutate: (document) => {
          document.filters[4].default = '202607';
        }
      },
      {
        case: 'time-point-month-range',
        base: 'filters-page',
        expect: /时间点不是有效月份/,
        mutate: (document) => {
          document.filters[4].default = '2026-13';
        }
      },
      {
        case: 'time-point-date-format',
        base: 'filters-page',
        expect: /时间点须为 YYYY-MM-DD 格式/,
        mutate: (document) => {
          document.filters[5].default = '20260731';
        }
      },
      {
        case: 'time-point-date-calendar',
        base: 'filters-page',
        expect: /时间点不是有效的公历日期/,
        mutate: (document) => {
          document.filters[5].default = '2026-02-30';
        }
      }
    ]
  },
  {
    id: 'number-range-default',
    description: 'numberRange 默认值至少有一端且 from 不大于 to',
    valid: ['filters-page'],
    cases: [
      {
        case: 'number-range-empty',
        base: 'filters-page',
        expect: /数值区间至少要有一端/,
        mutate: (document) => {
          document.filters[6].default = {};
        }
      },
      {
        case: 'number-range-inverted',
        base: 'filters-page',
        expect: /数值区间 from 不得大于 to/,
        mutate: (document) => {
          document.filters[6].default = { from: 10, to: 5 };
        }
      }
    ]
  },
  {
    id: 'hierarchy-level-id-unique',
    description: '层级 id 在同一筛选器内唯一',
    valid: ['filters-page', 'map-page'],
    cases: [
      {
        case: 'duplicate-hierarchy-level-id',
        base: 'filters-page',
        expect: /层级 id 重复:region-level/,
        mutate: (document) => {
          document.filters[0].hierarchy[1].id = 'region-level';
          document.filters[0].defaultLevel = 'region-level';
        }
      }
    ]
  },
  {
    id: 'default-level-declared',
    description: 'defaultLevel 只能用于声明了 hierarchy 的筛选器并引用已声明层级',
    valid: ['filters-page'],
    cases: [
      {
        case: 'default-level-without-hierarchy',
        base: 'filters-page',
        expect: /defaultLevel 只能用于声明了 hierarchy 的维度筛选器/,
        mutate: (document) => {
          document.filters[1].defaultLevel = 'city-level';
        }
      },
      {
        case: 'default-level-unknown',
        base: 'filters-page',
        expect: /defaultLevel 引用了未知层级:country/,
        mutate: (document) => {
          document.filters[0].defaultLevel = 'country';
        }
      }
    ]
  },
  {
    id: 'hierarchy-picker-requires-hierarchy',
    description: 'hierarchyPicker 只能用于声明了 hierarchy 的维度筛选器',
    valid: ['filters-page', 'map-page'],
    cases: [
      {
        case: 'hierarchy-picker-without-hierarchy',
        base: 'filters-page',
        expect: /hierarchyPicker 只能用于声明了 hierarchy 的维度筛选器/,
        mutate: (document) => {
          document.filters[1].hierarchyPicker = 'tabs';
        }
      }
    ]
  },
  {
    id: 'filter-depends-on',
    description: '级联只能依赖另一个已声明的 dimension 筛选器且不成环',
    valid: ['filters-page'],
    cases: [
      {
        case: 'depends-on-self',
        base: 'filters-page',
        expect: /筛选器不能依赖自己/,
        mutate: (document) => {
          document.filters[1].dependsOn = 'city';
        }
      },
      {
        case: 'depends-on-undeclared',
        base: 'filters-page',
        expect: /dependsOn 引用了未声明的筛选器:country/,
        mutate: (document) => {
          document.filters[1].dependsOn = 'country';
        }
      },
      {
        case: 'depends-on-non-dimension',
        base: 'filters-page',
        expect: /级联上游必须是 dimension 筛选器:period/,
        mutate: (document) => {
          document.filters[1].dependsOn = 'period';
        }
      },
      {
        case: 'depends-on-cycle',
        base: 'filters-page',
        expect: /筛选器级联存在循环/,
        mutate: (document) => {
          document.filters[0].dependsOn = 'city';
        }
      }
    ]
  },
  {
    id: 'hidden-hierarchy-picker-needs-map',
    description: '隐藏层级切换器时必须有地图通过 hierarchyFilter 承担下钻',
    valid: ['map-page'],
    cases: [
      {
        case: 'hidden-hierarchy-picker-without-map',
        base: 'filters-page',
        expect: /隐藏层级切换器要求同页地图通过 hierarchyFilter 承担下钻:region/,
        mutate: (document) => {
          document.filters[0].hierarchyPicker = 'hidden';
        }
      }
    ]
  },

  // ---------------------------------------------------------------- 分区
  {
    id: 'section-id-unique',
    description: '内容分区 id 唯一',
    valid: ['composite-page'],
    cases: [
      {
        case: 'duplicate-section-id',
        base: 'composite-page',
        expect: /section id 重复:overview/,
        mutate: (document) => {
          document.sections[1].id = 'overview';
        }
      }
    ]
  },
  {
    id: 'component-id-unique',
    description: '组件 id 在整页（含容器内）唯一',
    valid: ALL_VALID,
    cases: [
      {
        case: 'duplicate-component-id',
        base: 'query-dashboard',
        expect: /component id 重复:sales-table/,
        mutate: (document) => {
          document.sections[0].components.push({
            id: 'sales-table',
            type: 'reportHeader',
            layout: { span: 12 },
            props: { title: 'Duplicate' }
          });
        }
      },
      {
        case: 'duplicate-component-id-in-container',
        base: 'composite-page',
        expect: /component id 重复:single-panel/,
        mutate: (document) => {
          firstComponent(document, 0, 1).props.components[3].id = 'single-panel';
        }
      }
    ]
  },
  {
    id: 'layer-top-level-only',
    description: 'layout.layer 只能声明在内容分区的顶层组件上',
    valid: ['composite-page'],
    cases: [
      {
        case: 'layer-inside-composite-card',
        base: 'composite-page',
        expect: /layout\.layer 只能声明在内容分区的顶层组件上/,
        mutate: (document) => {
          firstComponent(document, 0, 1).props.components[1].layout.layer = 'backdrop';
        }
      }
    ]
  },
  {
    id: 'single-backdrop-per-section',
    description: '一个分区最多一个 backdrop',
    valid: ['composite-page'],
    cases: [
      {
        case: 'two-backdrops',
        base: 'composite-page',
        expect: /声明了 2 个 backdrop，最多允许一个/,
        mutate: (document) => {
          firstComponent(document, 0, 2).layout.layer = 'backdrop';
        }
      }
    ]
  },
  {
    id: 'backdrop-needs-siblings',
    description: '声明 backdrop 的分区必须还有别的组件叠在其上',
    valid: ['composite-page'],
    cases: [
      {
        case: 'backdrop-only-section',
        base: 'composite-page',
        expect: /只有 backdrop 组件，没有可叠放其上的组件/,
        mutate: (document) => {
          const section = document.sections[0];
          delete section.columnTracks;
          section.components = [section.components[0]];
        }
      }
    ]
  },
  {
    id: 'backdrop-container-plain',
    description: '声明 backdrop 的分区必须使用 container: plain',
    valid: ['composite-page'],
    cases: [
      {
        case: 'backdrop-in-card-container',
        base: 'composite-page',
        expect: /必须使用 container: plain，当前为 card/,
        mutate: (document) => {
          document.sections[0].container = 'card';
        }
      },
      {
        case: 'backdrop-without-container',
        base: 'composite-page',
        expect: /必须使用 container: plain，当前为 缺省/,
        mutate: (document) => {
          delete document.sections[0].container;
        }
      }
    ]
  },
  {
    id: 'column-track-span',
    description: '声明列轨的分区里顶层组件 span 不得超过轨数',
    valid: ['composite-page'],
    cases: [
      {
        case: 'span-exceeds-column-tracks',
        base: 'composite-page',
        expect: /声明了 2 条列轨，组件 card 的 span 不能超过 2/,
        mutate: (document) => {
          firstComponent(document, 0, 1).layout.span = 3;
        }
      }
    ]
  },

  // ---------------------------------------------------------------- 数据源
  {
    id: 'inline-rows-contract',
    description: 'inline 数据行满足结果字段契约（字段集合、类型、nullable、明细约束）',
    valid: ['inline-report', 'mixed-page', 'compute-page', 'params-page', 'composite-page', 'forecast-page'],
    cases: [
      {
        case: 'inline-row-undeclared-field',
        base: 'inline-report',
        expect: /行包含未声明字段:extra/,
        mutate: (document) => {
          document.dataSources.overview.source.rows[0].extra = 1;
        }
      },
      {
        case: 'inline-row-missing-field',
        base: 'forecast-page',
        expect: /行缺少字段:yoy/,
        mutate: (document) => {
          delete document.dataSources.current.source.rows[0].yoy;
        }
      },
      {
        case: 'inline-row-null-not-allowed',
        base: 'compute-page',
        expect: /字段 region 声明 nullable=false,不允许为 null/,
        mutate: (document) => {
          document.dataSources.targets.source.rows[0].region = null;
        }
      },
      {
        case: 'inline-row-type-mismatch',
        base: 'inline-report',
        expect: /字段 gmv 的值不符合类型 number/,
        mutate: (document) => {
          document.dataSources.overview.source.rows[0].gmv = 'a lot';
        }
      },
      {
        case: 'inline-row-date-invalid',
        base: 'forecast-page',
        expect: /字段 day 的值不符合类型 date/,
        mutate: (document) => {
          document.dataSources.notes.source.rows[0].day = '2026-6-15';
        }
      },
      {
        case: 'inline-row-datetime-invalid',
        base: 'forecast-page',
        expect: /字段 at 的值不符合类型 datetime/,
        mutate: (document) => {
          document.dataSources.notes.source.rows[0].at = '2026-06-15 10:00';
        }
      },
      {
        case: 'inline-row-semantic-html-type',
        base: 'forecast-page',
        expect: /字段 body 的值不符合类型 semanticHtml/,
        mutate: (document) => {
          document.dataSources.notes.source.rows[0].body = 123;
        }
      },
      {
        case: 'inline-row-detail-undeclared-field',
        base: 'forecast-page',
        expect: /嵌套明细项包含未声明字段:extra/,
        mutate: (document) => {
          document.dataSources.notes.source.rows[0].items[0].extra = 'x';
        }
      },
      {
        case: 'inline-row-detail-missing-field',
        base: 'forecast-page',
        expect: /嵌套明细项缺少字段:value/,
        mutate: (document) => {
          delete document.dataSources.notes.source.rows[0].items[0].value;
        }
      },
      {
        case: 'inline-row-detail-null-not-allowed',
        base: 'forecast-page',
        expect: /嵌套明细项字段 value 声明 nullable=false,不允许为 null/,
        mutate: (document) => {
          document.dataSources.notes.source.rows[0].items[0].value = null;
        }
      },
      {
        case: 'inline-row-detail-type-mismatch',
        base: 'forecast-page',
        expect: /嵌套明细项字段 value 的值不符合类型 number/,
        mutate: (document) => {
          document.dataSources.notes.source.rows[0].items[0].value = '3';
        }
      }
    ]
  },
  {
    id: 'detail-item-object',
    description: '嵌套明细的每一项必须是对象；由 Page Schema 在结构层拒绝，语义层的同名判定因此不可达',
    valid: ['compute-page', 'forecast-page'],
    cases: [
      {
        case: 'initial-row-detail-item-not-object',
        base: 'compute-page',
        expect: /must be object/,
        mutate: (document) => {
          document.dataSources.customers.source.initial.rows[0].events = ['续约'];
        }
      },
      {
        case: 'inline-row-detail-item-not-object',
        base: 'forecast-page',
        expect: /must be object/,
        mutate: (document) => {
          document.dataSources.notes.source.rows[0].items = ['续约'];
        }
      }
    ]
  },
  {
    id: 'detail-list-max-items',
    description: '嵌套明细最多 100 项；由 Page Schema 的 maxItems 在结构层拒绝，语义层的同名判定因此不可达',
    valid: ['compute-page', 'forecast-page'],
    cases: [
      {
        case: 'initial-row-detail-list-too-large',
        base: 'compute-page',
        expect: /must NOT have more than 100 items/,
        mutate: (document) => {
          const row = document.dataSources.customers.source.initial.rows[0];
          row.events = Array.from({ length: 101 }, (_unused, index) => ({
            event_title: `e${index}`,
            event_impact: index,
            event_desc: null
          }));
        }
      },
      {
        case: 'inline-row-detail-list-too-large',
        base: 'forecast-page',
        expect: /must NOT have more than 100 items/,
        mutate: (document) => {
          document.dataSources.notes.source.rows[0].items = Array.from(
            { length: 101 },
            (_unused, index) => ({ name: `n${index}`, value: index })
          );
        }
      }
    ]
  },
  {
    id: 'captured-at-valid',
    description: '内嵌初始行的 capturedAt 须为有效的 RFC 3339 日期时间',
    valid: ['filters-page', 'compute-page', 'grouped-fields-page', 'map-page', 'forecast-page'],
    cases: [
      {
        case: 'captured-at-invalid-month',
        base: 'filters-page',
        expect: /capturedAt 必须是有效的 RFC 3339 日期时间/,
        mutate: (document) => {
          document.dataSources.orders.source.initial.capturedAt = '2026-13-01T00:00:00Z';
        }
      }
    ]
  },
  {
    id: 'query-field-mapping',
    description: 'query 数据源字段与 DQE 输出字段之间的显式、唯一、角色相容映射',
    valid: ['query-dashboard', 'mixed-page', 'filters-page', 'compute-page', 'grouped-fields-page', 'map-page', 'forecast-page'],
    cases: [
      {
        case: 'query-field-without-mapping',
        base: 'filters-page',
        expect: /既没有 queryField 映射，也不是计算阶段产出字段/,
        mutate: (document) => {
          document.dataSources.orders.fields.extra = { type: 'number', role: 'measure' };
        }
      },
      {
        case: 'query-field-duplicate-mapping',
        base: 'filters-page',
        expect: /queryField region 已映射到页面字段 region/,
        mutate: (document) => {
          document.dataSources.orders.fields.city.queryField = 'region';
        }
      },
      {
        case: 'query-field-not-output',
        base: 'query-dashboard',
        expect: /不在 DQE 输出字段中/,
        mutate: (document) => {
          document.dataSources.sales.fields.gmv.queryField = 'unknown';
        }
      },
      {
        case: 'query-detail-item-duplicate-mapping',
        base: 'compute-page',
        expect: /嵌套明细 queryField event_title 已映射到页面字段 title/,
        mutate: (document) => {
          document.dataSources.customers.fields.events.items.fields.desc.queryField = 'event_title';
        }
      },
      {
        case: 'query-dimension-role-mismatch',
        base: 'filters-page',
        expect: /DQE 维度 city 的 role 必须为 dimension/,
        mutate: (document) => {
          document.dataSources.orders.fields.city.role = 'measure';
        }
      },
      {
        case: 'query-role-mismatch',
        base: 'query-dashboard',
        expect: /DQE 度量 gmv 的 role 必须为 measure/,
        mutate: (document) => {
          document.dataSources.sales.fields.gmv.role = 'dimension';
        }
      },
      {
        case: 'query-output-unmapped',
        base: 'query-dashboard',
        expect: /DQE 输出字段 uv 缺少显式 queryField 映射/,
        mutate: (document) => {
          document.dataSources.sales.source.query.body.dsl_list[0].output_metrics.push('uv');
        }
      }
    ]
  },
  {
    id: 'filter-binding',
    description: '筛选绑定引用已声明筛选器，且 time / dimension 目标类型匹配',
    valid: ['query-dashboard', 'filters-page', 'map-page'],
    cases: [
      {
        case: 'unknown-filter-binding',
        base: 'query-dashboard',
        expect: /筛选绑定引用了未知筛选器:unknown/,
        mutate: (document) => {
          document.dataSources.sales.source.query.filterBindings.unknown = {
            target: 'dimension',
            queryField: 'region'
          };
        }
      },
      {
        case: 'filter-binding-time-target-not-time-range',
        base: 'filters-page',
        expect: /time 目标必须绑定 timeRange 筛选器:city/,
        mutate: (document) => {
          document.dataSources.orders.source.query.filterBindings.city = { target: 'time' };
        }
      },
      {
        case: 'filter-binding-dimension-target-not-dimension',
        base: 'filters-page',
        expect: /dimension 目标必须绑定维度筛选器:period/,
        mutate: (document) => {
          document.dataSources.orders.source.query.filterBindings.period = {
            target: 'dimension',
            queryField: 'region'
          };
        }
      }
    ]
  },
  {
    id: 'compute-operator-inputs',
    description: '算子引用的字段已声明、角色相容、数值算子输入为数值类型',
    valid: ['compute-page'],
    cases: [
      {
        case: 'compute-undeclared-field',
        base: 'compute-page',
        expect: /算子引用了未声明的字段:missing/,
        mutate: (document) => {
          document.dataSources.targets.compute[0].numerator = 'missing';
        }
      },
      {
        case: 'compute-role-mismatch',
        base: 'compute-page',
        expect: /字段 region 的 role 为 dimension，此处要求 measure/,
        mutate: (document) => {
          document.dataSources.targets.compute[0].numerator = 'region';
        }
      },
      {
        case: 'compute-non-numeric-input',
        base: 'compute-page',
        expect: /字段 flag 的类型 boolean 不能参与数值算子/,
        mutate: (document) => {
          document.dataSources.targets.fields.flag = { type: 'boolean', role: 'measure' };
          document.dataSources.targets.source.rows.forEach((row: Doc) => {
            row.flag = true;
          });
          document.dataSources.targets.compute[1].minuend = 'flag';
        }
      }
    ]
  },
  {
    id: 'compute-operator-outputs',
    description: '算子产出字段已声明、不重名、不来自外部响应',
    valid: ['compute-page'],
    cases: [
      {
        case: 'compute-duplicate-output',
        base: 'compute-page',
        expect: /算子产出字段重复:rate/,
        mutate: (document) => {
          document.dataSources.targets.compute[1].output = 'rate';
        }
      },
      {
        case: 'compute-output-with-query-field',
        base: 'compute-page',
        expect: /算子产出字段 online 不来自外部响应，不得声明 queryField/,
        mutate: (document) => {
          document.dataSources.pivoted.fields.online.queryField = 'online';
          document.dataSources.pivoted.source.initial.rows[0].online = 5;
        }
      }
    ]
  },
  {
    id: 'compute-folding-collapsible',
    description: '折叠算子只能作用于显式声明 collapsible 的度量字段',
    valid: ['compute-page'],
    cases: [
      {
        case: 'compute-fold-non-collapsible',
        base: 'compute-page',
        expect: /折叠算子只能作用于显式声明 collapsible 的度量字段:actual/,
        mutate: (document) => {
          delete document.dataSources.targets.fields.actual.collapsible;
        }
      }
    ]
  },
  {
    id: 'compute-row-kind-field',
    description: '行类别字段必须是可空的 string 维度',
    valid: ['compute-page'],
    cases: [
      {
        case: 'compute-row-kind-not-string',
        base: 'compute-page',
        expect: /行类别字段 row-kind 必须是 string 类型/,
        mutate: (document) => {
          document.dataSources.targets.fields['row-kind'].type = 'number';
        }
      },
      {
        case: 'compute-row-kind-not-nullable',
        base: 'compute-page',
        expect: /行类别字段 row-kind 在明细行上没有取值，必须允许为空/,
        mutate: (document) => {
          document.dataSources.targets.fields['row-kind'].nullable = false;
        }
      }
    ]
  },
  {
    id: 'compute-pivot-categories-unique',
    description: '透视类别取值只能映射到一个目标列',
    valid: ['compute-page'],
    cases: [
      {
        case: 'compute-pivot-duplicate-category',
        base: 'compute-page',
        expect: /类别取值已映射到其它目标列:线上/,
        mutate: (document) => {
          document.dataSources.pivoted.compute[0].columns[1].categories.push('线上');
        }
      }
    ]
  },
  {
    id: 'compute-output-not-in-rows',
    description: '算子产出字段不得出现在数据行中',
    valid: ['compute-page'],
    cases: [
      {
        case: 'compute-output-in-inline-rows',
        base: 'compute-page',
        expect: /算子产出字段 rate 不得出现在数据行中/,
        mutate: (document) => {
          document.dataSources.targets.source.rows[0].rate = 1.2;
        }
      }
    ]
  },

  // ---------------------------------------------------------------- 组件绑定
  {
    id: 'data-slot-known-source',
    description: '组件数据槽只能引用已声明的页面数据源',
    valid: ALL_VALID,
    cases: [
      {
        case: 'data-slot-unknown-source',
        base: 'inline-report',
        expect: /数据槽 main 引用了未知数据源:nope/,
        mutate: (document) => {
          firstComponent(document, 0, 1).data.main = 'nope';
        }
      }
    ]
  },
  {
    id: 'field-binding-resolves',
    description: '字段绑定引用组件已声明的数据槽与数据源中存在的字段',
    valid: ALL_VALID,
    cases: [
      {
        case: 'field-binding-undeclared-slot',
        base: 'inline-report',
        expect: /字段绑定引用了组件未声明的数据槽:compare/,
        mutate: (document) => {
          firstComponent(document, 0, 1).props.rows[0].valueField = { data: 'compare', field: 'gmv' };
        }
      },
      {
        case: 'unknown-component-field',
        base: 'query-dashboard',
        expect: /字段 unknown 不在数据槽 main 的数据源 sales 中/,
        mutate: (document) => {
          firstComponent(document).props.columns[1].field = 'unknown';
        }
      }
    ]
  },
  {
    id: 'field-binding-role',
    description: '字段绑定的角色符合组件属性要求',
    valid: ALL_VALID,
    cases: [
      {
        case: 'field-binding-role-mismatch',
        base: 'mixed-page',
        expect: /字段 gmv 的 role 为 measure，此处要求 dimension/,
        mutate: (document) => {
          firstComponent(document, 0, 1).props.xField = { data: 'main', field: 'gmv' };
        }
      }
    ]
  },
  {
    id: 'detail-field-consumption',
    description: '嵌套明细字段只能由显式支持 detail 的组件属性消费',
    valid: ['compute-page', 'forecast-page'],
    cases: [
      {
        case: 'detail-field-in-generic-binding',
        base: 'forecast-page',
        expect: /嵌套明细字段 items 只能由显式支持 detail 的组件属性消费/,
        mutate: (document) => {
          document.sections[0].components.push({
            id: 'note-panel',
            type: 'keyValuePanel',
            layout: { span: 4 },
            data: { main: 'notes' },
            props: { items: [{ label: '明细', field: 'items' }] }
          });
        }
      },
      {
        case: 'record-list-in-table-column',
        base: 'compute-page',
        expect: /此组件属性只支持 semanticHtml 类型的 detail 字段:events/,
        mutate: (document) => {
          firstComponent(document, 0, 1).data = { main: 'customers' };
          firstComponent(document, 0, 1).props.columns = [{ field: 'name' }, { field: 'events' }];
        }
      }
    ]
  },
  {
    id: 'field-binding-match',
    description: '行匹配字段必须是 dimension，匹配值符合其类型',
    valid: ['composite-page'],
    cases: [
      {
        case: 'match-field-unknown',
        base: 'composite-page',
        expect: /字段 missing 不在数据槽 main 的数据源 summary 中/,
        mutate: (document) => {
          firstComponent(document, 0, 1).props.components[0].props.rows[0].valueField.match.field =
            'missing';
        }
      },
      {
        case: 'match-field-not-dimension',
        base: 'composite-page',
        expect: /行匹配字段 share 的 role 必须为 dimension/,
        mutate: (document) => {
          firstComponent(document, 0, 1).props.components[0].props.rows[0].valueField.match.field =
            'share';
        }
      },
      {
        case: 'match-value-type-mismatch',
        base: 'composite-page',
        expect: /匹配值不符合字段 channel 的类型 string/,
        mutate: (document) => {
          firstComponent(document, 0, 1).props.components[0].props.rows[0].valueField.match.equals = 1;
        }
      }
    ]
  },
  {
    id: 'ai-summary-related-data',
    description: 'AI 总结关联数据引用已声明数据源中的非明细字段，不重复且术语一致',
    valid: ['forecast-page'],
    cases: [
      {
        case: 'ai-summary-unknown-source',
        base: 'forecast-page',
        expect: /关联数据引用了未知数据源:nope/,
        mutate: (document) => {
          firstComponent(document, 0, 4).props.relatedData.kpi.source = 'nope';
        }
      },
      {
        case: 'ai-summary-unknown-field',
        base: 'forecast-page',
        expect: /关联字段 nope 不在数据源 current 中/,
        mutate: (document) => {
          firstComponent(document, 0, 4).props.relatedData.kpi.fields[0].field = 'nope';
        }
      },
      {
        case: 'ai-summary-detail-field',
        base: 'forecast-page',
        expect: /AI 总结暂不支持嵌套明细字段:items/,
        mutate: (document) => {
          firstComponent(document, 0, 4).props.relatedData.kpi = {
            source: 'notes',
            description: '说明',
            fields: [{ field: 'items', term: '明细' }]
          };
        }
      },
      {
        case: 'ai-summary-duplicate-field',
        base: 'forecast-page',
        expect: /关联字段重复:gmv/,
        mutate: (document) => {
          firstComponent(document, 0, 4).props.relatedData.kpi.fields.push({ field: 'gmv', term: '成交额' });
        }
      },
      {
        case: 'ai-summary-term-conflict',
        base: 'forecast-page',
        expect: /关联字段 gmv 的术语映射冲突:成交额\/销售额/,
        mutate: (document) => {
          firstComponent(document, 0, 4).props.relatedData.other = {
            source: 'current',
            description: '再引一次',
            fields: [{ field: 'gmv', term: '销售额' }]
          };
        }
      }
    ]
  },
  {
    id: 'metric-row-link-needs-navigate',
    description: '指标行声明 link 时组件必须至少有一个 navigate 动作',
    valid: ['composite-page'],
    cases: [
      {
        case: 'metric-row-link-without-navigate',
        base: 'composite-page',
        expect: /指标值链接必须至少声明一个 navigate 动作/,
        mutate: (document) => {
          delete firstComponent(document, 0, 1).props.components[0].props.actions;
        }
      }
    ]
  },
  {
    id: 'bar-forecast-boundary',
    description: '实际 / 预测系列不得跨越采集时间所在月',
    valid: ['forecast-page'],
    cases: [
      {
        case: 'forecast-before-captured-month',
        base: 'forecast-page',
        expect: /6月为统计月及之前不得提供预测系列 forecast/,
        mutate: (document) => {
          document.dataSources.monthly.source.initial.rows[1].forecast = 13;
        }
      },
      {
        case: 'actual-after-captured-month',
        base: 'forecast-page',
        expect: /7月为统计月之后不得提供实际系列 actual/,
        mutate: (document) => {
          document.dataSources.monthly.source.initial.rows[2].actual = 14;
        }
      }
    ]
  },
  {
    id: 'table-row-key',
    description: '多数据槽表格必须声明各槽都有且类型一致的 dimension rowKey',
    valid: ['forecast-page'],
    cases: [
      {
        case: 'table-multi-slot-without-row-key',
        base: 'forecast-page',
        expect: /多数据槽表格必须声明 rowKey/,
        mutate: (document) => {
          delete firstComponent(document, 0, 2).props.rowKey;
        }
      },
      {
        case: 'table-row-key-missing-in-slot',
        base: 'forecast-page',
        expect: /数据槽 compare 的数据源 previous 缺少 rowKey 字段:yoy/,
        mutate: (document) => {
          firstComponent(document, 0, 2).props.rowKey = 'yoy';
        }
      },
      {
        case: 'table-row-key-not-dimension',
        base: 'forecast-page',
        expect: /rowKey 字段 gmv 的 role 必须为 dimension/,
        mutate: (document) => {
          firstComponent(document, 0, 2).props.rowKey = 'gmv';
        }
      },
      {
        case: 'table-row-key-type-inconsistent',
        base: 'forecast-page',
        expect: /rowKey 字段 key 的类型必须一致:string\/number/,
        mutate: (document) => {
          document.dataSources.previous.fields.key.type = 'number';
          document.dataSources.previous.source.rows[0].key = 1;
        }
      }
    ]
  },
  {
    id: 'table-row-kind-field',
    description: '表格行类别字段必须存在且由该数据源的折叠算子写入',
    valid: ['compute-page'],
    cases: [
      {
        case: 'table-row-kind-field-unknown',
        base: 'compute-page',
        expect: /行类别字段 kind 不在数据源 targets 中/,
        mutate: (document) => {
          firstComponent(document).props.rowKindField = 'kind';
        }
      },
      {
        case: 'table-row-kind-field-not-written',
        base: 'compute-page',
        expect: /行类别字段 region 没有任何折叠算子写入/,
        mutate: (document) => {
          firstComponent(document).props.rowKindField = 'region';
        }
      }
    ]
  },
  {
    id: 'table-merge-by-column',
    description: 'mergeBy 必须是表格已声明的列字段',
    valid: ['compute-page'],
    cases: [
      {
        case: 'table-merge-by-not-column',
        base: 'compute-page',
        expect: /mergeBy 必须是表格已声明的列字段:row-kind/,
        mutate: (document) => {
          firstComponent(document).props.mergeBy = 'row-kind';
        }
      }
    ]
  },
  {
    id: 'table-selection-writes',
    description: '单元格选择只能写入已声明的 dimension 筛选器',
    valid: ['filters-page'],
    cases: [
      {
        case: 'table-selection-writes-unknown-filter',
        base: 'filters-page',
        expect: /写入了未声明的筛选器:country/,
        mutate: (document) => {
          firstComponent(document).props.columns[0].selection.writes.country = { value: 'CN' };
        }
      },
      {
        case: 'table-selection-writes-non-dimension',
        base: 'filters-page',
        expect: /单元格选择只能写入 dimension 筛选器:keyword/,
        mutate: (document) => {
          firstComponent(document).props.columns[0].selection.writes.keyword = { value: '华' };
        }
      }
    ]
  },
  {
    id: 'table-column-binding-unique',
    description: '表格列字段绑定不重复',
    valid: ['query-dashboard', 'filters-page', 'compute-page', 'forecast-page'],
    cases: [
      {
        case: 'table-duplicate-column-binding',
        base: 'query-dashboard',
        expect: /表格列字段绑定重复:main:region/,
        mutate: (document) => {
          firstComponent(document).props.columns.push({ field: { data: 'main', field: 'region' } });
        }
      }
    ]
  },
  {
    id: 'table-filterable-dimension',
    description: '表头筛选只能声明在 dimension 列上',
    valid: ['filters-page'],
    cases: [
      {
        case: 'table-filterable-on-measure',
        base: 'filters-page',
        expect: /字段 orders 的 role 为 measure，此处要求 dimension/,
        mutate: (document) => {
          firstComponent(document).props.columns[4].filterable = { mode: 'select' };
        }
      }
    ]
  },
  {
    id: 'category-swatches-need-pie',
    description: '分类明细开启色点要求同页有饼图绑定同一类别字段',
    valid: ['composite-page'],
    cases: [
      {
        case: 'category-swatches-without-pie',
        base: 'composite-page',
        expect: /没有配对的饼图/,
        mutate: (document) => {
          firstComponent(document, 0, 1).props.components.splice(1, 1);
        }
      }
    ]
  },
  {
    id: 'map-legend-bands-increasing',
    description: '地图图例档位下界严格递增',
    valid: ['map-page'],
    cases: [
      {
        case: 'map-legend-bands-not-increasing',
        base: 'map-page',
        expect: /图例档位下界必须严格递增:第 2 档 0 不大于第 1 档 0/,
        mutate: (document) => {
          firstComponent(document).props.legend.bands[1].from = 0;
        }
      }
    ]
  },
  {
    id: 'map-pinned-summary',
    description: '固定地域摘要只用于 regionalOverview，匹配值符合类型，标签不重复',
    valid: ['map-page'],
    cases: [
      {
        case: 'map-pinned-summary-wrong-variant',
        base: 'map-page',
        expect: /pinnedSummary 只能用于 variant: regionalOverview 的地图/,
        mutate: (document) => {
          delete firstComponent(document).props.variant;
        }
      },
      {
        case: 'map-pinned-summary-match-value-type',
        base: 'map-page',
        expect: /匹配值不符合字段 code 的类型 string/,
        mutate: (document) => {
          firstComponent(document).props.pinnedSummary.matchValue = 310000;
        }
      },
      {
        case: 'map-pinned-summary-duplicate-label',
        base: 'map-page',
        expect: /地域摘要字段标签重复:GMV/,
        mutate: (document) => {
          firstComponent(document).props.pinnedSummary.fields[1].label = 'GMV';
        }
      }
    ]
  },
  {
    id: 'map-hierarchy',
    description: '地图下钻字段只与 hierarchyFilter 一起使用，目标是声明了 hierarchy 的维度筛选器',
    valid: ['map-page'],
    cases: [
      {
        case: 'map-level-fields-without-hierarchy-filter',
        base: 'map-page',
        expect: /levelField 只能与 hierarchyFilter 一起使用/,
        mutate: (document) => {
          delete firstComponent(document).props.hierarchyFilter;
        }
      },
      {
        case: 'map-hierarchy-filter-undeclared',
        base: 'map-page',
        expect: /地图下钻引用了未声明的筛选器:nope/,
        mutate: (document) => {
          firstComponent(document).props.hierarchyFilter = 'nope';
        }
      },
      {
        case: 'map-hierarchy-filter-not-hierarchical',
        base: 'map-page',
        expect: /地图下钻目标必须是声明了 hierarchy 的维度筛选器:keyword/,
        mutate: (document) => {
          firstComponent(document).props.hierarchyFilter = 'keyword';
        }
      },
      {
        case: 'map-level-maps-unknown-level',
        base: 'map-page',
        expect: /levelMaps 引用了筛选器 area 未声明的层级:country/,
        mutate: (document) => {
          firstComponent(document).props.levelMaps.country = 'world';
        }
      }
    ]
  },
  {
    id: 'tab-container',
    description: 'Tab id 唯一且 defaultTab 已声明',
    valid: ['composite-page'],
    cases: [
      {
        case: 'tab-id-duplicate',
        base: 'composite-page',
        expect: /Tab id 重复:top/,
        mutate: (document) => {
          firstComponent(document, 1, 0).props.tabs[1].id = 'top';
        }
      },
      {
        case: 'tab-default-unknown',
        base: 'composite-page',
        expect: /defaultTab 不是已声明的 Tab:none/,
        mutate: (document) => {
          firstComponent(document, 1, 0).props.defaultTab = 'none';
        }
      }
    ]
  },
  {
    id: 'ranking-detail-semantic-description',
    description: '语义 HTML 说明必须绑定 semanticHtml 类型的 detail 字段',
    valid: ['compute-page'],
    cases: [
      {
        case: 'ranking-semantic-description-not-detail',
        base: 'compute-page',
        expect: /字段 note 的 role 为 dimension，此处要求 detail/,
        mutate: (document) => {
          firstComponent(document, 0, 2).props.semanticDescriptionField = 'note';
        }
      },
      {
        case: 'ranking-semantic-description-record-list',
        base: 'compute-page',
        expect: /语义 HTML 说明必须绑定 semanticHtml 字段:events/,
        mutate: (document) => {
          firstComponent(document, 0, 2).props.semanticDescriptionField = 'events';
        }
      }
    ]
  },
  {
    id: 'ranking-detail-records',
    description: '结构化明细必须绑定 recordList 字段，项字段存在且角色相容',
    valid: ['compute-page'],
    cases: [
      {
        case: 'ranking-details-not-record-list',
        base: 'compute-page',
        expect: /结构化明细必须绑定 recordList 字段:reason/,
        mutate: (document) => {
          firstComponent(document, 0, 2).props.details.field = 'reason';
        }
      },
      {
        case: 'ranking-details-item-field-unknown',
        base: 'compute-page',
        expect: /嵌套明细字段 events 不包含项字段:owner/,
        mutate: (document) => {
          firstComponent(document, 0, 2).props.details.titleField = 'owner';
        }
      },
      {
        case: 'ranking-details-item-role-mismatch',
        base: 'compute-page',
        expect: /嵌套明细项字段 impact 的 role 为 measure，此处要求 dimension/,
        mutate: (document) => {
          firstComponent(document, 0, 2).props.details.titleField = 'impact';
        }
      }
    ]
  },
  {
    id: 'actions-live-only',
    description: 'writeFilter 只允许绑定 query 数据源的组件',
    valid: ['query-dashboard', 'filters-page', 'params-page', 'composite-page', 'map-page'],
    cases: [
      {
        case: 'write-filter-on-inline-component',
        base: 'filters-page',
        expect: /writeFilter 只允许绑定 query 数据源的组件/,
        mutate: (document) => {
          document.dataSources.fixed = {
            fields: { region: { type: 'string', role: 'dimension' } },
            source: { type: 'inline', rows: [{ region: '华东' }] }
          };
          firstComponent(document).data = { main: 'fixed' };
          firstComponent(document).props.columns = [{ field: 'region' }];
        }
      }
    ]
  },
  {
    id: 'write-filter-target',
    description: '回写目标是已声明的 dimension 筛选器',
    valid: ['query-dashboard', 'filters-page'],
    cases: [
      {
        case: 'write-filter-undeclared',
        base: 'query-dashboard',
        expect: /回写了未声明的筛选器:nope/,
        mutate: (document) => {
          firstComponent(document).props.actions[0].writeFilter = 'nope';
        }
      },
      {
        case: 'write-filter-non-dimension',
        base: 'filters-page',
        expect: /回写目标必须是 dimension 筛选器:period/,
        mutate: (document) => {
          firstComponent(document).props.actions[0].writeFilter = 'period';
        }
      }
    ]
  },
  {
    id: 'navigate-carry-filters-declared',
    description: 'carryFilters 只能引用已声明的筛选器',
    valid: ['filters-page', 'map-page'],
    cases: [
      {
        case: 'carry-filters-undeclared',
        base: 'filters-page',
        expect: /carryFilters 引用了未声明的筛选器:nope/,
        mutate: (document) => {
          firstComponent(document).props.actions[1].navigate.carryFilters.push('nope');
        }
      }
    ]
  },
  {
    id: 'pagination-local-inline',
    description: "pagination.mode='local' 只允许绑定 inline 数据源",
    valid: ['composite-page'],
    cases: [
      {
        case: 'pagination-local-on-query',
        base: 'query-dashboard',
        expect: /pagination\.mode='local' 只允许绑定 inline 数据源:sales/,
        mutate: (document) => {
          firstComponent(document).props.pagination = { mode: 'local', pageSize: 10 };
        }
      }
    ]
  },
  {
    id: 'pagination-query-source',
    description: "pagination.mode='query' 只允许绑定 query 数据源",
    valid: ['query-dashboard', 'filters-page'],
    cases: [
      {
        case: 'pagination-query-on-inline',
        base: 'composite-page',
        expect: /pagination\.mode='query' 只允许绑定 query 数据源:summary/,
        mutate: (document) => {
          firstComponent(document, 1, 0).props.tabs[1].components[0].props.pagination = { mode: 'query' };
        }
      }
    ]
  },
  {
    id: 'pagination-query-order',
    description: '查询分页要求 DQE order.offset 为 0 且 limit 为正整数',
    valid: ['query-dashboard', 'filters-page'],
    cases: [
      {
        case: 'pagination-offset-not-zero',
        base: 'query-dashboard',
        expect: /查询分页要求 DQE order\.offset 为 0/,
        mutate: (document) => {
          document.dataSources.sales.source.query.body.dsl_list[0].order.offset = 20;
        }
      },
      {
        case: 'pagination-limit-not-positive',
        base: 'query-dashboard',
        expect: /查询分页要求 DQE order\.limit 为正整数/,
        mutate: (document) => {
          document.dataSources.sales.source.query.body.dsl_list[0].order.limit = 0;
        }
      }
    ]
  },
  {
    id: 'pagination-initial-rows',
    description: '查询分页的内嵌初始行必须声明 totalCount 且是完整第一页',
    valid: ['filters-page'],
    cases: [
      {
        case: 'pagination-initial-without-total-count',
        base: 'filters-page',
        expect: /查询分页的内嵌初始行必须声明 totalCount/,
        mutate: (document) => {
          delete document.dataSources.paged.source.initial.totalCount;
        }
      },
      {
        case: 'pagination-initial-not-full-page',
        base: 'filters-page',
        expect: /查询分页的内嵌初始行必须是完整第一页/,
        mutate: (document) => {
          document.dataSources.paged.source.initial.totalCount = 3;
        }
      }
    ]
  },
  {
    id: 'pagination-no-view-columns',
    description: '查询分页暂不支持排序与表头筛选',
    valid: ['query-dashboard', 'filters-page'],
    cases: [
      {
        case: 'pagination-sortable-column',
        base: 'query-dashboard',
        expect: /查询分页暂不支持排序/,
        mutate: (document) => {
          firstComponent(document).props.columns[1].sortable = true;
        }
      },
      {
        case: 'pagination-filterable-column',
        base: 'query-dashboard',
        expect: /查询分页暂不支持表头筛选/,
        mutate: (document) => {
          firstComponent(document).props.columns[0].filterable = { mode: 'select' };
        }
      }
    ]
  },
  {
    id: 'pagination-exclusive-source',
    description: '查询分页表格必须独占页面数据源',
    valid: ['query-dashboard', 'filters-page'],
    cases: [
      {
        case: 'pagination-shared-source',
        base: 'query-dashboard',
        expect: /查询分页表格必须独占页面数据源 sales，当前引用 2 次/,
        mutate: (document) => {
          document.sections[0].components.push({
            id: 'sales-pie',
            type: 'pieChart',
            layout: { span: 6 },
            data: { main: 'sales' },
            props: { categoryField: 'region', valueField: 'gmv' }
          });
        }
      }
    ]
  }
];
