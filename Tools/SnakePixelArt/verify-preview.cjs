const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.SNAKE_PLAYWRIGHT_MODULE || 'playwright');
const preview = path.resolve(__dirname, '../../ArtPreviews/SnakePixelArt');
async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1360, height: 980 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(pathToFileURL(path.join(preview, 'index.html')).href);
    await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0));
    assert.equal(await page.locator('#tiles figure').count(), 16);
    assert.equal(await page.locator('#stills figure').count(), 15);
    assert.equal(await page.locator('#sequence option').count(), 20);
    await page.getByRole('button', { name: '暂停', exact: true }).click();
    await page.getByRole('button', { name: '第 3 帧', exact: true }).click();
    assert.equal(await page.locator('#counter').textContent(), '3 / 6');
    const frozen = await page.locator('#motion').getAttribute('src');
    await page.waitForTimeout(250);
    assert.equal(await page.locator('#motion').getAttribute('src'), frozen);
    await page.getByRole('button', { name: '重新播放', exact: true }).click();
    const initial = await page.locator('#motion').getAttribute('src');
    await page.waitForFunction(src => document.getElementById('motion').src !== src, initial);
    await page.getByRole('button', { name: '暂停', exact: true }).click();
    for (const option of await page.locator('#sequence option').evaluateAll(nodes => nodes.map(n => n.value))) {
      await page.locator('#sequence').selectOption(option);
      assert.equal(await page.locator('#frames button').count(), option.includes('_idle_') ? 4 : 6);
      await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0));
    }
    await page.locator('#sequence').selectOption('head_turn_up_to_right');
    await page.getByRole('button', { name: '第 3 帧', exact: true }).click();
    await page.screenshot({ path: path.join(preview, 'preview-desktop.png'), fullPage: true });
    const viewports = [{ width: 390, height: 844 }, { width: 320, height: 740 }, { width: 768, height: 1024 }];
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(50);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      assert.equal(overflow, false, `Horizontal overflow at ${viewport.width}`);
      if (viewport.width === 390) await page.screenshot({ path: path.join(preview, 'preview-mobile.png'), fullPage: true });
    }
    assert.deepEqual(errors, []);
    const report = { sequences: 20, grassTiles: 16, controls: 'passed', imageLoads: 'passed', viewports: [1360,390,320,768], horizontalOverflow: false, consoleErrors: errors };
    fs.writeFileSync(path.join(preview, 'preview-validation.json'), JSON.stringify(report, null, 2)+'\n');
    console.log(JSON.stringify(report,null,2));
  } finally { await browser.close(); }
}
main().catch(e=>{console.error(e);process.exitCode=1});
