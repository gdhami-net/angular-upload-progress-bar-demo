# angular-upload-progress-bar-demo

Companion to the post **"An Angular upload progress bar that shows the server is
still working"**.

With `withXhr()`, Angular's `HttpClient` reports `UploadProgress` events, and the
last one says 100% as soon as the last byte has left the browser. The server may
need seconds more before it answers. This demo builds an upload bar with three
states and measures the gap:

- **sending**: a real percentage, from `loaded / total`
- **processing**: no `value` attribute on the `<progress>` (so it is
  indeterminate) plus an animated stripe, from `loaded === total` until the
  response
- **done** or **failed**, when the response or the error arrives

The bar is the native `<progress>` element, styled with `appearance: none`, the
vendor pseudo-elements, `light-dark()` colours and a `prefers-reduced-motion`
rule. The component is `src/app/upload-bar.ts` (with `.html` and `.css`).

## What it proves

`npm run check` runs `tests/*.spec.ts` with Playwright in Chromium, Firefox and
WebKit against `server/server.mjs`, a Node endpoint that reads the whole body,
then waits `delay` ms (2,000 by default) before it answers.

`tests/upload.spec.ts`

| test | what it asserts |
| --- | --- |
| state order | `idle`, `sending`, `processing`, `done`, in that order; `aria-valuetext` is `Uploading N%` while sending, `Processing` with no `value` attribute while processing, `Done` with `value="100"` at the end; the Upload button is disabled from sending to done |
| the gap | the last `UploadProgress` has `loaded === total`, and the `Response` arrives 1.5 to 3 s after it (the run prints the exact number) |
| `total` | every `UploadProgress` event of a `FormData` upload has a `total` |
| no `total` | with `total` stripped by an interceptor (`?dropTotal=1`), the bar has no value and says `Uploading` until done, and never shows `processing` |
| failure | a 500 after the delay ends in `failed`, `Upload failed` |
| cancel while processing | unsubscribing aborts the XHR; the server sees its response closed after it had every byte and before it answered; no `Response` event reaches the page |
| cancel while sending | the server sees the request closed with fewer bytes than its `Content-Length` |

`tests/styling.spec.ts`

| test | what it asserts |
| --- | --- |
| indeterminate | a `<progress>` with no `value` attribute has `position === -1` and matches `:indeterminate` |
| `[value]` and null | an Angular property binding `[value]` to `null` renders `value="0"`, `position === 0`: a determinate, empty bar. That is why the component binds `[attr.value]` |
| styled bar | pixel checks on the element screenshots: fill colour at 30% and track colour at 85% of a 64% bar, the done colour on a done bar, both stripe colours on the processing bar, and the stripe moves |
| dark mode | with `colorScheme: 'dark'` the fill is the dark-theme colour |
| reduced motion | with `reducedMotion: 'reduce'` the stripe doesn't move |
| unstyled indeterminate | `public/probe.html`: with `appearance: none` and no `:indeterminate` rules the bar doesn't move in any engine. Firefox paints `::-moz-progress-bar` across the whole width (it looks full); Chromium and WebKit show an empty track. The browser's own unstyled indeterminate bar does move |

## How to run it

```
npm install
npx playwright install chromium firefox webkit
npm run check        # builds, starts the server on :4370, runs the 13 tests in 3 engines
npm start            # http://localhost:4370 (?delay=2000&kbps=0&fail=0)
npm run measure      # one 5 MB upload per engine, prints the gap and the render counts
```

`http://localhost:4370/?gallery` shows one bar per state, a `div role="progressbar"`
for comparison, and the `[value]`-bound-to-null bar.

Other probes (each starts its own server; run `npm run build` first):

```
node scripts/measure.mjs 10 4000   # 10 MB, the server reads at 4,000 KB/s
node scripts/probe-shots.mjs       # unstyled and appearance:none <progress> with no value
node scripts/gallery-shots.mjs     # screenshots/gallery-<engine>-<light|dark>.png
node scripts/a11y-probe.mjs        # the accessibility tree for the gallery
```

`npm run check` output (2026-10-11):

```
Running 39 tests using 1 worker
  ...
chromium: last UploadProgress -> Response = 1903 ms
firefox: last UploadProgress -> Response = 1986 ms
webkit: last UploadProgress -> Response = 2013 ms
  ...
  39 passed (1.1m)
```

