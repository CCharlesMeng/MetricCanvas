import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/browser',testMatch:'ioc-navigation.spec.ts',timeout:30000,use:{baseURL:'http://127.0.0.1:4208',channel:'chrome',headless:true}});
