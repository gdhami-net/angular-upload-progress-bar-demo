import { expect, test } from '@playwright/test';
import { file, phasesOf, recordBar, serverLog, snapshots, timeline } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.request.post('/api/log/reset');
  await recordBar(page);
});

test('goes sending, then processing, then done, and blocks a second click until then', async ({ page }) => {
  // The server reads at 4 MB/s, so a 4 MB file spends about a second in "sending".
  await page.goto('/?delay=2000&kbps=4000');
  await page.setInputFiles('input[type=file]', file(4));
  await page.click('button.send');
  await page.waitForSelector('.upload[data-phase=done]', { timeout: 20_000 });

  const list = await snapshots(page);
  expect(phasesOf(list)).toEqual(['idle', 'sending', 'processing', 'done']);

  const sending = list.filter((s) => s.phase === 'sending');
  expect(sending.every((s) => /^Uploading \d+%$/.test(s.valuetext ?? ''))).toBe(true);
  expect(sending.some((s) => Number(s.value) > 0 && Number(s.value) < 100)).toBe(true);

  const processing = list.filter((s) => s.phase === 'processing');
  expect(processing.every((s) => s.value === null && s.valuetext === 'Processing')).toBe(true);
  expect([...sending, ...processing].every((s) => s.uploadDisabled)).toBe(true);

  const done = list.at(-1)!;
  expect(done).toMatchObject({ phase: 'done', value: '100', valuetext: 'Done', uploadDisabled: false });
});

test('the last UploadProgress arrives about two seconds before the Response', async ({ page }) => {
  await page.goto('/?delay=2000');
  await page.setInputFiles('input[type=file]', file(5));
  await page.click('button.send');
  await page.waitForSelector('.upload[data-phase=done]', { timeout: 20_000 });

  const events = await timeline(page);
  const lastProgress = events.filter((e) => e.type === 'UploadProgress').at(-1)!;
  const response = events.find((e) => e.type === 'Response')!;
  const gap = response.t - lastProgress.t;
  console.log(`${test.info().project.name}: last UploadProgress -> Response = ${gap.toFixed(0)} ms`);
  expect(lastProgress.loaded).toBe(lastProgress.total);
  expect(gap).toBeGreaterThan(1500);
  expect(gap).toBeLessThan(3000);
});

test('every UploadProgress for a FormData body carries total', async ({ page }) => {
  await page.goto('/?delay=0&kbps=4000');
  await page.setInputFiles('input[type=file]', file(2));
  await page.click('button.send');
  await page.waitForSelector('.upload[data-phase=done]', { timeout: 20_000 });

  const progress = (await timeline(page)).filter((e) => e.type === 'UploadProgress');
  expect(progress.length).toBeGreaterThan(0);
  expect(progress.every((e) => typeof e.total === 'number' && e.total > 0)).toBe(true);
});

test('without total the bar stays indeterminate and never claims "processing"', async ({ page }) => {
  await page.goto('/?delay=2000&kbps=4000&dropTotal=1');
  await page.setInputFiles('input[type=file]', file(2));
  await page.click('button.send');
  await page.waitForSelector('.upload[data-phase=done]', { timeout: 20_000 });

  const list = await snapshots(page);
  expect(phasesOf(list)).toEqual(['idle', 'sending', 'done']);
  // "Uploading 0%" until the first event, then no value and no number until the response.
  const lastSending = list.filter((s) => s.phase === 'sending').at(-1);
  expect(lastSending).toMatchObject({ value: null, valuetext: 'Uploading' });
});

test('a server error after the last byte ends in failed', async ({ page }) => {
  await page.goto('/?delay=1000&fail=1&kbps=4000');
  await page.setInputFiles('input[type=file]', file(2));
  await page.click('button.send');
  await page.waitForSelector('.upload[data-phase=failed]', { timeout: 20_000 });

  const list = await snapshots(page);
  expect(phasesOf(list)).toEqual(['idle', 'sending', 'processing', 'failed']);
  expect(list.at(-1)).toMatchObject({ valuetext: 'Upload failed', value: '100' });
});

test('cancel while processing aborts the request, and the server sees it', async ({ page }) => {
  await page.goto('/?delay=3000');
  await page.setInputFiles('input[type=file]', file(1));
  await page.click('button.send');
  await page.waitForSelector('.upload[data-phase=processing]');
  await page.click('button.cancel');

  await expect.poll(async () => (await serverLog(page)).at(-1)?.abortedWhile).toBe('processing');
  const [entry] = await serverLog(page);
  expect(entry.answeredAt).toBeUndefined();
  expect(entry.bytes).toBe(entry.contentLength);
  expect((await timeline(page)).some((e) => e.type === 'Response')).toBe(false);
  expect((await snapshots(page)).at(-1)).toMatchObject({ phase: 'cancelled', valuetext: 'Cancelled', value: '0' });
});

test('cancel while sending aborts the upload part-way', async ({ page }) => {
  // 1 MB/s for 6 MB: the upload is nowhere near done when we cancel.
  await page.goto('/?delay=2000&kbps=1000');
  await page.setInputFiles('input[type=file]', file(6));
  await page.click('button.send');
  await page.waitForFunction(() => Number(document.querySelector('progress')?.getAttribute('value')) > 0);
  await page.click('button.cancel');

  await expect.poll(async () => (await serverLog(page)).at(-1)?.abortedWhile).toBe('receiving');
  const [entry] = await serverLog(page);
  expect(entry.bytes).toBeLessThan(entry.contentLength);
});
