# Main交付检出与本地预检

2026-10-12，本轮以origin/main基线8d1c4635fa8b12254c53a506d4fac2644679d25b创建独立检出，使用实施前字节与当前字节的差分提取级联改动。未携带同文件内另一批allMissing改动、IOC页面改动、日期控件样式改动、图表改动或ADR-0098；生成契约在独立检出从源重新生成，没有拷贝混合工作区的锁文件。

独立[使用文档](../../cascading-queries.md)补齐定义、完整双源声明、原始查询和计算阶段、集合上限、完整性、空集/失败、刷新与导出逻辑。文档中的完整dataSources片段已放入合法页面夹具校验通过，仓内链接有效。页面协议索引同步至6.14，并注册该文档入口。

| 检查 | 交付检出结果 |
| --- | --- |
| pnpm test | 192个文件通过，1700项通过、4项跳过；全量检查修正内部导出快照和未来版本错误用例 |
| Python完整harness | 523项，522通过、1跳过；使用已有Python3.12虚拟环境；未调用真实模型 |
| pnpm check | 全仓类型与Svelte检查通过，0错误0警告 |
| pnpm build | 产品包、embed和platform构建通过 |
| platform pack:microfrontend / packages:check | 通过 |
| authoring:contracts / check / check_bundle.py | 548 product、4 authoring、1 interface；1772 digest checks通过 |
| 复杂度检查 | 15文件351函数，最大15，超限0 |
| pnpm validate | 干净交付检出14个页面全部通过；未包含混合工作区的独立日期示例 |
| adr:index:check / git diff --check | 通过 |

原混合工作区的浏览器、HTTP及导出证明保留于[result.md](result.md)，两种检出的测试数量分别记录，不重写历史结果。组件和查询链路使用同一实现，交付检出以完整测试、字段/契约校验和构建再次验证。

本文记录提交前本地预检；提交、远端SHA与CI结论以本次交付回复和Git记录为准。真实DQE、DS、Relay/Java集成及生产部署没有执行。全部文件按明确allowlist提交，原工作区其他文件和历史worktree保留。

原始DOM及工具输出保留行尾空白和末尾空行，目录内.gitattributes仅对捕获的txt留痕关闭空白判错，不修改证据字节；代码、JSON与文档仍按普通差分检查。
