import {chromium,expect} from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const output=new URL('../../../docs/evidence/2026-11-03-empty-supplement-key/',import.meta.url);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),results=[];
try{
  for(const state of ['ready','empty','all-empty','failure','truncated']){
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),calls=[],errors=[];
    await page.exposeFunction('recordQuery',query=>calls.push(query));
    await page.addInitScript(()=>window.addEventListener('metriccanvas:synthetic-paged-join',event=>window.recordQuery(event.detail)));
    page.on('console',message=>{if(message.type()==='error'&&message.text().includes('[MetricCanvas]'))errors.push(message.text());});
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:5196/pages/paged-join-on-demand?supplementKey=${state}`);
    const article=page.locator('[data-component$="/projects-table"]');
    if(['failure','truncated'].includes(state)){
      const code=state==='failure'?'DQE_FORBIDDEN':'DQE_ROW_CONTRACT_ERROR';
      await expect.poll(()=>errors.some(error=>error.includes(code))).toBe(true);
      await expect.poll(()=>calls.length).toBe(2);
    }else{
      await expect(article.locator('tbody tr')).toHaveCount(10);
      await expect(article.locator('.total')).toHaveText('总条数： 80');
      await expect.poll(()=>calls.length).toBe(2);
      if(state!=='ready'){
        await expect(article.getByText('部分数据异常，当前展示可用结果',{exact:true})).toBeVisible();
        await article.locator('.data-warning summary').click();
        await expect(article.locator('.data-warning')).toContainText(state==='empty'?'（1）':'（10）');
      }else await expect(article.locator('.data-warning')).toHaveCount(0);
      await article.getByRole('button',{name:'下一页',exact:true}).click();
      await expect(article.locator('tbody tr').first()).toContainText('P000011');
      await expect.poll(()=>calls.length).toBe(4);
      await expect(article.locator('.table-widget')).toHaveAttribute('aria-busy','false');
      expect(errors).toEqual([]);
      if(state==='empty')await article.screenshot({path:fileURLToPath(new URL('browser-empty-key.png',output))});
    }
    expect(calls.every(query=>query.pagination?.limit===10)).toBe(true);
    results.push({state,calls:calls.length,errors,limits:calls.map(query=>query.pagination)});
    await page.close();
  }
  await writeFile(new URL('browser.json',output),JSON.stringify({environment:'local synthetic Playground gateway',passed:true,results},null,2)+'\n');
  console.log(JSON.stringify(results.map(result=>({state:result.state,calls:result.calls,errors:result.errors.length}))));
}finally{await browser.close();}
