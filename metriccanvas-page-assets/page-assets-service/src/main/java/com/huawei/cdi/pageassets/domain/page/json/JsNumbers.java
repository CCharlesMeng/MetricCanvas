package com.huawei.cdi.pageassets.domain.page.json;

import com.fasterxml.jackson.databind.JsonNode;

import java.math.BigDecimal;
import java.math.BigInteger;

/**
 * JavaScript `String(number)` / `JSON.stringify(number)` 的输出规则：整数不带小数点，
 * 指数在 [-7, 21) 之外才用科学计数法，且形如 `1e+21` / `1.5e-7`。
 */
public final class JsNumbers {
    private static final BigDecimal EXPONENT_UPPER = new BigDecimal("1e21");
    private static final BigDecimal EXPONENT_LOWER = new BigDecimal("1e-6");

    private JsNumbers() {
    }

    public static String toString(JsonNode node) {
        if (node.isIntegralNumber()) {
            BigInteger value = node.bigIntegerValue();
            if (value.abs().compareTo(EXPONENT_UPPER.toBigInteger()) < 0) {
                return value.toString();
            }
            return toString(new BigDecimal(value));
        }
        if (node.isDouble() || node.isFloat()) {
            double d = node.doubleValue();
            if (Double.isNaN(d)) {
                return "NaN";
            }
            if (Double.isInfinite(d)) {
                return d > 0 ? "Infinity" : "-Infinity";
            }
            if (d == 0) {
                return "0";
            }
            return toString(new BigDecimal(Double.toString(d)));
        }
        return toString(node.decimalValue());
    }

    public static String toString(BigDecimal value) {
        if (value.signum() == 0) {
            return "0";
        }
        BigDecimal stripped = value.stripTrailingZeros();
        BigDecimal abs = stripped.abs();
        if (abs.compareTo(EXPONENT_UPPER) >= 0 || abs.compareTo(EXPONENT_LOWER) < 0) {
            String digits = stripped.unscaledValue().abs().toString();
            int exponent = digits.length() - 1 - stripped.scale();
            StringBuilder out = new StringBuilder();
            if (stripped.signum() < 0) {
                out.append('-');
            }
            out.append(digits.charAt(0));
            if (digits.length() > 1) {
                out.append('.').append(digits, 1, digits.length());
            }
            out.append('e').append(exponent >= 0 ? "+" : "-").append(Math.abs(exponent));
            return out.toString();
        }
        return stripped.scale() <= 0 ? stripped.toBigInteger().toString() : stripped.toPlainString();
    }
}
