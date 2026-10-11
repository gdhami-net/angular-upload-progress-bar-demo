import { Component, computed, input, output } from '@angular/core';
import { Phase, barValue, phaseText } from '../upload-state';

/** Design 3: twenty rounded segments, cut out of one native <progress> with a CSS mask. */
@Component({
  selector: 'app-segmented',
  host: { 'data-design': 'segmented', '[attr.data-phase]': 'phase()' },
  template: `
    <div class="head">
      <span class="state">{{ label() }}</span>
      @if (phase() === 'sending' || phase() === 'processing') {
        <button type="button" class="d-cancel" (click)="cancel.emit()">Cancel</button>
      }
    </div>
    <progress max="100" aria-label="Upload" [attr.value]="value()" [attr.aria-valuetext]="text()"></progress>
  `,
  styleUrl: './segmented.css',
})
export class Segmented {
  readonly phase = input.required<Phase>();
  readonly percent = input.required<number | null>();
  readonly cancel = output();

  protected readonly value = computed(() => barValue(this.phase(), this.percent()));
  protected readonly text = computed(() => phaseText(this.phase(), this.percent()));
  protected readonly label = computed(() => (this.phase() === 'processing' ? 'Processing…' : this.text()));
}
