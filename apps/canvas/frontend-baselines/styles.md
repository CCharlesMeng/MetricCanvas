# styles.md — 样式值从哪来,允许怎么写?

## 样式值的来源

<!-- 覆盖:packages/runtime-ui/src/(含 filters/、ai-summary/)、packages/widgets/src/、apps/canvas/src/routes/,以及全仓构建配置(2026-08-24);2026-08-25 追加 packages/runtime-ui/src/backdrop-safe-area.ts 与仓外参考稿 参考/项目地图/设计稿/(见 STRUCT-9,已列入 .gitignore,不随仓交付);2026-08-25 对 packages/runtime-ui/src/ 与 packages/widgets/src/ 全部 30 个 <style> 块做了声明级全量统计(STYLE-9~11 与 PATTERN-STYLE-1、PATTERN-STYLE-5 由此得出),这两个目录的 token/字面量落点已属「查不到即仓里没有」。apps/platform 的工作台样式未纳入首扫 -->

| ID | 指路 | 是什么、何时用 | 被引用 |
| --- | --- | --- | --- |
| `STYLE-1` | CSS 自定义属性,统一前缀 `--mc-`;主定义在 `packages/runtime-ui/src/RuntimeView.svelte` 的 `.runtime-view` 与 `.page-content` 两条规则里 | **token 集的真源**,约 80 个档位:颜色、字号、圆角、间距、分区渐变。要用某个档位就在这个文件里检索前缀,**不要凭记忆写数值**。<br>**它是 token 的真源,但不是样式值的真源**——构件内的多数视觉量根本不走 token(见 `PATTERN-STYLE-1`),另有 3 个文件零 `var(--mc-`(`STYLE-10`)、第二套非 `--mc-` 前缀在干同样的事(`STYLE-11`)。在这里检索不到某个档位,**先看 `STYLE-9`**:可能它作为空头名字只存在于回退位 | 页面、分区与多数叶子构件消费 `var(--mc-…)` |
| `STYLE-2` | `packages/runtime-ui/src/RuntimeSection.svelte` 与 `packages/widgets/src/components/report-header/ReportHeader.svelte`、`.../text/TextBlock.svelte` 内的 `--mc-` 定义 | 就地补充的局部档位(分区、报表页头、文本块各自的专属外观量)。同一前缀、不同定义点——**改一个档位前先确认它属于 `STYLE-1` 还是这里** | 各自组件内部 |
| `STYLE-3` | 成组的命名序列(可在 `STYLE-1` / `STYLE-2` 内按前缀检索):`--mc-color-*`、`--mc-color-report-*`、`--mc-font-size-report-*`、`--mc-radius-*`、`--mc-section-*`、`--mc-section-title-*`、`--mc-insight-*`、`--mc-metric-panel-*`、`--mc-gauge-*`、`--mc-cell-*`、`--mc-field-text-body-*` | scale 档位的分组。命名的第二段就是它管的东西,按段检索比按值找快。<br>**按前缀检索得到的名字不等于都是真档位**:`--mc-field-text-body-*` 与 `--mc-text-heading-*` 两族里都混着 `STYLE-9` 的空头名字(前者四个名字里三真一空)。按前缀取到一批名字后,**逐个确认它有定义点**,不要整族当成可覆写档位 | 同 `STYLE-1` |
| `STYLE-4` | Svelte 单文件组件的 `<style>` 块 | **唯一的样式写法**。全仓没有独立 `.css` / `.scss` / `.less` 文件,没有预处理器,没有 Tailwind / PostCSS 配置,没有工具类方案。样式默认按组件作用域隔离,跨界要 `:global()` | 全部构件 |
| `STYLE-5` | `packages/embed/vite.config.ts`(`emitCss: false`、`cssCodeSplit: false`)+ `packages/embed/src/index.ts` 的 `attachShadow` | 第二形态(嵌入)的样式隔离:组件样式随 JS 注入 ShadowRoot,宿主样式进不来、本仓样式也出不去。**嵌入场景不要指望外部样式表** | `STRUCT-6` |
| `STYLE-6` | `apps/canvas/src/routes/+layout.svelte`、`(viewer)/+layout.svelte`、`(viewer)/+page.svelte`、`(viewer)/pages/[pageId]/+page.svelte`、`(viewer)/preview/+page.svelte` 内的字面色值与尺寸 | **宿主壳的硬编码基准**:顶栏、目录卡片、页面外框用的是直写的十六进制色值与像素,不在 `--mc-` 体系内。这是有意的边界——壳属宿主,`--mc-` 属统一运行时。**外框共 3 处、类名不统一**:两处叫 `.page-frame`(`(viewer)/+page.svelte`、`pages/[pageId]/+page.svelte`),`preview/+page.svelte` 那处叫 `.preview-page`,几何写法相同。数外框时**只数 CSS 规则**——`(viewer)/+layout.svelte` 里的 `.page-frame` 出现在注释中不算,`apps/platform` 的同名类属另一个 app 的原型件、不在本表范围 | 5 个路由文件 |
| `STYLE-7` | `参考/项目地图/设计稿/` 两份在用导出稿(`project-overview.html`、`porject-detail.html`)内的**两种字面量写法**:任意值类名 `<前缀>-[<字面量>]`(检索 `-[` )与任意属性 `[<属性>:<字面量>]`(检索 `[border:` / `[box-shadow:` 等);节点身份靠 `data-node-name` 属性 | **设计稿唯一可静态读取的样式层**。这两种写法把尺寸、位置、色值、字号、行高、圆角、边框、阴影直接写在 HTML 属性里,`rg` 即可取,不必跑浏览器。除此之外该稿**没有**任何可抽取样式:0 个 `<style>` 块、0 张外链样式表、0 个 `style=` 属性,全部规则由 Tailwind CDN 在运行时生成。要取某个数值就在这两种写法里检索,**不要从截图目测,也不要从渲染结果反推** | `PATTERN-STYLE-4`;第三份 `opportunity-lits.html` 已于 2026-08-25 退出事实源并移入 `archive-not-a-source/`,**禁止再引** |
| `STYLE-8` | `packages/runtime-ui/src/backdrop-safe-area.ts` 导出的安全区自定义属性组(统一前缀 `--mc-backdrop-safe-`)与 `RuntimeSection.svelte` 上的 `data-backdrop-safe` 锚点;**同一通道另有 `--mc-backdrop-available-h`**,由 `RuntimeSection.svelte` 直接拼进 `style` 字符串(不经本模块导出),在同文件内被消费 | **运行时算出来的 `--mc-` 属性**:值由布局完成后的未遮挡矩形算得,经 `style` 属性字符串下发到 backdrop 单元格,由 `MapChart` 消费。它是**几何通道不是设计档位**——不要往 `STYLE-1` / `STYLE-2` 里找它的定义,也不要把它当成主题机制的证据(见 `PATTERN-STYLE-3`)。矩形无解时四个 `-safe-` 属性与锚点一并缺席,消费方退回全容器;`-available-h` 无解时退回自己的回退字面量。**按 `--mc-backdrop-safe-` 前缀检索会漏掉 `-available-h`**,要数全这条通道得按 `--mc-backdrop-` 检索 | `RuntimeSection.svelte` 一处下发点 + 构件侧消费 |
| `STYLE-9` | 「回退位即默认值」写法:`var(--mc-…, <字面量>)` 的第二参数。按 `--mc-` 检索定义点、再与消费点求差即可列出**有消费无定义**的那批名字 | **本仓 token 的主流写法,也是最大的一个坑**。`--mc-` 的 `var()` 引用里约四分之三带回退,回退位承担的是「默认档位」而不是「兜底」——真正的档位切换靠上层覆盖那个属性。**有一批名字只出现在回退写法里、全仓没有任何定义点**,它们的生效值恒为回退字面量:`--mc-cell-surface`、`--mc-field-text-body-line-height`、`--mc-semantic-paragraph-gap`,以及 `--mc-text-heading-` 前缀那 5 个。**这批名字命名规整、和同族真档位混在同一条 CSS 规则里**,只看名字或只看代码注释判不出来——`FieldText.svelte` 正文块的注释就把其中一个说成「可被页面布局形态就地覆写」,而它没有定义点,覆写不存在。判某个 `--mc-` 名字是真档位还是空头,**只能检索它的定义点**,不能看命名、不能看注释 | 8 个空头名字,各 1 处消费;带回退的 `--mc-` 引用约 168 处 |
| `STYLE-10` | 有 `<style>` 块但**零 `var(--mc-`** 的文件:`packages/runtime-ui/src/ai-summary/SafeMarkdown.svelte`、`packages/widgets/src/shared/EChart.svelte`、`packages/widgets/src/components/metric-card/ProgressRing.svelte` | 当前仅这 3 个文件整体不消费 `--mc-*`。`ProgressRing.svelte` 重度使用构件私有前缀(`STYLE-11`)。**要取这批文件里的视觉量,不要去 `STYLE-1` 找档位**,直接读该文件 | 3 个文件 |
| `STYLE-11` | 不带 `--mc-` 前缀的跨文件下发属性,按构件命名:`--progress-ring-*`、`--table-widget-radius-*`、`--table-header-row-height`、`--section-grid-gap`、`--key-value-columns`、`--risk-notice-max-width`。检索 `var(--` 再排掉 `--mc-` 即得全集 | **和 `--mc-` 干同一件事的第二套前缀**:父组件给另一个文件(甚至另一个包)里的子组件定值。**跨界下发的前缀无统一做法**,检视据此**不得**判「跨界下发没走 `--mc-`」。与 `--mc-` 的两点不同:<br>① **差异轴不是页面布局形态**,所以 `PATTERN-STYLE-2` 的「差异只落一处」不覆盖它。三条轴各有实例:**视口**(`--progress-ring-*`,定义点在 `MetricCard.svelte` 的窄视口 `@media` 内,消费在 `ProgressRing.svelte`)、**单元格相邻状态**(`--table-widget-radius-*`,定义点在 `RuntimeSection.svelte` 的 `.connect-next` / `.connect-previous` 状态类上,消费在 `Table.svelte`)、**运行时数据**(`--key-value-columns`、`--risk-notice-max-width`、`--table-header-row-height`,由模板上的 `style:` 指令按 props 写入)。<br>② 默认值一律写在**消费点的回退位**(同 `STYLE-9`),定义点只给覆盖档。**同一个量因此有两个值、在两个文件里**,取值前先确定要哪一档 | 19 个属性;`ProgressRing.svelte` 的 16 处引用全部属这套 |

