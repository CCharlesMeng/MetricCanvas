# IOC 页头顺序与 Playground 组件入口

2026-10-26。实施与隔离交付验收记录；远端 SHA 和 CI 结果以交付回执为准。

## 修改范围

- `ioc-header-demo` 的 `iocHeader.filterIds` 改为 `key, period, region, customer-type`，即重点国代、时间、Region、客户分类。
- Playground 原组件目录只读取正文 `componentCatalog`，根级 IOC 页头没有入口。开发工具补充 `iocHeader` 浏览条目，与原数据目录复用 `ioc-header` 场景；默认变体仍为经营概览。
- 文件目录按实际根声明识别 IOC 页头；配置区读取 `document.iocHeader`。产品正文组件类型与页面协议不变。
- 操作说明同步至页面目录 README、根 `pages/README.md` 和 Playground README。此次只有既有页面配置顺序及开发工具查找能力变化，没有页面协议或运行时能力变化，故不修改 `PAGE-METADATA.md`、协议知识和独立校验器；使用现有 local-authoring 校验器验收页面。页面与 README 属于 MC 来源输入，交付时从真源重生成来源摘要、内容版本及 Bundle 锁。

## 验证

- `pnpm exec vitest run apps/playground/tests/scenario-directory.test.ts apps/playground/tests/page-directory.test.ts apps/playground/tests/data-directory.test.ts apps/playground/tests/directory-navigation-state.test.ts`：4 文件、21 项通过。
- `pnpm --filter playground check`：0 错误、0 警告，测试 TypeScript 检查通过。
- `node .agents/skills/metriccanvas-local-authoring/scripts/validate-page.mjs --expected-layout dashboard pages/capabilities/ioc-header/business/ioc-header-demo.json`：`ok: true`。
- `git diff --check`：通过。
- 实际浏览器 `http://localhost:5173`：首页点击“IOC 页头”进入 `/catalog/components/iocHeader`，显示经营概览；当前组件配置包含根级 `filterIds`；iframe 与独立页面均按新顺序呈现。
- 1440px 下重点国代、时间、Region 的横坐标依次为 204、328、770px；`?back=1` 的返回按钮可见。
- 勾选重点国代并切季度后，签约额显示 39,960；390px 下顺序保持，等待图表响应式重排后页面宽度为 390px。第一次脚本在 resize 后立即读取，曾观测到重排前旧画布宽度；改为等待实际布局稳定后通过，未修改运行时。
- `/files` 组件类型选择“IOC 页头”并搜索 `ioc-header-demo`，仅显示目标页面；浏览器无页面异常。
- 本地临时证据：`/tmp/ioc-header-directory-browser.json`、`/tmp/ioc-header-directory-after.png`、`/tmp/ioc-header-order-after.png`。均为合成数据，不涉及真实 IOC/DQE/Relay 验收。

## 复杂度

同一测量器 `metriccanvas-ts-ast/1`、TypeScript 5.9.3，比较自身 `selfCC`，嵌套回调独立计数。

| 修改函数 | 修改前 | 修改后 |
| --- | ---: | ---: |
| `directoryTopics` | 3 | 3 |
| `sceneSearchText` | 1 | 1 |
| `sceneRelations` | 1 | 1 |
| `pageEntry` | 7 | 8 |
| `componentConfiguration` | 2 | 3 |

测量包括 `scenarios/components.ts`、以上三个函数文件及修改的两份测试，全部函数（含回调）自身 CC ≤ 9，无本次未关闭超限项。浏览目录注册为声明数据，没有新增辅助函数；Svelte 只调整导入与已有页脚数量表达式，没有修改脚本函数或增加模板分支。

前后完整临时结果：`/tmp/ioc-header-directory-complexity-before.json`、`/tmp/ioc-header-directory-complexity-after.json`。

## 隔离交付复验

- 交付工作树：`/Users/moon/.codex/worktrees/ioc-header-directory-delivery/DataDashboard`，起始基线 `9263fb54b03667cb4eb3682f967f28deda0e14c7`，并入最新 main 后基线为 `a812e94021241c79369a4cbce4dd91738c5672ad`；显式范围为 20 个文件（含 3 个派生清单与 4 个生成诊断/场景产物）。保留基线已有 `multi-source-table` 推荐场景和其他页面说明；原工作区不做覆盖或暂存。
- 使用 `pnpm install --offline --frozen-lockfile --ignore-scripts` 安装锁定依赖；锁文件未变化。
- 按项目入口重新运行 `pnpm test`，上述 4 文件、21 项通过；`pnpm --filter playground check` 0 错误、0 警告；`pnpm build:playground` 静态构建通过。
- 在隔离工作树的 `http://127.0.0.1:5283` 复验组件入口、根配置、重点与季度联动、390px 布局和文件组件筛选，全部通过，0 页面异常；证据 `/tmp/ioc-header-delivery-browser.json`。
- 同口径重测 134 个函数（含回调），最大自身 CC 为 9；相关函数前后值与上表一致。完整结果 `/tmp/ioc-header-delivery-complexity.json`。

- 初次契约检查因系统 Python 缺少 `fastmcp` 未执行，切换至已有 `fastmcp 3.4.7` 验证环境后继续。检查识别出页面与 README 来源摘要需同步，已通过 `pnpm authoring:contracts` 生成 3 个必要派生文件；没有手写生成物或改变协议。

- 页面内容摘要变化会同步进入 MC 编译诊断中的 `contentSha256`，故通过 `mc-content-fixtures.py` 生成诊断证据。最新 main 新增的两个知识主题也同步到诊断页的来源覆盖数量（175→177），没有修改编译行为或另造业务示例。
- 仓外复制完整 local-authoring 实体，确认无符号链接，并对本次 Dashboard 页面执行独立校验，通过。

- 最终 `pnpm mc:content:check` 通过：契约无漂移、MC 来源覆盖通过、30 项 MC 测试通过、诊断与可观察场景夹具一致。生成器与检查使用已有锁定依赖环境，产品 Python 源码未改动。
