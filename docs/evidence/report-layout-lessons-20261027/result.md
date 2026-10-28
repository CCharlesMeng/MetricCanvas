# 服务运营月报布局迭代与创作经验沉淀

本轮由用户对最终页面反馈“好多了”后，要求回顾历程并沉淀到创作Skill，且能作为mc-content的一部分。范围为创作参考、读取路由及其同源生成物；不改页面Schema、运行时或compose_page装配支持面。最终页面仍是此前的inline合成数据页面。

## 这次为什么绕了几轮

| 迭代 | 实际处理 | 暴露的问题与结论 |
|---|---|---|
| 初稿 | 采用已审核的信息组合，团队、趋势、客户、阶段和构成均有内容 | 信息归属大体正确，实际卡高、字号、留白与背景边界仍未达到预期；结构合法不能代表创作完成 |
| 阅读面重组 | 用整章白色容器聚合内容，去掉偏小的构成图，数值使用紧凑文字排布 | 把密度放在表达任务之前，用户需要的精确表格和构成图被弱化；整章白面也掩盖了独立主题边界 |
| 加强分隔 | 改用panel及内部横竖分隔线 | 回答的是“线不够明显”，而用户真正需要的是“不同信息组有各自卡面”；章节和卡片的层级没有分清 |
| 恢复组件 | 月度值恢复真实table，构成恢复饼图及原生表格式图例 | 表达方式更合适，但仍被包在共享外壳中，主题边界依然依赖内部分隔线 |
| 外层独立卡片 | plain分区放章节标题；团队、趋势、月度表、两个饼图各自成卡；客户与阶段各一张宽表卡 | 用背景与间距分出主题，保留卡内数据关系。用户反馈“好多了”，是本案例目前的视觉认可依据 |

前几轮并非都缺少组件能力。真正的决策错误是把容器当装饰、把分割理解成加线，以及为消除空白而改变了读者需要的表达。现有创作参考已经强调关系就近和能力核对，本轮补足表达选型、卡面边界及反馈诊断，而非把所有问题归结为缺文档。

## 沉淀的位置与原则

唯一维护正文为[PC Report章节组合](../../../tools/mc-content/layouts/report-composition.md)。本轮在既有正文增补“先选表达，再定卡面边界”，调整C4-A／C4-B对饼图、环图与明细方向的描述，并扩充实际预览的完成核对。

可复用的判断包括：精确核对用真实表格；构成份额在数据完整、分母可信时用图形并保留数量和占比；同一对象的主值与变化同卡；独立主题用独立卡面；章节只表达阅读顺序，不必等于一张大卡；背景和间距承担主题边界，表格行线与图表网格继续服务读数。

规则保留替换条件：连续正文可以共用整章阅读面；阶段横向比较继续使用一张分组表头表；类别很多或主要比较大小时使用条形图／表格；只有精确核对用途时可省图。案例的蓝底、两团队、五主题、span和卡片数量不成为通用模板，也不新增保存或发布门禁。

实现提示覆盖plain与分区card／panel的层次、组合卡的组件级边界、metricGrid的内容高度、普通table自身卡面与reportCompact的用途、原生饼图图例的实际方向，以及组合卡子组件准入限制。具体属性和工具能力仍从当前协议读取。

## 创作入口与分发

| 消费方 | 入口与结果 |
|---|---|
| mc-content | `query_content('layout', 'report-composition')`；`layout/report`澄清省略容器的panel是工具默认，不等于所有章节应统一套panel |
| 本地创作Skill | SKILL任务表新增已确认Report的区域／背景／卡片调整路由；report-patterns在此类反馈时触发读取同源正文 |
| Platform兼容参考 | 随现有生成链投影同一正文和report基线，不维护第二份经验规则 |

本地创作Skill升版 **1.4.0 → 1.4.1**，属于兼容说明纠正；页面写出版本仍为 **6.69**。正文从tools/mc-content生成到MC、Platform和本地Skill三个消费位置，禁止直接修补生成副本。安装时仍整体替换目录。

## 案例与证据