## 规范

#### `PATTERN-STYLE-1` · 字面量是构件内部的常态,token 只强制管两件事

| 项 | 内容 |
| --- | --- |
| 规则 | **`--mc-` 不是通用设计档位,本仓不要求构件内的样式数值走 token。** token 强制只在两种场合成立:<br>**① 两档页面布局形态取值不同的量。** 必须落在 `STYLE-1` 的 `.page-content` / `.page-content.layout-dashboard` 这一对规则上。`PATTERN-STYLE-2` 管「差异只落一处」,本条管「那一处的载体必须是 CSS 自定义属性」——两条是同一机制的两面。<br>**② 跨文件下发的量。** 父组件要给另一个文件里的子组件定值,自定义属性是唯一通道(Svelte 作用域样式到不了,样式不走 props)。**但前缀无统一做法**:`--mc-*` 与构件私有前缀(`STYLE-11`)并存且各占相当分量,检视**不得**判「跨界下发没用 `--mc-` 前缀」。<br>**③ 其余一律允许字面量,而且字面量就是本仓常态。** 构件 `<style>` 里的字号、行高、字重、内边距、宽高按字面量直写是**正确**的,不是技术债。`--mc-color-*` 调色板可用但**不强制**——调色板 24 个值里 14 个同时以字面量形式出现在别处。<br>**本条推翻 2026-08-24 那版**「`runtime-ui` 与 `widgets` 的样式值必须取 `var(--mc-…)`」。那版按其规则文本在本仓命中 30 个 `<style>` 块里的 29 个、非平凡字面量 914 处;一条规则与代码相差到这个量级,失真的是规则而不是代码,它已经无法充当任何判据 |
| 依据清单 | `STYLE-1`、`STYLE-2`、`STYLE-9`、`STYLE-10`、`STYLE-11` |
| 依据样本 | 2026-08-25 对 `packages/runtime-ui/src` 与 `packages/widgets/src` 全部 30 个 `<style>` 块做**声明级**统计(按 `;` / `{` / `}` 切声明而非按行,剥掉 `var()` 回退位与 `--mc-` 定义行,`font-weight` 等无单位量一并计入):2009 条声明里字面量 945 条、token 231 条,**token 占比 20%**;去掉 `0` / `100%` / `auto` 等平凡值后字面量 914 条,涉 29 个文件。<br>**分量看,落点是分裂的**:内边距/外边距/间距走 token 12%、字号 12%、字重 6%、宽高定位 17%、行高 19%;而色值/背景 36%、阴影 35%、圆角 31%、边框 22%。**token 管的是「表面长什么样」,字面量管的是「字和盒子多大」**——因为两档布局形态差的正是表面。<br>**正面(收窄后的规则仍有牙)**:①的机制 100% 干净——`layoutForm` 全仓只出现在 `RuntimeView.svelte` 的 4 行里且只用于切类名,没有任何构件按布局形态分支;`SemanticHtml.svelte`(15 处 `--mc-` 对 3 处字面量)与 `ProgressRing.svelte`(16 处自定义属性对 7 处字面量)明显在刻意走变量。<br>**反面**:某个正文色档位在 5 个文件里被直写 16 次,而它同时是一个 `--mc-color-*` 档位;`STYLE-10` 那 13 个文件零 `var(--mc-` |
| 违例判定 | ① 某个量在两档布局形态下取值不同,却没走 `.page-content` / `.layout-dashboard` 这对规则——表现为构件内出现布局形态分支,或第二处定义两档差异。与 `PATTERN-STYLE-2` 同一判据。<br>② 父组件要给别文件的子组件定值却没用自定义属性(改成传 props 控样式、加类名开关、或复制一份样式过去)。<br>**③ 反向违例,这是本次修订的主要目的**:把构件 `<style>` 里的十六进制色值、`px` 字号、行高、字重、内边距判成「硬编码违规」,并据此要求改成 token——**违例**。本仓 914 处非平凡字面量、29 个文件是既定惯例;要不要收敛成档位是产品决策,不是检视 Finding。<br>**旧判定作废**:「出现十六进制或 `rgb(` 且不在 `var()` 回退位、也不在 `--mc-` 定义行」在本仓命中 **230 处**(十六进制 201 + `rgb(` 29)、遍布 **26 个文件**,信噪比为零,**不得再用**。<br>注意旧条目**自身不自洽**:规则文本管「样式值」全体(实测 914 处非平凡字面量、29 个文件),判定却只查色值(230 处、26 个文件)。按判定读会漏掉字号行高间距这批最大的偏离,按规则读则 29 个文件全违例。两种读法都不可用,这也是必须整条重写而不是改判定的原因 |

