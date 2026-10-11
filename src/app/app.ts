import { Component, afterEveryRender, afterNextRender, viewChildren } from '@angular/core';
import { UploadBar } from './upload-bar';

declare global {
  interface Window {
    __renders: number;
  }
}

const params = new URLSearchParams(location.search);

@Component({
  selector: 'app-root',
  imports: [UploadBar],
  template: `
    <main>
      <h1>Upload progress bar</h1>
      @if (gallery) {
        <section class="gallery">
          @for (s of states; track s) {
            <app-upload-bar [attr.data-preview]="s" />
          }
          <div class="custom" role="progressbar" aria-label="Upload" aria-valuemin="0" aria-valuemax="100"
               aria-valuenow="64" aria-valuetext="Uploading 64%"><div class="custom-fill" style="width: 64%"></div></div>
          <!-- A property binding to null: the DOM turns it into value="0", so the bar is NOT indeterminate. -->
          <progress id="property-null" max="100" [value]="nothing"></progress>
        </section>
      } @else {
        <app-upload-bar [url]="url" />
      }
    </main>
  `,
  styles: `
    main { max-width: 560px; margin: 48px auto; padding: 0 16px; font-family: system-ui, sans-serif; }
    .gallery { display: grid; gap: 28px; }
    .custom { height: 10px; border-radius: 999px; overflow: hidden; background: #e2e8f0; }
    .custom-fill { height: 100%; background: #0284c7; }
  `,
})
export class App {
  // The endpoint waits ?delay ms after the last byte (2 s by default); ?fail=1 makes it answer 500.
  protected readonly url =
    `/api/upload?delay=${params.get('delay') ?? 2000}&fail=${params.get('fail') ?? 0}&kbps=${params.get('kbps') ?? 0}`;

  // ?gallery shows one bar per phase, for the cross-browser styling checks.
  protected readonly gallery = params.has('gallery');
  protected readonly states = ['sending', 'processing', 'done', 'failed'] as const;
  protected readonly nothing = null as unknown as number;
  private readonly bars = viewChildren(UploadBar);

  constructor() {
    window.__renders = 0;
    afterEveryRender(() => window.__renders++);
    afterNextRender(() => {
      this.bars().forEach((bar, i) => {
        if (!this.gallery) return;
        bar.phase.set(this.states[i]);
        bar.percent.set(64);
      });
    });
  }
}
