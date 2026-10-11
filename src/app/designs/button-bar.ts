import { Component, computed, input, output } from '@angular/core';
import { Phase, barValue, phaseText } from '../upload-state';

/**
 * Design 4: the Upload button fills up as the file goes.
 * The progressbar sits behind the button as a sibling, the same size. Inside the button,
 * Chromium folded the bar's value into the button's name ("Upload 40").
 */
@Component({
  selector: 'app-button-bar',
  host: { 'data-design': 'button', '[attr.data-phase]': 'phase()' },
  template: `
    <div class="wrap">
      <div
        class="bar"
        role="progressbar"
        aria-label="Upload"
        aria-valuemin="0"
        aria-valuemax="100"
        [attr.aria-valuenow]="value()"
        [attr.aria-valuetext]="text()"
      >
        <span class="fill" [style.--p]="fill()"></span>
      </div>
      <!-- aria-disabled, not disabled: a disabled button drops keyboard focus to <body>. -->
      <button
        type="button"
        class="btn"
        [attr.aria-disabled]="busy() ? 'true' : null"
        (click)="busy() || start.emit()"
      >
        <span class="ink">{{ label() }}</span>
      </button>
      <!-- The same words in the on-fill colour, clipped to the filled part. -->
      <span class="ink over" aria-hidden="true" [style.--p]="fill()">{{ label() }}</span>
    </div>
    @if (busy()) {
      <button type="button" class="d-cancel" (click)="cancel.emit()">Cancel</button>
    }
  `,
  styleUrl: './button-bar.css',
})
export class ButtonBar {
  readonly phase = input.required<Phase>();
  readonly percent = input.required<number | null>();
  readonly start = output();
  readonly cancel = output();

  protected readonly busy = computed(() => this.phase() === 'sending' || this.phase() === 'processing');
  protected readonly value = computed(() => barValue(this.phase(), this.percent()));
  protected readonly text = computed(() => phaseText(this.phase(), this.percent()));

  // How much of the button is filled, 0 to 1. Only sending is part-filled; at rest it's a solid button.
  protected readonly fill = computed(() => (this.phase() === 'sending' ? (this.percent() ?? 0) / 100 : 1));

  protected readonly label = computed(() => {
    switch (this.phase()) {
      case 'sending': return this.text();
      case 'processing': return 'Processing…';
      case 'done': return 'Done, upload another';
      case 'failed': return 'Upload failed, try again';
      default: return 'Upload';
    }
  });
}
