import catalog from '../../page-catalog.json';

export const headerTopics = [
  { id: 'overview', title: '完整演示', description: '先操作一个常用组合：期间、币种、区域。公共页头是共用结构，下面四个专题分别介绍其中的功能。', scenes: ['navigation-source', 'overview', 'dense-filter'] },
  { id: 'time', title: '时间选择', description: '按使用场景选择期间；年季月、详情单月和不连续月份分别保留自己的含义。', scenes: ['overview', 'detail', 'month-set', 'time-modes', 'time-presets', 'availability', 'calendar-window'] },
  { id: 'business', title: '业务筛选', description: '选择业务条件和区域层级，观察上下级联动，以及详情页独立生效的条件。', scenes: ['business-options', 'business-tree', 'business-detail', 'dense-filter'] },
  { id: 'currency', title: '币种与金额', description: '切换币种、单位和金额范围。人民币与美元使用独立演示字段，不进行前端换汇。', scenes: ['currency'] },
  { id: 'navigation', title: '跨页传值', description: '从概览开始，选择条件后进入清单，再打开项目详情。各页面独立修改，只传值，不恢复来源视图。', scenes: ['navigation-source', 'navigation-list', 'navigation-detail'] }
] as const;

export function headerScene(scene: string) { return catalog.pages.find(entry => entry.group === 'ioc-header' && entry.scenario === scene); }
export function headerSceneKey(id: string) { return catalog.pages.find(entry => entry.id === id)?.scenario; }
export function headerSceneHref(scene: string) {
  const suffix = scene === 'navigation-list' ? '?origin=专题直接入口'
    : scene === 'navigation-detail' ? '?project-id=P-001&project-name=示例项目甲&origin=专题直接入口&month=2026-09' : '';
  return `/pages/${headerScene(scene)?.id}${suffix}`;
}

export function resolveHeaderSelection(topic: string | null, scene: string | null) {
  const validScene = headerTopics.flatMap(item => [...item.scenes]).find(item => item === scene);
  const selectedTopic = headerTopics.find(item => item.id === topic && (!validScene || item.scenes.some(value => value === validScene)))
    ?? headerTopics.find(item => validScene && item.scenes.some(value => value === validScene)) ?? headerTopics[0];
  return { topic: selectedTopic, scene: validScene ?? selectedTopic.scenes[0] };
}

