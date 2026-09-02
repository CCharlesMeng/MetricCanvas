package com.huawei.cdi.pageassets.domain.page.version;

import com.fasterxml.jackson.databind.JsonNode;
import com.huawei.cdi.pageassets.domain.page.document.ComponentWalk;
import com.huawei.cdi.pageassets.domain.page.document.PageParams;
import com.huawei.cdi.pageassets.domain.page.json.Json;
import com.huawei.cdi.pageassets.domain.page.json.JsonPointer;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Predicate;

/**
 * 能力表：每项能力由哪个次版本引入。与 TypeScript 基线 `pageCapabilities` 逐条对应，
 * 顺序也一致（能力下限错误按此顺序报出）。
 */
public final class PageCapabilities {
    private static final List<PageCapability> ALL = List.of(
            cap("page-params", 1, "顶层 params:页面参数声明(ADR-0047)",
                    document -> Json.nonEmptyArray(Json.get(document, "params")) ? List.of("/params") : List.of()),
            cap("page-layout-form", 1, "顶层 layoutForm:页面布局形态(看板满宽 / 报表定宽)",
                    document -> Json.isString(Json.get(document, "layoutForm")) ? List.of("/layoutForm") : List.of()),
            cap("dashboard-toolbar-visibility", 3, "顶层 dashboardToolbar:显式关闭 dashboard 统一工具栏",
                    document -> Json.isString(Json.get(document, "dashboardToolbar"))
                            ? List.of("/dashboardToolbar") : List.of()),
            cap("project-detail-restoration-variants", 3, "项目详情页还原专用的组件呈现档",
                    document -> suffix(componentPaths(document, component -> {
                        String type = type(component);
                        String variant = Json.text(Json.get(props(component), "variant"));
                        if (variant == null) {
                            return false;
                        }
                        return ("reportHeader".equals(type) && variant.equals("projectDetail"))
                                || ("keyValuePanel".equals(type)
                                && (variant.equals("detailSummary") || variant.equals("detailNormMatrix")))
                                || ("compositeCard".equals(type) && variant.equals("projectNorms"))
                                || ("table".equals(type) && variant.equals("forecastMatrix"))
                                || ("fieldText".equals(type)
                                && (variant.equals("narrativeShort") || variant.equals("narrativeMeeting")
                                || variant.equals("narrativeRisk") || variant.equals("narrativeProgress")));
                    }), "/props/variant")),
            cap("key-value-panel-six-columns", 3, "key-value 信息面板的六列排布",
                    document -> suffix(componentPaths(document, component ->
                            "keyValuePanel".equals(type(component))
                                    && numberEquals(Json.get(props(component), "columns"), 6)), "/props/columns")),
            cap("component-backdrop-layer", 1, "组件 layout.layer:分区内叠放层,组件铺满分区置于其余组件之下",
                    PageCapabilities::componentLayerPaths),
            cap("text-value-reference", 1, "文本取值引用页面参数而不是写字面量(ADR-0047)",
                    document -> PageParams.collectTextValueReferences(document).stream()
                            .map(PageParams.TextValueReferenceUsage::path).toList()),
            cap("data-source-computation", 1, "页面数据源的受控计算阶段与具名算子(ADR-0046)",
                    document -> suffix(dataSourcePaths(document,
                            dataSource -> Json.nonEmptyArray(dataSource.get("compute"))), "/compute")),
            cap("collapsible-measure", 1, "结果字段契约上的可折叠度量声明(ADR-0046)",
                    PageCapabilities::collapsibleFieldPaths),
            cap("table-row-kind-field", 1, "表格按行类别字段套用明细/小计/合计呈现档位(ADR-0049)",
                    document -> suffix(componentPaths(document, component ->
                            "table".equals(type(component)) && Json.has(props(component), "rowKindField")),
                            "/props/rowKindField")),
            cap("table-merge-by", 1, "表格按字段合并相邻同值单元格(ADR-0049)",
                    document -> suffix(componentPaths(document, component ->
                            "table".equals(type(component)) && Json.has(props(component), "mergeBy")),
                            "/props/mergeBy")),
            cap("key-value-panel-component", 1, "key-value 信息面板组件",
                    document -> componentPaths(document, component -> "keyValuePanel".equals(type(component)))),
            cap("field-text-component", 1, "字段绑定长文本组件",
                    document -> componentPaths(document, component -> "fieldText".equals(type(component)))),
            cap("filter-boolean", 1, "boolean 筛选器(ADR-0050)",
                    document -> filterPaths(document, filter -> "boolean".equals(type(filter)))),
            cap("filter-time-point", 1, "timePoint 筛选器(ADR-0050)",
                    document -> filterPaths(document, filter -> "timePoint".equals(type(filter)))),
            cap("filter-number-range", 1, "numberRange 筛选器(ADR-0050)",
                    document -> filterPaths(document, filter -> "numberRange".equals(type(filter)))),
            cap("filter-search", 1, "search 筛选器(ADR-0050)",
                    document -> filterPaths(document, filter -> "search".equals(type(filter)))),
            cap("filter-hierarchy", 1, "层级维度筛选器(ADR-0050)",
                    document -> suffix(filterPaths(document,
                            filter -> Json.nonEmptyArray(filter.get("hierarchy"))), "/hierarchy")),
            cap("filter-depends-on", 1, "筛选器级联 dependsOn(ADR-0050)",
                    document -> suffix(filterPaths(document,
                            filter -> Json.isString(filter.get("dependsOn"))), "/dependsOn")),
            cap("filter-relative-time", 1, "结构化相对时间表达(ADR-0035 / ADR-0050)",
                    document -> suffix(filterPaths(document,
                            filter -> Json.isString(Json.get(Json.record(filter.get("default")), "unit"))),
                            "/default")),
            cap("table-column-link", 1, "表格列声明为行点击导航入口(ADR-0049)",
                    PageCapabilities::tableColumnLinkPaths),
            cap("navigate-set-params", 1, "导航意图 setParams:设置目标页页面参数(ADR-0047)",
                    PageCapabilities::navigateSetParamsPaths),
            cap("tab-container-component", 1, "Tab 容器组件",
                    document -> componentPaths(document, component -> "tabContainer".equals(type(component)))),
            cap("gauge-component", 1, "gauge 仪表组件",
                    document -> componentPaths(document, component -> "gauge".equals(type(component)))),
            cap("map-hierarchy-filter", 1, "地图按层级维度筛选器下钻",
                    document -> suffix(componentPaths(document, component ->
                            "mapChart".equals(type(component)) && Json.has(props(component), "hierarchyFilter")),
                            "/props/hierarchyFilter")),
            cap("composite-card-component", 2, "组合卡:组件级分组容器(ADR-0053)",
                    document -> componentPaths(document, component -> "compositeCard".equals(type(component)))),
            cap("category-breakdown-component", 2, "分类明细组件(ADR-0053)",
                    document -> componentPaths(document, component -> "categoryBreakdown".equals(type(component)))),
            cap("map-legend-bands", 2, "地图分档图例",
                    document -> suffix(componentPaths(document, component ->
                            "mapChart".equals(type(component)) && Json.has(props(component), "legend")),
                            "/props/legend")),
            cap("map-tooltip-fields", 2, "地图 tooltip 扩展字段",
                    document -> suffix(componentPaths(document, component ->
                            "mapChart".equals(type(component)) && Json.has(props(component), "tooltipFields")),
                            "/props/tooltipFields")),
            cap("key-value-panel-single-column", 2, "key-value 信息面板的单列排布",
                    document -> suffix(componentPaths(document, component ->
                            "keyValuePanel".equals(type(component))
                                    && numberEquals(Json.get(props(component), "columns"), 1)), "/props/columns")),
            cap("ratio-scale", 2, "ratio 算子的输出刻度 scale(ADR-0046)", PageCapabilities::ratioScalePaths),
            cap("section-column-tracks", 3, "内容分区的受控列轨权重(ADR-0054)",
                    PageCapabilities::sectionColumnTrackPaths),
            cap("filter-empty-label", 3, "维度筛选器的空选展示文案",
                    document -> suffix(filterPaths(document,
                            filter -> Json.isString(filter.get("emptyLabel"))), "/emptyLabel")),
            cap("filter-hierarchy-picker", 3, "层级维度筛选器的显式级别切换器形态",
                    document -> suffix(filterPaths(document,
                            filter -> Json.isString(filter.get("hierarchyPicker"))), "/hierarchyPicker")),
            cap("metric-row-context", 3, "指标行与主值同排的短上下文",
                    document -> metricRowPaths(document, "context")),
            cap("composite-card-compact", 3, "组合卡紧凑呈现档",
                    document -> suffix(componentPaths(document, component ->
                            "compositeCard".equals(type(component))
                                    && "compact".equals(Json.text(Json.get(props(component), "variant")))),
                            "/props/variant")),
            cap("tab-container-compact", 3, "Tab 容器紧凑呈现档",
                    document -> suffix(componentPaths(document, component ->
                            "tabContainer".equals(type(component))
                                    && "compact".equals(Json.text(Json.get(props(component), "variant")))),
                            "/props/variant")),
            cap("table-embedded", 3, "表格嵌入式密度与底部渐隐", document -> {
                List<String> paths = new ArrayList<>(suffix(componentPaths(document, component ->
                        "table".equals(type(component))
                                && "embedded".equals(Json.text(Json.get(props(component), "variant")))),
                        "/props/variant"));
                paths.addAll(suffix(componentPaths(document, component ->
                        "table".equals(type(component)) && Json.has(props(component), "bottomFade")),
                        "/props/bottomFade"));
                return paths;
            }),
            cap("key-value-item-unit", 3, "信息面板条目的展示单位", PageCapabilities::keyValueItemUnitPaths),
            cap("widget-symbol-icons", 3, "组合卡和信息面板的受控语义图标",
                    PageCapabilities::widgetSymbolIconPaths),
            cap("map-regional-overview", 3, "地域概览地图与稳定字段匹配的固定摘要", document -> {
                List<String> paths = new ArrayList<>(suffix(componentPaths(document, component ->
                        "mapChart".equals(type(component))
                                && "regionalOverview".equals(Json.text(Json.get(props(component), "variant")))),
                        "/props/variant"));
                paths.addAll(suffix(componentPaths(document, component ->
                        "mapChart".equals(type(component)) && Json.has(props(component), "pinnedSummary")),
                        "/props/pinnedSummary"));
                return paths;
            }),
            cap("metric-row-link", 4, "指标行的显式非空值导航入口",
                    document -> metricRowPaths(document, "link")),
            cap("tab-container-multi-table", 4, "Tab item 按顺序承载非空表格列表",
                    PageCapabilities::tabMultiTablePaths),
            cap("tab-container-analysis-stack", 4, "Tab 容器的分析表格堆叠呈现档",
                    document -> suffix(componentPaths(document, component ->
                            "tabContainer".equals(type(component))
                                    && "analysisStack".equals(Json.text(Json.get(props(component), "variant")))),
                            "/props/variant")),
            cap("dashboard-toolbar-compact-read-only", 4, "dashboard 紧凑页头与只读筛选说明",
                    document -> Json.isRecord(Json.get(document, "dashboardToolbar"))
                            ? List.of("/dashboardToolbar") : List.of()),
            cap("composite-card-metric-grid", 4, "组合卡的紧凑指标网格呈现档",
                    document -> suffix(componentPaths(document, component ->
                            "compositeCard".equals(type(component))
                                    && "metricGrid".equals(Json.text(Json.get(props(component), "variant")))),
                            "/props/variant"))
    );

