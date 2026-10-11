import { Component, computed, input, output } from '@angular/core';
import { Phase, barValue, phaseText } from '../upload-state';

/** Design 1: an upload row with a file-type tile, a slim gradient bar and a cancel button. */
@Component({
  selector: 'app-file-card',
  host: { 'data-design': 'file-card', '[attr.data-phase]': 'phase()' },
  template: `
    <div class="tile" aria-hidden="true">{{ ext() }}</div>
    <div class="main">
      <span class="name">{{ name() }}</span>
      <progress max="100" aria-label="Upload" [attr.value]="value()" [attr.aria-valuetext]="text()"></progress>
      <div class="bottom">
        <span class="size">{{ sizeText() }}</span>
        <span class="state">{{ label() }}</span>
      </div>
    </div>
    <div class="slot">
      @if (phase() === 'sending' || phase() === 'processing') {
        <button type="button" class="x" aria-label="Cancel upload" (click)="cancel.emit()">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /></svg>
        </button>
      } @else if (phase() === 'done') {
        <svg class="badge ok" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 8.4l2.6 2.6L12 5.6" /></svg>
      } @else if (phase() === 'failed') {
        <svg class="badge bad" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 4.5v4.2M8 11.3v.2" /></svg>
      }
    </div>
  `,
  styleUrl: './file-card.css',
})
export class FileCard {
  readonly phase = input.required<Phase>();
  readonly percent = input.required<number | null>();
  readonly name = input('site-photos.zip');
  readonly size = input(4 * 1024 * 1024);
  readonly cancel = output();

  protected readonly value = computed(() => barValue(this.phase(), this.percent()));
  protected readonly text = computed(() => phaseText(this.phase(), this.percent()));
  protected readonly ext = computed(() => (this.name().split('.').pop() ?? 'file').slice(0, 4).toUpperCase());

  protected readonly label = computed(() => {
    switch (this.phase()) {
      case 'sending': return this.percent() === null ? 'Uploading' : `${this.percent()}%`;
      case 'processing': return 'Processing…';
      default: return this.text();
    }
  });

  protected readonly sizeText = computed(() => {
    const mb = (n: number) => (n / 1024 / 1024).toFixed(1);
    const p = this.percent();
    if (this.phase() === 'sending' && p !== null) return `${mb((this.size() * p) / 100)} of ${mb(this.size())} MB`;
    if (this.phase() === 'processing') return `${mb(this.size())} MB sent`;
    return `${mb(this.size())} MB`;
  });
}
