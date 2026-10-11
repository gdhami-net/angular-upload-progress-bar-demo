// What <progress> does with no value attribute, before any styling of mine: two screenshots
// 300 ms apart per engine (do they differ, so is it animated?), plus position/:indeterminate.
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium, firefox, webkit } from '@playwright/test';

const PORT = 4373;
const server = spawn(process.execPath, ['server/server.mjs'], { env: { ...process.env, PORT: String(PORT) } });
await new Promise((resolve) => server.stdout.once('data', resolve));
await mkdir('screenshots', { recursive: true });
try {
  for (const engine of [chromium, firefox, webkit]) {
    const browser = await engine.launch();
    const page = await browser.newPage({ viewport: { width: 620, height: 300 } });
    await page.goto(`http://localhost:${PORT}/probe.html`);
    const facts = await page.evaluate(() => [...document.querySelectorAll('progress')].map((p) => ({
      id: p.id, position: p.position, indeterminate: p.matches(':indeterminate'),
    })));
    const moving = {};
    for (const id of ['dnone', 'nnone']) {
      const a = await page.locator('#' + id).screenshot();
      await page.waitForTimeout(300);
      const b = await page.locator('#' + id).screenshot();
      moving[id] = !a.equals(b);
    }
    await page.screenshot({ path: `screenshots/probe-${engine.name()}.png` });
    // Setting the value property to null: does that make it indeterminate?
    const nullValue = await page.evaluate(() => {
      const p = document.createElement('progress');
      p.max = 100; p.value = 40; p.value = null;
      const viaProperty = { attribute: p.getAttribute('value'), position: p.position };
      p.removeAttribute('value');
      return { viaProperty, afterRemoveAttribute: { position: p.position, indeterminate: p.matches(':indeterminate') } };
    });
    console.log(engine.name(), JSON.stringify({ facts, animated: moving, nullValue }));
    await browser.close();
  }
} finally {
  server.kill();
}