#### `PATTERN-STYLE-2` · 两档页面布局形态的差异集中在一处

| 项 | 内容 |
| --- | --- |
| 规则 | 报表形态与看板形态的**宿主外框几何**由 Canvas viewer 正式路由根据 `documentLayoutForm` 切换;**统一运行时内部视觉档位**则集中在 `RuntimeView.svelte` 的 `.page-content` / `.page-content.layout-dashboard` 一对规则上覆盖 token。叶子构件和分区均不得自行读取 `layoutForm` 或按页面 id 分支 |
| 依据清单 | `STYLE-1`、`COMP-5` |
| 依据样本 | `apps/canvas/src/routes/(viewer)/pages/[pageId]/+page.svelte` 根据 `documentLayoutForm` 切宿主 frame;`RuntimeView.svelte` 的 `.page-content.layout-dashboard` 集中覆盖内部视觉档位;`RuntimeSection.svelte` 和 Widgets 不读布局形态。 |
| 违例判定 | 叶子构件或分区内出现 `layoutForm === 'dashboard'`、正式页面 id 分支，或统一运行时内部又建第二处布局形态档位。宿主路由对外框的切换不算第二处内部档位。`STYLE-11` 的视口 / 相邻状态 / 运行时数据轴不受本条约束 |

#### `PATTERN-STYLE-3` · 无主题机制

