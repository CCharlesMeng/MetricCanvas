import { describe, expect, it } from 'vitest';
import Ajv from 'ajv';
import inlineReport from '../fixtures/contract-valid/inline-report.json';
import queryDashboard from '../fixtures/contract-valid/query-dashboard.json';
import { pageSchema } from '../src';

/**
 * 当前页面 JSON Schema 的边界行为回归(继承自已删除的等价性安全网):
 * 原「阶段三A 安全网」以 912 行手写 legacy snapshot 为对照,其迁移使命
 * 已完成且副本已实证漂移(见 docs/reviews/2026-08-packages-architecture-review.md
 * 与 issue #73)。这里保留其中对当前 Schema 仍有价值的边界用例,改为
 * 直接断言有效/无效,不再维护第二份 Schema 真源。
 */

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(pageSchema as Record<string, unknown>);

function expectValid(description: string, document: unknown): void {
  const valid = validate(document) as boolean;
  expect(valid, `${description} 应有效:${JSON.stringify(validate.errors)}`).toBe(true);
}

function expectInvalid(description: string, document: unknown): void {
  const valid = validate(document) as boolean;
  expect(valid, `${description} 应无效`).toBe(false);
}

function groupedPage() {
  return structuredClone({
    schemaVersion: '5.0',
    id: 'grouped',
    dataSources: {
      current: {
        fields: {
          dimensions: { region: { queryField: '区域', type: 'string' } },
          measures: { revenue: { queryField: '销售额', type: 'number' } }
        },
        source: {
          type: 'query',
          query: {
            language: 'dqe',
            body: { dsl_list: [{ output_dims: ['区域'], output_metrics: ['销售额'] }] }
          }
        }
      }
    },
    sections: [
      {
        id: 'main',
        components: [
          {
            id: 'table',
            type: 'table',
            layout: { span: 12 },
            data: { main: 'current' },
            props: { columns: [{ field: 'region' }, { field: 'revenue' }] }
          }
        ]
      }
    ]
  });
}

describe('当前 page schema 边界行为', () => {
  it('groupedQueryFields:双分组有效,空对象无效', () => {
    expectValid('grouped fields 双分组', groupedPage());
    const empty: any = groupedPage();
    empty.dataSources.current.fields = {};
    expectInvalid('grouped fields 空对象', empty);
  });

  it('fieldReference/fieldBinding 非判别式联合:字符串与对象有效,数字无效', () => {
    const withValueField = (value: unknown) => {
      const clone: any = structuredClone(inlineReport);
      clone.sections[0].components[1].props.rows[0].valueField = value;
      return clone;
    };
    const original = (structuredClone(inlineReport) as any).sections[0].components[1].props
      .rows[0].valueField;
    expectValid('字符串简写', withValueField(original));
    expectValid('对象形式', withValueField({ data: 'main', field: 'gmv' }));
    expectInvalid('数字(两个分支都不匹配)', withValueField(42));
  });

  it('componentAction 共享 on:"click" 判别值:两分支各自有效,混合无效', () => {
    const base: any = structuredClone(queryDashboard);
    const writeFilterAction = base.sections[0].components[0].props.actions[0];
    const navigateAction = { on: 'click', navigate: { page: 'other-page' } };
    const withAction = (action: unknown) => {
      const clone = structuredClone(base);
      clone.sections[0].components[0].props.actions = [action];
      return clone;
    };
    expectValid('writeFilter 分支', withAction(writeFilterAction));
    expectValid('navigate 分支', withAction(navigateAction));
    expectInvalid('混合两个分支', withAction({
      on: 'click',
      writeFilter: writeFilterAction.writeFilter,
      navigate: navigateAction.navigate
    }));
  });

  it('tableColumnNode 递归联合:嵌套分组列有效,分组与字段列混用无效', () => {
    const base: any = structuredClone(queryDashboard);
    const withColumns = (columns: unknown) => {
      const clone = structuredClone(base);
      clone.sections[0].components[0].props.columns = columns;
      return clone;
    };
    expectValid('嵌套分组列', withColumns([
      {
        kind: 'group',
        id: 'g1',
        title: '分组',
        children: [
          { kind: 'group', id: 'g2', title: '嵌套分组', children: [{ field: 'region' }] }
        ]
      }
    ]));
    expectInvalid('分组与字段列字段混用', withColumns([{ kind: 'group', field: 'region' }]));
  });

  it('dqeQuery.body.dsl_list 长度封闭为 1', () => {
    const withDslList = (dslList: unknown[]) => {
      const clone: any = structuredClone(queryDashboard);
      clone.dataSources.sales.source.query.body.dsl_list = dslList;
      return clone;
    };
    const item = (queryDashboard as any).dataSources.sales.source.query.body.dsl_list[0];
    expectInvalid('0 项', withDslList([]));
    expectValid('1 项', withDslList([item]));
    expectInvalid('2 项', withDslList([item, item]));
  });

  it('timeRangeFilter.default:预设与绝对区间有效,数字无效', () => {
    const base: any = structuredClone(queryDashboard);
    base.filters = [{ id: 'range', type: 'timeRange' }];
    const withDefault = (value: unknown) => {
      const clone = structuredClone(base);
      clone.filters[0].default = value;
      return clone;
    };
    expectValid('预设字符串', withDefault('last7d'));
    expectValid('绝对区间', withDefault({ from: '2026-01-01', to: '2026-01-31' }));
    expectInvalid('数字', withDefault(42));
  });

  it('table.pagination 判别式联合:三态有效,缺 pageSize 与未知 mode 无效', () => {
    const base: any = structuredClone(queryDashboard);
    const withPagination = (pagination: unknown) => {
      const clone = structuredClone(base);
      const table = clone.sections[0].components.find((c: any) => c.type === 'table');
      table.props.pagination = pagination;
      return clone;
    };
    expectValid('mode:none', withPagination({ mode: 'none' }));
    expectValid('mode:local', withPagination({ mode: 'local', pageSize: 10 }));
    expectValid('mode:query', withPagination({ mode: 'query' }));
    expectInvalid('mode:local 缺 pageSize', withPagination({ mode: 'local' }));
    expectInvalid('未知 mode', withPagination({ mode: 'unknown' }));
  });

  it('reportHeader/text/aiSummary 不接受 data 键', () => {
    const withData: any = structuredClone(inlineReport);
    const header = withData.sections[0].components.find((c: any) => c.type === 'reportHeader');
    if (!header) throw new Error('inlineReport fixture 需要一个 reportHeader 组件');
    header.data = { main: 'overview' };
    expectInvalid('reportHeader 携带非法 data', withData);
  });

  it('dataSource 联合:inline 有效,inline 混入 query 字段无效', () => {
    expectValid('inline 数据源', structuredClone(inlineReport));
    const mixedSource: any = structuredClone(inlineReport);
    mixedSource.dataSources.overview.source.query = {
      language: 'dqe',
      body: { dsl_list: [{}] }
    };
    expectInvalid('inline 数据源混入 query 字段', mixedSource);
  });
});
