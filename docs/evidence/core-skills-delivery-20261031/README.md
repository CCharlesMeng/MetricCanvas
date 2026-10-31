# repair 入口与独立 Skill 分发交付

本批从 `ce6eb3e0e791bc37ab9beb9932594dcc3fc6cb62` 隔离检出，只交付仓内 repair 入口、独立 local-authoring 打包回验、持续集成和维护说明。保留最新 main 的 Schema 6.77、Skill 1.14.11、精确分支诊断及按需编译；主目录旧生成物和 period-comparison 未提交能力由原任务保留。

## 行为与范围

repair 复用产品 `inspectPageDocument` 和递归 `pageFilesById`，移除失效公共导入与旧跨页目标检查。报告封装与产品有序错误保持，退出码0/1/2分别表示通过、文档错误和调用错误，输入文件只读。真实CLI覆盖递归目录、重复ID、导航URL、字段绑定、非法JSON和输入范围。

独立归档覆盖作者文件在内的整个安装目录，回执记录来源提交、Skill/Schema/产品版本和逐文件摘要；拒绝覆盖、符号链接、漂移或损坏。实际归档解包至仓外执行版本、合法/非法页面探针，覆盖完整升级与回退。CI增加归档上传、下载和实际下载内容回验，来源SHA不符或脏工作区拒绝作为CI发行。

`package.json` 是现有MC来源指纹的构建输入。通过官方生成器只刷新 `runtime/source-identity.json`、`mc-content.version.json` 和 `bundle.lock.json`，不改变安装实体，无需升Skill版本。本批不新增页面协议或渲染能力，复用现有页面和产品检查；浏览器、真实服务、DS模型、外部安装和部署没有因工具归档检查自动获得验收。

## 本地验证

上述定向命令对应本批冻结输入；完整作者回归和GitHub上传/下载以同SHA CI及交付回执核实。维护命令使用已锁定依赖的Python环境；安装后的Skill只依赖Node22+。

- `pnpm skills:repair:check`：定向类型检查，repair 11项和归档5项通过。
- `pnpm exec tsc --noEmit -p tests/tsconfig.json`：通过。
- `pnpm authoring:contracts:check`：通过，1321 product / 4 authoring / 1 interface。
- CI YAML解析与 `git diff --check`：通过。
- 完整 `pnpm skills:check`：包含上述16项工具检查与既有local-authoring六文件回归；完整结果由本批交付回执和同SHA CI提供。

## 复杂度

TypeScript采用 `metriccanvas-ts-ast/1`、TypeScript5.9.3，逐函数selfCC，嵌套闭包独立测量。Python采用Radon6.0.1。基线为上述远端提交；两个测试文件与Python工具为新增。

| 函数/扫描范围 | 前 | 后 |
|---|---:|---:|
| repair main | 19 | 5 |
| repair inspectFile | 4 | 2 |
| repair inputFiles | 新增 | 5 |
| repair全部3个map/filter/reduce回调 | 原包装内各1 | 2/1/1 |
| repair测试全部9个函数与回调 | 新增 | 最高5 |
| release测试全部11个函数与回调 | 新增 | 各1 |
| Python digest / inventory / check_tree | 新增 | 1/5/7 |
| Python run_validator / probe / extract | 新增 | 2/5/8 |
| Python verify_archive / write_archive | 新增 | 10/2 |
| Python revision / pack / main | 新增 | 6/3/4 |

旧messageOf、printFatal随包装移除。修改函数及全部新增辅助/回调均不超过15，无本批未关闭复杂度项；不据此宣称全仓存量问题清零。未修改执行分支的Skill与维护说明不单独伪造函数测量。
