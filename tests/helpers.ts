import { Page } from '@playwright/test';
import { PNG } from 'pngjs';

export interface Snapshot {
  phase: string;
  valuetext: string | null;
  value: string | null; // the value attribute; null means it isn't there (indeterminate)
  uploadDisabled: boolean;
  t: number;
}

declare global {
  interface Window {
    __snapshots: Snapshot[];
    __timeline: { type: string; t: number; loaded?: number; total?: number }[];
  }
}

/** Records the bar's phase and aria attributes every time the DOM changes. */
export async function recordBar(page: Page) {
  await page.addInitScript(() => {
    window.__snapshots = [];
    new MutationObserver(() => {
      const host = document.querySelector('.upload');
      const bar = host?.querySelector('progress');
      if (!host || !bar) return;
      const s = {
        phase: host.getAttribute('data-phase') ?? '',
        valuetext: bar.getAttribute('aria-valuetext'),
        value: bar.getAttribute('value'),
        uploadDisabled: (host.querySelector('button.send') as HTMLButtonElement).disabled,
        t: performance.now(),
      };
      const last = window.__snapshots.at(-1);
      if (!last || last.phase !== s.phase || last.valuetext !== s.valuetext || last.value !== s.value) {
        window.__snapshots.push(s);
      }
    }).observe(document, { subtree: true, attributes: true, childList: true, characterData: true });
  });
}

export const snapshots = (page: Page) => page.evaluate(() => window.__snapshots);
export const timeline = (page: Page) => page.evaluate(() => window.__timeline);

export function phasesOf(list: Snapshot[]) {
  return list.map((s) => s.phase).filter((p, i, all) => p !== all[i - 1]);
}

export const file = (mb: number) => ({
  name: 'scan-me.bin',
  mimeType: 'application/octet-stream',
  buffer: Buffer.alloc(mb * 1024 * 1024, 7),
});

export async function serverLog(page: Page) {
  return (await page.request.get('/api/log')).json();
}

/** RGB of the pixel at (fx, 0.5) of an element screenshot, fx as a fraction of its width. */
export function pixel(png: Buffer, fx: number): [number, number, number] {
  const img = PNG.sync.read(png);
  const x = Math.floor(img.width * fx);
  const y = Math.floor(img.height / 2);
  const i = (img.width * y + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}

export function hex(color: string): [number, number, number] {
  const n = parseInt(color.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function near(a: [number, number, number], b: [number, number, number], tolerance = 8) {
  return a.every((v, i) => Math.abs(v - b[i]) <= tolerance);
}
