package com.huawei.cdi.pageassets.domain.page.document;

import com.fasterxml.jackson.databind.JsonNode;
import com.huawei.cdi.pageassets.domain.page.json.Json;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** 绝对时间范围、时间点与结构化相对时间的公历语义判定，对应基线 filter.ts 的校验函数。 */
public final class CalendarValues {
    private static final Pattern DATE = Pattern.compile("^(\\d{4})-(\\d{2})-(\\d{2})$");
    private static final Pattern DATETIME = Pattern.compile("^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2})$");
    private static final Pattern MONTH = Pattern.compile("^(\\d{4})-(\\d{2})$");
    private static final Set<String> RELATIVE_UNITS = Set.of("day", "week", "month", "quarter", "year");

    private CalendarValues() {
    }

    /** 单端点错误定位到具体字段（from/to）；区间或精度一致性错误 field 为 null。 */
    public record RangeIssue(String field, String message) {
    }

    public static List<RangeIssue> validateCalendarTimeRange(JsonNode from, JsonNode to, String precision) {
        Parsed parsedFrom = parseCalendarValue(from, precision);
        Parsed parsedTo = parseCalendarValue(to, precision);
        List<RangeIssue> issues = new ArrayList<>();
        if (!parsedFrom.valid) {
            issues.add(new RangeIssue("from", calendarValueMessage("from", parsedFrom, precision)));
        }
        if (!parsedTo.valid) {
            issues.add(new RangeIssue("to", calendarValueMessage("to", parsedTo, precision)));
        }
        if (!parsedFrom.valid || !parsedTo.valid) {
            return issues;
        }
        if (!parsedFrom.precision.equals(parsedTo.precision)) {
            return List.of(new RangeIssue(null, "时间范围 from 与 to 必须使用相同精度"));
        }
        if (from.textValue().compareTo(to.textValue()) > 0) {
            issues.add(new RangeIssue(null, "时间范围 from 不得晚于 to"));
        }
        return issues;
    }

    public static boolean isCalendarDate(String value) {
        if (!DATE.matcher(value).matches()) {
            return false;
        }
        JsonNode node = com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.textNode(value);
        return validateCalendarTimeRange(node, node, "date").isEmpty();
    }

    public static boolean isRelativeTimeExpression(JsonNode value) {
        if (!Json.isRecord(value)) {
            return false;
        }
        String unit = Json.text(value.get("unit"));
        JsonNode range = value.get("range");
        return unit != null && RELATIVE_UNITS.contains(unit)
                && range != null && (range.isObject() || range.isArray())
                && Json.isBoolean(value.get("includeCurrent"));
    }

    public static boolean isTimeRangeValue(JsonNode value) {
        return Json.isRecord(value) && Json.isString(value.get("from")) && Json.isString(value.get("to"));
    }

    public static String validateTimePointValue(JsonNode value, String granularity) {
        if ("month".equals(granularity)) {
            String text = Json.text(value);
            Matcher matcher = text == null ? null : MONTH.matcher(text);
            if (matcher == null || !matcher.matches()) {
                return "时间点须为 YYYY-MM 格式";
            }
            int month = Integer.parseInt(matcher.group(2));
            if (month < 1 || month > 12) {
                return "时间点不是有效月份";
            }
            return null;
        }
        Parsed parsed = parseCalendarValue(value, "date");
        if (parsed.valid) {
            return null;
        }
        return "calendar".equals(parsed.reason) ? "时间点不是有效的公历日期" : "时间点须为 YYYY-MM-DD 格式";
    }

    public static int daysInGregorianMonth(int year, int month) {
        if (month == 2) {
            boolean leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
            return leap ? 29 : 28;
        }
        return (month == 4 || month == 6 || month == 9 || month == 11) ? 30 : 31;
    }

    private record Parsed(boolean valid, String reason, String precision) {
    }

    private static Parsed parseCalendarValue(JsonNode value, String requiredPrecision) {
        String text = Json.text(value);
        if (text == null) {
            return new Parsed(false, "format", null);
        }
        Matcher dateMatch = DATE.matcher(text);
        Matcher datetimeMatch = DATETIME.matcher(text);
        boolean isDatetime = datetimeMatch.matches();
        boolean isDate = !isDatetime && dateMatch.matches();
        String precision = isDatetime ? "datetime" : isDate ? "date" : null;
        Matcher match = isDatetime ? datetimeMatch : isDate ? dateMatch : null;
        if (match == null || (requiredPrecision != null && !requiredPrecision.equals(precision))) {
            return new Parsed(false, "format", precision);
        }
        int year = Integer.parseInt(match.group(1));
        int month = Integer.parseInt(match.group(2));
        int day = Integer.parseInt(match.group(3));
        Integer hour = isDatetime ? Integer.parseInt(datetimeMatch.group(4)) : null;
        Integer minute = isDatetime ? Integer.parseInt(datetimeMatch.group(5)) : null;
        if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInGregorianMonth(year, month)
                || (hour != null && (hour > 23 || minute > 59))) {
            return new Parsed(false, "calendar", precision);
        }
        return new Parsed(true, null, precision);
    }

    private static String calendarValueMessage(String field, Parsed parsed, String precision) {
        if ("calendar".equals(parsed.reason)) {
            return "时间范围 " + field + " 不是有效的公历" + ("datetime".equals(parsed.precision) ? "日期时间" : "日期");
        }
        String expected = "datetime".equals(precision)
                ? "YYYY-MM-DDTHH:mm"
                : "date".equals(precision) ? "YYYY-MM-DD" : "YYYY-MM-DD 或 YYYY-MM-DDTHH:mm";
        return "时间范围 " + field + " 须为 " + expected + " 格式";
    }
}
