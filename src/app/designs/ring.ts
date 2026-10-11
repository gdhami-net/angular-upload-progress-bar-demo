import { Component, computed, input, output } from '@angular/core';
import { Phase, barValue, phaseText } from '../upload-state';

/**
 * Design 2: a ring. <progress> can't take this shape, so it is a div with
 * role="progressbar" and the three aria-value* attributes written by hand.
 */
@Component({
  selector: 'app-ring',
  host: { 'data-design': 'ring', '[attr.data-phase]': 'phase()' },
  template: `
    <div
      class="ring"
      role="progressbar"
      aria-label="Upload"
      aria-valuemin="0"
      aria-valuemax="100"
      [attr.aria-valuenow]="value()"
      [attr.aria-valuetext]="text()"
    >
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle class="track" cx="32" cy="32" r="27" />
        <circle class="arc" cx="32" cy="32" r="27" pathLength="100" [style.stroke-dashoffset]="offset()" />
        @if (phase() === 'done') {
          <path class="mark" d="M22.5 32.5l6.5 6.5 12.5-13" pathLength="1" />
        } @else if (phase() === 'failed') {
          <path class="mark" d="M25 25l14 14M39 25L25 39" pathLength="1" />
        }
      </svg>
      @if (phase() === 'sending' && percent() !== null) {
        <span class="pct" aria-hidden="true"><span>{{ percent() }}<small>%</small></span></span>
      }
    </div>
    <div class="side">
      <span class="state">{{ label() }}</span>
      <span class="hint">{{ hint() }}</span>
      @if (phase() === 'sending' || phase() === 'processing') {
        <button type="button" class="d-cancel" (click)="cancel.emit()">Cancel</button>
      }
    </div>
  `,
  styleUrl: './ring.css',
})
export class Ring {
  readonly phase = input.required<Phase>();
  readonly percent = input.required<number | null>();
  readonly cancel = output();

  protected readonly value = computed(() => barValue(this.phase(), this.percent()));
  protected readonly text = computed(() => phaseText(this.phase(), this.percent()));
  protected readonly label = computed(() => (this.phase() === 'processing' ? 'Processing…' : this.text()));

  // pathLength="100" makes the dash maths a percentage. Processing shows a fixed quarter arc that spins.
  protected readonly offset = computed(() => {
    if (this.phase() === 'processing') return 75;
    return 100 - (this.value() ?? 0);
  });

  protected readonly hint = computed(() => {
    switch (this.phase()) {
      case 'sending': return 'Sending the file';
      case 'processing': return 'File sent, the server is working';
      case 'done': return 'The server has it';
      case 'failed': return 'The server said no';
      default: return 'Nothing sent yet';
    }
  });
}
