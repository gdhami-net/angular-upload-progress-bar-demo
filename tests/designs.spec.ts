import { expect, test } from '@playwright/test';
import { DESIGNS, designSnapshots, file, infiniteAnimations, phasesOf, recordDesigns, serverLog } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.request.post('/api/log/reset');
  await recordDesigns(page);
});

for (const design of DESIGNS) {
  test.describe(`design: ${design}`, () => {
    const host = (page: import('@playwright/test').Page) => page.locator(`[data-design="${design}"]`);

    test('has exactly one progressbar', async ({ page }) => {
      await page.goto('/?preview=sending&percent=64');
      await expect(host(page).getByRole('progressbar')).toHaveCount(1);
      await expect(host(page).locator('progress, [role=progressbar]')).toHaveCount(1);
    });

    test('goes idle, sending, processing, done, and says so in aria-valuetext', async ({ page }) => {
      // The server reads at 4 MB/s, so a 4 MB file spends about a second in "sending".
      await page.goto('/?delay=1500&kbps=4000');
      await page.setInputFiles('input[type=file]', file(4));
      // The button design starts the upload itself; the others follow the page's Upload button.
      if (design === 'button') await host(page).getByRole('button', { name: 'Upload' }).click();
      else await page.click('button.send');
      await expect(host(page)).toHaveAttribute('data-phase', 'done', { timeout: 20_000 });

      const list = await designSnapshots(page, design);
      expect(phasesOf(list)).toEqual(['idle', 'sending', 'processing', 'done']);
      const sending = list.filter((s) => s.phase === 'sending');
      expect(sending.every((s) => /^Uploading \d+%$/.test(s.valuetext ?? ''))).toBe(true);
      expect(list.filter((s) => s.phase === 'processing').every((s) => s.valuetext === 'Processing')).toBe(true);
      expect(list.at(-1)!.valuetext).toBe('Done');
      expect((await serverLog(page)).length).toBe(1);
    });

    test('a server error ends in "Upload failed"', async ({ page }) => {
      await page.goto('/?delay=500&fail=1&kbps=4000');
      await page.setInputFiles('input[type=file]', file(2));
      await page.click('button.send');
      await expect(host(page)).toHaveAttribute('data-phase', 'failed', { timeout: 20_000 });

      const list = await designSnapshots(page, design);
      expect(phasesOf(list)).toEqual(['idle', 'sending', 'processing', 'failed']);
      expect(list.at(-1)!.valuetext).toBe('Upload failed');
      await expect(host(page)).toContainText('Upload failed');
    });

    test("its own cancel button aborts the request", async ({ page }) => {
      await page.goto('/?delay=3000');
      await page.setInputFiles('input[type=file]', file(1));
      await page.click('button.send');
      await expect(host(page)).toHaveAttribute('data-phase', 'processing');
      // Reached from the keyboard: focus it and press Enter.
      const cancel = host(page).getByRole('button', { name: /cancel/i });
      await cancel.focus();
      await page.keyboard.press('Enter');

      await expect.poll(async () => (await serverLog(page)).at(-1)?.abortedWhile).toBe('processing');
      await expect(host(page)).toHaveAttribute('data-phase', 'cancelled');
      expect((await designSnapshots(page, design)).at(-1)!.valuetext).toBe('Cancelled');
    });

    test('with reduced motion, processing runs no infinite animation and still looks different', async ({ page }) => {
      await page.goto('/?preview=processing');
      expect(await infiniteAnimations(page, design)).toBeGreaterThan(0); // the check below isn't empty by accident

      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForTimeout(100);
      expect(await infiniteAnimations(page, design)).toBe(0);
      await expect(host(page).locator('progress, [role=progressbar]')).toHaveAttribute('aria-valuetext', 'Processing');

      // Still: two shots 300 ms apart match. And the bar isn't the same picture as a full "sending" bar.
      const bar = host(page).locator('progress, [role=progressbar]');
      const a = await bar.screenshot({ animations: 'allow' });
      await page.waitForTimeout(300);
      const b = await bar.screenshot({ animations: 'allow' });
      expect(a.equals(b)).toBe(true);
      await page.goto('/?preview=sending&percent=100');
      const full = await host(page).locator('progress, [role=progressbar]').screenshot({ animations: 'allow' });
      expect(full.equals(a)).toBe(false);
    });
  });
}

test("with reduced motion the file card's shimmer stops too, though getAnimations() can't see it", async ({ page }) => {
  // The shimmer is a CSS animation on ::-webkit-progress-value / ::-moz-progress-bar. It moves,
  // but no engine lists it in document.getAnimations(), so only pixels can show it stopped.
  const bar = page.locator('[data-design="file-card"] progress');
  await page.goto('/?only=file-card&preview=sending&percent=64');
  const moving = [await bar.screenshot(), await page.waitForTimeout(400).then(() => bar.screenshot())];
  expect(moving[0].equals(moving[1])).toBe(false);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(100);
  const still = [await bar.screenshot(), await page.waitForTimeout(400).then(() => bar.screenshot())];
  expect(still[0].equals(still[1])).toBe(true);
});

test('the button design keeps keyboard focus while it is busy, and a second Enter sends nothing', async ({ page }) => {
  await page.goto('/?delay=2000&kbps=4000');
  await page.setInputFiles('input[type=file]', file(2));
  const button = page.locator('[data-design="button"] button.btn');
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-design="button"]')).toHaveAttribute('data-phase', 'processing', { timeout: 20_000 });

  expect(await button.evaluate((b) => b === document.activeElement)).toBe(true);
  await expect(button).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-design="button"]')).toHaveAttribute('data-phase', 'done', { timeout: 20_000 });
  expect((await serverLog(page)).length).toBe(1);
});
