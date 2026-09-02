# MetricCanvas Authoring Bundle

自包含的 MetricCanvas 创作期迁移单元。S0/S1 已完成：包含唯一 Skill、锁定依赖、FastMCP stdio 入口、中立契约导出物和独立验收。S2 已开始：页面构建规格、Python 契约消费层和三个语义 Port/Fake 已落盘；确定性装配算法按 [`docs/plan/metriccanvas-authoring-bundle.md`](../docs/plan/metriccanvas-authoring-bundle.md) 继续迁移。

## 验收

```bash
python3 -m pip install --require-hashes -r requirements.lock
python3 scripts/check_bundle.py
python3 -m unittest discover -s tests -p 'test_*.py'
```

根仓另提供 `pnpm authoring:contracts:check` 检查 TypeScript 真源与 Bundle 导出物是否漂移。Bundle 自身运行不依赖 Node、pnpm workspace 包或真实 Relay/Java/DQE。
