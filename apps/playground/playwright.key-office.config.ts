import {defineConfig} from '@playwright/test';

const port=process.env.MC_PLAYGROUND_PORT??'5296';
const origin=`http://127.0.0.1:${port}`;
export default defineConfig({
  testDir:'../../packages/embed/tests/browser',testMatch:'key-office-priority.spec.ts',timeout:30000,
  use:{baseURL:origin,channel:'chrome',headless:true,timezoneId:'Asia/Shanghai'},
  webServer:{command:`pnpm dev --host 127.0.0.1 --port ${port} --strictPort`,url:`${origin}/pages/key-office-priority-demo`,reuseExistingServer:false}
});