    private PageCapabilities() {
    }

    public static List<PageCapability> all() {
        return ALL;
    }

    private static PageCapability cap(String id, int minor, String description,
                                      java.util.function.Function<JsonNode, List<String>> usage) {
        return new PageCapability(id, minor, description, usage);
    }

    private static String type(JsonNode node) {
        return Json.text(Json.get(node, "type"));
    }

    private static JsonNode props(JsonNode component) {
        return Json.record(Json.get(component, "props"));
    }

    private static boolean numberEquals(JsonNode node, int expected) {
        return Json.isNumber(node) && node.decimalValue().compareTo(java.math.BigDecimal.valueOf(expected)) == 0;
    }

    private static List<String> suffix(List<String> paths, String suffix) {
        return paths.stream().map(path -> path + suffix).toList();
    }

    private static List<String> componentPaths(JsonNode document, Predicate<JsonNode> matches) {
        List<String> paths = new ArrayList<>();
        ComponentWalk.walkDocument(document, (component, path) -> {
            if (matches.test(component)) {
                paths.add(path);
            }
        });
        return paths;
    }

    private static List<String> dataSourcePaths(JsonNode document, Predicate<JsonNode> matches) {
        List<String> paths = new ArrayList<>();
        JsonNode dataSources = Json.record(Json.get(document, "dataSources"));
        for (Map.Entry<String, JsonNode> entry : Json.entries(dataSources)) {
            JsonNode dataSource = Json.record(entry.getValue());
            if (dataSource != null && matches.test(dataSource)) {
                paths.add("/dataSources/" + JsonPointer.escape(entry.getKey()));
            }
        }
        return paths;
    }

