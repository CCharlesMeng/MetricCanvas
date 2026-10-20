import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('导出图片使用独立文档和真实3倍图表，只下载一张可解码PNG且无父层水印', async ({page},testInfo) => {
  test.setTimeout(120_000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(() => {
    const OriginalWorker = Worker;
    window.Worker = class extends OriginalWorker {
      constructor(url:string|URL, options?:WorkerOptions) {
        super(url,options);
        const view=document.querySelector<HTMLIFrameElement>('[data-report-export-frame]')?.contentDocument?.querySelector<HTMLElement>('[data-export-view]');
        if(view) {
          const chart=view.querySelector<HTMLImageElement>('[data-export-chart] img');
          (window as any).imageFacts={width:view.getBoundingClientRect().width,height:view.getBoundingClientRect().height,chartWidth:chart?.width,chartPixels:chart?.naturalWidth,title:view.querySelector('h1')?.textContent,parentStage:!!document.querySelector('[data-export-view]'),bg:getComputedStyle(view.parentElement!).backgroundImage};
        }
      }
    };
  });
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/examples/report-image-download.html');
  await page.addStyleTag({content:'body::after{content:"PORTAL WATERMARK";position:fixed;inset:0;background:#ff00ff;opacity:.35;pointer-events:none;z-index:99999} [data-export-view]::before{content:"PARENT ONLY";display:block;height:80px;background:#ff00ff}'});
  await page.evaluate(()=>{const layer=document.createElement('div');layer.id='portal-watermark';layer.style.cssText='position:fixed;inset:0;background:#ff00ff;opacity:.2;pointer-events:none;z-index:99998';document.body.append(layer);});
  const toolbar=page.locator('[data-report-toolbar]').first();
  await expect(toolbar.getByRole('button',{name:'导出 PDF',exact:true})).toBeVisible();
  const imageButton=toolbar.getByRole('button',{name:'导出图片',exact:true});
  await expect(imageButton).toBeVisible();
  await expect(page.getByRole('menuitem')).toHaveCount(0);
  let downloads=0;page.on('download',()=>downloads++);
  const event=page.waitForEvent('download',{timeout:90_000});
  await imageButton.click();
  await expect(toolbar.locator('[data-report-pdf-download]')).toBeDisabled();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const download=await event;expect(download.suggestedFilename()).toBe('经营分析报告-2026-09.png');
  const facts=await page.evaluate(()=>(window as any).imageFacts);
  expect(facts.parentStage).toBe(false);expect(facts.bg).toBe('none');
  expect(facts.chartPixels).toBeGreaterThanOrEqual(facts.chartWidth*3-1);
  await download.saveAs(testInfo.outputPath('report-image.png'));
  const bytes=await readFile((await download.path())!);
  expect([...bytes.subarray(0,8)]).toEqual([137,80,78,71,13,10,26,10]);
  expect(bytes.readUInt32BE(16)).toBe(Math.ceil(facts.width*3));expect(bytes.readUInt32BE(20)).toBe(Math.ceil(facts.height*3));
  const decoded=await page.evaluate(async base64=>{
    const image=await createImageBitmap(await (await fetch('data:image/png;base64,'+base64)).blob());
    const canvas=new OffscreenCanvas(image.width,1),context=canvas.getContext('2d')!;
    let magenta=0;
    for(let y=0;y<image.height;y+=31){context.drawImage(image,0,y,image.width,1,0,0,image.width,1);const row=context.getImageData(0,0,image.width,1).data;for(let x=0;x<row.length;x+=4)if(row[x]>245&&row[x+1]<10&&row[x+2]>245)magenta++;}
    const dimensions={width:image.width,height:image.height,magenta};image.close();return dimensions;
  },bytes.toString('base64'));
  expect(decoded.magenta).toBe(0);expect(decoded.width).toBe(bytes.readUInt32BE(16));
  expect(downloads).toBe(1);await expect(page.locator('#portal-watermark')).toHaveCount(1);
  await expect(page.locator('[data-report-export-frame], [data-report-pdf-frame]')).toHaveCount(0);
  await expect(imageButton).toBeEnabled();
  expect(errors).toEqual([]);
  await testInfo.attach('image-facts',{body:Buffer.from(JSON.stringify({...facts,...decoded,bytes:bytes.length})),contentType:'application/json'});
});

test('超出单块预算的完整长报告也只有一个PNG文件', async ({page},testInfo) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    const Original=Worker;
    window.Worker=class extends Original {
      constructor(url:string|URL,options?:WorkerOptions) {
        super(url,options);
        const view=document.querySelector<HTMLIFrameElement>('[data-report-export-frame]')?.contentDocument?.querySelector<HTMLElement>('[data-export-view]');
        if(!view)return;
        // Pixel rulers exercise screenshot block joins without changing the author configuration.
        view.style.position='relative';
        const height=view.getBoundingClientRect().height;
        for(let index=0;index*64<height;index++) {
          const marker=view.ownerDocument.createElement('div');
          marker.style.cssText=`position:absolute;left:0;top:${index*64}px;width:8px;height:64px;background:rgb(${(index*43+17)%256},${(index*61+29)%256},${(index*79+41)%256});z-index:999;`;
          view.append(marker);
        }
      }
    };
  });
  await page.goto('/examples/report-image-download.html?page=report-png-long-export');
  let count=0;page.on('download',()=>count++);
  const pending=page.waitForEvent('download',{timeout:90_000});
  await page.locator('[data-report-image-download]').click();
  const download=await pending;expect(download.suggestedFilename()).toBe('单张长报告.png');
  await download.saveAs(testInfo.outputPath('report-image-long.png'));
  const file=await readFile((await download.path())!);
  const width=file.readUInt32BE(16),height=file.readUInt32BE(20);
  expect(height).toBeGreaterThan(8192);expect(width*height).toBeGreaterThan(16_777_216);
  const scale = 3;
  const decoded=await page.evaluate(async ({base64,scale})=>{
    const image=await createImageBitmap(await (await fetch('data:image/png;base64,'+base64)).blob());
    const context=new OffscreenCanvas(1,1).getContext('2d')!;
    let mismatches=0;
    // Every output row, including both sides of every screenshot block join.
    for(let y=0;y<image.height;y++) {
      context.drawImage(image,4,y,1,1,0,0,1,1);
      const pixel=context.getImageData(0,0,1,1).data,index=Math.floor(y/(64*scale));
      if(pixel[0]!==((index*43+17)%256)||pixel[1]!==((index*61+29)%256)||pixel[2]!==((index*79+41)%256))mismatches++;
    }
    const result={width:image.width,height:image.height,mismatches};image.close();return result;
  },{base64:file.toString('base64'),scale});
  expect([decoded.width,decoded.height]).toEqual([width,height]);expect(decoded.mismatches).toBe(0);expect(count).toBe(1);
  await testInfo.attach('long-image-facts',{body:Buffer.from(JSON.stringify({...decoded,bytes:file.length,scale})),contentType:'application/json'});
});

