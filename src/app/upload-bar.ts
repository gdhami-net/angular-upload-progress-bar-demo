import { Component, computed, input } from '@angular/core';
import { Phase, phaseText } from './upload-state';

/** Design 0, the classic: one native <progress>, styled the same in three engines. */
@Component({
  selector: 'app-upload-bar',
  templateUrl: './upload-bar.html',
  styleUrl: './upload-bar.css',
})
export class UploadBar {
  readonly phase = input.required<Phase>();
  readonly percent = input.required<number | null>();

  // null removes the value attribute, which is what makes <progress> indeterminate.
  readonly value = computed(() => {
    const phase = this.phase();
    if (phase === 'processing') return null;
    if (phase === 'done' || phase === 'failed') return 100;
    return this.percent();
  });

  readonly text = computed(() => phaseText(this.phase(), this.percent()));
}
