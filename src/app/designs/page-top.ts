import { Component, computed, input, output } from '@angular/core';
import { Phase, barValue, phaseText } from '../upload-state';

/** Design 5: a thin bar pinned to the top edge of the page, shown here inside a small browser frame. */
@Component({
  selector: 'app-page-top',
  host: { 'data-design': 'page-top', '[attr.data-phase]': 'phase()' },
  template: `
    <div class="frame">
      <div class="chrome" aria-hidden="true">
        <i></i><i></i><i></i>
        <span class="addr">files.example.com/upload</span>
      </div>
      <div class="view">
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
          <span class="sliver"></span>
        </div>
        <div class="page">
          <div class="line w60" aria-hidden="true"></div>
          <div class="line w85" aria-hidden="true"></div>
          <div class="foot">
            <span class="chip">{{ label() }}</span>
            @if (phase() === 'sending' || phase() === 'processing') {
              <button type="button" class="d-cancel" (click)="cancel.emit()">Cancel</button>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrl: './page-top.css',
})
export class PageTop {
  readonly phase = input.required<Phase>();
  readonly percent = input.required<number | null>();
  readonly cancel = output();

  protected readonly value = computed(() => barValue(this.phase(), this.percent()));
  protected readonly text = computed(() => phaseText(this.phase(), this.percent()));
  protected readonly fill = computed(() => (this.value() ?? 0) / 100);
  protected readonly label = computed(() => (this.phase() === 'processing' ? 'Processing…' : this.text()));
}
