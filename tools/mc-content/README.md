# MC 内容与布局能力

MC 提供完整资源、确定性脚本及检查结论。Skill 负责调用 Adapter、采用规则和流程编排；本包不新增保存或发布入口，不根据检查结果撤销现有保存。

作者维护源是 tools/mc-content；安装副本由 MC 导出器生成。旧 Platform Skill 中对应的事实参考属于兼容投影，随 MC 作者源生成；Skill 工作流与作者扩展保持各自归属。MC 事实和版本不再反向从 Skill 副本读取。

## 安装与整体替换

复制完整 mc-content 目录。运行环境为 Python 3.12+、Node.js 22+；Python 依赖见 scripts/requirements.txt。脚本只依赖本目录和明确安装的第三方库，不读取 MC 开发仓。Interface 版本、内容摘要、页面写出版本及当前可读范围分别记录，不能混为一个版本号。

```sh
python -m pip install -r /absolute/mc-content/scripts/requirements.txt
python /absolute/mc-content/scripts/mc_content.py verify
python /absolute/mc-content/scripts/mc_content.py query --topic version
python /absolute/mc-content/scripts/mc_content.py query --topic index --key tool
python /absolute/mc-content/scripts/mc_content.py query --topic tool --key compose_page
```

整包资源逐项校验摘要和文件集合。不要混装新脚本、旧快照或单独替换模板。接口不兼容、资源不完整时返回具体错误；采用或回退由调用方决定。Python 缓存不属于分发资源。

整包替换后，调用方新建调用进程或完整重新载入 Skill 脚本，使内存中的函数与磁盘资源来自同一版本。同轮固定内容摘要；调用 Adapter 的缓存以内容摘要区分，更新后重新建立检查声明。本包的 CLI 每次调用使用新进程，进程内重载属于调用方接线验收。

## 程序 Interface

将 scripts 加入调用程序的 Python 模块路径后，可从 mc_content 导入 query_content、compile_layout、inspect_assembly、inspect_schema、upgrade_page、evaluate。

- 查询受控 topic/key，索引可分页。单原子超预算时整体暂不返回并给 requiredBytes，不截断成貌似完整的工具契约。同轮缓存由 Adapter 决定。
- 编译输入为 templateRef、完整 plan、可选 userRequirements 与 targetVersions。输出 plan、调整、缺口及 inspectionSpec；plan 仍是现有 compose_page 的 request，检查声明不能夹带进去。
- targetVersions 可传入实际工具返回的版本。未提供时 deploymentAlignment=not_run，不声称已核对部署；不匹配时无法可靠编译并返回原因。
- inspect_assembly 接收完整 document 与对应 inspectionSpec，仅在程序通道执行。模型消费检查报告；本包不提供把完整产物暴露给模型的替代通道。
- 评测接收调用方的能力矩阵，每项返回 passed/failed/not_run。报告不写回内容清单，不生成采用准入状态或豁免。
- 工具参数签名从活动 MCP 定义导出；实际 list_tools 仍是部署参数 Schema 真源。错误索引覆盖产品查询错误闭集、页面错误类型及 Python 字面量调用点，分别标明来源；动态错误和外部服务错误以真实结构化回执为准，静态索引不代表全部部署错误。

调用命令也可使用 compile、inspect、schema、evaluate，输入通过 stdin 或 --input 明确指定；命令只做确定性计算。业务状态看 JSON 中 status/checks，CLI 退出码不等于业务检查通过。MC 不注册 Relay Tool、Hook 或新的管理器；工具注册与权限隔离由调用 Adapter 验收。

## Schema 升级后的旧文件流程

1. 整体更新内容包并校验完整性，读取本包当前页面版本、可读范围和实际目标工具版本。内容包版本不等于页面 schemaVersion；模板版本也不是页面版本。
2. 对旧文件执行 schema 检查。报告分别给出 readable、能力下限错误、validationErrors、upgrade.possible 及已知语义缺口。可读取的旧页不强制整页升级。
3. 需要新能力或文件不能继续使用时，先以 upgrade 仅检查；按产品迁移规则决定是否可升级，不能直接修改 schemaVersion。
4. 明确给出全新输出目录后写出：original 保存原字节，page 保存通过目标校验的文件，migration.json 记录输入 SHA256、版本、变更和缺口。已有目录拒绝覆盖；不支持降级。
5. Skill 核对迁移报告与目标运行时支持，决定是否采用新文件、继续编辑或报告人工处理项。预览、数据执行、保存、发布仍分别验收。

```sh
python /absolute/mc-content/scripts/mc_content.py schema --input /absolute/old-page.json
python /absolute/mc-content/scripts/mc_content.py upgrade --input /absolute/old-page.json
python /absolute/mc-content/scripts/mc_content.py upgrade --input /absolute/old-page.json --out-dir /absolute/new-attempt
```

未来/未知版本、缺版本声明、能力下限错误，以及产品尚无明确规则的旧参数或页头语义不会被自动放行。原页仍合法且只做该版本支持的局部改动时，Skill 可选择保留原版本。迁移逻辑与静态校验直接打包产品实现；后续 Schema 升级必须重新生成、运行旧输入回归并替换整包。