`npm run measure` output (2026-10-11):

```
chromium 156.0.8078.4  5 MB
  UploadProgress events: 1, every one with total: true
  first: 5243079/5243079  last: 5243079/5243079
  Sent -> last UploadProgress: 110 ms
  last UploadProgress -> Response: 1908 ms
  phases: idle -> sending -> processing -> done
  renders during the upload: 3
firefox 157.0  5 MB
  UploadProgress events: 1, every one with total: true
  first: 5243109/5243109  last: 5243109/5243109
  Sent -> last UploadProgress: 50 ms
  last UploadProgress -> Response: 1999 ms
  phases: idle -> sending -> processing -> done
  renders during the upload: 3
webkit 27.2  5 MB
  UploadProgress events: 81, every one with total: true
  first: 64968/5243079  last: 5243079/5243079
  Sent -> last UploadProgress: 30 ms
  last UploadProgress -> Response: 2010 ms
  phases: idle -> sending -> processing -> done
  renders during the upload: 5
```

## Versions

Measured on Windows 11 with:

- Node 26.1.0, npm 11.13.0
- Angular 22.2.2 (`@angular/core`, `@angular/common`, `@angular/cli`, `@angular/build`), TypeScript 6.0.3, RxJS 7.8.2
- Playwright 1.64.0 with Chromium 156.0.8078.4, Firefox 157.0, WebKit 27.2
  (Playwright's own browser builds; WebKit on Windows is not Safari)
- pngjs 7.0.0 (reads the element screenshots)

## Edge cases the post leaves out

- **Chromium reports the last byte late on a fast local upload.** Against
  localhost, Chromium's gap is about 1,905 ms for a 2,000 ms server wait: its
  only progress event fires roughly 100 ms after the server already has the
  whole body. Firefox and WebKit land within 15 ms of 2,000.
- **One event, or a burst.** On localhost Chromium and Firefox fire a single
  `UploadProgress` event, already at 100%, for a 5 MB file (Chromium: still one
  for 40 MB). WebKit fires 81 events in 30 ms for 5 MB. With the server reading
  at 4,000 KB/s, Chromium fires 34 events for 10 MB, Firefox 37, WebKit 161.
- **100% before the server has the bytes.** With the server reading at
  4,000 KB/s, every engine reached 100% before the server finished reading:
  about 170 ms early in WebKit, 350 ms in Chromium, 450 ms in Firefox (the gap
  was 2,182 to 2,455 ms for a 2,000 ms wait). 100% means the
  bytes were handed to the network stack.
- **WebKit can skip "sending" entirely.** A fast 1 MB upload in WebKit went
  straight from `idle` to `processing`: its progress events arrive in one burst
  before a render, so `sending` is never painted. The state tests throttle the
  server read for that reason.
- **Render counts.** Signals with OnPush (the default in Angular 22) and no
  zone.js: Chromium 34 events and 36 renders, Firefox 37 and 39, WebKit 161 and
  87 for the throttled 10 MB upload. No throttling of the progress signal is
  needed at these rates.
- **`reportProgress` is deprecated in 22.** The component uses
  `reportUploadProgress: true`. With the default fetch backend that option throws
  runtime error 2824 ("The FetchBackend does not support upload progress
  reporting"), which is why `app.config.ts` has `withXhr()`.
- **Screen readers.** The tests assert the `aria-valuetext` attribute per state.
  They don't prove what a screen reader announces: Chromium's DevTools protocol
  (`Accessibility.getFullAXTree`) returned an empty `valuetext` for every bar,
  and also for a plain `role="slider"` with `aria-valuetext`, so it can't be
  used to check this. Not tested with NVDA, JAWS or VoiceOver. The live region
  announces state changes only, not every percent.
- **The server keeps working after a cancel during processing.** The XHR is
  aborted and the Node server sees the socket close, but the body was already
  received. An endpoint that should stop its work has to watch for the
  disconnect (`HttpContext.RequestAborted` in ASP.NET Core).
- **Not covered:** several files at once, resumable or chunked uploads, retries,
  download progress, SSR (the component reads `window` only in the measurement
  interceptor), and a speed or time-left display.

## License

MIT
