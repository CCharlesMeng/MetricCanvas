package com.huawei.cdi.pageassets;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * 独立部署入口。并入 CDINL2DataBuilderService 后由宿主的 StartUp 取代，本类随 bootstrap module 丢弃。
 */
@SpringBootApplication
public class StartUp {
    public static void main(String[] args) {
        SpringApplication.run(StartUp.class, args);
    }
}
