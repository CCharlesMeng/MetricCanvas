<script lang="ts">
  import type { CategoryBreakdownProps } from '@metriccanvas/page';
  import type { MainDataSlots } from '../../shared/component-data';
  import { CATEGORICAL_PALETTE_PROPERTY, readColorList } from '../../shared/chart-palette';
  import { categoryBreakdownView } from './rows';

  /**
   * 分类明细(纯渲染):按类别逐行、按度量逐列的紧凑明细,带列头。
   *
   * 它是一份独立的数据展示而不是图表的附属物,所以走正常的数据槽;它也不是
   * 「小一号的表格」——没有分页、排序、表头筛选与选择写回,需要那些能力就用
   * 明细表。真正是一张带列头的小表,因此用 `table` 而不是 div 网格:列对齐
   * 由表格布局算,列头与行的对应关系也不必另用 aria 描述一遍。
   */
  interface Props {
    data: MainDataSlots;
    props: CategoryBreakdownProps;
  }

  let { data, props }: Props = $props();

  /* 类别配色从自身容器的计算样式读(与饼图同一个装置,见 shared/chart-palette.ts)。
     报表形态不定义这个属性,读到空串即色板缺席,色点因此不着色。 */
  let host = $state<HTMLElement | null>(null);
  const palette = $derived(readColorList(host, CATEGORICAL_PALETTE_PROPERTY));
  const view = $derived(categoryBreakdownView(data, props, palette));
</script>

<div bind:this={host} class="category-breakdown">
  {#if props.title}<h3>{props.title}</h3>{/if}
  <table>
    <thead>
      <tr>
        {#if view.categoryLabel === undefined}
          <!-- 类别列不要列头时仍占一个空单元格:列数两行不一致,列宽就不再由
               列头与取值共同决定,度量列头会挪到类别列上方去。空的列头单元格
               按惯例是 td 而不是无障文本的 th。 -->
          <td class="category"></td>
        {:else}
          <th scope="col" class="category">{view.categoryLabel}</th>
        {/if}
        {#each view.columns as column, columnIndex (columnIndex)}
          <th scope="col" class="measure">{column}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each view.rows as row, index (`${row.category}:${index}`)}
        <tr>
          <th scope="row" class="category">
            <span class="category-cell">
              {#if props.swatches}
                <span
                  class="swatch"
                  style={row.swatch ? `background:${row.swatch};` : undefined}
                ></span>
              {/if}
              <span class="category-label">{row.category}</span>
            </span>
          </th>
          {#each row.values as value, valueIndex (valueIndex)}
            <td class="measure">{value}</td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .category-breakdown {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    gap: 8px;
  }
  h3 {
    margin: 0;
    color: var(--mc-card-title-color, #191919);
    font-size: var(--mc-card-title-font-size, 16px);
    font-weight: var(--mc-card-title-font-weight, 500);
    line-height: var(--mc-card-title-line-height, 24px);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    /* 数字与类别都是短文本,列宽取内容宽;类别列吃掉剩余宽度。 */
    table-layout: auto;
  }
  th,
  td {
    padding: 0;
    font-weight: inherit;
    text-align: left;
    white-space: nowrap;
  }
  /* 行距 6px;列头与首行之间只有 2px,所以首行把行距收回 4px。
     两个量都由「第几行」之外的结构选出来:一个是 tbody 的首行,其余是它的后继。 */
  tbody tr:not(:first-child) th,
  tbody tr:not(:first-child) td {
    padding-top: 6px;
  }
  tbody tr:first-child th,
  tbody tr:first-child td {
    padding-top: 2px;
  }
  .category {
    width: 100%;
  }
  thead th {
    color: var(--mc-color-report-description, #595959);
    font-size: 12px;
    line-height: 18px;
  }
  tbody th.category {
    color: var(--mc-color-report-description, #595959);
    font-size: 14px;
    line-height: 22px;
  }
  /* 色点与类别文字在单元格**内**成行:不把 th 自己改成 flex 容器,
     那会让它退出表格格式化上下文,列对齐随之失效。 */
  .category-cell {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .swatch {
    display: block;
    width: 8px;
    height: 8px;
    flex: none;
    border-radius: 999px;
  }
  .category-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* 度量列右对齐:设计源里列头与取值的右边缘对齐,左边缘不对齐。 */
  .measure {
    text-align: right;
  }
  /* 列距按「前一个单元格是谁」选出,不按单元格是 th 还是 td:类别列没有列头
     时那一格是空 td,列距不该因此消失。 */
  .measure + .measure,
  .category + .measure {
    padding-left: 24px;
  }
  tbody td.measure {
    color: var(--mc-color-report-text, #191919);
    font-size: 14px;
    font-weight: 500;
    line-height: 22px;
  }
</style>
