import {
  QUERY_LANGUAGES,
  isQueryLanguage,
  type QueryLanguage
} from '@metriccanvas/page';
import type { DataGateway } from '@metriccanvas/runtime';
import { DqeGatewayError } from './dqe';

/**
 * 按 language 注册的执行适配器表:键取 @metriccanvas/page 声明的查询协议
 * 闭集。Record 是全量的——闭集内每个协议都必须注册适配器,新增协议分支
 * 而未注册在编译期即失败关闭。
 */
export type DataGatewayAdapters = Readonly<Record<QueryLanguage, DataGateway>>;

/**
 * 数据网关的按 language 分发注册点(ADR-0034/issue #79)。
 *
 * 统一运行时继续只面对一个查询执行端口;生效查询按判别符 language 路由到
 * 对应协议的执行适配器。协议闭集之外的 language(只可能来自类型之外的
 * 不可信输入)失败关闭:按查询声明错误分类拒绝(DQE_CONFIG_ERROR,执行前
 * 即失败,取 issue #51 的查询错误分类封闭集,不新造分类)。
 */
export function createDataGateway(adapters: DataGatewayAdapters): DataGateway {
  return {
    fetchData(query, diagnosticContext, signal) {
      if (!isQueryLanguage(query.language)) {
        // 不回显集外 language 原文:它是任意不可信内容,错误对象只携带闭集事实。
        return Promise.reject(
          new DqeGatewayError(
            'DQE_CONFIG_ERROR',
            '生效查询的 language 不在受支持的查询协议闭集内',
            { supported: QUERY_LANGUAGES }
          )
        );
      }
      return adapters[query.language].fetchData(query, diagnosticContext, signal);
    },
    async fetchDimensionValues(dimension) {
      // 维度候选值端口不携带 language:按协议闭集声明顺序逐一询问并合并去重。
      const values = await Promise.all(
        QUERY_LANGUAGES.map((language) =>
          adapters[language].fetchDimensionValues(dimension)
        )
      );
      return [...new Set(values.flat())];
    }
  };
}
