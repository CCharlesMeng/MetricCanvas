# 设计稿字面量取证(design facts)

这里放的是从 IOC 项目地图设计稿里抽出来的**可静态读取的字面量**,每份在用稿一个 JSON。

## 为什么入库

设计稿在 `参考/项目地图/设计稿/`,该目录已被 gitignore,不随仓交付。而 sdd 仓外 baseline 的
`PATTERN-STYLE-4` 要求还原判据的 `design_fact_source` **三件齐全**——哪个文件、哪个
`data-node-name` 节点、哪个类名,一条 `rg` 能复现。别人 clone 下来手里没有设计稿,这条指路就是空的。

所以把**抽出来的字面量**落盘入库,而不是把整份设计稿纳入交付。三件套在这里的对应关系是:

| `design_fact_source` | 本产物里的字段 |
| --- | --- |
| 哪个文件 | `source.path` |
| 哪个 `data-node-name` 节点 | `nodes[].nodeName`(重名时用 `nodes[].nodeId` 或 `nodes[].namePath` 消歧) |
| 哪个类名 | `literals[].raw` / `computed[]`,均为源文件 token 的原样切片 |

## 文件

| 文件 | 源 |
| --- | --- |
| `project-overview.json` | `参考/项目地图/设计稿/project-overview.html` |
| `porject-detail.json` | `参考/项目地图/设计稿/porject-detail.html`(文件名的拼写错误来自设计稿本身,保持一致) |

第三份 `archive-not-a-source/opportunity-lits.html` 已于 2026-08-25 退出事实源、禁止再引,**没有**抽取。

## 重新生成与校验

```bash
pnpm design:facts        # 设计稿变了重新生成
pnpm design:facts:check  # 只校验,不写盘
pnpm test                # 同一批断言也在 tools/design-facts/tests 里跑
```

设计稿不在本机时,`design:facts:check` 打印 `SKIP` 并退出 0——没有稿就没法比对哈希,这不算失败。

## 怎么读

产物自带一份 `reading` 说明,下面是要点。

### 字面量层 vs 计算层

分层判据只有一条,而且是机械的:**值有没有写在类名里**。

- 写了 → `nodes[].literals`。两种写法都覆盖:任意值 `<前缀>-[<值>]`(`w-[580px]`、`text-[#191919]`)
  与任意属性 `[<属性>:<值>]`(`[border:1px_dashed_#dcdbdb]`、`[box-shadow:...]`)。
  注意稿里 `border-[` 和 `shadow-[` 是 **0 命中**,边框和阴影只走后一种写法。
- 没写 → `nodes[].computed`,只留原样 token。它们是「读不到具体值」的标记,不是值本身。
  全部计算层 token 及出现次数见 `stats.computedByToken`。

其中一部分计算层 utility 能按 Tailwind 默认主题解出定值,那些解在 `themeResolution` 里单列,
见下一节。**解出来的值不进 `literals`**——那是 Tailwind 的值,不是设计稿的值。

### Tailwind 默认值对照表(`themeResolution`)

`nodes[].computed` 只有原样 token,没有值。要值就到 `themeResolution` 查:

```jsonc
"themeResolution": {
  "basis": { "cdn": "https://cdn.tailwindcss.com", "versionPinned": false, "versionAdopted": "tailwindcss 3.x 默认主题", ... },
  "resolved": {
    "font-medium": { "occurrences": 30, "declarations": { "font-weight": "500" }, "origin": "theme.fontWeight.medium" }
  },
  "unresolved": {
    "justify-between": { "occurrences": 56, "family": "layout-allocation", "reason": "主轴剩余空间的分配方式,实际间距由算法按容器宽度与子盒尺寸算出" }
  },
  "byProperty": { "font-weight": { "400": 167, "500": 30 } }
}
```

按节点查就是一次 join:拿 `nodes[].computed` 里的 token 到 `resolved` / `unresolved` 里查。
表是按 utility 聚合的、不下发到节点上,因为那个值不是节点的属性,是 utility + 主题的属性——
分开放才不会被读成稿里的字面量。

**解与不解的界线**:该 utility 决定的量,是不是由布局算法分配出来的。

| | utility | 解出来的声明 |
| --- | --- | --- |
| **解**(13 个 / 1139 处) | `font-normal` 427 | `font-weight: 400` |
| | `font-medium` 108 | `font-weight: 500` |
| | `whitespace-nowrap` 524 | `white-space: nowrap` |
| | `text-left` 8 / `text-right` 5 / `text-center` 2 | `text-align: left` / `right` / `center` |
| | `overflow-hidden` 4 | `overflow: hidden` |
| | `isolate` 5 | `isolation: isolate` |
| | `bg-no-repeat` 25 | `background-repeat: no-repeat` |
| | `bg-center` 25 | `background-position: center` |
| | `origin-top-left` 2 | `transform-origin: top left` |
| | `m-0` 2 / `p-0` 2 | `margin: 0px` / `padding: 0px` |
| **不解**(9 个 / 736 处) | `flex` 194、`flex-col` 82、`justify-between` 60、`items-start` 112、`items-center` 44、`block` 101、`inline-block` 2、`absolute` 121、`relative` 20 | — |

不解的那 9 个,CSS 声明本身也是确定的(`display: flex` 等),但这些 utility 的作用就是把尺寸和
间距交给布局算法分配;把声明解出来会让人误以为分配结果也可判,而那正是 `PATTERN-STYLE-4 ②`
判不了的东西。逐条理由记在 `unresolved[].reason`。`w-full` / `h-full` 同理,不过这两个在
两份在用稿里并未出现。

