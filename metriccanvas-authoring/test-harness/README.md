# 创作验证入口

`pnpm authoring:test` 使用 `run_tests.py`，默认运行全部层，不按环境隐式跳过测试。CI 的 `pnpm authoring:check` 消费同一入口。直接 `unittest discover` 仍可使用；测试文件名与共享夹具导入路径保持不变。

| 层 | 判据 | 内容 |
|---|---|---|
| rules | 不通过 MCP/HTTP/存储交付，主要断言纯规则 | 页面契约、组件与布局、编辑、字段映射 |
| adapters | 断言外部协议或存储边界 | Lab/DQE/Java HTTP、Relay 基线、SQLite |
| delivery | 验证用例组合、状态、程序/模型通道或安装入口 | compose/edit、MCP/stdio、参数程序、重启、Skill、打包 |
| evaluation | 验证模型评测框架和证据隔离 | 模型 runner 契约、本地场景及可信通道隔离 |

混合测试按其最外层验收边界归类，不把其中的本地替身描述成生产证据。每个测试文件在 `test-layers.json` 恰好出现一次；新文件漏登记、删除后仍登记、重复归类都会阻止运行。分类是显式清单，不依赖文件名猜测。

```sh
python3 metriccanvas-authoring/test-harness/run_tests.py --check
python3 metriccanvas-authoring/test-harness/run_tests.py --layer rules
python3 metriccanvas-authoring/test-harness/run_tests.py --layer adapters --layer delivery
pnpm authoring:test
```

`evaluation` 层测试的是框架；真实模型请求仍由 `model-evals/README.md` 的独立命令发起。`model-evals/evidence/` 与 `history/` 是特定运行的证据，不能用旧记录证明本次成功。`fixtures/` 为本地契约输入。

目录根的 `stdio_*.py` 是交付测试夹具，浏览器入口为 `*.mjs`；它们不是生产入口，也不代替真实 Relay/Java 验收。需要端口、浏览器、模型或外部服务的命令必须在具备对应能力的环境运行；不能将排除后的绿色结果描述为完整门禁通过。
