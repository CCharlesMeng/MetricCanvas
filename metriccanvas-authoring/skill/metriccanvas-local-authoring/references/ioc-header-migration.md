# 旧页头快速迁移为 iocHeader

用户要求“旧 header 换新版”“reportHeader 换 iocHeader”或“工具栏迁移”时使用。直接在用户指定页面完成局部替换，沿用原 Dashboard/Report 形态。`iocHeader` 是页面根级声明，不是 `sections[].components[]` 中的组件，也不是把 `type:"reportHeader"` 改个名字。

先按[旧页升级](page-upgrade.md)保留原件、检查并完成可执行的协议升级，再做下列替换。升级脚本不执行页头语义迁移。字段、版本下限与运行行为以包内[页面](page-metadata/page.md)的“IOC 公共页头”“唯一页头”为准；涉及动态标题再查[参数与文字](page-metadata/params-and-text-values.md)。

## 识别旧页头并选择替换范围

先定位 `layout`、`meta.title`、`dashboardToolbar`、现有 `iocHeader`、页级 `filters`，以及组件树里的 `reportHeader`、`filterGroup`。只读取相关对象与引用，不打印大页的数据行；完整校验仍覆盖全页。已有 `iocHeader` 时在原对象上补齐，避免生成第二份身份。

| 旧页特征 | 迁移动作 |
|---|---|
| Dashboard 的 `dashboardToolbar` 缺省或为 `"visible"` | 声明根级 `iocHeader`；将原先实际显示的标题显式写入 `identity.title`，保留 `meta.title`。按原顺序认领应在页头的筛选，使用 `presentation:{layout:"inline",density:"normal",collapse:"overflow"}` 承接旧工具栏呈现。删除显式 `dashboardToolbar`。 |
| `dashboardToolbar:{variant:"compact",readOnly,note}` | 使用 `presentation:{layout:"inline",density:"compact",collapse:"none"}`；将原 `readOnly`、`note` 原值搬到 `iocHeader`，再删除旧声明。不得因删除旧工具栏解锁原只读筛选。 |
| `dashboardToolbar:"hidden"`，正文 `reportHeader` 承担整页身份 | 按下表映射身份，将该页头认领的筛选转交 `iocHeader`。确认内容均承接后删除旧页头；只移除因此变空且无其他语义或引用的分区。`hidden` 可兼容保留，也可随替换删除。 |
| 首个 `reportHeader` 或 `variant:"projectDetail"` | 逐项处理身份与附属内容；与 `iocHeader` 并存会被校验拒绝。遇到下述能力缺口时保留原页及候选，不通过丢功能制造迁移成功。 |
| 正文中独立章节的 `reportHeader`、普通标题或说明文字 | 保留；不能按组件类型全量删除。仅替换实际承担页面身份的对象。没有页头的页面也不能仅因 `hidden` 自动新增身份。 |

显式 `iocHeader` 的标题不自动回退 `meta.title`；旧工具栏原先回退到其他标题或页面 id 时，先核对实际显示值再显式写入。不要为了迁移同步改目录标题。根级 `layout` 与 `iocHeader.presentation.layout` 各有用途，不因页头改为 inline 就改变页面形态。

## 旧 reportHeader 字段映射

| 旧字段 | 新位置或处理 |
|---|---|
| `props.title` | 原样保留字符串或 TextValue 至 `iocHeader.identity.title`，保留参数声明、引用、格式和组合片段。 |
| 纯文本 `props.subtitle` | `identity.description:{text:<原值>,presentation:"inline"}`。明确要求收纳说明时才使用 tooltip。 |
| `props.tags[]` | 转为 `identity.tags[]`，每项添加稳定且唯一的 `id`，`text` 保留原 TextValue；无业务色调依据时省略 tone。 |
| `props.badge` | 可转为独立 tag 并保留原文字；仅当原材料明确区分编码标签和值时才使用 `identity.code:{label,value}`。不猜测编码含义。 |
| `props.asOf` | 先确定是查询期间、最新数据期、刷新时间还是生成时间，再写对应 `identity.facts[]`，保留 label/value。无法确认时保留为正文说明并列缺口，不将浏览器当前时间当事实。 |
| `props.filterIds` | Report 旧日期工具带认领的日期筛选按原顺序迁至根级 `iocHeader.filterIds`；Dashboard 的其他页级筛选从原通用筛选区选取。筛选声明、默认值、候选依赖及查询绑定保持原样。 |