    private static List<String> filterPaths(JsonNode document, Predicate<JsonNode> matches) {
        List<String> paths = new ArrayList<>();
        JsonNode filters = Json.get(document, "filters");
        if (!Json.isArray(filters)) {
            return paths;
        }
        for (int index = 0; index < filters.size(); index++) {
            JsonNode filter = Json.record(filters.get(index));
            if (filter != null && matches.test(filter)) {
                paths.add("/filters/" + index);
            }
        }
        return paths;
    }

    /** `collapsible` 在扁平字段与按角色分组的字段下位置不同，因此在 fields 子树内按结构递归查找。 */
    private static List<String> collapsibleFieldPaths(JsonNode document) {
        List<String> paths = new ArrayList<>();
        JsonNode dataSources = Json.record(Json.get(document, "dataSources"));
        for (Map.Entry<String, JsonNode> entry : Json.entries(dataSources)) {
            JsonNode fields = Json.record(Json.get(Json.record(entry.getValue()), "fields"));
            if (fields == null) {
                continue;
            }
            visitCollapsible(fields, "/dataSources/" + JsonPointer.escape(entry.getKey()) + "/fields", paths);
        }
        return paths;
    }

    private static void visitCollapsible(JsonNode node, String path, List<String> paths) {
        if (Json.has(node, "collapsible")) {
            paths.add(path + "/collapsible");
            return;
        }
        for (Map.Entry<String, JsonNode> entry : Json.entries(node)) {
            JsonNode nested = Json.record(entry.getValue());
            if (nested != null) {
                visitCollapsible(nested, JsonPointer.child(path, entry.getKey()), paths);
            }
        }
    }

