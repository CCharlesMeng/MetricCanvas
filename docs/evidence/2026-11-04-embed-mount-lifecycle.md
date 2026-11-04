# Embed 重复挂载交付验收

交付基线：`13ce48e7774957319e0e54c83a711226f16f10b8`，在独立工作树承接本次修改。未复制原混合工作区的分发配置、指标卡、查询或其他作者工作流改动；最新 main 的 URL 初始化和资源分发逻辑保留。

## 行为与范围

同一 DOM 元素再次调用 `mount(target, options)`，更新完整运行输入并返回原句柄，保持同一 Shadow DOM 根。新的 `onEvent` 替换旧回调，省略时清除；普通 `handle.update` 保留当前回调。不同容器独立，销毁可重复调用，旧句柄不能更新或销毁重挂载的新实例。读取配置失败不留下半挂载节点。容器仍须由一个生命周期所有者管理，组件卸载时显式 `destroy`。

公开函数签名不变，页面 Schema 字段净增减0。不新增创作配置。Skill 内容变化仅由测试源码摘要和分发锁关联触发，本地创作安装目录版本从1.22.0升至1.22.1。派生物全部从本交付检出的产品真源生成，不带入旧工作区清单。

页面与入口：

- `pages/capabilities/layout/embed-mount-lifecycle.json` 使用 dashboard、内联合成计数，无URL参数及外部服务依赖。
- Playground `/pages/embed-mount-lifecycle` 验证页面发现与初值1；本次实际浏览器地址为 `http://127.0.0.1:5197/pages/embed-mount-lifecycle`，无 pageerror。
- embed `/examples/mount-lifecycle.html` 读取同一JSON，连续挂载、计数变化、销毁和重新挂载均由浏览器验证；宿主 API 行为不从 Playground 的静态呈现推断。
- 页面元数据入口、集成应用契约、embed生命周期说明和页面目录索引同批更新。

## 本地检查

Python检查使用仓库锁定依赖的 `METRICCANVAS_PYTHON`，未对接真实模型。

| 检查 | 结果 |
| --- | --- |
| `pnpm --filter @metriccanvas/embed build` | 通过，16个JS，最大929901字节 |
| 构建及pack的 `check:dist` | 通过，入口、分块、独立图片引用闭合 |
| `pnpm --filter @metriccanvas/embed check` | 通过，Svelte 0错误、0警告，宿主测试类型通过 |
| `pnpm --filter @metriccanvas/embed exec playwright test --reporter=line` | 270项全部通过，1.4分钟；含ES/global、仓外复制、Webpack两种模式、懒加载导出、URL初始化和生命周期边界 |
| `pnpm validate pages` | 179个页面全部通过 |
| `pnpm test tests/local-authoring-tools.test.ts tests/local-authoring-row-expansion.test.ts tests/local-authoring-skill.test.ts tests/local-authoring-upgrade.test.ts tests/page-reference.test.ts` | 5文件、205项通过，含仓外安装、知识摘要、页面校验和升级 |
| `pnpm authoring:contracts:check` | 1454 product、5 authoring、1 interface文件一致 |
| `pnpm complexity:check` | 通过，全项目平均值及新增/增长超限门禁通过 |
| 实际 `pnpm pack` 并回读归档 | 全部dist文件与构建逐字节一致，16个JS均不超过1000000字节 |

本地候选归档 SHA-256：`032ccb93e740240a06edfe62c73ec4f986857371f63ebf38301d230225e8dcd4`。归档为工作区候选，不能代替正式发行版本、源码提交或宿主部署证据。完整复制dist时保留chunks、assets与package.json。

未追加历史Bundle、其他Skill或真实DS模型专项验收。远端CI结论以本次提交对应的GitHub运行记录为准；真实Angular宿主、DQE和Relay未部署或联调。

## 复杂度

口径：`metriccanvas-ts-ast/1`、TypeScript 5.9.3，独立计算自身圈复杂度selfCC，嵌套回调单列，不把外层工厂分数当作闭包总分。

| 修改或新增函数 | 修改前 | 修改后 |
| --- | ---: | ---: |
| mount | 3 | 3 |
| handle.update | 2 | 2 |
| handle.destroy | 2 | 2 |
| 原重复挂载测试evaluate回调 | 3 | 1 |
| 事件转发回调、挂载输入替换方法 | — | 各1 |
| 新增生命周期测试及全部嵌套回调 | — | 1–3 |
| HTML示例的showStatus、renderCanvas、destroyCanvas | — | 各1 |

HTML模块脚本独立提取测量；未用TS解析完整HTML宣称覆盖模板。相关修改函数未增长，全部新增函数不超过15，无本次复杂度遗留项。存量其他函数不属于本次重构范围。
