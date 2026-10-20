# IOC 公共页头 Playground 优化验收

日期：2026-10-20。实施基线：`97e87e11df51a2e724db48515e55f827933a2c29`，隔离工作区 `codex/ioc-header-catalog`；实施验证时尚未提交；用户随后授权提交并合入 main，交付验证见下文。唯一主计划见 [§25](../../plan/2026-10-16-ioc-header-feature-plan.md#25-playground-展示与能力索引优化2026-10-20)。

## 使用入口与结果

- Playground 首页：选择“IOC 公共页头”能力，可与功能演示、布局、运行条件及搜索组合。原 `/#group-ioc-header` 保留，15 个场景收拢成一张集合卡片；匹配数量仍按场景统计。
- `/ioc-header`：常用完整组合，以及时间、业务条件、币种金额、跨页传值四个专题。具体场景在入口内切换，仍可新标签页访问原始页面和配置。演示窗口隐藏重复的试验场导航与指南，使用原产品运行时。
- `/ioc-header?view=capabilities`：32 项归并的使用能力，默认可见；每项有状态、用途、适用条件、规划编号、演示链接。未实施项单列；所有 88 个规划编号完整且唯一映射，不把规划数量解释为已完成数量。
- 主入口的 topic/scene/view 写入 URL，支持刷新、前进/后退和直接链接；非法场景回到合法选项。这是试验场导航，不是业务来源视图恢复。

## 首轮本地验证（实施基线）

| 验证 | 命令或证据 | 结果 |
|---|---|---|
| 单元与目录规则 | `pnpm test apps/playground/tests` | 13 文件、60 测试通过，含 88 项编号完整性、集合筛选、场景覆盖、合成输入边界和实例隔离 |
| 类型与 Svelte | `pnpm --filter playground check` | 0 errors、0 warnings，测试 TypeScript 通过 |
| 静态构建 | `pnpm build:playground` | 通过，adapter-static 写出 build |
| 创作知识一致性 | `pnpm authoring:contracts:check` | current：915 product、4 authoring、1 interface 文件 |
| 差异与保护 | `git diff --check`，原工作区 status 字节比较 | 通过；原工作区状态未变 |

本轮只改变开发工具信息结构和合成输入。原始 15 份页面 JSON、产品 Schema、协议文档及 local-authoring 生成规则未改；没有新产品字段需要导出或安装。知识生成一致性通过；未重复进行与本轮无关的 Skill 独立安装或真实模型验证。

## 浏览器验证

启动 `pnpm --filter playground dev --host 127.0.0.1 --port 4220 --strictPort`，执行：

```sh
PLAYGROUND_BASE_URL=http://127.0.0.1:4220 node apps/playground/tests/ioc-header-showcase-browser.mjs /tmp/ioc-header-hub-main-browser
PLAYGROUND_BASE_URL=http://127.0.0.1:4220 node apps/playground/tests/page-catalog-browser.mjs /tmp/ioc-header-hub-main-catalog
```

[页头结果](browser-result.json)：15 个实际场景通过；能力筛选及 ISO 周关键词能进入对应场景；能力索引能按 T08 搜索并链接演示；日/月/ISO 周真实控件与合成回显同步；人民币/美元静态字段和金额范围确认后过滤正确；地区部切换代表处后查询字段正确变为 office_code；概览→清单→详情实际跳转及详情单月修改正常；刷新/后退保持专题选择；390px 外框与演示窗口无横向溢出。浏览器错误为 0，外部 POST 查询为 0。

[目录回归](catalog-browser-result.json)：54 个页面、116 处配置片段、下载 JSON 和相关页面链接通过，桌面与 390px 布局通过，浏览器错误为 0。浏览器结果从同一源文件读取页面，不替换页面声明；只注入明确标注的试验场合成输入。

截图位于命令输出目录：`time-desktop.png`、`capabilities-desktop.png`、`capabilities-mobile.png`、`interactive-mobile.png`，已检查桌面与移动布局。临时目录截图不作为持久产品资产，命令可重新生成。

## 数据与验证边界

仅目录标记 `externalInputs: ioc-header` 的页面取得内置合成查询、候选、固定期间事实。查询复用产品 DQE 适配器，候选复用现有类型端口；未知查询/维度明确拒绝，无真实网络回退。展示时注明“内置合成数据”，固定 latest=2026-10、latestComplete=2026-09；业务语义仍由各页面查询和绑定决定。

未改变年季月/之前12完整月、详情单月、不连续月份、货币静态字段或跨页显式映射语义。未批量迁移 IOC 业务页；来源视图恢复仍未选，B6 可选操作继续挂起。未启动真实 DQE、CloudIOC、Relay、门户或业务授权服务；这些以及 CI/CD、部署、真实模型均为 **NOT_RUN**，不能由内置合成演示代替验收。

## 合入最新 main 后复验

用户授权后先提交范围内 18 个文件，再衔接 `fa61a03cb24f490ce0c5b3377622d9fdc614c749` 的 main。保留目录返回筛选及滚动恢复、6.41 统一页头、6.42 表格字段搜索和 Select 箭头修复。两份文档的同位置追加内容均保留；原主计划的统一页头结论为 §24，本轮展示结论顺延为 §25。能力文案同步显示上游已有的行内/上下排、紧凑吸顶、更多筛选及允许模式限制，没有新增产品契约。

- `pnpm test apps/playground/tests`：14 个文件、63 项通过。
- `pnpm --filter playground check`：0 errors、0 warnings；`pnpm build:playground` 通过。
- `pnpm authoring:contracts:check`：943 product、4 authoring、1 interface 文件 current。
- 页头浏览器：15 个场景、32 项索引、筛选后进入专题及返回目录保留关键词/能力选择、刷新/后退、区域层级切换、币种金额、跨页流程及 390px 布局通过。
- 全目录浏览器：54 个页面、116 处配置片段、下载和相关导航通过。按上游示例最新文案调整“只刷新”检索预期；移动端检查前显式重置恢复的目录条件，避免错误假定每次返回都是无筛选目录。
- [上游目录导航回归](catalog-navigation-result.json)：详情重载返回、滚动、独立历史条目、空结果/重置/相关导航、锚点、新标签及禁用存储场景均通过。命令为 `PLAYGROUND_BASE_URL=http://127.0.0.1:4220 node apps/playground/tests/catalog-navigation-browser.mjs /tmp/ioc-header-hub-main-navigation`。

本轮页面协议及 local-authoring 产物相对最新 main 仍无改动；原工作区并行内容继续保留。CI 最终结论在交付报告中单独核对，不将上述本地结果计作 CI 或真实服务验收。
