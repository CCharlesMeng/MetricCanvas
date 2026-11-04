# 共享用数关联与受控换源

打开 Playground 的 `/pages/authoring-analysis-rebind`。两张表共享 `sales`，都显示 CN=10.00、EU=20.00；独立对照表显示 CONTROL=999.00。所有行均为合成数据。页面显式使用 Dashboard，不包含创作报告或中间状态字段。

本地演示使用独立 Skill 的 Node 工具目录，不依赖 Python、仓库内运行时包或外部查询服务。在仓库根目录执行，替换 `--tools` 为实际已安装的 Skill `scripts` 目录，`--out-dir` 必须尚不存在：

```sh
node tools/fixtures/local-authoring-association/run-demo.mjs \
  --tools /absolute/path/to/metriccanvas-local-authoring/scripts \
  --page pages/capabilities/authoring/analysis-rebind/authoring-analysis-rebind.json \
  --out-dir /tmp/authoring-analysis-rebind-demo
```

脚本先按完整原始字节建立报告，再显式提交需求、现有 `DataRequest`、结果记录和关联。虽只选 `sales-main` 阅读，报告仍覆盖 `sales-shared` 和独立对照。合成结果 CN=30.5、EU=40.25 用于核对普通换源，候选保留两个共享消费者的全部章节、列、格式与布局，独立来源保持。结果行不会写入报告或候选 `initial`；没有真实服务时候选查询不声称已执行。

输出目录包含 `draft-result.json`、`linked-result.json`、`candidate-result.json`、`candidate-page.json`、`duplicate-key-result.json` 及相应显式输入。检查最后一个失败结果：重复区域行键必须返回 `document: null`。脚本同时断言源文件字节未变、候选章节和独立来源未改。候选仅保存在新建演示目录，供审查，不写回原页。

原始文件摘要包含空白；同一页面 ID 的新字节、工作副本版本/绑定、材料、Schema 或用数位置变化都会使旧关联失效。图表或表格重排可保留语义 `useId`，当前 JSON pointer 仍重新核对。Node 定向测试覆盖这些拒绝边界，以及共享消费者篡改、辅助槽行键、独立置顶汇总、字段契约、粒度、周期、筛选和参数变化。

本场景证明本地合成页面呈现与纯产品候选生成。真实结果查找、权限、CAS、Java 保存、CI、部署和真实 Relay 接入需各自验收。详细操作边界见 [创作分析关联与受控换源](../../../../docs/page-metadata/authoring-analysis-rebind.md)。
