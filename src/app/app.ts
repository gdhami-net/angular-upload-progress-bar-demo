import { Component, afterEveryRender, computed, inject, signal } from '@angular/core';
import { UploadBar } from './upload-bar';
import { Phase, UploadState, phaseText } from './upload-state';
import { FileCard } from './designs/file-card';
import { Ring } from './designs/ring';
import { Segmented } from './designs/segmented';
import { ButtonBar } from './designs/button-bar';
import { PageTop } from './designs/page-top';
import { Stepper } from './designs/stepper';

declare global {
  interface Window {
    __renders: number;
  }
}

const params = new URLSearchParams(location.search);

export const DESIGNS = ['file-card', 'ring', 'segmented', 'button', 'page-top', 'stepper'] as const;

@Component({
  selector: 'app-root',
  imports: [UploadBar, FileCard, Ring, Segmented, ButtonBar, PageTop, Stepper],
  providers: [UploadState],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly state = inject(UploadState);

  // ?gallery shows one classic bar per phase, for the cross-browser styling checks.
  protected readonly gallery = params.has('gallery');
  protected readonly states = ['sending', 'processing', 'done', 'failed'] as const;
  protected readonly nothing = null as unknown as number;

  // ?only=ring shows one design (for the render counts); ?preview=processing&percent=64 freezes the state.
  protected readonly only = params.get('only');
  protected readonly fileName = signal('site-photos.zip');
  protected readonly fileSize = signal(4 * 1024 * 1024);

  // One polite live region for the page: phase changes only, never every percent.
  protected readonly announce = computed(() => {
    const phase = this.state.phase();
    return phase === 'sending' ? 'Uploading' : phase === 'idle' ? '' : phaseText(phase, null);
  });

  constructor() {
    // The endpoint waits ?delay ms after the last byte (2 s by default); ?fail=1 makes it answer 500.
    this.state.url.set(
      `/api/upload?delay=${params.get('delay') ?? 2000}&fail=${params.get('fail') ?? 0}&kbps=${params.get('kbps') ?? 0}`,
    );
    const preview = params.get('preview') as Phase | null;
    if (preview) {
      this.state.phase.set(preview);
      this.state.percent.set(Number(params.get('percent') ?? (preview === 'sending' ? 64 : 100)));
    }
    window.__renders = 0;
    afterEveryRender(() => window.__renders++);
  }

  protected show(design: string) {
    return !this.only || this.only === design;
  }

  protected start(picker: HTMLInputElement) {
    // No file picked: send a 4 MB stand-in, so the designs can be tried without one.
    const file = picker.files?.[0] ?? new File([new Uint8Array(4 * 1024 * 1024)], 'site-photos.zip');
    this.fileName.set(file.name);
    this.fileSize.set(file.size);
    this.state.send(file);
  }
}