    private static List<String> ratioScalePaths(JsonNode document) {
        List<String> paths = new ArrayList<>();
        JsonNode dataSources = Json.record(Json.get(document, "dataSources"));
        for (Map.Entry<String, JsonNode> entry : Json.entries(dataSources)) {
            JsonNode compute = Json.get(Json.record(entry.getValue()), "compute");
            if (!Json.isArray(compute)) {
                continue;
            }
            for (int index = 0; index < compute.size(); index++) {
                JsonNode operator = Json.record(compute.get(index));
                if (operator != null && "ratio".equals(Json.text(operator.get("op"))) && Json.has(operator, "scale")) {
                    paths.add("/dataSources/" + JsonPointer.escape(entry.getKey()) + "/compute/" + index + "/scale");
                }
            }
        }
        return paths;
    }

    private static List<String> navigateSetParamsPaths(JsonNode document) {
        List<String> paths = new ArrayList<>();
        ComponentWalk.walkDocument(document, (component, path) -> {
            JsonNode actions = Json.get(props(component), "actions");
            if (!Json.isArray(actions)) {
                return;
            }
            for (int index = 0; index < actions.size(); index++) {
                JsonNode navigate = Json.record(Json.get(Json.record(actions.get(index)), "navigate"));
                if (Json.has(navigate, "setParams")) {
                    paths.add(path + "/props/actions/" + index + "/navigate/setParams");
                }
            }
        });
        return paths;
    }

    private static List<String> componentLayerPaths(JsonNode document) {
        List<String> paths = new ArrayList<>();
        ComponentWalk.walkDocument(document, (component, path) -> {
            if (Json.has(Json.record(component.get("layout")), "layer")) {
                paths.add(path + "/layout/layer");
            }
        });
        return paths;
    }