`subtitleFormat:"semanticHtml"` 不能直接塞入纯文本 description：用正文 `text` 的对应合法语义保留原内容，或先明确接受纯文本转换。`generatedBy` 是作者/来源说明，不等于 generatedAt；需保留时放正文说明。`decoration`、旧页头卡面及布局跨度不属于根级页头属性，不透传到 `iocHeader`；新版自带 16px 底部外间距，不再添加空白组件补同一份间距。

`exportButtons`、`pdfExport`、`pngExport` 没有对应的 `iocHeader` 字段。Report 下载能力先查[报告页头](page-metadata/components/reportHeader.md)：有合法独立章节页头时评估承接并验证下载；无法保留时明确报告能力缺口，保留原件与未完成候选，不删按钮、不改变 layout 绕过限制。集成应用提供的主题、全屏或其他按钮也不能写成未支持的 `iocHeader.actions`。

## 筛选与返回保持

- `filterIds` 只列本页已声明、静态可见且应属于页头的筛选，顺序就是显示顺序。没有认领项时省略字段，不写空数组。未认领项保留在正文；不删除或复制 `filters` 来移动控件。
- 图表独立筛选、详情私有筛选、被 `filterGroup` 或保留的 `reportHeader` 消费的筛选不能重复认领。旧页头认领转移后解除原位置；搜索是否留在正文按原布局核对。不要把所有 filter id 无条件收进页头。
- 保留 `params`、查询体、`filterBindings`、`initial`、来源及正文组件绑定。期间继续使用原 `timeRange`；详情单月继续 `timePoint`，离散月份继续原维度。页头迁移不顺带改候选权限、时间粒度或查询口径。
- 原来需要返回时可声明 `back:true`，但新页头仅在集成应用同时提供合法 `navigation.returnContext.entryId` 与 back 函数时显示返回。旧工具栏的返回兼容行为不能视为新页头保证；直接打开应隐藏，不能伪造 Page 参数、URL 或返回上下文来补按钮。缺集成接线时报告该项待验。
- 原页只读限制和纯文本原因随迁移保留；集成应用额外施加的只读门禁仍由集成应用提供，不在页面里伪造权限。

## 最小前后对照

以下是同一 Dashboard 的局部对象；其余字段沿用原文，不作为完整页面直接校验。例中的 `month`、`region` 必须已在目标页声明，原先显示在通用筛选区且没有其他组件认领；迁移后移动到页头。旧 `reportHeader.filterIds` 只用于 Report 日期工具带，不能在此 Dashboard 上写入维度筛选。

旧声明：

```json
{
  "dashboardToolbar": "hidden",
  "sections": [{
    "id": "heading",
    "container": "plain",
    "components": [{
      "id": "old-header",
      "type": "reportHeader",
      "layout": {"span": 12},
      "props": {
        "title": {"param": "project-name"},
        "subtitle": "项目经营情况",
        "tags": ["重点项目"]
      }
    }]
  }]
}
```

目标根级声明：

```json
{
  "iocHeader": {
    "identity": {
      "title": {"param": "project-name"},
      "description": {"text": "项目经营情况", "presentation": "inline"},
      "tags": [{"id": "priority", "text": "重点项目"}]
    },
    "filterIds": ["month", "region"],
    "presentation": {"layout": "inline", "density": "normal", "collapse": "none"}
  }
}
```

在完整页面里新增该根级对象，删除 `old-header` 和仅为它存在的空 `heading` 分区，其余正文顺序及原 `project-name` 参数保持。示例不补 `back`、期间事实或新查询。完整结构按需参照[身份与筛选](page-metadata/examples/ioc-header-page.json)、[密集页头](page-metadata/examples/unified-overflow-header.json)、[导航详情](page-metadata/examples/navigation-detail-page.json)，只取所需页头结构，不复制示例业务与数据。

## 完成检查

保存原件和迁移候选后，运行 `node "<skill-dir>/scripts/validate-page.mjs" "<page-file>"` 校验完整页。核对 diff：只变页头声明、被替换的身份组件与必要版本/空分区处理；数据、筛选定义和正文绑定无意外变化。失败时保留 type/path/message 修复，不删除合法配置绕过错误。

有目标运行环境时，预览精确文件的宽/窄容器：身份仅一份，标题/标签/说明与原材料一致；筛选顺序、默认值、折叠、只读、清空、级联及原数据结果一致；有来源/直接打开两种返回状态正确；原有导出仍可用。可参考 Playground `/pages/ioc-header-standard`、`/pages/ioc-header-dense`、`/pages/ioc-header-detail`，这些合成页不能代替目标业务页验收。

交付目标文件、旧页头类型、迁移映射、原件路径、完整校验结果，以及未承接能力或缺运行环境的具体项。静态校验、浏览器交互、真实查询分别报告；只升级版本或只新增 `iocHeader` 而遗留重复身份不算完成。
