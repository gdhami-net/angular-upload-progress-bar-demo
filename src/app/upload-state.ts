import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { Subscription } from 'rxjs';

export type Phase = 'idle' | 'sending' | 'processing' | 'done' | 'failed' | 'cancelled';

/** The words every design puts in aria-valuetext. */
export function phaseText(phase: Phase, percent: number | null): string {
  switch (phase) {
    case 'sending':
      return percent === null ? 'Uploading' : `Uploading ${percent}%`;
    case 'processing': return 'Processing';
    case 'done': return 'Done';
    case 'failed': return 'Upload failed';
    case 'cancelled': return 'Cancelled';
    default: return 'Ready';
  }
}

/** The bar's value: null while the server works (no number), 100 once it has answered. */
export function barValue(phase: Phase, percent: number | null): number | null {
  if (phase === 'processing') return null;
  if (phase === 'done' || phase === 'failed') return 100;
  if (phase === 'sending') return percent;
  return 0;
}

/**
 * The one upload state every design reads: a phase and a percentage, set from
 * HttpClient's event stream. The designs only draw these two signals.
 */
@Injectable()
export class UploadState {
  private readonly http = inject(HttpClient);
  readonly url = signal('/api/upload');

  readonly phase = signal<Phase>('idle');
  readonly percent = signal<number | null>(0);
  readonly busy = computed(() => this.phase() === 'sending' || this.phase() === 'processing');
  private sub?: Subscription;

  send(file: File) {
    if (this.busy()) return; // a second click while busy does nothing
    const body = new FormData();
    body.append('file', file);
    this.phase.set('sending');
    this.percent.set(0);

    this.sub = this.http
      .post(this.url(), body, { observe: 'events', reportUploadProgress: true })
      .subscribe({
        next: (event) => {
          if (event.type === HttpEventType.UploadProgress) {
            if (event.total) {
              this.percent.set(Math.round((100 * event.loaded) / event.total));
              // The last byte has left the browser. The server hasn't answered yet.
              if (event.loaded === event.total) this.phase.set('processing');
            } else {
              this.percent.set(null);
            }
          } else if (event.type === HttpEventType.Response) {
            this.phase.set('done');
          }
        },
        error: () => this.phase.set('failed'),
      });
  }

  cancel() {
    this.sub?.unsubscribe(); // HttpXhrBackend calls xhr.abort() on teardown
    this.phase.set('cancelled');
    this.percent.set(0);
  }
}