test('Worker失败可重试，销毁清理准备中的独立文档', async ({page}) => {
  await page.addInitScript(()=>{const Original=Worker;(window as any).OriginalWorker=Original;window.Worker=class extends Original{constructor(url:string|URL,options?:WorkerOptions){super(url,options);this.terminate();throw Error('PNG_WORKER_FAILURE');}};});
  await page.goto('/examples/report-image-download.html?page=report-png-long-export');
  await page.locator('[data-report-image-download]').click();
  await expect(page.getByRole('alert')).toContainText('PNG_WORKER_FAILURE');
  await expect(page.locator('[data-report-image-download]')).toBeEnabled();
  await expect(page.locator('[data-report-export-frame]')).toHaveCount(0);
  await page.evaluate(()=>window.Worker=(window as any).OriginalWorker);
  await page.locator('[data-report-image-download]').click();
  await expect(page.locator('[data-report-export-frame]')).toHaveCount(1);
  await page.evaluate(()=>window.runtime.destroy());
  await expect(page.locator('[data-report-export-frame], .html2canvas-container')).toHaveCount(0);
});

test('DPR2和窄容器不叠加倍率，配置3/4倍直接下载，键盘操作且文件名冻结点击时月份', async ({browser}) => {
  test.setTimeout(90_000);
  const context=await browser.newContext({deviceScaleFactor:2,viewport:{width:800,height:800},acceptDownloads:true});
  const page=await context.newPage();
  try {
    await page.addInitScript(()=>{
      const Original=Worker;
      window.Worker=class extends Original {
        constructor(url:string|URL,options?:WorkerOptions){super(url,options);const view=document.querySelector<HTMLIFrameElement>('[data-report-export-frame]')?.contentDocument?.querySelector<HTMLElement>('[data-export-view]');if(view)(window as any).imageLayout={width:view.getBoundingClientRect().width,height:view.getBoundingClientRect().height};}
      };
    });
    await page.goto(`http://127.0.0.1:${process.env.MC_EMBED_EXAMPLE_PORT??4175}/examples/report-image-download.html`);
    const pending=page.waitForEvent('download',{timeout:60_000});
    const button=page.locator('[data-report-image-download]').first();
    await button.focus();await page.keyboard.press('Enter');
    // A later applied filter must not change the captured filename or generated file.
    const month=page.getByRole('combobox',{name:'报告月份',exact:true});
    await month.fill('2026-08');await month.press('Enter');
    await expect(page.getByRole('heading',{level:1}).first()).toHaveText('2026-08 经营分析报告');
    const download=await pending;
    expect(download.suggestedFilename()).toBe('经营分析报告-2026-09.png');
    const bytes=await readFile((await download.path())!);
    const box=await page.evaluate(()=>(window as any).imageLayout);
    expect(bytes.readUInt32BE(16)).toBe(Math.ceil(box.width*3));
    expect(bytes.readUInt32BE(20)).toBe(Math.ceil(box.height*3));
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const high=page.waitForEvent('download',{timeout:60_000});
    await page.locator('[data-report-image-download]').nth(1).click();
    const highBytes=await readFile((await (await high).path())!);
    const highBox=await page.evaluate(()=>(window as any).imageLayout);
    expect(highBytes.readUInt32BE(16)).toBe(Math.ceil(highBox.width*4));
    expect(highBytes.readUInt32BE(20)).toBe(Math.ceil(highBox.height*4));
  } finally {await context.close();}
});


