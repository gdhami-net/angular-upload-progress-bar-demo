import { Component, computed, input, output } from '@angular/core';
import { Phase, barValue, phaseText } from '../upload-state';

type Step = 'todo' | 'active' | 'complete' | 'failed';

/** Design 6: three stages joined by a line. The first line fills with the percentage. */
@Component({
  selector: 'app-stepper',
  host: { 'data-design': 'stepper', '[attr.data-phase]': 'phase()' },
  template: `
    <div
      class="steps"
      role="progressbar"
      aria-label="Upload"
      aria-valuemin="0"
      aria-valuemax="100"
      [attr.aria-valuenow]="value()"
      [attr.aria-valuetext]="text()"
    >
      @for (s of stages; track s.name; let i = $index) {
        @if (i > 0) {
          <span class="line"><span class="fill" [style.--p]="lines()[i - 1]"></span></span>
        }
        <span class="node" [attr.data-step]="steps()[i]">
          <span class="dot">
            @switch (steps()[i]) {
              @case ('complete') {
                <svg viewBox="0 0 16 16"><path d="M4 8.4l2.6 2.6L12 5.6" /></svg>
              }
              @case ('failed') {
                <svg viewBox="0 0 16 16"><path d="M5 5l6 6M11 5l-6 6" /></svg>
              }
              @default {
                {{ i + 1 }}
              }
            }
          </span>
          <span class="cap">{{ s.name }}</span>
        </span>
      }
    </div>
    <div class="foot">
      <span class="state">{{ label() }}</span>
      @if (phase() === 'sending' || phase() === 'processing') {
        <button type="button" class="d-cancel" (click)="cancel.emit()">Cancel</button>
      }
    </div>
  `,
  styleUrl: './stepper.css',
})
export class Stepper {
  readonly phase = input.required<Phase>();
  readonly percent = input.required<number | null>();
  readonly cancel = output();

  protected readonly stages = [{ name: 'Sending' }, { name: 'Processing' }, { name: 'Done' }];
  protected readonly value = computed(() => barValue(this.phase(), this.percent()));
  protected readonly text = computed(() => phaseText(this.phase(), this.percent()));
  protected readonly label = computed(() => (this.phase() === 'processing' ? 'Processing…' : this.text()));

  protected readonly steps = computed((): Step[] => {
    switch (this.phase()) {
      case 'sending': return ['active', 'todo', 'todo'];
      case 'processing': return ['complete', 'active', 'todo'];
      case 'done': return ['complete', 'complete', 'complete'];
      // The percentage is still there after an error: below 100, the bytes never all left.
      case 'failed': return this.percent() === 100 ? ['complete', 'failed', 'todo'] : ['failed', 'todo', 'todo'];
      default: return ['todo', 'todo', 'todo'];
    }
  });

  // How full each joining line is, 0 to 1.
  protected readonly lines = computed(() => {
    switch (this.phase()) {
      case 'sending': return [(this.percent() ?? 0) / 100, 0];
      case 'processing': return [1, 0];
      case 'done': return [1, 1];
      case 'failed': return this.percent() === 100 ? [1, 0] : [0, 0];
      default: return [0, 0];
    }
  });
}
