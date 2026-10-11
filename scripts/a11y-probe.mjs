// What the accessibility tree holds for each bar in ?gallery. Chromium through CDP's
// Accessibility domain; Firefox and WebKit through Playwright's aria snapshot.
import { spawn } from 'node:child_process';
import { chromium, firefox, webkit } from '@playwright/test';

const PORT = 4374;
const server = spawn(process.execPath, ['server/server.mjs'], { env: { ...process.env, PORT: String(PORT) } });
await new Promise((resolve) => server.stdout.once('data', resolve));
try {
  for (const engine of [chromium, firefox, webkit]) {
    const browser = await engine.launch();
    const page = await browser.newPage();
    await page.goto(`http://localhost:${PORT}/?gallery`);
    await page.waitForSelector('[data-phase=failed]');
    if (engine === chromium) {
      const cdp = await page.context().newCDPSession(page);
      const { nodes } = await cdp.send('Accessibility.getFullAXTree');
      for (const n of nodes.filter((n) => n.role?.value === 'progressbar')) {
        const props = Object.fromEntries((n.properties ?? []).map((p) => [p.name, p.value.value]));
        console.log('chromium', JSON.stringify({ name: n.name?.value, value: n.value?.value, ...props }));
      }
    }
    console.log(engine.name(), 'ariaSnapshot:\n' + await page.locator('main').ariaSnapshot());
    await browser.close();
  }
} finally {
  server.kill();
}