`byProperty` 给出已解声明的**取值闭集**与次数,判「闭集只有哪几个值」直接读它。当前
`font-weight` 的闭集恰为 `{400: 427, 500: 108}`——Tailwind 也提供 `font-semibold`(600)与
`font-bold`(700),但这两个 utility 在稿里**零命中**。

稿里出现了对照表未收录的 utility 时,它会落进 `unresolved` 且 `family` 为 `unlisted`,同时计入
`stats.unlistedUtilities`,由测试断言为 0 拦住——不会被静默忽略,也不会被瞎猜。

### 文字盒宽

Figma 给每个文本 span 都写了 `w-[24px] h-[18px]`,那是**那串字在设计稿字体栈
(`HarmonyOS Sans SC`)下的实测盒**,不是排版意图;运行时字体不同就永远对不上。

这类量标成 `literals[].fontMeasured: true`。规则是机械的:**文本叶节点上的 `w` / `h` 字面量**,
其中文本叶 = `tag` 为 `span`、有直接文本、无元素子节点(`nodes[].textLeaf: true`)。
两份稿的 536 个文本叶**全部**带 w 和 h,合计 1072 处,占全部 `w-[…]`/`h-[…]` 的 61%。

同一节点上的 `text-[12px]` 与 `leading-[18px]` **不带**这个标记——那是排版设置,可以照用。

消费方按 `fontMeasured` 过滤即可:

```bash
# 拿掉文字盒后剩下的尺寸字面量
jq '[.nodes[].literals[] | select(.category=="size" and .fontMeasured != true)]' docs/design-facts/project-overview.json
```

### 抽不出来的东西

- **CSS 规则确为 0**:两份稿都是 0 个 `<style>` 块、0 张外链样式表、0 个 `style=` 属性,
  全部规则由 Tailwind CDN 在运行时生成。所以本产物只覆盖类名里的字面量。
- **图形观感没有来源**:稿内引用的 `assets/` 目录整体不存在,`assetReferences.paths`
  里的路径无一命中。图标形状、地图底图、分隔线画法、装饰件都判不了,只登记引用。
- **body 的 `font-family` 在稿里是坏的**:Figma 写成
  `[font-family: "HarmonyOS Sans SC", ...]`,冒号后有真空格且值里带裸双引号,把 `class`
  属性提前截断了。按 HTML 规范解析只能拿到 `[font-family:`。产物没有猜这个值,而是把
  整个开标签原样记在 `parseWarnings[].tagSource` 里,字体栈从那里读。

### 只抽,不判

产物里不出现「这个应该是环形图」这类推断。`literals[].category` 只是把前缀归并成
统计桶,判断留给消费方。`themeResolution` 是唯一一处产物给出了「设计稿里没写的值」的地方,
所以它单列、带出处、并写明依据的 Tailwind 版本线。

## 规模

两份稿合计:

| 项 | 数量 |
| --- | --- |
| 节点 | 950(其中 942 个带 `data-node-name`,可作 `design_fact_source`;181 个去重名) |
| 字面量 · 任意值 `<前缀>-[<值>]` | 4760 |
| 字面量 · 任意属性 `[<属性>:<值>]` | 265 |
| 计算层 token | 1875(22 种;1139 处按 Tailwind 主题解出定值,736 处留在计算层) |
| 文本叶 / 其中标为 `fontMeasured` 的量 | 536 / 1072 |
| 资源引用(全部缺失) | 138 个去重路径 |
| `parseWarnings` | 2(每份稿 body 上那条截断的 `[font-family:`) |

与 `PATTERN-STYLE-4` 依据样本逐项对齐的结果:任意值总数 4760、位置 287、色值 682、
字号 536、行高 536、圆角 49、`[border:…]`/`[border-top:…]` 18、`[box-shadow:…]` 23、
`[text-shadow:…]` 59、`justify-between` 60、去重节点名 181、缺失资源 138——全部一致。

**只有一处不一致**:尺寸桶本产物记 2666,依据样本记 2657,差 9 处。本产物的分项全在
`stats.literalsByProperty` 里,两份稿相加即得:

| 前缀 | 次数 | | 前缀 | 次数 |
| --- | --- | --- | --- | --- |
| `w-[…]` | 946 | | `pt-[…]` | 46 |
| `h-[…]` | 794 | | `pr-[…]` | 46 |
| `ml-[…]` | 515 | | `pb-[…]` | 46 |
| `mt-[…]` | 194 | | `pl-[…]` | 46 |
| `gap-[…]` | 31 | | `m-[…]` | 2 |
| | | | **合计** | **2666** |

依据样本没有列出分项,所以那 9 处的去向无从判断,只能指出差在哪:

- 依据样本自己的六个桶(尺寸 2657 + 位置 287 + 色值 682 + 字号 536 + 行高 536 + 圆角 49)
  合计 **4747**,与它同批给出的任意值总数 **4760** 差 **13**;
- 13 = 这 9 处 + 依据样本未列出的 `opacity-[…]` 4 处。

也就是说本产物的 2666 能把 4760 补齐(2666 + 287 + 682 + 536 + 536 + 49 + 4 = 4760),
依据样本的 2657 补不齐。**修依据样本不是本产物的事**,这里只把分项摊开,让下一个人一眼看出
差在尺寸桶、且只差 9。
