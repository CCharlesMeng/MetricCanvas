package com.huawei.cdi.pageassets.adapter.inbound.rest;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.SerializerProvider;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

/**
 * `createdAt` 固定为 UTC 毫秒精度 `yyyy-MM-dd'T'HH:mm:ss.SSS'Z'`（基线 `Date#toISOString`），
 * 不随毫秒为零而省略小数位。
 */
public final class UtcMillisSerializer extends JsonSerializer<OffsetDateTime> {
    private static final DateTimeFormatter FORMAT = DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss.SSS'Z'");

    @Override
    public void serialize(OffsetDateTime value, JsonGenerator generator, SerializerProvider serializers)
            throws IOException {
        generator.writeString(FORMAT.format(value.withOffsetSameInstant(ZoneOffset.UTC)));
    }
}
