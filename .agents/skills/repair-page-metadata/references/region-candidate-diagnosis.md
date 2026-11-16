# IOC Region 候选拒绝

用实际加载的页面、报错数据源 ID 和 URL 查询串复现。需要对照时仅把旧 `region=值` 换成显式层级参数，例如 `rep-office=值`。

```sh
pnpm exec tsx .agents/skills/repair-page-metadata/scripts/diagnose-region-candidates.ts \
  pages/temporary/business-result-pinned-diagnosis-20261102/business-result-metrics.json \
  --source cloud-service-options --search 'mtime=month:2026-10&region=安徽代表处'
```

回执包含页面哈希、相关数据源和筛选 ID、解析阶段及已知层级。裸 `region` 的 `region-candidate-resolution/pending` 表示当前解析要等待各层候选。显式层级的 `region-candidate-validation/unobserved` 表示 URL 已确定层级，候选校验仍需证据。

已有同一筛选上下文的候选回执时，加 `--region-receipts <file.json>` 本地重放。文件按层级 ID 索引，例如 `{"geo":{"status":"ready","candidates":[{"level":"geo","value":"全球","label":"全球"}]},"office":{"status":"loading"}}`。缺失层级保持未观测。各层完成后，裸值可能得到 `resolved` 或 `rejected`。回执只输出状态、层级和固定诊断信息。

命令运行当前检出的解析逻辑，`dqeRequest` 为 `not-observed`。实际部署版本、当前授权候选和 DQE 是否发出，使用目标浏览器的请求记录核对。若日志给出的数据源未声明 Region 依赖，沿实际请求与其他筛选继续定位。
