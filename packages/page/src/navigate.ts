import { placeholderDimension } from './interaction';
import { isChartWidget, type Page } from './page';
import type { TypedError } from './errors';

/**
 * navigate 跨页下钻与文本带参链接的跨文档校验:目标页存在、目标筛选器 id 有效。
 * 二者共用同一声明形态(page + carryFilters)与同一校验规则。
 * 需要"已知页面清单"这类仓库知识,与文件名校验同理不进 validate 签名,
 * 由 validate CLI(已扫 pages/ 目录)组合调用。
 *
 * @param knownPageIds 全量页面 id 清单(来自 pages/ 目录文件名,文件名与 id 一致已单独校验)
 * @param pagesById    通过自身校验的页面文档,按 id 索引;目标页文档不可用时只做存在性校验,
 *                     不误报筛选器错误(坏文档自身的错误已单独报出)
 */
export function navigateErrors(
  page: Page,
  knownPageIds: ReadonlySet<string>,
  pagesById: ReadonlyMap<string, Page>
): TypedError[] {
  const errors: TypedError[] = [];

  page.widgets.forEach((widget, i) => {
    // 文本带参链接:与 navigate 同规则的目标页存在性 + carryFilters 同名筛选器校验
    if (widget.type === 'text') {
      (widget.links ?? []).forEach((link, j) => {
        const basePath = `/widgets/${i}/links/${j}`;
        if (!knownPageIds.has(link.page)) {
          errors.push({
            type: 'SCHEMA_ERROR',
            path: `${basePath}/page`,
            message: `链接指向不存在的页面:${link.page}(pages/ 目录中没有该页面文档)`
          });
          return;
        }
        const target = pagesById.get(link.page);
        if (!target) return;
        errors.push(...carryFilterErrors(link.carryFilters, target, link.page, basePath));
      });
      return;
    }

    if (!isChartWidget(widget)) return;
    (widget.interactions ?? []).forEach((interaction, j) => {
      if (!('navigate' in interaction)) return;
      const basePath = `/widgets/${i}/interactions/${j}/navigate`;
      const { page: targetId, carryFilters, setFilters } = interaction.navigate;

      if (!knownPageIds.has(targetId)) {
        errors.push({
          type: 'SCHEMA_ERROR',
          path: `${basePath}/page`,
          message: `navigate 指向不存在的页面:${targetId}(pages/ 目录中没有该页面文档)`
        });
        return;
      }

      const target = pagesById.get(targetId);
      if (!target) return;
      const targetFilters = new Map((target.filters ?? []).map((f) => [f.id, f]));

      errors.push(...carryFilterErrors(carryFilters, target, targetId, basePath));

      for (const [filterId, placeholder] of Object.entries(setFilters ?? {})) {
        const targetFilter = targetFilters.get(filterId);
        if (!targetFilter) {
          errors.push({
            type: 'SCHEMA_ERROR',
            path: `${basePath}/setFilters/${filterId}`,
            message: `目标页 ${targetId} 没有筛选器 ${filterId}`
          });
          continue;
        }
        if (targetFilter.type !== 'dimension') {
          errors.push({
            type: 'SCHEMA_ERROR',
            path: `${basePath}/setFilters/${filterId}`,
            message: `目标页筛选器 ${filterId} 不是 dimension 型,点击上下文的维度值写不进去`
          });
          continue;
        }
        // 与页内下钻同理:占位维度须与目标筛选器约束的维度一致,否则 A 维度的值会写进 B 维度的条件
        const code = placeholderDimension(placeholder);
        if (code !== targetFilter.dimension) {
          errors.push({
            type: 'SCHEMA_ERROR',
            path: `${basePath}/setFilters/${filterId}`,
            message: `取值占位的维度 ${code} 与目标页筛选器 ${filterId} 约束的维度 ${targetFilter.dimension} 不一致`
          });
        }
      }
    });
  });

  return errors;
}

/** carryFilters 逐项检查目标页是否有同名筛选器(navigate 交互与文本链接共用) */
function carryFilterErrors(
  carryFilters: string[] | undefined,
  target: Page,
  targetId: string,
  basePath: string
): TypedError[] {
  const targetFilterIds = new Set((target.filters ?? []).map((f) => f.id));
  return (carryFilters ?? []).flatMap((filterId, k) =>
    targetFilterIds.has(filterId)
      ? []
      : [
          {
            type: 'SCHEMA_ERROR' as const,
            path: `${basePath}/carryFilters/${k}`,
            message: `目标页 ${targetId} 没有同名筛选器 ${filterId},携带的筛选值将被丢弃`
          }
        ]
  );
}
