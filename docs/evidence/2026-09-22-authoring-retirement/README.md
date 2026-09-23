# Authoring 旧编排与旧保存链退役验收

2026-09-22。对应架构检视回复的第 1、2、3 项：旧编排残留、现行指标关系缺失、仍可触发的旧 Java 保存链。用户明确要求不做截图验证；本次没有调用截图或浏览器截图验收。真实 Relay 生产装配与元数据接口隔离属于原检视的其他问题，本次不声称已解决。

## 交付行为

- 平台 query_data 从可信 MetricRelationsPort 取得关系，验证版本/业务域并限定到本次查询的期间、度量字段与返回对象。完整关系与查询结果同轮次持久化；模型仅见有界投影与 relationCoverage。
- compose_page 和 add_result_component 使用精确 resultRef 对应的关系。服务重启后仍可消费，不在创建、编辑或保存时重新取得可能变化的关系。
- 缺关系、错误期间、伪造 evidenceRef 不会被放宽接受；相应组件失败且不触发保存。证据裁剪同步更新 complete/truncated。
- 普通问数 metriccanvas-authoring 默认仅 discovery + compose；compose 只交付临时产物。原 relay 环境配置保留有效，显式 compatibility 拒绝启动，旧 build_page 工具不再注册。
- 页面生成、字段映射、查询错误和布局验收迁至不保存的 create_compose_page；平台内部单次草稿保存、冲突、未知结果和预览恢复继续由现行平台测试覆盖。

## 已删除

12 个 Python 源文件：

- ask/build_page.py
- assets/ports.py（旧 PageAssetPort、SavedRevision 等）
- assets/java_save_fingerprint.py
- adapters/firstparty/java_page_assets.py
- data/structure_query_cache.py
- pages/composition/unified_composition.py
- pages/composition/structure_composition.py
- pages/composition/structure_preflight.py
- pages/composition/structure_scope.py
- pages/composition/structure_diagnostics.py
- pages/editing/unified_edit_page.py
- pages/editing/structure_revision.py

删除专属 add-data-component.schema.json、structure-revision.schema.json、authoring-composition-protocol.md，并清理导出清单、打包声明、旧装配、假保存提供方和脚本引用。

metric_relations.py 保留并迁入现行结果链，不再是旧编排的孤立支撑。page_structure / section_editing / 呈现规则、普通问数规则、平台公开导入委托与独立生命周期接口按现有职责保留。历史证据中的旧名称没有作为当前可执行引用恢复。

Python 主包从 113 个源文件、14,032 行变成 101 个源文件、13,013 行，净减少 1,019 物理行（含注释和空行）。该差值不把删除旧测试后重新迁入的新测试误算为功能减量。

## 验收

| 检查 | 结果 | 证据 |
|---|---|---|
| 修改前现行 MCP 关系回归 | 明确失败：三个卡片均 STRUCTURE_CHANGE_RELATION_UNVERIFIED | [失败记录](relations-before.log) |
| 修改后 Authoring 全量 | 402 项通过；51 个测试文件全部登记 | [日志](python-tests.log) |
| 现行结构验收 | 两次查询、三张卡、六个主指标行、六处变化绑定；页面合法 | [结果](structure-acceptance.json) |
| 全项目 pnpm test | 1,509 通过、1 项既有失败 | [日志](project-tests.log) |
| 全项目 pnpm check | 通过，Svelte 检查无错误/警告 | [日志](typecheck.log) |
| authoring:contracts:check | 510 产品、4 创作、1 接口文件 current | [日志](contracts.log) |
| check_bundle.py | 1,610 次摘要校验通过 | [日志](bundle.log) |
| sdist → wheel 构建 | 通过 | [日志](build.log) |
| 独立 wheel 启动 | 隔离目录消费内嵌契约；普通问数 2 工具、平台 9 工具；退役资产不在 wheel 内 | [结果](wheel-smoke.log) |
| git diff --check | 通过 | 执行退出码 0 |
| 截图、真实模型、生产服务联调 | 未执行 | 遵循本轮验收范围 |

全项目唯一失败是 apps/platform/tests/workbench/platform-shell-and-composer.test.ts 的“分析会话轨在所有工作台断点保持 480px 宽”：测试从组件源码读取 --analysis-rail-w，期待 ['480px']，当前得到 []。组件与测试均与本轮开始的 HEAD 完全相同，HEAD 同样没有该声明，见 [基线核对](existing-failure.json)。未修改该既有前端断言，也没有宣称全项目测试全绿。

最终格式整理后另运行关系、普通问数配置与迁移后的页面装配回归；行为检查仍通过。源码范围搜索没有发现对已删除 Python 模块的活动导入。文档和 Bundle 已同步更新。

## 可重跑命令

从仓根执行，Python 使用已装依赖的 tool/.venv：

```sh
PYTHONDONTWRITEBYTECODE=1 metriccanvas-authoring/tool/.venv/bin/python metriccanvas-authoring/test-harness/run_tests.py
pnpm test
pnpm check
pnpm authoring:contracts:check
python3 metriccanvas-authoring/scripts/check_bundle.py
PYTHONDONTWRITEBYTECODE=1 metriccanvas-authoring/tool/.venv/bin/python metriccanvas-authoring/test-harness/model-evals/run_structure_acceptance.py --output /tmp/authoring-structure-new-output
uv build --out-dir /tmp/authoring-new-dist metriccanvas-authoring/tool
```

结构验收输出目录必须是新目录。全项目测试会继续暴露上述独立的既有前端失败，直到其单独修复。
