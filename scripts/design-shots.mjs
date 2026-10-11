// 2x screenshots of the six designs, frozen in each state with ?preview=<phase>, in all three
// engines, light and dark: screenshots/designs-<engine>-<light|dark>-<phase>.png.
// Animations are paused at a fixed time so the moving looks (shimmer, spin, wave) are caught mid-motion.
// Needs `npm run build` first. Pass --reduced to take the reduced-motion set (designs-*-reduced-*.png).
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium, firefox, webkit } from '@playwright/test';

const PORT = 4373;
const reduced = process.argv.includes('--reduced');
const PHASES = ['sending', 'processing', 'done', 'failed'];
const server = spawn(process.execPath, ['server/server.mjs'], { env: { ...process.env, PORT: String(PORT) } });
await new Promise((resolve) => server.stdout.once('data', resolve));
await mkdir('screenshots', { recursive: true });
try {
  for (const engine of [chromium, firefox, webkit]) {
    const browser = await engine.launch();
    for (const colorScheme of reduced ? ['light'] : ['light', 'dark']) {
      const page = await browser.newPage({
        colorScheme,
        reducedMotion: reduced ? 'reduce' : 'no-preference',
        viewport: { width: 760, height: 900 },
        deviceScaleFactor: 2,
      });
      for (const phase of reduced ? ['processing'] : PHASES) {
        await page.goto(`http://localhost:${PORT}/?preview=${phase}${phase === 'sending' ? '&percent=64' : ''}`);
        await page.waitForSelector(`[data-design=stepper][data-phase=${phase}]`);
        await page.waitForTimeout(600); // let the finite transitions (check mark, fills) end
        await page.evaluate(() => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 450; }));
        const name = reduced ? `designs-${engine.name()}-reduced-${phase}` : `designs-${engine.name()}-${colorScheme}-${phase}`;
        await page.locator('.designs').screenshot({ path: `screenshots/${name}.png` });
      }
      await page.close();
    }
    await browser.close();
  }
} finally {
  server.kill();
}
