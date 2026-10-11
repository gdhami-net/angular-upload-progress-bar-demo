// Prints the measurements the post quotes: one upload per browser engine against the
// 2-second endpoint, with the gap between the last UploadProgress and the Response.
// Needs `npm run build` first; starts its own server on port 4371.
import { spawn } from 'node:child_process';
import { chromium, firefox, webkit } from '@playwright/test';

const PORT = 4371;
const SIZE_MB = Number(process.argv[2] ?? 5);
const KBPS = Number(process.argv[3] ?? 0); // 0: the server reads as fast as it can
const server = spawn(process.execPath, ['server/server.mjs'], { env: { ...process.env, PORT: String(PORT) } });
await new Promise((resolve) => server.stdout.once('data', resolve));

const file = { name: 'scan-me.bin', mimeType: 'application/octet-stream', buffer: Buffer.alloc(SIZE_MB * 1024 * 1024, 7) };

try {
  for (const engine of [chromium, firefox, webkit]) {
    const browser = await engine.launch();
    const page = await browser.newPage();
    await page.addInitScript(() => {
      window.__phases = [];
      new MutationObserver(() => {
        const phase = document.querySelector('.upload')?.getAttribute('data-phase');
        const last = window.__phases.at(-1);
        if (phase && phase !== last?.phase) window.__phases.push({ phase, t: performance.now() });
      }).observe(document, { subtree: true, attributes: true, childList: true });
    });
    await page.goto(`http://localhost:${PORT}/?delay=2000&kbps=${KBPS}`);
    await page.setInputFiles('input[type=file]', file);
    const rendersBefore = await page.evaluate(() => window.__renders);
    await page.click('button.send');
    await page.waitForSelector('.upload[data-phase=done]', { timeout: 20000 });

    const { timeline, phases, renders } = await page.evaluate(() => ({
      timeline: window.__timeline, phases: window.__phases, renders: window.__renders,
    }));
    const progress = timeline.filter((e) => e.type === 'UploadProgress');
    const lastProgress = progress.at(-1);
    const response = timeline.find((e) => e.type === 'Response');
    const sent = timeline.find((e) => e.type === 'Sent');

    console.log(`${engine.name()} ${browser.version()}  ${SIZE_MB} MB${KBPS ? `, server reads at ${KBPS} KB/s` : ''}`);
    console.log(`  UploadProgress events: ${progress.length}, every one with total: ${progress.every((e) => typeof e.total === 'number')}`);
    console.log(`  first: ${progress[0]?.loaded}/${progress[0]?.total}  last: ${lastProgress?.loaded}/${lastProgress?.total}`);
    console.log(`  Sent -> last UploadProgress: ${(lastProgress.t - sent.t).toFixed(0)} ms`);
    console.log(`  last UploadProgress -> Response: ${(response.t - lastProgress.t).toFixed(0)} ms`);
    console.log(`  phases: ${phases.map((p) => p.phase).join(' -> ')}`);
    console.log(`  renders during the upload: ${renders - rendersBefore}`);
    const log = await (await fetch(`http://localhost:${PORT}/api/log`)).json();
    const entry = log.at(-1);
    console.log(`  server: body ${entry.bytes} bytes, read in ${entry.receivedAt - entry.startedAt} ms, answered ${entry.answeredAt - entry.receivedAt} ms later`);
    await fetch(`http://localhost:${PORT}/api/log/reset`, { method: 'POST' });
    await browser.close();
  }
} finally {
  server.kill();
}