type CapabilityStatus = 'supported' | 'integration' | 'deferred' | 'unsupported';
export interface HeaderCapability {
  title: string;
  description: string;
  condition: string;
  scene: string;
  refs: string[];
  status: CapabilityStatus;
}
export const headerStatusLabels = { supported: '已支持', integration: '需业务接入', deferred: '暂缓实施', unsupported: '暂未支持' } as const;
const range = (prefix: string, from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${String(from + i).padStart(2, '0')}`);
function item(title: string, description: string, condition: string, scene: string, refs: string[], status: CapabilityStatus = 'supported'): HeaderCapability {
  return { title, description, condition, scene, refs, status };
}

/** Curated usage index, traced to the approved plan. This does not define Page semantics. */
export const headerCapabilityGroups = [
  { id: 'foundation', title: '基础呈现', items: [
    item('标题、副标题与说明', '显示固定文字、参数或已应用筛选值；说明可直接展示或作为提示。', '由页面声明；标题缺值与可省略信息分别处理。', 'overview', ['H01', 'H05']),
    item('业务编码、状态与标签', '显示对象编码、业务标签及明确的状态颜色。', '显示项与顺序显式配置；缺值整项省略。', 'detail', ['H03', 'H04']),
    item('期间、数据期与更新时间', '分别展示查询期间、最新数据期、刷新时间和生成时间。', '最新期和时间戳来自可信输入；不会用当前时间补缺值。', 'availability', ['H06']),
    item('普通、密集、详情与无标题形态', '共用一套页头结构，支持上下排、行内、紧凑吸顶和无标题筛选区，也可承载对象详情信息。', '根据页面内容与容器布局；不会自动迁移已有页面。', 'month-set', ['H07', 'H08']),
    item('筛选顺序与唯一归属', '按声明顺序放置筛选，同一条件不会在页头和通用筛选区重复出现。', '引用当前页面合法筛选；详情私有筛选不能被错误认领。', 'overview', ['H09']),
    item('更多筛选与展开收起', '可按实际首行折叠，或将密集条件收纳到“更多筛选”；展开后继续操作其余条件。', '首行折叠与按数量收纳分别声明；收起不会清值或发起查询。', 'dense-filter', ['H10', 'O02']),
    item('窄屏、键盘与只读状态', '标题和控件随容器回流；可通过键盘操作，折叠内容不保留隐藏焦点。', '只读限制用户写入；候选加载或失败只影响相关条件。', 'dense-filter', ['H12', 'H13', 'H14']),
    item('返回来源入口', '有合法来源时显示返回，没有来源时隐藏。', '由集成应用提供返回上下文与处理函数；不包含完整视图恢复。', 'navigation-source', ['H02', 'O01'])
  ] },
  { id: 'time', title: '时间选择', items: [
    item('年、季度、月与近一年', '切换期间时保留月份锚点；近一年取当前月之前的 12 个完整月。', '可限制为只选年份等允许模式；查询需绑定对应范围，不同于近 12 个月候选多选。', 'overview', ['T09']),
    item('单月、单日与日期范围', '选择一个月、一天或完整的起止范围；详情单月独立生效。', '粒度和边界由页面声明；未完成的范围只保留为草稿。', 'detail', ['T01', 'T02', 'T03']),
    item('日、月与 ISO 周切换', '模式、范围与查询一起切换，ISO 周固定为周一至周日。', '需要为每个模式提供完整的静态查询；不推断内部周编码。', 'time-modes', ['T04', 'T05']),
    item('快捷日期与相对月份', '今日、近 7 天、近 30 天、上个完整月等按统一时钟计算。', '近 7 天含当天；按月的快捷项单独声明，禁选范围仍生效。', 'time-presets', ['T06', 'T07']),
    item('不连续月份与最近 12 月候选', '同时选择 1 月和 3 月，只查询这两个月。', '需要年月维度绑定；动态候选窗口需要最新期和候选接口。只有时间字段时不支持多区间替代。', 'calendar-window', ['T08']),
    item('最新数据期、完整期与日期上限', '分别配置默认期间和最大可选期间，拒绝缺数或超界日期。', '需可信期间事实；合法显式 URL 优先于动态初值。', 'availability', ['T10', 'T11']),
    item('已应用期间说明', '说明跟随生效的筛选；累计、同比等窗口沿用显式查询配置。', '切换控件不会自动改变业务聚合口径。', 'overview', ['T12'])
  ] },
  { id: 'business', title: '业务筛选与状态联动', items: [
    item('单选、多选、全选与不限', '按配置限制选择数量；“不限”与真实选择全部候选分别处理。', '固定枚举可直接声明，动态维度通过候选接口取得。', 'business-options', ['L06']),
    item('业务勾选条件', '可表达仅看重点、Top100 等勾选，并显式映射选中或取消的查询值。', '提供通用控件与绑定；具体业务编码和指标作用范围需真实业务确认。', 'business-options', range('F', 1, 4), 'integration'),
    item('产业、客户、活动与项目档位', '使用单选、多选、勾选和有限枚举表达业务条件，包括是/否、不限和百分比档位。', '通用能力已支持；各字段的候选、档位、业务依赖与查询语义需要接入，不表示全部业务场景已上线。', 'business-options', [...range('F', 5, 5), ...range('F', 7, 19), ...range('F', 21, 24)], 'integration'),
    item('区域层级与树形选择', '区分地区部、代表处以及各层级自己的代码；也支持旧路径树。', '需提供层级、父子关系与查询字段；跨层任意混选不在当前范围。', 'business-tree', ['F06']),
    item('时间关联模型候选', '时间变化后重新取得模型候选，保留有效交集；没有交集时等待用户确认。', '需候选接口提供当前时间范围下的合法模型。', 'calendar-window', ['F20', 'L05']),
    item('候选来源、状态与重试', '区分加载、就绪、空、无权限、未配置、不可用和失败。', '固定枚举与动态授权候选不能互相冒充；失败时不回退全量。', 'business-tree', ['L01', 'L02']),
    item('上下级联动与条件启用', '上级变化递归清理下级；可按有限规则禁用条件，并显示原因。', '依赖与清值规则显式声明；自动清空需要用户确认。', 'dense-filter', ['L03', 'L04']),
    item('初始化、原子更新与局部刷新', '参数、显式 URL、候选校验按顺序初始化；整组合法变化一次生效，仅刷新受影响数据。', '未就绪条件暂停相关查询和导出，无关数据仍可用；非法草稿不覆盖已应用值。', 'business-options', ['L07', 'L08', 'L09']),
    item('候选缓存与迟到响应保护', '候选按实例、条件、层级、依赖及身份隔离，旧回执不能覆盖新状态。', '由共用筛选协调处理；不使用跨页可变筛选单例。', 'business-tree', ['L10']),
    item('只读、禁用与显示条件', '只读阻止用户修改；显示条件使用已有统一呈现能力。', '只读不是权限校验，静态隐藏不自动停止查询；权限仍由现有服务保证。', 'availability', ['L11'])
  ] },
  { id: 'currency', title: '币种与金额', items: [
    item('币种选择与静态字段切换', '人民币、美元使用各自的静态货币字段，相关查询与显示随选择更新。', '需要真实数据提供对应字段；没有汇率时不进行前端换算。', 'currency', ['M01', 'M02']),
    item('金额单位、预设与自定义范围', '按币种选择预设档位或输入单边、双边范围；确定才应用，取消保留原值。', '范围以基本单位进入查询；有限非负数及上下界按声明校验。', 'currency', ['M03', 'M04', 'O06']),
    item('切换币种清金额', '换币种与清理旧金额范围一次提交，重新确认后查询。', '不会把旧币种范围用于新币种字段。', 'currency', ['M05']),
    item('图表、表格、计算与导出一致', '消费同一已应用币种及静态字段，显示单位和已有表格导出保持一致。', '不新增页头导出按钮；真实美元数据与业务导出另验。', 'currency', ['M06'])
  ] },
  { id: 'navigation', title: '跨页传值', items: [
    item('概览、清单、详情显式传值', '按声明传递行、参数和筛选值；目标页以此初始化。', '只传允许的字段，同名条件不会自动继承。', 'navigation-source', ['N01']),
    item('目标输入校验', '校验必需项、类型、日期粒度和区域层级，错误时说明原因并拒绝相关执行。', '目标候选就绪后再确认范围；季度不能自动截成详情单月。', 'navigation-list', ['N02']),
    item('页面独立与 URL 打开', '详情中的修改不回写来源；合法 URL 可直接打开或刷新目标页。', '只保留显式可序列化输入，不保存分页、排序、Tab 或滚动。', 'navigation-detail', ['N03', 'N08'])
  ] }
];

export const headerPlannedCapabilities: HeaderCapability[] = [
  item('来源视图恢复', '筛选快照、分页、排序、Tab、滚动及多来源导航恢复不在本轮实施范围。', '用户已收窄为跨页传值；原规划保留。', 'navigation-source', range('N', 4, 7), 'deferred'),
  item('页头操作区、主题、全屏与导出入口', '页头统一动作区、主题切换、全屏、表格导出入口及整页 PDF/PNG。', '可选操作批次整体挂起；已有表格内部导出仍可使用。', 'currency', ['H11', 'O03', 'O04', 'O05', 'O07'], 'deferred'),
  item('刷新、重置、手动应用与更多操作', '页头级刷新、重置、查询按钮和更多操作菜单。', '批次挂起；当前继续沿用条件修改即生效。', 'overview', range('O', 8, 11), 'deferred'),
  item('页头全页搜索', '全页搜索需要明确查询目标、匹配字段和服务端能力。', '当前未开放；表格自身搜索保持原有归属。', 'overview', ['L12', 'O12'], 'unsupported'),
  item('动态货币字段、任意跨层混选及仅时间字段的多区间', '这些扩展不属于当前已支持的通用契约。', '需要独立确认数据契约与执行能力。', 'currency', [], 'unsupported')
];