| 项 | 内容 |
| --- | --- |
| 规则 | 仓内没有主题上下文、没有主题对象、没有暗色或多品牌切换。`STYLE-1` / `STYLE-2` 的**设计档位**是一套固定值,不是可换的主题。计划期据此**不要**发明主题层;检视**不得**判「硬编码了主题色」。<br>**`--mc-` 前缀不等于设计档位**:`STYLE-8` 的安全区属性同前缀但按视口逐次算出,它是几何通道,不构成主题机制 |
| 依据清单 | `STYLE-1`、`STYLE-4`、`STYLE-8` |
| 依据样本 | 设计档位的 `--mc-` 定义只出现在 4 个文件的静态规则里;无主题 provider 或 context;`packages/**` 内 `style.setProperty(` 零命中(全仓仅 `apps/platform/static/prototype/` 的两份原型 HTML 有,非产品代码)。<br>**`setProperty` 零命中不是充分依据,复现时要连 Svelte 的写法一起数**:`packages/**` 内 `style:--` 指令有 3 处、模板字符串拼 `--mc-` 有 1 处。逐个看过,它们写的都不是设计档位——3 处 `style:--` 下发的是列数、最大宽度、表头行高(`STYLE-11` 的运行时数据轴),1 处模板字符串是 `STYLE-8` 的几何通道。**结论不变,但依据从「运行时不写自定义属性」换成「运行时写的都不是设计档位」**,与本条违例判定同一判据 |
| 违例判定 | 出现主题上下文、主题对象,或 `STYLE-1` / `STYLE-2` 的**设计档位**被运行时改写而本条未更新。判据是「被改写的是不是设计档位」,**不是**「有没有在运行时写 `--mc-`」——按后者判会把 `STYLE-8` 误判成违例 |

