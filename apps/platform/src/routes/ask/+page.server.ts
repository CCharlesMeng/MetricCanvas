import { randomUUID } from 'node:crypto';
import { assembleTransientPage } from '@metriccanvas/mcp';
import { askPresetUnits } from './preset-units';
import type { PageServerLoad } from './$types';

/**
 * 每次请求装配一份临时页面态（ADR-0030）：使用临时页面 id，只在本次
 * 响应内存在，不写入页面仓储、不产生页面修订。页面文档是
 * assembleTransientPage 的出口产物（已通过 validate()），这里不手写
 * 第二份文档；装配失败时把 issues 原样交给视图呈现。
 */
export const load: PageServerLoad = () => {
  const result = assembleTransientPage({
    pageId: `ask-transient-${randomUUID().slice(0, 8)}`,
    description: '问数最小竖切：由预置取数单元装配的临时页面态',
    units: askPresetUnits,
    sectionTitle: '问数结果',
    container: 'panel'
  });

  if (!result.ok) {
    return { assembly: { ok: false as const, issues: result.issues } };
  }

  const { document } = result;
  return {
    assembly: {
      ok: true as const,
      document,
      pageId: document.id,
      componentCount: document.sections.reduce(
        (count, section) => count + section.components.length,
        0
      ),
      dataSourceCount: Object.keys(document.dataSources).length
    }
  };
};
