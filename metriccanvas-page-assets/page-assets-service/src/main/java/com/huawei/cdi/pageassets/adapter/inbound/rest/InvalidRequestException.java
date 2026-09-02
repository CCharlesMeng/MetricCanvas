package com.huawei.cdi.pageassets.adapter.inbound.rest;

/** 传输层 400：请求形状在进入领域之前就不成立（Bean Validation 覆盖不到的判别结构约束等）。 */
public final class InvalidRequestException extends RuntimeException {
    private static final long serialVersionUID = 1L;

    public InvalidRequestException(String message) {
        super(message);
    }
}
