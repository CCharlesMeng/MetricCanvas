/** 纯 node 宿主端点的类型声明；实现是 ESM JavaScript，见同名 `.mjs`。 */

export declare const DQE_EXECUTE_PATH: string;

export declare function executeFixtureItem(item: unknown): {
  code: 'SUCCESS' | 'DQE_SIM_UNSUPPORTED_QUERY';
  data: Array<Record<string, unknown>>;
  total_count: number;
  retDesc?: string;
  dqe: {
    columns: Array<{
      id: string;
      caption: string;
      data_type: 'STRING' | 'NUMBER';
      type: 'dimension' | 'metric';
    }>;
    orders: unknown[];
    limit: number;
    offset: number;
    sql: null;
  };
};