#### `PATTERN-STYLE-4` · 设计稿的字面量层可作数值依据,计算层与缺失资源不可

| 项 | 内容 |
| --- | --- |
| 规则 | 设计稿分**两层**,判据不同,不要整份一刀切。<br>**① 字面量层——可作数值依据。** 凡在 `STYLE-7` 的两种写法里检索得到的量:尺寸、位置、色值、字号、行高、圆角、边框、阴影,连同原有的结构、文案、满宽,都可以进期望值,也可以据此判样式违规。<br>**② 计算层——不可。** 由布局算法在运行时分配出来的量,类名里根本没有:`flex` 分配后的实际宽度、`justify-between` / `justify-around` 造成的间距、`w-full` / `h-full` 相对父盒解析出的值、截断与换行的实际落点。<br>**③ 缺失资源的图形观感——不可。** `设计稿/assets/` 整目录不存在,该目录下的引用**无一命中**,任何依赖图形本身的结论(图标形状、地图底图、分隔线画法、装饰件)都没有来源。<br>②③ 一律记「未验证」,**不得**用截图目测或从当前渲染结果反推补上——反推会把实现写成期望。<br>**④ 引用格式。** `design_fact_source` 要三件齐全:哪个文件、哪个 `data-node-name` 节点、哪个类名或任意属性,一条 `rg` 能复现。只写到「第几屏 / 哪块区域看起来像」的不算来源。<br>**⑤ 已归档的第三份稿禁止再引**,见 `STYLE-7` 的被引用列。<br>**本条推翻 2026-08-24 那版**「三份稿只支持结构、文案、满宽三类判据,数值级一律未验证」。那版的依据是「静态抽取得到 0 条 CSS 规则」——该依据对 **CSS 规则**成立(实测确为 0),对**类名**不成立:任意值类名本身就是可静态读取的字面量 |
| 依据清单 | `STYLE-7`、`STYLE-1`、`STYLE-6`、`STRUCT-9` |
| 依据样本 | 2026-08-25 对两份在用稿逐 token 统计。**正面**:任意值类名 4760 处——尺寸 **2666**、位置 287、色值 682、字号 536、行高 536、圆角 49、`opacity-[…]` 4;任意属性另有 `[border:…]` / `[border-top:…]` 18 处 4 种、`[box-shadow:…]` 23 处 3 种、`[text-shadow:…]` 59 处 1 种;节点锚点 `data-node-name` 942 处、181 个去重名。**反面同批坐实**:`<style>` 块 0、外链样式表 0、`style=` 属性 0(故 CSS 规则确为 0,旧依据在这一半上没错);`justify-between` 60 处;资源引用 138 个**全部缺失**,`assets/` 目录不存在。<br>**尺寸桶 2026-08-25 由 2657 更正为 2666,并补上原先漏列的 `opacity` 桶。** 可核来源是入库产物 `docs/design-facts/*.json` 的 `stats.literalsByProperty`,两份稿相加即得:`w` 946 + `h` 794 + `ml` 515 + `mt` 194 + `pt`/`pr`/`pb`/`pl` 各 46 + `gap` 31 + `m` 2 = **2666**。<br>**那 13 处的去向**:旧版六个桶(2657 + 287 + 682 + 536 + 536 + 49)合计 **4747**,与同批给出的任意值总数 **4760** 差 **13**;13 = 尺寸桶少数的这 **9** 处 + 旧版**未列出**的 `opacity-[…]` **4** 处。更正后 2666 + 287 + 682 + 536 + 536 + 49 + 4 = **4760**,正好补齐;2657 补不齐 |
| 违例判定 | 分三条判:① 计划或检视里出现「按设计稿的某个数值」,而该数值在 `STYLE-7` 两种写法里**检索不到**——违例,它来自目测或反推;② 出处没给出 `data-node-name` 节点与类名——违例,不可复现;③ 把 `flex` / `justify-between` 分配出的间距、或缺失资源的图形观感写成期望值——违例。<br>**反向也是违例**:检索得到类名、出处三件齐全的数值判据**被判成「设计稿不能作数值依据」而驳回**——那正是本次修订推翻的读法 |

