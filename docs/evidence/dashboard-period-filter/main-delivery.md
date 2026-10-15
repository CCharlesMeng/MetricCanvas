# Dashboard 期间筛选 main 交付

2026-10-15。用户已明确授权提交并 push main。本次在独立工作区先从 `0311c2541089af9472349a559c6b579ab88bb15b` 承接期间筛选，交付前再同步到最新 `origin/main=b57fff40da91a2f7341bf0fd3dd2e88d80cf36ff`，保留 main 已有 PDF 功能及当前 Schema 6.28；期间选择能力的版本下限仍为 6.27。

## 交付范围

- 期间选择、共享 DatePicker 年季扩展、FilterBar 接入、范围与模式状态、参数初始化、查询与导出范围、人工及 Python 创作。
- 四个完整验收页面、八个合法协议夹具、拒绝向量、文档与原型及本次验收证据。
- 在该基线上重新生成产品契约、本地 Skill 知识、独立校验器和哈希清单，不复制旧工作区的派生文件。
- 新基线规范化 6.27 页面会写出 6.28，已同步对应断言；保留随后由 main 的 b57fff40 补齐的 PDF 字段参考注释、拒绝向量和独立 Skill 预检，不覆盖为旧产物。
- 未带入原工作区的图表独立筛选、自定义组件等其他未提交功能，未修改原工作区源码或暂存区。

## 本地复验

- `pnpm install --frozen-lockfile --strict-peer-dependencies` 通过。
- `pnpm check` 通过，全部工作区类型检查完成；Svelte 为 0 error / 0 warning。
- `pnpm build` 通过，六包构建、embed 及 Platform 构建完成。
- `pnpm authoring:contracts`、`pnpm authoring:contracts:check` 通过，711 product / 4 authoring / 1 interface 产物。
- `python3 metriccanvas-authoring/scripts/check_bundle.py`：2589 digest checks 通过。
- 公共 API 快照测试 8 项通过。
- Python rules：156 项通过，包含期间 add/update 及原查询聚合保持。
- UI Chrome：22 项通过；在本次工作区独立 4192 端口验证，未复用原工作区服务。
- embed Chrome 期间场景：3 项通过；在本次工作区独立 4197 端口验证，读取正式 pages 并使用合成 DQE 响应。
- `canonical-writers.test.ts` 修正 6.27 允许及规范化预期后 2 项通过。

本次并行运行完整测试与构建时，独立 Skill 复制两例触及默认 5 秒超时；单独以 `--testTimeout=30000` 复跑相关两个文件，18 项全部通过。未更改测试断言或仓库默认超时。完整测试、提交、远端及 CI 的最终结论由执行回执与最终回复给出。运行日志位于本机 `/tmp/dashboard-period-delivery-*.log`。

## 基线失败与证据边界

上游 `cbf9c35b` 的 CI [38743812426](https://github.com/CCharlesMeng/MetricCanvas/actions/runs/38743812426) 已失败。其测试包含 `page-id-neutrality` 对 `report-pdf-export` 的名称冲突，以及 PDF 字段参考注释缺失导致的生成隔离检查失败。这两类问题已由新 main 的 b57fff40 修复，本次同步后重跑检查，不通过放宽中立性规则掩盖。

原混合工作区的 SDT、旧类型和临时 PDF 样例失败仅是历史实施记录，不当作这个新基线的当前失败。真实 DQE／Relay／Java、真实 DS 模型和部署未验证；Edge 本机未安装，浏览器本地结果限 Chrome。此前安装包验证属于旧源码树，未冒充本次基线的安装包完整矩阵。
