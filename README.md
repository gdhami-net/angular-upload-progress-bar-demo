# angular-upload-progress-bar-demo

Companion to the post **"An Angular upload progress bar that shows the server is
still working"**.

With `withXhr()`, Angular's `HttpClient` reports `UploadProgress` events, and the
last one says 100% as soon as the last byte has left the browser. The server may
need seconds more before it answers. This demo keeps one upload state with three
phases, measures the gap, and draws it seven ways:

- **sending**: a real percentage, from `loaded / total`
- **processing**: no `value` attribute on the `<progress>` (so it is
  indeterminate) plus an animated stripe, from `loaded === total` until the
  response
- **done** or **failed**, when the response or the error arrives

The state is `src/app/upload-state.ts`: a `phase` signal, a `percent` signal and
the upload code. Every design is a presentation-only component that takes `phase`
and `percent` as signal inputs.

The classic bar (design 0, `src/app/upload-bar.ts` with `.html` and `.css`) is the
native `<progress>` element, styled with `appearance: none`, the vendor
pseudo-elements, `light-dark()` colours and a `prefers-reduced-motion` rule.

## The six designs

The default page shows the classic bar and the six designs below it, all driven
by the one Upload button (or the button design itself). They are a gallery for the
post, not a library. Each is in `src/app/designs/`.

