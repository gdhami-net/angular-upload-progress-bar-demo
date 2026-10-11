import { Component, computed, inject, input, signal } from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { Subscription } from 'rxjs';

export type Phase = 'idle' | 'sending' | 'processing' | 'done' | 'failed' | 'cancelled';

@Component({
  selector: 'app-upload-bar',
  templateUrl: './upload-bar.html',
  styleUrl: './upload-bar.css',
})
export class UploadBar {
  private readonly http = inject(HttpClient);
  readonly url = input('/api/upload');

  readonly phase = signal<Phase>('idle');
  readonly percent = signal<number | null>(0);
  private sub?: Subscription;

  // null removes the value attribute, which is what makes <progress> indeterminate.
  readonly value = computed(() => {
    const phase = this.phase();
    if (phase === 'processing') return null;
    if (phase === 'done' || phase === 'failed') return 100;
    return this.percent();
  });

  readonly text = computed(() => {
    switch (this.phase()) {
      case 'sending': {
        const p = this.percent();
        return p === null ? 'Uploading' : `Uploading ${p}%`;
      }
      case 'processing': return 'Processing';
      case 'done': return 'Done';
      case 'failed': return 'Upload failed';
      case 'cancelled': return 'Cancelled';
      default: return 'Ready';
    }
  });

  readonly busy = computed(() => this.phase() === 'sending' || this.phase() === 'processing');

  send(file: File) {
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
