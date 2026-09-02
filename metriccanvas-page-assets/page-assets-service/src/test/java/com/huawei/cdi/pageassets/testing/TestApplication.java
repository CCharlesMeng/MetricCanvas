package com.huawei.cdi.pageassets.testing;

import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.context.annotation.ComponentScan;

/** service module 自己没有 StartUp（那是 bootstrap 的）；契约测试用这个最小装配起 MockMvc。 */
@SpringBootConfiguration
@EnableAutoConfiguration
@ComponentScan("com.huawei.cdi.pageassets")
public class TestApplication {
}
