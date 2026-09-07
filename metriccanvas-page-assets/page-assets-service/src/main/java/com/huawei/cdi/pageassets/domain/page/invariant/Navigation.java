package com.huawei.cdi.pageassets.domain.page.invariant;

import com.fasterxml.jackson.databind.JsonNode;
import com.huawei.cdi.pageassets.domain.page.TypedError;
import com.huawei.cdi.pageassets.domain.page.document.ComponentWalk;
import com.huawei.cdi.pageassets.domain.page.json.Json;
import com.huawei.cdi.pageassets.domain.page.json.JsonPointer;
import java.net.URL;
import java.net.MalformedURLException;
import java.util.*;

/** 源侧 URL/绑定校验；不请求、不推断外部目标。 */
public final class Navigation {
    private Navigation() { }
    public static List<TypedError> errors(JsonNode page) {
        List<TypedError> errors = new ArrayList<>();
        Map<String,JsonNode> filters = new LinkedHashMap<>();
        page.path("filters").forEach(f -> filters.put(f.path("id").asText(), f));
        Set<String> params = new HashSet<>();
        page.path("params").forEach(p -> params.add(p.path("id").asText()));
        ComponentWalk.walkDocument(page, (component, path) -> {
            JsonNode props = component.path("props");
            if ("text".equals(component.path("type").asText())) {
                for(int i=0;i<props.path("links").size();i++) target(page, component, props.path("links").get(i), path+"/props/links/"+i, filters, params, errors);
            } else {
                for(int i=0;i<props.path("actions").size();i++) {
                    JsonNode action = props.path("actions").get(i);
                    if(action.has("navigate")) target(page,component,action.get("navigate"),path+"/props/actions/"+i+"/navigate",filters,params,errors);
                }
            }
        });
        Set<String> used = new HashSet<>(params);
        int index=0;
        for(JsonNode filter: page.path("filters")) {
            List<String> parts = parts(filter);
            for(var entry:Json.entries(Json.record(filter.get("urlParams")))) {
                if(!parts.contains(entry.getKey())) errors.add(TypedError.schema("/filters/"+index+"/urlParams/"+entry.getKey(),"该筛选器不支持此 URL 分量"));
            }
            for(String part:parts) {
                String key=filter.path("urlParams").path(part).asText(filter.path("id").asText()+(part.equals("value")?"":"."+part));
                if(!used.add(key)) errors.add(TypedError.schema("/filters/"+index+"/urlParams/"+part,"URL 参数名重复:"+key));
            }
            index++;
        }
        return errors;
    }
    private static List<String> parts(JsonNode filter) {
        String type=filter.path("type").asText();
        if(type.equals("timeRange")||type.equals("numberRange")) return List.of("from","to");
        return filter.has("hierarchy") ? List.of("value","level") : List.of("value");
    }
    private static void target(JsonNode page, JsonNode component, JsonNode target, String path, Map<String,JsonNode> filters, Set<String> params, List<TypedError> errors) {
        if(!validHref(target.path("href").asText())) errors.add(TypedError.schema(path+"/href","导航只允许 HTTP(S) 或相对 URL"));
        for(var entry:Json.entries(Json.record(target.get("query")))) {
            JsonNode b=entry.getValue(); String p=path+"/query/"+JsonPointer.escape(entry.getKey());
            String id=b.path("id").asText();
            switch(b.path("source").asText()) {
                case "param" -> { if(!params.contains(id)) errors.add(TypedError.schema(p+"/id","未声明的页面参数:"+id)); }
                case "filter" -> {
                    JsonNode f=filters.get(id);
                    if(f==null) errors.add(TypedError.schema(p+"/id","未声明的筛选器:"+id));
                    else {
                        String part=b.path("part").asText("value");
                        if(!parts(f).contains(part)) errors.add(TypedError.schema(p+"/part","筛选器 "+id+" 不支持分量 "+part));
                    }
                }
                case "row" -> {
                    String field=b.path("field").asText();
                    List<String> slots = new ArrayList<>();
                    if (component.path("type").asText().equals("metricCard")) {
                        for (String rowsKey : List.of("rows", "secondaryRows")) {
                            for (JsonNode row : component.path("props").path(rowsKey)) {
                                if (!row.path("link").asBoolean()) continue;
                                JsonNode binding = row.path("valueField");
                                slots.add(binding.isTextual() ? "main" : binding.path("data").asText("main"));
                            }
                        }
                    }
                    if (slots.isEmpty()) slots.add("main");
                    boolean invalid = slots.stream().anyMatch(slot -> {
                        JsonNode source = page.path("dataSources").path(component.path("data").path(slot).asText());
                        JsonNode definition = source.path("fields").path(field);
                        return !List.of("string", "number", "money", "boolean", "date", "datetime")
                            .contains(definition.path("type").asText());
                    });
                    if (invalid) errors.add(TypedError.schema(p+"/field", "当前行缺少可传参的标量字段:"+field));
                }
                default -> { }
            }
        }
    }
    private static boolean validHref(String href) {
        if(href.isEmpty() || !href.equals(href.strip()) || href.matches("(?i)^https?:(?!//).*")) return false;
        for(int i=0;i<href.length();i++) { char c=href.charAt(i); if(c<32||c==127||c=='\\') return false; }
        try {
            URL url = new URL(new URL("https://metriccanvas.invalid/"), href);
            return ("https".equalsIgnoreCase(url.getProtocol()) || "http".equalsIgnoreCase(url.getProtocol()))
                && !url.getHost().isEmpty() && !url.getHost().matches(".*[\\s<>].*")
                && url.getPort() >= -1 && url.getPort() <= 65535;
        } catch(MalformedURLException | IllegalArgumentException ex) { return false; }
    }
}
