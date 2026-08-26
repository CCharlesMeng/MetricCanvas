import { z } from 'zod';
import {
  componentIdZ,
  componentLayoutZ,
  fieldBindingZ,
  mainDataZ,
  nonEmptyTextValueZ,
  textValueZ
} from '../primitives';
import { componentCatalogRegistry } from '../registry';

const categoryBreakdownColumnZ = z
  .object({
    label: nonEmptyTextValueZ,
    field: fieldBindingZ
  })
  .strict()
  .meta({ id: 'categoryBreakdownColumn' });

/**
 * 分类明细(ADR-0053):按类别逐行、按度量逐列的紧凑明细,带列头。
 *
 * 它是一份独立的数据展示,不是图表的附属物,因此自己声明 `data` 与字段
 * 绑定;它也不是「小一号的表格」——没有分页、排序、表头筛选、固定列、
 * 列组与选择写回,需要那些能力就该用 `table`。
 *
 * `swatches` 是**同色同序约束**在协议侧的落点:开启后类别列前显示色点,
 * 色点由**类别取值**在页面共享的类别配色中查得,不由行序或扇区序号查得。
 * 因此开启它要求同页某个饼图绑定同一个类别字段(见校验),否则「同色」
 * 没有对照物。颜色本身不进页面文档(ADR-0003)。
 */
export const categoryBreakdownComponentZ = z
  .object({
    id: componentIdZ,
    type: z.literal('categoryBreakdown'),
    layout: componentLayoutZ,
    data: mainDataZ,
    props: z
      .object({
        title: textValueZ.optional(),
        /** 逐行列出的类别字段。 */
        categoryField: fieldBindingZ,
        /**
         * 类别列的列头,三种表达各占一个取值形状:
         *
         * - 不写 → 取字段自己的 label(既有语义,不变);
         * - 文本 → 用这段文案(既有语义,不变);
         * - `false` → 这一列不要列头(设计源里类别列确实没有列头)。
         *
         * 用 `false` 而不是空串或 `"none"` 这类字符串哨兵:任何字符串哨兵都
         * 可能与一段真实文案撞上,读的人得先知道哪个值被征用了才看得懂;
         * 换成布尔就是类型上的互斥,不可能与文案混淆。三种表达都落在同一个
         * 属性上,因此不存在「两处声明互相矛盾」的组合要另加校验规则。
         */
        categoryLabel: z.union([nonEmptyTextValueZ, z.literal(false)]).optional(),
        /** 逐列列出的度量;每列一个列头与一个 measure 字段绑定。 */
        columns: z.array(categoryBreakdownColumnZ).min(1),
        /** 类别列前是否显示色点;颜色按类别取值查得,不进页面文档。 */
        swatches: z.boolean().optional()
      })
      .strict()
  })
  .strict()
  .meta({ id: 'categoryBreakdownComponent' });

componentCatalogRegistry.add(categoryBreakdownComponentZ, {
  label: '分类明细',
  aliases: ['类别明细', '分类清单'],
  purpose: '按类别逐行、按度量逐列列出少数几行带列头的紧凑明细',
  chooseWhen: [
    '环形图旁边那份「类别 + 两三个度量」的小表,或卡内的分档明细',
    '行数与列数都很少、不需要分页排序表头筛选时;需要那些能力改用明细表',
    '每个类别只有一个取值、结构是键值对时改用信息面板'
  ],
  dataShape: '每行一个类别;一个 dimension 类别字段 + 一到多个 measure 字段',
  title: 'optional',
  defaultSpan: 6
});
