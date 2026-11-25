# Operation Map 合同商务总览地图接入手册

目标版本为支持合同商务总览 Schema 6.141 的 MC Embed。交付时请从同一份构建复制入口和全部 chunks。OM 负责提供当前身份的组织候选、查询网关及共享地理字典。MC 按页面配置分区，绘制底图及业务行，并将点击回写至页头 Region。浏览器可执行的接线示例见 [独立集成页](../packages/embed/examples/ioc-region-map.html)、[模拟数据网关及地图适配器](../packages/embed/examples/ioc-region-map-fixture.mjs) 与 [所属地区部展示事实](../packages/embed/examples/region-department-facts.mjs)。模拟网关应替换为 OM 已有网关。

组织简称通过 Embed 的可选挂载参数 `regionMap.displayNames` 提供，按 `region-dept`、`office` 分组，以原业务值作键，例如 `{ "region-dept": {"中国地区部":"中国区"}, "office": {"德国代表处":"德国"} }`。OM 可以集中维护字典，按页面决定是否传入。地图的散点文字和对应数据行的悬浮标题使用命中的非空显示名。页头候选 `label` 应继续传完整组织名称。点击回写、DQE 维度值和底图地理匹配继续使用原值。

## 第一步　整理数据

| 资料 | OM 到哪里取 | 交给 MC 的结构 |
|---|---|---|
| 当前可选组织和父级 | 复用 metric-canvas-candidates.service.ts 中已有权限候选树。地区部与代表处的业务 value 与表格 org-key 对齐 | fetchRegionCandidates 返回 {kind:"values",candidates:[{level,value,label,parent?}]}。parent 包含 level 和 value。代码 R43 等可在 OM 内用于取配置 |
| 地区部汇总点 | 旧实现 business-overview.datasource.ts 将组织归一为地图名，再查 datav-lowcode 的 WorldMapDatas。欧洲示例为 [21,52.13] | point.lngLat，按 [经度,纬度]。从依赖提取的配置应记录依赖版本和原键，发布到 OM 自有配置 |
| 代表处落点 | 已有页面的 nameMap 和底图真实 feature 名，或经业务确认的坐标 | point.feature 如 Germany，或 point.lngLat。只有使用 feature 作为落点时才依赖该 feature 的中心点 |
| 选中组织后的镜头 | customer-overview/config.ts 的 mapCode、common-util.ts 的 getSiteTypeOption。欧洲 R43 → EUROPE | viewport.center 和 zoom。将旧子图视口放到 world 或 china 后在实际容器校准缩放 |
| 需要着色的多边形 | map-provice-showName.mjs 的对应业务范围，按当前底图的 properties.name 转换 | 可选 features 数组。示例中东中亚的“海湾北”等业务名需 OM 核对地理范围。代表处集合取自组织树 |
| 本次点的指标 | 直接复用现有业务查询。全球/清空取 regions；地区部/代表处取 offices | 地区部行含 org-key、discount。代表处行另含 region-key。表格和地图共用同一批行 |

以欧洲为例，OM 应供下面的公共资料。北京为中国底图下的代表处位置；根据相同规则填充当前业务使用的其他组织。全球视角下的中国地区部落点属于 world 下的 region-dept 条目。

```json
{
  "world": {
    "region-dept": {
      "欧洲地区部": {
        "point": {"lngLat": [21, 52.13]},
        "viewport": {"center": [20.7129, 60.166], "zoom": 3}
      }
    },
    "office": {
      "德国代表处": {"point": {"feature": "Germany"}},
      "法国代表处": {"point": {"feature": "France"}}
    }
  },
  "china": {
    "office": {"北京代表处": {"point": {"feature": "北京市"}}}
  }
}
```

两份独立输入对应的业务样例如下，指标仅作演示：

```json
{
  "candidate": {"level":"office","value":"德国代表处","label":"德国代表处","parent":{"level":"region-dept","value":"欧洲地区部"}},
  "tableRow": {"org-key":"德国代表处","region-key":"欧洲地区部","discount":35.7}
}
```

底图支持 world/china，经度范围 ±180°，纬度范围 ±90°，zoom 为有限正数。旧交接稿拉美中心经度 300.7129 超出范围。请由 OM 确认源坐标系并对照旧页实际视口校准，另取拉美地区部的真实汇总点和一组代表处业务行。独立裁剪的拉美轮廓需要另行交付资产。示例工程的拉美范围和坐标只用于测试。

