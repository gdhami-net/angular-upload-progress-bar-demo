// Measurement only: records every HttpEvent with a timestamp on window.__timeline,
// so the Playwright tests can read the gap between the last UploadProgress and the Response.
// With ?dropTotal=1 it removes `total` from progress events, to show what the bar does without it.
import { HttpEvent, HttpEventType, HttpInterceptorFn } from '@angular/common/http';
import { map, tap } from 'rxjs';

export interface TimelineEntry {
  type: string;
  t: number;
  loaded?: number;
  total?: number;
}

declare global {
  interface Window {
    __timeline: TimelineEntry[];
  }
}

window.__timeline = [];
const dropTotal = new URLSearchParams(location.search).get('dropTotal') === '1';

export const timelineInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    map((event): HttpEvent<unknown> =>
      dropTotal && event.type === HttpEventType.UploadProgress ? { type: event.type, loaded: event.loaded } : event,
    ),
    tap((event) => {
      const entry: TimelineEntry = { type: HttpEventType[event.type], t: performance.now() };
      if (event.type === HttpEventType.UploadProgress) {
        entry.loaded = event.loaded;
        entry.total = event.total;
      }
      window.__timeline.push(entry);
    }),
  );
