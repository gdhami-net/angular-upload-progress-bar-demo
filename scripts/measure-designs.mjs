// Measurements for the six designs. Needs `npm run build` first; starts its own server on port 4374.
//   1. bytes of CSS per design (source file, and gzipped)
//   2. Angular renders during a ~4-second upload, one design on the page at a time (?only=<design>)
//   3. frame timing during that upload, sampled with requestAnimationFrame (Chromium only)
//   4. whether the file card's shimmer on the vendor pseudo-elements moves, and whether
//      document.getAnimations() reports it, per engine
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { chromium, firefox, webkit } from '@playwright/test';

const PORT = 4374;
const DESIGNS = ['file-card', 'ring', 'segmented', 'button', 'page-top', 'stepper'];
const CSS = { 'file-card': 'file-card', ring: 'ring', segmented: 'segmented', button: 'button-bar', 'page-top': 'page-top', stepper: 'stepper' };

console.log('CSS per design (source bytes / gzipped):');
for (const d of DESIGNS) {
  const css = await readFile(`src/app/designs/${CSS[d]}.css`);
  console.log(`  ${d.padEnd(10)} ${String(css.length).padStart(5)} / ${gzipSync(css).length}`);
}

const server = spawn(process.execPath, ['server/server.mjs'], { env: { ...process.env, PORT: String(PORT) } });
await new Promise((resolve) => server.stdout.once('data', resolve));
const file = { name: 'site-photos.zip', mimeType: 'application/zip', buffer: Buffer.alloc(10 * 1024 * 1024, 7) };

try {
  // 2 and 3: 10 MB, the server reads at 2,560 KB/s (about 4 s of sending), then waits 2 s.
  for (const engine of [chromium, firefox, webkit]) {
    const browser = await engine.launch();
    console.log(`\n${engine.name()} ${browser.version()}: 10 MB at 2,560 KB/s, then 2 s of server work`);
    for (const d of ['none', ...DESIGNS]) {
      const page = await browser.newPage();
      await page.goto(`http://localhost:${PORT}/?only=${d}&delay=2000&kbps=2560`);
      await page.setInputFiles('input[type=file]', file);
      await page.evaluate(() => {
        window.__frames = [];
        const tick = (t) => { window.__frames.push(t); window.__raf = requestAnimationFrame(tick); };
        window.__raf = requestAnimationFrame(tick);
      });
      const before = await page.evaluate(() => window.__renders);
      await page.click('button.send');
      await page.waitForSelector('.upload[data-phase=processing]', { timeout: 30000 });
      const atLastByte = await page.evaluate(() => window.__renders);
      await page.waitForSelector('.upload[data-phase=done]', { timeout: 30000 });
      const { renders, frames, events } = await page.evaluate(() => {
        cancelAnimationFrame(window.__raf);
        return {
          renders: window.__renders,
          frames: window.__frames,
          events: window.__timeline.filter((e) => e.type === 'UploadProgress').length,
        };
      });
      const gaps = frames.slice(1).map((t, i) => t - frames[i]);
      const long = gaps.filter((g) => g > 25).length;
      const max = Math.max(...gaps);
      const line = `  ${d.padEnd(10)} events ${String(events).padStart(3)}  renders ${String(renders - before).padStart(3)} (${atLastByte - before} while sending)`;
      console.log(engine === chromium ? `${line}  frames ${gaps.length}, over 25 ms: ${long}, longest ${max.toFixed(1)} ms` : line);
      await page.close();
    }
    await browser.close();
  }

  // 4: the shimmer lives on ::-webkit-progress-value / ::-moz-progress-bar.
  console.log('\nfile card shimmer while sending (preview at 64%):');
  for (const engine of [chromium, firefox, webkit]) {
    const browser = await engine.launch();
    const page = await browser.newPage();
    await page.goto(`http://localhost:${PORT}/?only=file-card&preview=sending&percent=64`);
    const bar = page.locator('[data-design=file-card] progress');
    const a = await bar.screenshot();
    await page.waitForTimeout(400);
    const b = await bar.screenshot();
    const listed = await page.evaluate(() =>
      document.getAnimations().map((x) => `${x.animationName}${x.effect.pseudoElement ? ' on ' + x.effect.pseudoElement : ''}`),
    );
    console.log(`  ${engine.name().padEnd(9)} moves: ${!a.equals(b)}  getAnimations(): ${JSON.stringify(listed)}`);
    await browser.close();
  }
} finally {
  server.kill();
}