## 第二步　接入一次，页面复用

1. 用当前身份获取候选树和该版本的地理字典。通过已有 withOperationMapRegion 网关提供候选。收到 AbortSignal 时传给上游；权限拒绝、未就绪和查询空结果保持各自状态。
2. 使用相同的初始查询串初始化 MC 和 regionDepartment 展示事实。选地区部时事实是自身 value，选代表处时取授权节点 parent.value，全球和清空给 ready/null。未取得树时给 pending；最终无法定位授权节点时给 error。页面初始化还原了默认组织或最近选择时，以最终已应用选择对齐事实。首次恢复和后续变化都要处理。
3. 将地图配置作为 regionMap.geography 传入 mount。已有异步 resolveViewport 可继续提供动态镜头。具体用法如下，示例中 existingGateway、fetchAuthorizedCandidates、pageDocument、initialSearch、geography、nodes 均由 OM 提供。nodes 包含本次身份的完整授权节点。示例事实源为独立页面设计，OM 已有其他展示事实或定稿期间输入时，须将 regionDepartment 合并进同一份快照的 values，并保留既有 permissions、periods、timeZone 及订阅通知。

```js
import { mount, withOperationMapRegion } from '@metriccanvas/embed';
import { createRegionDepartmentFacts } from './region-department-facts.mjs';

const facts = createRegionDepartmentFacts(nodes, initialSearch);
const dataGateway = withOperationMapRegion(existingGateway, {
  fetchRegionCandidates: fetchAuthorizedCandidates
});
const handle = mount('#dashboard', {
  document: pageDocument,
  initialSearch,
  dataGateway,
  regionMap: { geography },
  displayInputs: facts.displayInputs,
  onEvent(event) {
    if (event.type === 'filter-change') {
      facts.setSelection(event.search, event.filterRevision);
    }
  }
});
```

本地模块取本手册链接的示例文件。正式实现的 permissionRevision 取自 OM 当前会话；身份或权限变更时销毁旧实例、候选与订阅，再加载新身份资料。对依赖筛选的异步回执，记录触发时的 filterRevision，取消或丢弃迟到回执。示例 setSelection 同步读取已获取的树。OM 若在进入页面后才异步取得树，应在树就绪时按当前已应用选择重算并通知。页面卸载调用 handle.destroy()。

4. 替换为[合同商务总览 JSON](../pages/business/dashboard/ioc/commercial/contract-business-overview.json)。正文共用六张指标卡，左侧地图与右侧七列明细随 Region 切换。该页使用 regionDepartment 选择中国或世界底图。全球或清空始终展示地区部。代表处从 office/parent 取得归属，无须在 JSON 枚举代表处。地图点击通过原始 org-key 和 region-key 走页头同一选择，DQE 请求继续沿用现有 filterBindings。
5. 仅在该页面有展示例外时声明根级 mapOverrides。比如只想把欧洲放大到 6.4，可写下面的覆盖。点位优先级从高到低为页面 point、组件显式 nameMap、OM point、业务值同名底图区域。viewport 按字段合并，页面优先于 OM 静态配置，静态配置优先于有效的动态回执。点位和数组整体替换，features 空数组清除着色。覆盖只影响画法。

```json
{"mapOverrides":{"world":{"region-dept":{"欧洲地区部":{"viewport":{"zoom":6.4}}}}}}
```

## 第三步　在 OM 环境验收

- 全球或清空 Region。地图与表格展示地区部。核对欧洲汇总点坐标及同一行的折扣。
- 点欧洲汇总点。页头变成欧洲地区部，镜头按配置聚焦。返回几条有位置的代表处行就能找到几个点；缺资料的行仍可从表格核对。
- 点德国代表处散点。页头、查询中的代表处谓词、地图与表格应同时更新。用同一身份从页头选德国应得到相同结果。用代表处 URL 冷启动再验一次。
- 选择一个原来不在页面名单里的中国代表处。检查 parent.value、regionDepartment、所选底图和点位。快速切换地区时旧镜头回执应被丢弃。
- 用真实拉美数据重复核对。至少记录当前底图、候选 level/value/parent、去敏业务行、点位及实际视口。密集点还要点击测试，邻近标签可能遮挡目标。
- 若表格有数据而地图没点，先对齐行 org-key 与字典键，再检查底图、point.feature 是否与打包资产同名且有中心点，或 lngLat 是否有效。若整个中国/海外分区缺失，优先检查事实源、授权树与筛选修订。
