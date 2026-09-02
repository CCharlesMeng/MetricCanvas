package com.huawei.cdi.pageassets.domain.page.invariant;

import com.fasterxml.jackson.databind.JsonNode;
import com.huawei.cdi.pageassets.domain.page.document.DataSources;
import com.huawei.cdi.pageassets.domain.page.json.Json;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 以报告采集时间所在月为边界，保证实际与预测柱不跨越时间语义。
 * 仅对"N月"类别和显式 actual/forecast role 生效。
 */
final class BarForecastBoundary {
    private static final Pattern REPORT_MONTH = Pattern.compile("^\\d{4}-(\\d{2})-");
    private static final Pattern CATEGORY_MONTH = Pattern.compile("^(\\d{1,2})月$");

    private BarForecastBoundary() {
    }

    record Issue(int rowIndex, String field, String message) {
    }

    static List<Issue> issues(JsonNode props, JsonNode rows, String capturedAt) {
        List<Issue> issues = new ArrayList<>();
        Integer capturedMonth = reportMonth(capturedAt);
        if (capturedMonth == null) {
            return issues;
        }
        String categoryField = DataSources.fieldName(props.get("categoryField"));
        JsonNode series = props.get("series");
        for (int rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
            JsonNode row = rows.get(rowIndex);
            Integer month = categoryMonth(row.get(categoryField));
            if (month == null) {
                continue;
            }
            for (JsonNode item : series) {
                String role = Json.text(item.get("role"));
                if (!FilterInvariants.truthyString(role)) {
                    continue;
                }
                String field = DataSources.fieldName(item.get("field"));
                JsonNode value = row.get(field);
                if (value != null && value.isNull()) {
                    continue;
                }
                if (role.equals("forecast") && month <= capturedMonth) {
                    issues.add(new Issue(rowIndex, field, month + "月为统计月及之前不得提供预测系列 " + field));
                }
                if (role.equals("actual") && month > capturedMonth) {
                    issues.add(new Issue(rowIndex, field, month + "月为统计月之后不得提供实际系列 " + field));
                }
            }
        }
        return issues;
    }

    private static Integer reportMonth(String capturedAt) {
        Matcher matcher = capturedAt == null ? null : REPORT_MONTH.matcher(capturedAt);
        if (matcher == null || !matcher.find()) {
            return null;
        }
        int month = Integer.parseInt(matcher.group(1));
        return month >= 1 && month <= 12 ? month : null;
    }

    private static Integer categoryMonth(JsonNode value) {
        if (!Json.isString(value)) {
            return null;
        }
        Matcher matcher = CATEGORY_MONTH.matcher(jsTrim(value.textValue()));
        if (!matcher.matches()) {
            return null;
        }
        int month = Integer.parseInt(matcher.group(1));
        return month >= 1 && month <= 12 ? month : null;
    }

    /** JS `String.prototype.trim` 去掉的是 Unicode 空白与行终止符，与 Java `strip` 一致。 */
    private static String jsTrim(String value) {
        return value.strip();
    }
}
