import { expect, test } from '@playwright/test';
import { hex, near, pixel } from './helpers';

const LIGHT = { track: '#e2e8f0', fill: '#0284c7', soft: '#7dd3fc', ok: '#16a34a' };
const DARK = { fill: '#38bdf8' };

async function gallery(page: import('@playwright/test').Page) {
  await page.goto('/?gallery');
  await page.waitForSelector('[data-phase=failed]');
  return page.locator('app-upload-bar progress');
}

test('a progress element without a value attribute is indeterminate', async ({ page }) => {
  const bars = await gallery(page);
  const processing = bars.nth(1);
  expect(await processing.getAttribute('value')).toBeNull();
  expect(await processing.evaluate((p: HTMLProgressElement) => p.position)).toBe(-1);
  expect(await processing.evaluate((p) => p.matches(':indeterminate'))).toBe(true);
});

test('binding [value] to null gives value="0", not an indeterminate bar', async ({ page }) => {
  await gallery(page);
  const bar = page.locator('#property-null');
  expect(await bar.getAttribute('value')).toBe('0');
  expect(await bar.evaluate((p: HTMLProgressElement) => p.position)).toBe(0);
});

test('the styled bar draws the same in this engine: fill, track, stripe, done', async ({ page }) => {
  const bars = await gallery(page);

  const sending = await bars.nth(0).screenshot();
  expect(near(pixel(sending, 0.3), hex(LIGHT.fill))).toBe(true);
  expect(near(pixel(sending, 0.85), hex(LIGHT.track))).toBe(true);

  const done = await bars.nth(2).screenshot();
  expect(near(pixel(done, 0.9), hex(LIGHT.ok))).toBe(true);

  // The processing stripe: both stripe colours somewhere along the middle row, and it moves.
  const a = await bars.nth(1).screenshot();
  const row = Array.from({ length: 40 }, (_, i) => pixel(a, 0.1 + i * 0.02));
  expect(row.some((c) => near(c, hex(LIGHT.fill), 20))).toBe(true);
  expect(row.some((c) => near(c, hex(LIGHT.soft), 20))).toBe(true);
  await page.waitForTimeout(250);
  const b = await bars.nth(1).screenshot();
  expect(a.equals(b)).toBe(false);
});

test('dark mode switches the fill colour through light-dark()', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  const bars = await gallery(page);
  const sending = await bars.nth(0).screenshot();
  expect(near(pixel(sending, 0.3), hex(DARK.fill))).toBe(true);
});

test('reduced motion stops the stripe', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const bars = await gallery(page);
  const a = await bars.nth(1).screenshot();
  await page.waitForTimeout(250);
  const b = await bars.nth(1).screenshot();
  expect(a.equals(b)).toBe(true);
});

test('appearance: none without :indeterminate rules loses the busy animation', async ({ page, browserName }) => {
  await page.goto('/probe.html');
  const bar = page.locator('#nnone'); // appearance: none, fill colour set, no value, no :indeterminate rules
  const a = await bar.screenshot();
  await page.waitForTimeout(300);
  const b = await bar.screenshot();
  expect(a.equals(b)).toBe(true); // nothing moves

  // Firefox paints ::-moz-progress-bar across the whole bar; Chromium and WebKit leave the track empty.
  const middle = pixel(a, 0.5);
  if (browserName === 'firefox') expect(near(middle, hex(LIGHT.fill))).toBe(true);
  else expect(near(middle, hex(LIGHT.track))).toBe(true);

  // The browser's own indeterminate bar does move.
  const d1 = await page.locator('#dnone').screenshot();
  await page.waitForTimeout(300);
  const d2 = await page.locator('#dnone').screenshot();
  expect(d1.equals(d2)).toBe(false);
});