- [最终页面](http://localhost:5173/pages/service-operations-report-202609-structured)，由当前工作区5173服务提供。
- [最终页面及验收说明](../../../pages/temporary/report-layout-structure-20261027-qtlle05j/README.md)；[1440截图](../../../pages/temporary/report-layout-structure-20261027-qtlle05j/outer-cards-1440-full.png)、[1280截图](../../../pages/temporary/report-layout-structure-20261027-qtlle05j/outer-cards-1280-full.png)。
- [初稿验收](../../../pages/temporary/report-layout-acceptance-20261027-qtlle05j/README.md)、[阅读面重组](../../../pages/temporary/report-layout-refinement-20261027-qtlle05j/README.md)。
- 中间的panel／分隔线、恢复表格及饼图、外层独立卡片的修改前后快照分别保留于`/tmp/report-layout-structure-20261027-qtlle05j`、`/tmp/report-layout-charts-20261027-qtlle05j`、`/tmp/report-layout-outer-cards-20261027-qtlle05j`。

最终页面此前完成1440／1280实际CSS视口检查，无横向溢出；6个dataSources与修改前深比较一致；真实表格行数6／6／2，饼图图例行数3／2。此次沉淀不改该页面，不将此前浏览器结果冒称为新Skill独立生成复测。

本轮实施先在`/Users/moon/.codex/worktrees/report-layout-lessons/DataDashboard`隔离检出进行，以前轮已审核的Report内容改动为基线；同步到当前工作区前对相关文件进行SHA256冲突核对。仅同步本轮4个作者文件及其生成参考，包身份、知识清单、锁和诊断从当前工作区重新生成，保留并行改动。原始日志与同步清单位于`/tmp/report-layout-lessons-20261027`。

## 验证与边界

| 检查 | 结果 |
|---|---|
| authoring:contracts及contracts:check | 当前目录生成成功，1256项产品、4项创作、1项接口文件，最终漂移检查通过 |
| mc:content:check | 隔离检出及当前目录均完整通过，含来源覆盖、33项MC回归及诊断夹具检查 |
| Skill quick_validate | 有效；使用项目Python环境补足默认Python缺失的yaml依赖 |
| tests/tsconfig.json TypeScript检查 | 退出0 |
| Bundle摘要 | 最终通过6165项检查 |
| 本文四份同源正文 | 作者源、MC、Platform、本地Skill逐字节一致，11201字节；SHA256为`aeca0bef66c5936b253999bb2795ebef489f73d3c29aacc7d21c1a2150553faa` |
| 仓外本地Skill | 692个文件与当前安装实体逐字节一致，独立Node校验器验证当前月报通过 |
| 仓外MC | 独立包解包后verify通过；查询layout/report-composition完整返回且未截断，与作者正文一致 |
| authoring:check | 隔离检出6个测试文件、219项全部通过，耗时804.38秒，含生成隔离、知识闭合、旧页迁移及仓外校验 |

本次修改仅涉及Markdown、版本元数据及派生身份／锁文件，不新增可执行分支，无产品函数新增或修改，复杂度测量不适用。

首次MC检查发现改写C4-A时遗漏了原有“小环图不独占通栏”提示，保留该约束并从真源重新生成后完整通过。当前目录检查另发现Finder生成的`pages/temporary/.DS_Store`在生成后变化，污染输入身份；将该缓存可恢复地移至证据目录，再生成并检查通过，未修改身份生成器或放宽校验。首次缺失父目录的归档未产生输出，建立目录后完成独立打包。

## 当前分发身份

- 本地Skill：**1.4.1**；MC内容版本：`1-972222e3488e9c2c`。
- MC内容SHA256：`972222e3488e9c2c16f63073615df55c9b71fe0b617b8fc79a3fd2a5e037e8ac`。
- 独立包：`/tmp/report-layout-lessons-20261027/final/mc-content.tar.gz`；归档SHA256：`dba75396826c5ec67399a2a3b034c4b1b5267c14d1da8a80d6b98f1e4cbdd6fc`，相邻release.json记录来源身份。
- Git基线：`9ee7e6ac611e5651046dde16f9b5fc44dc0974b1`。工作区未提交，隔离检出与当前目录因页面输入集合不同，MC内容身份不同；当前分发以本节身份为准。

本轮不提交推送、不更新Codex记忆、不调用真实DS／DQE／Relay，也不宣称已完成部署或证明后续创作稳定性。

本轮新建隔离检出在验证完成后归档，保留可恢复Git快照；前轮report-layout-mc-content检出及其他任务工作树保持原状。当前工作区保留本轮文件和完整分发内容。
