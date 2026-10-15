# 独立本地创作 Skill 的维护

维护 `metriccanvas-local-authoring` 时读取本页。分发实体是 `metriccanvas-authoring/skill/metriccanvas-local-authoring/`；仓内发现入口 `.agents/skills/metriccanvas-local-authoring` 指向该实体目录。安装复制完整实体，内部知识路径必须闭合。

所有新功能的场景、页面元数据文档和本 Skill 同步均按[新功能验收要求](feature-acceptance.md)执行，为同批必选完成项。

安装副本附有[维护说明](../../metriccanvas-authoring/skill/metriccanvas-local-authoring/references/maintenance.md)，只使用自身目录。下面的仓库路径与命令属于维护流程，不是 Skill 使用者的运行依赖。

## 修改入口

| 改动 | 真源 |
|---|---|
| 触发条件、流程、数据口径复核、布局及地图说明 | Skill 的 SKILL.md 和作者维护的 references/*.md |
| 尝试快照 | Skill 的 scripts/snapshot-attempt.mjs |
| 页面字段、约束、校验 | packages/page/src/ 及合法/非法夹具；涉及公共协议时按产品契约流程同步 |
| 协议语义正文、示例路由 | docs/page-metadata/ 与 tools/scripts/page-reference.ts |
| 通用概览完整样例 | tools/scripts/local-authoring-overview-example.ts；使用当前写出版本并重新校验 |
| 目录封闭、参考净化与校验器打包 | tools/scripts/local-authoring-projection.ts、local-authoring-validator.ts |
| 实际地图地名 | 产品底图，经导出器投影；保留源摘要，移除仓库路径 |
| 注册与分发 | metriccanvas-authoring/bundle.json、scripts/check_bundle.py |

生成范围由导出器管理：references/page-metadata/、references/map-regions.json、references/knowledge.json、assets/layouts/overview-map-led.json、scripts/validate-page.mjs、scripts/THIRD-PARTY-LICENSES.md。其他文件归作者维护，重新生成必须保留。真源映射总表见[真源与派生链](../../metriccanvas-authoring/SOURCES.md)。

## 更新与交付

先确认实际产品版本；混合工作区中在独立检出承接本次改动，再从该检出的产品真源生成。不能把其他任务未提交的 Schema 或组件知识散入安装包。

```sh
pnpm install --frozen-lockfile
pnpm authoring:contracts
pnpm authoring:contracts:check
python3 metriccanvas-authoring/scripts/check_bundle.py
pnpm exec vitest run tests/local-authoring-skill.test.ts tests/page-reference.test.ts tests/authoring-export-isolation.test.ts
pnpm exec tsc --noEmit -p tests/tsconfig.json
pnpm authoring:test
```

Python 测试需要 Bundle 锁定依赖；使用已装依赖的环境执行，不能把缺依赖当成产品失败。独立安装运行校验只需 Node.js 22+，无需上述维护工具链。

检查生成差异、第三方许可证、注册入口及完整目录链接闭合。tests/local-authoring-skill.test.ts 会复制实体至临时位置，核对生成哈希、短片段/完整样例、快照与产品契约向量的一致性；导出隔离测试验证生成漂移与作者文件保留。显式暂存本次真源和对应派生物，保持其他任务的源文件与本地证据不变。

## 行为复测

实质工作流变化以独立输入复测。先总结原始页面特征；模型仅取得冻结 Skill、需求、设计与原始数据，不取得旧页面JSON、预期答案或之前生成结果。独立期望值必须从输入程序化计算，特别记录分组分子/分母、百分刻度、零分母和未知值。

保留模型版本、提示词、输入/知识哈希、原始尝试、校验回执与实际使用的作者说明版本。浏览器检查宽/窄屏、最终显示文字、地图地域命中、Tab、排序、筛选状态和导航值。静态成功、控制状态变化与真实数据变化分别判定；真实DS复验另按[模型验收流程](skill-ds-model-acceptance.md)执行。

项目概览的历史复测见[问题与改进](../evidence/local-authoring-ioc-overview/improvements.md)：布局和结构改善，完整业务/视觉验收仍失败；后续文档追加不能改写历史结论。记录所用知识版本与当前分发版本的差异，不能用过去模型测试替当前版本背书。

升级与回退均交付完整Skill目录，重新核对版本、哈希及用户页面。Skill内知识清单覆盖生成文件；作者文件随完整目录/仓库提交版本保存，Bundle锁覆盖所有分发文件。