    private static List<String> sectionColumnTrackPaths(JsonNode document) {
        List<String> paths = new ArrayList<>();
        JsonNode sections = Json.get(document, "sections");
        if (!Json.isArray(sections)) {
            return paths;
        }
        for (int index = 0; index < sections.size(); index++) {
            if (Json.has(Json.record(sections.get(index)), "columnTracks")) {
                paths.add("/sections/" + index + "/columnTracks");
            }
        }
        return paths;
    }

    private static List<String> keyValueItemUnitPaths(JsonNode document) {
        List<String> paths = new ArrayList<>();
        ComponentWalk.walkDocument(document, (component, path) -> {
            if (!"keyValuePanel".equals(type(component))) {
                return;
            }
            JsonNode items = Json.get(props(component), "items");
            if (!Json.isArray(items)) {
                return;
            }
            for (int index = 0; index < items.size(); index++) {
                if (Json.has(Json.record(items.get(index)), "unit")) {
                    paths.add(path + "/props/items/" + index + "/unit");
                }
            }
        });
        return paths;
    }

    private static List<String> widgetSymbolIconPaths(JsonNode document) {
        List<String> paths = new ArrayList<>();
        ComponentWalk.walkDocument(document, (component, path) -> {
            String type = type(component);
            JsonNode componentProps = props(component);
            if (("compositeCard".equals(type) || "keyValuePanel".equals(type)) && Json.has(componentProps, "titleIcon")) {
                paths.add(path + "/props/titleIcon");
            }
            if (!"keyValuePanel".equals(type)) {
                return;
            }
            JsonNode items = Json.get(componentProps, "items");
            if (!Json.isArray(items)) {
                return;
            }
            for (int index = 0; index < items.size(); index++) {
                if (Json.has(Json.record(items.get(index)), "icon")) {
                    paths.add(path + "/props/items/" + index + "/icon");
                }
            }
        });
        return paths;
    }

    private static List<String> metricRowPaths(JsonNode document, String key) {
        List<String> paths = new ArrayList<>();
        ComponentWalk.walkDocument(document, (component, path) -> {
            if (!"metricCard".equals(type(component))) {
                return;
            }
            for (String rowsKey : List.of("rows", "secondaryRows")) {
                JsonNode rows = Json.get(props(component), rowsKey);
                if (!Json.isArray(rows)) {
                    continue;
                }
                for (int index = 0; index < rows.size(); index++) {
                    if (Json.has(Json.record(rows.get(index)), key)) {
                        paths.add(path + "/props/" + rowsKey + "/" + index + "/" + key);
                    }
                }
            }
        });
        return paths;
    }

    private static List<String> tabMultiTablePaths(JsonNode document) {
        List<String> paths = new ArrayList<>();
        ComponentWalk.walkDocument(document, (component, path) -> {
            if (!"tabContainer".equals(type(component))) {
                return;
            }
            JsonNode tabs = Json.get(props(component), "tabs");
            if (!Json.isArray(tabs)) {
                return;
            }
            for (int index = 0; index < tabs.size(); index++) {
                if (Json.isArray(Json.get(Json.record(tabs.get(index)), "components"))) {
                    paths.add(path + "/props/tabs/" + index + "/components");
                }
            }
        });
        return paths;
    }

    private static List<String> tableColumnLinkPaths(JsonNode document) {
        List<String> paths = new ArrayList<>();
        ComponentWalk.walkDocument(document, (component, path) -> {
            if ("table".equals(type(component))) {
                visitColumns(Json.get(props(component), "columns"), path + "/props/columns", paths);
            }
        });
        return paths;
    }

    private static void visitColumns(JsonNode columns, String path, List<String> paths) {
        if (!Json.isArray(columns)) {
            return;
        }
        for (int index = 0; index < columns.size(); index++) {
            JsonNode column = Json.record(columns.get(index));
            if (column == null) {
                continue;
            }
            String columnPath = path + "/" + index;
            if (Json.has(column, "link")) {
                paths.add(columnPath + "/link");
            }
            visitColumns(column.get("children"), columnPath + "/children", paths);
        }
    }
}
