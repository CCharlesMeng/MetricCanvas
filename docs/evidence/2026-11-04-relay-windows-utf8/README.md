# Relay Windows UTF-8 发行修复

首轮CI3846ba52c的Linux producer与本机macOS同字节，Linux原生消费通过；Windows原生self-test失败：PRODUCT_ENVIRONMENT_INVALID，charmap cannot decode byte 0x8d position517。0.2.1不是跨平台通过批次；其余未结束任务已取消，保留首轮失败证据。

独立C会话只读定位与主控最小复现一致：field_presentation.py读取UTF-8呈现政策时使用默认编码；其他JSON读取和Node text通道有同类遗漏。修文件读取之后，中文page.compose仍会在Node桥默认cp1252编码失败，需一并修正。

回归test_archived_cli_uses_utf8_with_windows_legacy_locale运行真正导出四项CLI，模拟Windows默认Path.read_text/subprocess文本编码为cp1252，保留显式encoding；先出现与Windows相同0x8d/517并exit3，修复后35条self-test（含中文compose）通过。不是仅设置PYTHONUTF8环境变量：隔离模式会忽略此变量。

本次在实际Python闭包的13处资源读取、6处Node文本通道显式UTF-8；保持错误顺序、数值、操作和所有冻结样本不变。发行patch0.2.2、Interface1.1.0、Schema6.83；Skill知识摘要随产品真源更新，版本1.21.1，未覆写旧包。

复杂度采用Radon6.0.1：相关已有函数CC均不变；新增真实归档回归自身CC2，bootstrap lambda CC1。页面Schema字段净增减0，引擎/浏览器可执行输入未变，复用已有4184/5、261 Embed和新3场景记录；Python与发行测试、同源知识及原生CI重新验收。

同一最终候选两次导出3834文件的路径/字节一致；完整Interface和6个Node预构建文件与0.2.1字节一致。真实0.2.1 current→0.2.2比较及正式35条回放通过，旧23条仍needs_migration。99项Python核心与204项独立Skill回归通过；固定复杂度门禁无违规。首轮额外本地复验因测试调用未继承禁写设置产生一个mc_content.pyc而被完整性门禁正确拒绝；仅清除此轮缓存，并带PYTHONDONTWRITEBYTECODE=1重跑，不放宽检查。

81项发行测试带实际0.2.2候选全部通过、零跳过（85.192秒）。MC知识52项通过，摘要变化引起派生diagnostics fixture漂移，使用官方mc-content-fixtures.py重新生成并另做--check，不手写哈希。

本次编码边界存量例外：`text_map_building.add_map_chart` CC21→21，仅将地图JSON资源读取显式为UTF-8，未改组件装配和校验分支；为避免扩展这一跨平台修复的行为面，本次不拆分，后续在该函数承接地图资源/组件装配职责分离时关闭。Node桥 `_checked_program` 4→4、`validate_with_resources` 10→10、`validate_with_node` 11→11、`edit_presentation_with_node` 8→8；新增隔离回归2、bootstrap lambda1。之前buildSkillProjections52→52仍按原记录保留。