| design | progressbar element | sending | processing | reduced motion, processing |
| --- | --- | --- | --- | --- |
| file card (`file-card.ts`) | native `<progress>` | gradient fill with a light sweeping over it | a band of colour travelling along the track | a static dashed line |
| ring (`ring.ts`) | `div role="progressbar"` (a ring is a shape `<progress>` can't take) | SVG arc, `pathLength="100"`, the number in the middle | a quarter arc spinning, no number | a dotted full ring |
| segmented (`segmented.ts`) | native `<progress>` cut into 20 pills by a CSS mask | segments fill left to right | all lit, a wave of brightness running across | every other segment lit |
| button (`button-bar.ts`) | `div role="progressbar"` behind the button, the same size | the button fills, "Uploading 64%" | full, the gradient drifting, "Processing…" | full with a dashed inner edge |
| page-top (`page-top.ts`) | `div role="progressbar"`, 3px, pinned to the top of a faux browser frame | `transform: scaleX()` | a sliver sliding across | a static dashed line |
| stepper (`stepper.ts`) | `div role="progressbar"` around the three stages | the first line fills with the percentage | the middle node pulses | the middle node gets a dashed ring |

Every design shows idle, sending (a real percentage), processing (no number),
done, failed (red, with the words "Upload failed") and cancelled, and has its own
keyboard-reachable Cancel. `aria-valuetext` reads `Uploading 45%`, `Processing`,
`Done`, `Upload failed`. With `prefers-reduced-motion: reduce` no infinite animation
runs. The colours are `light-dark()` tokens in `src/styles.css` (`--ub-*`), tints
are `color-mix()`. Text pairs are at least 4.5:1 and every bar against its track
at least 3:1 in both themes (the lowest is the dark accent on the dark track,
3.47:1).

Query parameters: `?delay=2000&kbps=0&fail=0` for the server, `?preview=processing`
(or `sending&percent=64`, `done`, `failed`) freezes the state without uploading,
`?only=ring` shows one design.

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

`tests/designs.spec.ts`, once per design

| test | what it asserts |
| --- | --- |
| one progressbar | exactly one element with the progressbar role (by Playwright's role query and by `progress, [role=progressbar]`) |
| state order | `idle`, `sending`, `processing`, `done`; `aria-valuetext` is `Uploading N%` while sending, `Processing`, then `Done`; one request reached the server. The button design starts the upload from its own button |
| failure | a 500 ends in `failed`, `aria-valuetext` `Upload failed`, and the words "Upload failed" are on screen |
| cancel | the design's own Cancel, focused and pressed with Enter, aborts the request (the server sees it close while processing) and the design shows `Cancelled` |
| reduced motion | in the processing state the design runs at least one infinite animation; with `reducedMotion: 'reduce'` it runs none (`document.getAnimations()`), `aria-valuetext` still says `Processing`, two element screenshots 300 ms apart match, and the bar doesn't look like a full sending bar |

plus two more:

| test | what it asserts |
| --- | --- |
| the shimmer `getAnimations()` can't see | the file card's shimmer is a CSS animation on `::-webkit-progress-value` / `::-moz-progress-bar`. It moves (screenshots differ) while `document.getAnimations()` is empty, in all three engines. With reduced motion the screenshots match |
| button focus | the button design keeps keyboard focus through the upload (`aria-disabled`, not `disabled`), and a second Enter while it's busy sends nothing |

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
npm run check        # builds, starts the server on :4370, runs the 45 tests in 3 engines
npm start            # http://localhost:4370 (?delay=2000&kbps=0&fail=0)
npm run measure      # one 5 MB upload per engine, prints the gap and the render counts
npm run measure:designs  # CSS bytes, renders and frame timing per design
```

`http://localhost:4370/?gallery` shows one bar per state, a `div role="progressbar"`
for comparison, and the `[value]`-bound-to-null bar.

Other probes (each starts its own server; run `npm run build` first):

```
node scripts/measure.mjs 10 4000   # 10 MB, the server reads at 4,000 KB/s
node scripts/probe-shots.mjs       # unstyled and appearance:none <progress> with no value
node scripts/gallery-shots.mjs     # screenshots/gallery-<engine>-<light|dark>.png
node scripts/design-shots.mjs      # screenshots/designs-<engine>-<light|dark>-<phase>.png, 2x
node scripts/design-shots.mjs --reduced   # screenshots/designs-<engine>-reduced-processing.png
node scripts/a11y-probe.mjs        # the accessibility tree for the gallery
```

`npm run check` output (2026-10-11):

```
Running 135 tests using 1 worker
  ...
chromium: last UploadProgress -> Response = 1902 ms
firefox: last UploadProgress -> Response = 1994 ms
webkit: last UploadProgress -> Response = 2007 ms
  ...
  135 passed (3.8m)
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

## What building the six designs showed

`npm run measure:designs` output (2026-10-11), 10 MB with the server reading at
2,560 KB/s (about four seconds of sending) and then working for 2 s, one design
on the page at a time (`?only=`; `none` is the page with no design at all):

```
CSS per design (source bytes / gzipped):
  file-card   4481 / 1348
  ring        2340 / 922
  segmented   2778 / 1043
  button      2279 / 998
  page-top    2612 / 1064
  stepper     2674 / 1019

chromium 156.0.8078.4: 10 MB at 2,560 KB/s, then 2 s of server work
  none       events  44  renders   3 (2 while sending)  frames 437, over 25 ms: 0, longest 16.8 ms
  file-card  events  38  renders  40 (39 while sending)  frames 434, over 25 ms: 0, longest 16.8 ms
  ring       events  38  renders  40 (39 while sending)  frames 434, over 25 ms: 0, longest 16.8 ms
  segmented  events  44  renders  46 (45 while sending)  frames 434, over 25 ms: 0, longest 16.8 ms
  button     events  38  renders  40 (39 while sending)  frames 435, over 25 ms: 0, longest 16.8 ms
  page-top   events  44  renders  46 (45 while sending)  frames 435, over 25 ms: 0, longest 16.8 ms
  stepper    events  38  renders  40 (39 while sending)  frames 433, over 25 ms: 0, longest 16.8 ms

firefox 157.0: 10 MB at 2,560 KB/s, then 2 s of server work
  none       events  74  renders   3 (2 while sending)
  file-card  events  37  renders  39 (38 while sending)
  ring       events  37  renders  39 (38 while sending)
  segmented  events  37  renders  39 (38 while sending)
  button     events  37  renders  39 (38 while sending)
  page-top   events  37  renders  39 (38 while sending)
  stepper    events  37  renders  39 (38 while sending)

webkit 27.2: 10 MB at 2,560 KB/s, then 2 s of server work
  none       events 161  renders   3 (2 while sending)
  file-card  events 161  renders  51 (50 while sending)
  ring       events 161  renders  50 (49 while sending)
  segmented  events 161  renders  49 (48 while sending)
  button     events 161  renders  51 (50 while sending)
  page-top   events 161  renders  50 (49 while sending)
  stepper    events 161  renders  49 (48 while sending)

file card shimmer while sending (preview at 64%):
  chromium  moves: true  getAnimations(): []
  firefox   moves: true  getAnimations(): []
  webkit    moves: true  getAnimations(): []
```

- **Renders follow the events, not the design.** In Chromium and Firefox every
  design re-rendered once per progress event, plus two. WebKit fired 161 events
  and every design rendered 49 to 51 times. The page with no design reads
  `percent` nowhere and rendered three times. The frame timing is Chromium only (headless,
  `requestAnimationFrame` deltas): no frame over 25 ms for any design.
- **The segmented bar's mask works in all three engines, but WebKit rounds the
  tile.** One `<progress>`, `mask` with three gradient layers per 5%-wide tile.
  Chromium and Firefox drew 20 pills. WebKit showed a cut-off 21st pill at the
  end, with `mask-repeat: repeat-x` and with `round`, which looks like the
  fractional tile width being rounded down. With
  `width: round(down, 100%, 20px)` a tile is always a whole number of pixels, and
  WebKit draws 20.
- **`color-mix(in oklch, <grey>, white)` turns pink in Chromium.** Mixing
  `#e2e8f0` 55% with `#ffffff` in `oklch`: Chromium 156 computes
  `oklch(0.9608 0.0069 none)`, a hue of `none` that paints as `rgb(246,240,242)`.
  Firefox and WebKit keep the grey's hue (255.5) and paint `rgb(239,242,247)`.
  Mixing neutrals `in oklab` gives `rgb(239,242,247)` in all three; the demo uses
  `oklab` for the browser frame and `oklch` only where an accent is involved.
- **A focused button that gets `disabled` drops focus to `<body>`**, in all three
  engines; the next Tab starts again from the top of the page (WebKit's stayed on
  `<body>`). The button design uses `aria-disabled="true"` and ignores clicks
  while busy, so focus stays on it.
- **A progressbar inside a button changes the button's name.** In Chromium's
  accessibility tree, `<button>Upload <span role="progressbar" aria-valuenow="40">`
  is a button named "Upload 40" with the progressbar as a child. The button design
  keeps the progressbar outside, behind the button, the same size.
- **Text over a half-filled button needs two copies.** The label sits half over
  the fill and half over the track, and no single colour reads on both. The
  button draws the label twice: accent (or plain text in dark mode) underneath,
  the on-fill colour on top, clipped with `clip-path: inset()` to the filled part.
- **`getAnimations()` doesn't see animations on `::-webkit-progress-value` or
  `::-moz-progress-bar`.** The file card's shimmer runs there and moves in all
  three engines, but `document.getAnimations()` is empty. The reduced-motion check
  for it is a pixel check.
- **An outline on a parent hides under a positioned child.** The first
  reduced-motion look for the button put a dashed `outline` on the progressbar
  element; its absolutely positioned fill painted over it in Chromium and Firefox,
  so nothing showed. The outline is on the fill now.
- The ring needed nothing special: `pathLength="100"` on the circle makes
  `stroke-dashoffset` a percentage in all three engines, and the processing spin
  turns the whole `<svg>`, an HTML-level box, around its own centre.

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