test('同一按钮支持元数据4倍PDF，超单页画布预算时保持配置倍率', async ({page}) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    const Original=Worker;
    window.Worker=class extends Original {
      constructor(url:string|URL, options?:WorkerOptions) {
        super(url,options);
        const original=this.postMessage.bind(this);
        this.postMessage=((data:any,transfer:any)=>{
          if(data.kind==='bitmap') {
            const facts=(window as any).pdfBlocks ??= [];
            facts.push({width:data.bitmap.width,height:data.bitmap.height,slices:data.slices});
          }
          return original(data,transfer);
        }) as typeof this.postMessage;
      }
    };
  });
  await page.goto('/examples/report-image-download.html');
  const pending=page.waitForEvent('download',{timeout:60_000});
  await page.getByRole('button',{name:'导出 PDF（4倍）',exact:true}).click();
  const download=await pending;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  const bytes=await readFile((await download.path())!);
  expect(bytes.subarray(0,5).toString()).toBe('%PDF-');
  await download.saveAs(test.info().outputPath('report-pdf-4x.pdf'));
  const blocks=await page.evaluate(()=>(window as any).pdfBlocks);
  expect(blocks.length).toBeGreaterThan(1);
  expect(blocks[0].width).toBe(4800);
  expect(blocks.every((b:any)=>b.width*b.height<=16_777_216&&b.height<=8192)).toBe(true);
  expect(blocks.flatMap((b:any)=>b.slices).some((s:any)=>s.topMm>0)).toBe(true);
  await expect(page.locator('[data-report-export-frame]')).toHaveCount(0);
});


test('无效scale不会阻止打开，新旧配置均直接下载默认倍率', async ({page}) => {
  test.setTimeout(90_000);
  await page.addInitScript(()=>{
    const Original=Worker;
    window.Worker=class extends Original {
      constructor(url:string|URL,options?:WorkerOptions) {
        super(url,options);
        const view=document.querySelector<HTMLIFrameElement>('[data-report-export-frame]')?.contentDocument?.querySelector<HTMLElement>('[data-export-view]');
        if(view){const chart=view.querySelector<HTMLImageElement>('[data-export-chart] img');(window as any).fallbackView={width:view.getBoundingClientRect().width,height:view.getBoundingClientRect().height,chartWidth:chart?.width,chartPixels:chart?.naturalWidth};}
        const original=this.postMessage.bind(this);
        this.postMessage=((data:any,transfer:any)=>{if(data.kind==='bitmap'&&data.slices)(window as any).fallbackPdfWidth=data.bitmap.width;return original(data,transfer);}) as typeof this.postMessage;
      }
    };
  });
  await page.goto('/examples/report-image-download.html?page=report-export-scale-fallback');
  await expect(page.locator('[data-report-pdf-download]')).toBeVisible();
  for (const index of [0,1]) {
    const pending=page.waitForEvent('download',{timeout:60_000});
    await page.locator('[data-report-image-download]').nth(index).click();
    const download=await pending;
    const bytes=await readFile((await download.path())!);
    expect(bytes.subarray(0,8)).toEqual(Buffer.from([137,80,78,71,13,10,26,10]));
    const facts=await page.evaluate(()=>(window as any).fallbackView);
    expect(bytes.readUInt32BE(16)).toBe(Math.ceil(facts.width*3));
    expect(bytes.readUInt32BE(20)).toBe(Math.ceil(facts.height*3));
    expect(facts.chartPixels).toBeGreaterThanOrEqual(facts.chartWidth*3-1);
  }
  const pending=page.waitForEvent('download',{timeout:60_000});
  await page.locator('[data-report-pdf-download]').click();
  const bytes=await readFile((await (await pending).path())!);
  expect(bytes.subarray(0,5).toString()).toBe('%PDF-');
  const facts=await page.evaluate(()=>({width:(window as any).fallbackView.width,bitmapWidth:(window as any).fallbackPdfWidth}));
  expect(facts.bitmapWidth).toBe(Math.floor(facts.width*2));
});
