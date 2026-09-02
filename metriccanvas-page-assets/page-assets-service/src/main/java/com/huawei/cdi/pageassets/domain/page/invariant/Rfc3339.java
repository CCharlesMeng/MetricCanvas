package com.huawei.cdi.pageassets.domain.page.invariant;

import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 基线用 `Date.parse` 判定 capturedAt；这里复现 V8 对 ISO 8601 日期时间的字段范围校验
 * （月 1–12、日 1–31、时 0–23 或 24:00、分秒 0–59、时区小时 0–23）。结构校验已保证形状为
 * `YYYY-MM-DDTHH:mm:ss(.sss)?(Z|±HH:mm)`，其它形状退到 java.time 的严格解析。
 */
final class Rfc3339 {
    private static final Pattern ISO = Pattern.compile(
            "^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2}):(\\d{2})(?:\\.(\\d{1,3}))?(Z|[+-]\\d{2}:\\d{2})$");

    private Rfc3339() {
    }

    static boolean parses(String value) {
        if (value == null) {
            return false;
        }
        Matcher matcher = ISO.matcher(value);
        if (!matcher.matches()) {
            try {
                OffsetDateTime.parse(value);
                return true;
            } catch (DateTimeParseException invalid) {
                return false;
            }
        }
        int month = Integer.parseInt(matcher.group(2));
        int day = Integer.parseInt(matcher.group(3));
        int hour = Integer.parseInt(matcher.group(4));
        int minute = Integer.parseInt(matcher.group(5));
        int second = Integer.parseInt(matcher.group(6));
        if (month < 1 || month > 12 || day < 1 || day > 31 || minute > 59 || second > 59) {
            return false;
        }
        if (hour > 24 || (hour == 24 && (minute != 0 || second != 0))) {
            return false;
        }
        String zone = matcher.group(8);
        if (!zone.equals("Z")) {
            int zoneHour = Integer.parseInt(zone.substring(1, 3));
            int zoneMinute = Integer.parseInt(zone.substring(4, 6));
            if (zoneHour > 23 || zoneMinute > 59) {
                return false;
            }
        }
        return true;
    }
}