#### `PATTERN-STYLE-5` · 视觉量的落点判定(写 `static` 针的前置)

| 项 | 内容 |
| --- | --- |
| 规则 | 给定一个视觉量(字号、行高、字重、圆角、内边距、边框、色值、宽高),**先定它在仓里的落点,再按落点写针**。落点四种,判定按序短路:<br>**S1 目标文件在 `STYLE-10` 的零 token 清单里** → 落点必为**裸字面量**,针匹配字面量,不必再往下走。<br>**S2 该量写成 `var(--x, <字面量>)` 且 `--x` 属 `STYLE-9` 的空头名字** → 生效值**恒等于回退字面量**,针匹配回退位;**写成 token 匹配会恒红**。<br>**S3 该量写成 `var(--x, …)` 且 `--x` 有定义点** → 值在**定义点**,消费点看不到值,针要指向定义点所在文件。**再数定义点有几个**:一个定义点是单值(`--mc-color-*`、`--mc-insight-*`、`--mc-radius-*` 多属此类);两个及以上就是**多值**,针必须写明判的是哪一档。多值的三个来源:`.page-content` 与 `.layout-dashboard` 这对规则(报表/看板,30 个)、`STYLE-11` 的视口与相邻状态档、以及同名档位在 `STYLE-2` 的局部定义点上被就地覆盖。<br>**S4 其余** → 按下表取默认落点,**再打开目标文件的 `<style>` 块确认**。<br>**下表是先验概率,不是许可。** 三条禁止:不得从设计稿数值反推落点;不得从 `--mc-<组件>-<量>` 这个命名在不在推断属性存不存在(`STYLE-9` 就是命名规整但不存在的反例);不得从代码注释推断——`FieldText.svelte` 的注释把一个空头名字说成「可被布局形态覆写」。 |
| 依据清单 | `STYLE-9`、`STYLE-10`、`STYLE-11`、`STYLE-1` |
| 依据样本 | 比例来自 `PATTERN-STYLE-1` 同一批声明级统计(2026-08-25,2009 条声明)。**四种落点在一条 8 行 CSS 规则里同时出现**的实例:`FieldText.svelte` 的正文 `p` 规则——3 个真档位(`--mc-field-text-body-` 的 padding / surface / radius,都在 `.layout-dashboard` 的覆盖清单里,走 S3)、1 个空头名字(同族的 `-line-height`,全仓无定义点,走 S2)、2 个裸字面量(其中正文色值等于一个 `--mc-color-*` 档位的值却被直写,走 S4)。同族四个名字里三真一空,**这就是为什么落点必须逐个量查、不能按前缀家族推断**。<br>S3 的两条差异轴各有实例:布局形态轴见 `.page-content.layout-dashboard` 的 30 个覆盖(`PATTERN-STYLE-2`);视口轴见 `ProgressRing.svelte` 的 16 处引用,默认值在自己的回退位、窄视口档在 `MetricCard.svelte` 的 `@media` 里(`STYLE-11`) |
| 违例判定 | ① `static` 针写成 token 匹配,而该名字在 `STYLE-9` 的空头清单里,或该文件在 `STYLE-10` 的零 token 清单里——恒红,违例。<br>② 针匹配了 `var()` 的消费点却声称验的是数值——消费点看不到值,数值在定义点或回退位。<br>③ S3 的量有多个定义点却只写一个针而没说是哪一档——另一档必然不匹配。<br>④ 针的期望值来自设计稿或档位命名而没在目标文件里检索确认过落点 |

**S4 的默认落点表**(先验概率,不免除「开文件确认」那一步):

| 视觉量 | 走 token 比例 | 默认落点 | 动作 |
| --- | --- | --- | --- |
| 字重 | 6% | 字面量 | 直接匹配字面量 |
| 内边距 / 外边距 / 间距 | 12% | 字面量 | 直接匹配字面量 |
| 字号 | 12% | 字面量 | 直接匹配字面量 |
| 宽高 / 定位 | 17% | 字面量 | 直接匹配字面量 |
| 行高 | 19% | 字面量 | 直接匹配,但**先过 S2**——空头名字里就有一个 `-line-height` |
| 边框 | 22% | 混合 | **必须开文件确认** |
| 圆角 | 31% | 混合 | **必须开文件确认** |
| 阴影 | 35% | 混合 | **必须开文件确认** |
| 色值 / 背景 | 36% | 混合 | **必须开文件确认**。**值相同不能推断落点**——调色板 24 个值里 14 个同时被直写,同一个色值在一个文件里是 token、在另一个文件里是字面量 |
