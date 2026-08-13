import {
  QUERY_LANGUAGES,
  isQueryLanguage,
  type QueryLanguage
} from '@metriccanvas/page';
import type {
  DataGateway,
  DimensionValuesGateway,
  DimensionValuesResult,
  RuntimeDataGateway
} from '@metriccanvas/runtime';
import { DqeGatewayError } from './dqe';

/**
 * 按 language 注册的执行适配器表:键取 @metriccanvas/page 声明的查询协议
 * 闭集。Record 是全量的——闭集内每个协议都必须注册适配器,新增协议分支
 * 而未注册在编译期即失败关闭。维度候选值端口独立于主查询执行:适配器
 * 可以不实现它(能力缺席,issue #54)。
 */
export type DataGatewayAdapters = Readonly<Record<QueryLanguage, RuntimeDataGateway>>;

/**
 * 数据网关的按 language 分发注册点(ADR-0034/issue #79)。
 *
 * 统一运行时继续只面对一个查询执行端口;生效查询按判别符 language 路由到
 * 对应协议的执行适配器。协议闭集之外的 language(只可能来自类型之外的
 * 不可信输入)失败关闭:按查询声明错误分类拒绝(DQE_CONFIG_ERROR,执行前
 * 即失败,取 issue #51 的查询错误分类封闭集,不新造分类)。
 */
export function createDataGateway(
  adapters: DataGatewayAdapters
): DataGateway & DimensionValuesGateway {
  return {
    fetchData(query, diagnosticContext) {
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
      return adapters[query.language].fetchData(query, diagnosticContext);
    },
    async fetchDimensionValues(dimension, options) {
      // 维度候选值端口不携带 language:按协议闭集声明顺序询问声明了候选值
      // 能力的适配器并合并去重;没有适配器声明能力,或声明方全部回答不可用
      // 时,如实返回不可用而不是伪装成空结果(issue #54)。
      const capable = QUERY_LANGUAGES.map((language) => adapters[language]).filter(
        (adapter): adapter is DataGateway & DimensionValuesGateway =>
          typeof adapter.fetchDimensionValues === 'function'
      );
      if (capable.length === 0) return { kind: 'unavailable' };
      const results: DimensionValuesResult[] = await Promise.all(
        capable.map((adapter) => adapter.fetchDimensionValues(dimension, options))
      );
      if (results.every((result) => result.kind === 'unavailable')) {
        return { kind: 'unavailable' };
      }
      const values = results.flatMap((result) =>
        result.kind === 'values' ? result.values : []
      );
      return { kind: 'values', values: [...new Set(values)] };
    }
  };
}
