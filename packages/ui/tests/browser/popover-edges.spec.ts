import { expect, test } from '@playwright/test';

for (const shadow of [false, true]) {
  test(`cramped multi menu scrolls to its last option; shadow=${shadow}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 180 });
    await page.goto(`/tests/browser/index.html?popovers${shadow ? '&shadow' : ''}`);
    const trigger = page.locator('[data-control="multi"] summary');
    await trigger.evaluate(element => element.scrollIntoView({ block: 'center' }));
    await trigger.click();
    const popup = page.locator('.options:popover-open');
    await expect(popup).toBeVisible();
    const anchor = (await trigger.boundingBox())!, panel = (await popup.boundingBox())!;
    expect(panel.y >= anchor.y + anchor.height || panel.y + panel.height <= anchor.y).toBe(true);
    expect(panel.y).toBeGreaterThanOrEqual(7);
    expect(panel.y + panel.height).toBeLessThanOrEqual(173);
    expect(await popup.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
    await popup.getByRole('checkbox', { name: '候选29', exact: true }).check();
    await expect(popup.getByRole('checkbox', { name: '候选29', exact: true })).toBeChecked();
  });

  test(`open multi menu follows document scrolling; shadow=${shadow}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 480 });
    await page.goto(`/tests/browser/index.html?popovers${shadow ? '&shadow' : ''}`);
    const trigger = page.locator('[data-control="multi"] summary');
    await trigger.evaluate(element => element.scrollIntoView({ block: 'start' }));
    await page.evaluate(() => window.scrollBy(0, -80));
    await trigger.click();
    const popup = page.locator('.options:popover-open');
    const before = (await popup.boundingBox())!;
    await page.evaluate(() => window.scrollBy(0, 30));
    await expect.poll(async () => Math.round((await popup.boundingBox())!.y)).toBe(Math.round(before.y - 30));
    await page.setViewportSize({ width: 320, height: 480 });
    await expect.poll(async () => {
      const panel = (await popup.boundingBox())!;
      return panel.x >= 7 && panel.x + panel.width <= 313;
    }).toBe(true);
  });

  for (const kind of ['multi', 'tree', 'range', 'select', 'menu', 'date']) {
    for (const edge of ['start', 'end'] as const) {
      test(`${kind} opens within viewport at ${edge}; shadow=${shadow}`, async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 480 });
        await page.goto(`/tests/browser/index.html?popovers${shadow ? '&shadow' : ''}`);
        const control = page.locator(`[data-control="${kind}"]`);
        const trigger = control.locator('summary, .selection-trigger, .mc-ui-button, input').first();
        await trigger.evaluate((element, block) => element.scrollIntoView({ block }), edge);
        await trigger.click();
        const popup = page.locator('.options:visible, .nodes:visible, .panel:visible, [popover]:popover-open');
        await expect(popup).toHaveCount(1);
        await expect.poll(async () => {
          const panel = await popup.boundingBox();
          return !!panel && panel.y >= 7 && panel.y + panel.height <= 473 && panel.x >= 7 && panel.x + panel.width <= 383;
        }).toBe(true);
        const anchor = (await trigger.boundingBox())!, panel = (await popup.boundingBox())!;
        if (kind === 'multi' || kind === 'tree') expect(panel.width).toBeGreaterThanOrEqual(anchor.width);
        if (edge === 'start') expect(panel.y).toBeGreaterThanOrEqual(anchor.y + anchor.height);
        else expect(panel.y + panel.height).toBeLessThanOrEqual(anchor.y);
        await page.keyboard.press('Escape');
        await expect(popup).toHaveCount(0);
      });
    }
  }
}
