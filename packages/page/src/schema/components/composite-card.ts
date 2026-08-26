import { z } from 'zod';
import { componentIdZ, componentLayoutZ, textValueZ } from '../primitives';
import { componentCatalogRegistry } from '../registry';
import { metricCardComponentZ } from './metric-card';
import { pieChartComponentZ } from './charts';
import { gaugeComponentZ } from './gauge';
import { keyValuePanelComponentZ } from './key-value-panel';
import { categoryBreakdownComponentZ } from './category-breakdown';

/**
 * 组合卡准入的子组件白名单(ADR-0053)。首批五种,不多给一种:两个设计源
 * 里的卡内构成用它们就能表达。加成员是闭集新增成员、属纯增量;从「任意
 * 叶子」收回白名单则是破坏性变更,所以起点是白名单而不是「任意叶子」。
 *
 * 这个数组是白名单的唯一真源:判别联合与校验器的可读报错都从它派生。
 */
const compositeCardChildSchemas = [
  metricCardComponentZ,
  pieChartComponentZ,
  gaugeComponentZ,
  keyValuePanelComponentZ,
  categoryBreakdownComponentZ
] as const;

export const compositeCardChildTypes: readonly string[] = compositeCardChildSchemas.map(
  (schema) => schema.shape.type.value
);

export const compositeCardChildZ = z
  .discriminatedUnion('type', compositeCardChildSchemas)
  .meta({ id: 'compositeCardChild' });

/**
 * 组合卡(ADR-0053):一个**组件级**的分组容器,一张卡就是一个组件。
 *
 * 它进内容分区的 12 列自动流,卡宽由自己的 `layout.span` 决定,同一分区
 * 里可以并排若干张;`section.container: "card"` 则是**分区级**声明,卡与卡
 * 只能纵向堆叠。判据是层次不是功能:要装的这组组件本身是不是一个分区。
 *
 * 卡内复用同一条 12 列自动流,不引入第二套布局词汇:子组件照常写
 * `layout.span`,含义变成卡内容宽度的十二分之几,组件数组顺序仍决定
 * 自动流顺序。卡内禁 `layout.layer`(没有分区可铺满)。
 *
 * 它自己不承载数据:不声明 `data`、不声明字段绑定、不声明 `actions`。
 * 「用组合卡还是用 metricCard」因此是一条结构判据——有没有子组件。
 */
export const compositeCardComponentZ = z
  .object({
    id: componentIdZ,
    type: z.literal('compositeCard'),
    layout: componentLayoutZ,
    props: z
      .object({
        title: textValueZ.optional(),
        /**
         * 相邻子组件之间是否分隔。位置由结构派生,不写索引、坐标与线型:
         * 线画在 12 列自动流已经形成的单元格边界上——行与行之间是横线,
         * 同一行相邻子组件之间是竖线。
         */
        dividers: z.boolean().optional(),
        components: z.array(compositeCardChildZ).min(1)
      })
      .strict()
  })
  .strict()
  .meta({ id: 'compositeCardComponent' });

componentCatalogRegistry.add(compositeCardComponentZ, {
  label: '组合卡',
  aliases: ['复合卡', '组合卡片'],
  purpose: '把若干组件框进一张卡,并让这张卡作为一个组件进 12 列栅格横向并排',
  chooseWhen: [
    '需要若干张白卡横向并排,每张卡自带卡壳、可选标题与卡内分隔',
    '要装的这组组件本身就是一个内容分区时改用 section.container: "card"',
    '卡内是多张表格互斥切换时改用 Tab 容器'
  ],
  dataShape: '不绑定页面数据源；每个子组件自己声明数据槽与字段绑定',
  title: 'optional',
  defaultSpan: 4
});
