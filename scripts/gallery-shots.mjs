// Screenshots of ?gallery (one bar per phase plus a div role="progressbar") in all three
// engines, light and dark, into screenshots/. Needs `npm run build` first.
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium, firefox, webkit } from '@playwright/test';

const PORT = 4372;
const server = spawn(process.execPath, ['server/server.mjs'], { env: { ...process.env, PORT: String(PORT) } });
await new Promise((resolve) => server.stdout.once('data', resolve));
await mkdir('screenshots', { recursive: true });
try {
  for (const engine of [chromium, firefox, webkit]) {
    const browser = await engine.launch();
    for (const colorScheme of ['light', 'dark']) {
      const page = await browser.newPage({ colorScheme, viewport: { width: 640, height: 420 } });
      await page.goto(`http://localhost:${PORT}/?gallery`);
      await page.waitForSelector('[data-phase=failed]');
      await page.screenshot({ path: `screenshots/gallery-${engine.name()}-${colorScheme}.png` });
      await page.close();
    }
    await browser.close();
  }
} finally {
  server.kill();
}
