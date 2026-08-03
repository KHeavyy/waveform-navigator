# React Native spin-off: port plan

A plan for `react-native-waveform-navigator` — a sibling library that gives React
Native apps the same waveform component this repo gives the web.

This document is **planning only**. No code has been written. The target is a
separate repository; this file lives here so the plan sits next to the source it
describes and so the web repo has a record of what was carved off.

**Status:** draft for review. Section 9 lists the decisions that need answers
before Phase 1 starts.

---

## 1. Verdict up front

A port is very worth doing, but be clear-eyed about what "port" means here:
**the design ports, most of the code does not.**

Of ~3,440 lines of source, roughly 160 lines lift verbatim. The rest is a
rewrite against different primitives. What actually carries over — and what
makes this a port rather than a from-scratch build — is the part that took the
longest to get right in the first place:

- the public prop contract and its defaults,
- the canonical-vs-display peaks invariant,
- the hook decomposition (data / player / render / layout, no cross-talk),
- the progressive streaming protocol for peak computation,
- the marker model, including label-badge-only hit regions,
- the pre-computed-peaks workflow,
- and 4,900 lines of unit tests describing behaviour that is platform-neutral.

That is the asset. Treat the RN repo as a second implementation of a spec this
repo already wrote, not as a fork.

The stack is also, in 2026, genuinely ready: Skia handles the canvas work better
than the web version's `ImageData` cache does, and `react-native-audio-api` gives
a real `decodeAudioData` on device — which two years ago was the blocker that
would have sunk this.

---

## 2. Portability audit

Every source file, what happens to it, and why.

### Lifts verbatim (~160 LOC, 5%)

| File                          | LOC | Notes                                                                                       |
| ----------------------------- | --: | ------------------------------------------------------------------------------------------- |
| `utils/peaksComputation.ts`   |  81 | Pure math. `computePeaksFromChannelData` + `resamplePeaks` have zero platform surface.      |
| `utils/defaultMarkerLabel.ts` |  62 | Pure geometry. The `estimateDefaultMarkerLabelWidth` fallback becomes the **primary** path. |
| `utils/formatTime.ts`         |  15 | Pure.                                                                                       |

Their tests (`peaksComputation.test.ts`, `defaultMarkerLabel.test.ts`,
`formatTime.test.ts` — 208 + ~90 + ~40 lines) port with an import swap.

### Ports with edits (~400 LOC, 12%)

| File                       | LOC | What changes                                                                                                                                                        |
| -------------------------- | --: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WaveformNavigator.tsx`    | 839 | The props interface, TSDoc, defaults, and marker hit-test loop port. Pointer handlers, blob-URL lifecycle, `useImperativeHandle` body, and JSX are rewritten. ~40%. |
| `hooks/useWaveformData.ts` | 412 | The state machine ports almost intact — canonical ref, precomputed adoption, resample-on-resize, recompute triggers. All I/O (fetch, `AudioContext`, worker) swaps. |
| `hooks/useResponsiveWidth` | 113 | Same contract, ~30 lines: `onLayout` replaces `ResizeObserver`. Keep the debounce for orientation changes.                                                          |
| `peaks.worker.ts`          |  66 | The chunked slot/max loop and the `progress`/`done` message shape port. The `self.onmessage` transport does not.                                                    |

### Rewritten (~2,880 LOC, 83%)

| File                          | LOC | Why                                                                                                                                                                                                                                                              |
| ----------------------------- | --: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hooks/useAudioPlayer.ts`     | 810 | The most web-coupled file in the repo. `HTMLAudioElement`, nine media events, `visibilitychange`/`pageshow`/`blur`/`focus`, `MediaError` codes, blob URLs — none exist. The _recovery state machine's shape_ is worth keeping; every primitive under it changes. |
| `hooks/useWaveformCanvas.ts`  | 362 | Canvas 2D immediate mode, `ImageData` caching, `putImageData`, RAF. Skia is retained-mode; this shrinks to roughly half (see §4.2).                                                                                                                              |
| `components/WaveformControls` | 353 | Props and layout intent port. Inline SVG, `<input type="range">`, the outside-click listener, and `clientWidth` breakpoint all get RN equivalents.                                                                                                               |
| `styles.css`                  | 360 | → `StyleSheet.create`. Container queries → `onLayout` width. `:focus-visible` → drop. Spinner keyframes → Reanimated loop or `ActivityIndicator`.                                                                                                                |

### Deleted

| File                           | LOC | Why                                                                 |
| ------------------------------ | --: | ------------------------------------------------------------------- |
| `hooks/useKeyboardControls.ts` |  90 | Replaced by `accessibilityRole="adjustable"` actions (see §5.4).    |
| `utils/workerCreation.ts`      |  65 | No `Worker` constructor. Replaced by a compute-backend selector.    |
| `utils/syncCanvasSize.ts`      |  34 | Skia handles DPR itself; there is no backing store to size by hand. |

---

## 3. Recommended stack

Four dependencies do the heavy lifting. All are current and actively maintained
as of August 2026.

### 3.1 Rendering — `@shopify/react-native-skia`

v2.7.0, requires RN 0.79+ / React 19, works with Expo SDK 55. This is the only
serious option: `react-native-svg` will not hold 60fps with 400+ rects, and 400
`<View>`s is worse.

Skia is also a **better** fit than web canvas here, not just an equivalent one —
see §4.2.

### 3.2 Decoding — `react-native-audio-api`

v0.13.x, from Software Mansion. Implements the Web Audio API on device, and
critically exports a standalone `decodeAudioData` that takes **a file path or an
ArrayBuffer** and an **optional target sample rate**.

That sample-rate parameter is the single most important detail in this plan —
see §4.3. Note the default format support is `.mp3`, `.wav`, `.mp4`, `.m4a`,
`.aac`, which is narrower than a browser's `decodeAudioData`. If Ogg/FLAC/Opus
matter to the app, verify support in the Phase 0 spike.

### 3.3 Playback — pluggable, `expo-audio` first

**Do not hard-wire a player.** The RN audio ecosystem is fragmented, apps
usually already own a player instance, and the leading candidates have real
trade-offs:

| Library                     | Good for                                                                | Watch out for                                                                                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `expo-audio`                | Expo apps, simple in-app playback. Clean hooks API.                     | Known issue where `currentTime` from `useAudioPlayerStatus` doesn't update after a `seekTo` in some flows — verify against the current SDK in Phase 0.                              |
| `react-native-track-player` | Background playback, lock screen, notification controls, Bluetooth/car. | Heavier; singleton service model fights a "drop in N components" design.                                                                                                            |
| `react-native-audio-api`    | Already a dependency for decode; can drive playback too.                | Web Audio graph means you own the transport — no free `currentTime`/`seek`, and buffer-source playback loads the whole file into memory. Fine for short clips, wrong for a podcast. |

Ship a `WaveformAudioBackend` interface plus adapters behind subpath exports
(`react-native-waveform-navigator/backends/expo-audio`). The audio library stays
an **optional** peer dependency; consumers install only the one they use, and an
app with its own player can implement the interface in ~40 lines.

The interface is small:

```
play() / pause() / seekTo(seconds)
setVolume(0..1)
getStatus() -> { currentTime, duration, isPlaying, isBuffering, error }
subscribe(cb) -> unsubscribe
load(source) / unload()
```

### 3.4 Gestures & animation — `react-native-gesture-handler` + `react-native-reanimated`

Standard, already in most apps. Reanimated is required by Skia anyway for
UI-thread animation, and it brings `react-native-worklets` — which supplies the
optional off-thread compute path in §4.4.

### 3.5 Not recommended

- **`expo-av`** — superseded by `expo-audio`/`expo-video`.
- **`react-native-sound`** — no modern status stream, effectively unmaintained.
- **A native (Nitro/TurboModule) peaks module** — the right endgame if profiling
  demands it, but it breaks Expo Go, doubles the platform matrix, and §4.3
  probably makes it unnecessary. Revisit after Phase 0 numbers.

---

## 4. Architecture

Same shape as the web version. `WaveformNavigator` stays the only orchestrator;
hooks still don't talk to each other.

```
src/
├── index.ts
├── WaveformNavigator.tsx          # orchestrator: props, gestures, marker hit-test, a11y
├── components/
│   ├── WaveformCanvas.tsx         # Skia render tree
│   └── WaveformControls.tsx       # Pressables + Reanimated volume slider
├── hooks/
│   ├── useAudioPlayer.ts          # backend adapter lifecycle + interpolated clock
│   ├── useWaveformData.ts         # decode → peaks (chunked or worklet runtime)
│   ├── useContainerWidth.ts       # onLayout + debounce
│   └── useAudioFileCache.ts       # remote URL → local file
├── backends/
│   ├── types.ts                   # WaveformAudioBackend
│   ├── expo-audio.ts
│   └── track-player.ts
├── core/                          # ← vendored verbatim from the web repo
│   ├── peaksComputation.ts
│   ├── defaultMarkerLabel.ts
│   └── formatTime.ts
└── compute/
    ├── chunked.ts                 # default: cooperative yielding on the JS thread
    └── worklet.ts                 # optional: react-native-worklets runtime
```

### 4.1 Data flow

1. `useAudioFileCache` resolves the source to a local file path (download +
   cache for remote URLs; pass-through for bundled assets and `file://`).
2. `useWaveformData` calls `decodeAudioData(path, PEAKS_SAMPLE_RATE)` and hands
   the channel data to the compute backend.
3. The compute backend streams `progress` results in chunks, exactly as the web
   worker does today, so the waveform fills in progressively.
4. `WaveformCanvas` builds an `SkPath` once per peaks change and animates
   progress on the UI thread.
5. `useAudioPlayer` owns the backend adapter and is the source of truth for
   time, duration, play state, buffering, and volume.

### 4.2 Rendering: Skia is an upgrade, not a substitute

The web version's `ImageData` cache exists to work around canvas being immediate
mode — it snapshots all the bars so the RAF loop only repaints the progress
region. Skia is retained mode, so that whole mechanism disappears:

- Build **one `SkPath`** containing every bar rect, once, when peaks change.
- Draw it in `barColor`.
- Draw the **same path again** in `progressColor`, inside a `<Group>` clipped to
  `[0, playedWidth]`.
- Playhead is a `<Rect>` at `playedWidth`.

`playedWidth` is a Reanimated `SharedValue`, so progress and playhead animate
entirely on the UI thread. The JS thread does **zero work per frame** — versus
the web version's per-frame `putImageData` plus a full bar loop.

This also fixes a limitation the web version can't escape. Today the RAF loop
reads `currentTimeRef.current`, which is only refreshed by `timeupdate` events —
roughly 4Hz in most browsers. So the web playhead redraws at 60fps but _moves_
at 4Hz. Mobile audio libraries report status at a similar or coarser rate, so a
naive port would look worse. Instead, **interpolate on the UI thread**: track the
last reported `(time, timestamp)` pair and advance `playedWidth` by wall-clock
delta while playing, re-anchoring on each status update. The result is a
genuinely smooth playhead — better than the web component's.

Cache invalidation still matters: rebuild the path on peaks, `barWidth`, `gap`,
or width change. Colors no longer invalidate anything, since they are props on
the draw call rather than baked into a bitmap.

**Marker labels need a font.** Skia has no `ctx.measureText` without one. Use
`Skia.FontMgr.System().matchFamilyStyle()` rather than shipping a `.ttf` —
bundling a font inside a library is an asset-resolution headache. The font
resolves asynchronously, so markers may render a frame late; the existing
`estimateDefaultMarkerLabelWidth` covers that gap.

While porting, **fix a latent inconsistency**: the web version draws labels using
`measureText` but hit-tests them using the estimate, so the drawn badge and its
hit region can disagree by a pixel or two. In RN, make one measurement the source
of truth for both.

### 4.3 Decode at a reduced sample rate

This is the detail that decides whether the library is usable on a mid-range
Android.

A 3-minute 44.1kHz mono track decodes to ~7.9M floats — **32MB** in the JS heap,
plus whatever the JSI boundary copies. Do that on a cheap device and you will hit
GC pauses or an OOM.

`decodeAudioData(source, sampleRate)` solves it. Decode at **8000 Hz** and the
same track is ~1.44M samples, about **5.8MB** — a 5.5× reduction. Peak quality is
unaffected in any visible way: at 1400 canonical bars, each bar still averages
over ~1,000 samples at 8kHz. You are computing a max-amplitude envelope, not
doing spectral analysis.

**One cross-platform consequence to decide on now.** Max-of-abs over downsampled
audio slightly underestimates true peaks, so peaks computed on mobile will not
be bit-identical to peaks computed by this repo on the web. If the app persists
`onPeaksComputed` output server-side and shares it between web and mobile, the
waveform will shift subtly when a user switches devices. Two options:

- **Accept it.** Differences are well under a pixel of bar height. Simplest.
- **Pin both platforms.** Add a `peakSampleRate` prop here on web too, defaulting
  to `null` (current behaviour), and set both clients to 8000. Costs a minor
  release on this repo and keeps the two byte-identical.

Recommend pinning if peaks are shared, accepting otherwise. Either way, decide
before peaks reach production storage.

### 4.4 Off-main-thread computation

There are no Web Workers. Three options, in the order they should be tried:

1. **Chunked cooperative compute on the JS thread (default).** The worker already
   processes in slot chunks and streams partials; yield between chunks instead of
   posting messages. Zero new dependencies, and it preserves progressive
   rendering exactly. At 8kHz the whole computation is likely tens of
   milliseconds — measure in Phase 0 before building anything fancier.
2. **`react-native-worklets` runtime (optional).** `createWorkletRuntime('waveform-peaks')`
   plus `runOnRuntime` is the true worker analogue — a separate JS runtime on its
   own thread. Gate it behind the same `forceMainThread` prop shape the web
   version already exposes. Caveat: passing a large `Float32Array` into a worklet
   runtime may copy it, which can cost more than the computation saves. Benchmark
   before adopting.
3. **Native module.** Only if 1 and 2 both fail on target hardware.

**Do not use `runOnUI`.** That is the _UI_ thread — blocking it stalls the very
animation this design exists to keep smooth. Worth a comment in the source, since
it is the obvious-looking wrong answer.

### 4.5 File caching replaces the blob-URL trick

The web version fetches once and shares the `ArrayBuffer` with the `<audio>`
element via a blob URL, with careful ownership and revocation in
`WaveformNavigator.tsx`. None of that exists in RN — and it doesn't need to.

Download to the cache directory once (`expo-file-system`, or `react-native-blob-util`
in bare RN), then point **both** the decoder and the player at the local path.
`decodeAudioData` accepting a file path means the compressed bytes never
materialise in JS at all.

This turns a web workaround into a real feature: caching survives app restarts
and gives offline playback for free. Cache invalidation (by URL + ETag, with a
size cap) becomes a small amount of new work with no web counterpart.

### 4.6 Background audio and interruptions

`useAudioPlayer`'s 810 lines exist because browsers evict media in background
tabs. Mobile has the same class of problem, differently shaped and arguably
worse. The mapping:

| Web                                     | React Native                                                            |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `visibilitychange`                      | `AppState` `'background'` / `'active'`                                  |
| `blur` / `focus` (macOS Safari windows) | `AppState` `'inactive'` (Control Center, incoming-call banner)          |
| `pageshow` / bfcache                    | n/a                                                                     |
| Media eviction in a background tab      | Audio-session interruption (call, Siri) / Android audio-focus loss      |
| `MediaError` codes 1–4                  | Backend-specific error payloads, normalised by the adapter              |
| Reload `src` + await `canplay` (8s cap) | Re-`load()` the source on the backend + await a ready status (same cap) |

Keep the state machine's _shape_ — playback-intent tracking, `lastKnownTime`
that only advances while intent is active, the in-flight guard, the abort
controller. That logic was earned through 1,000+ lines of regression tests and
the failure modes rhyme. Replace every primitive underneath it.

Interruption handling is a **first-class requirement** on mobile, not an edge
case: phone calls, alarms, and other apps grabbing focus are routine. Both
`expo-audio` (via audio-mode configuration) and `react-native-track-player` (via
remote/duck events) surface these; normalising them is the adapter's job.

---

## 5. Public API: what stays, what changes, what goes

Target: **same prop names and defaults wherever the concept survives**, with
documented deltas. A web developer moving to the RN package should mostly be
able to copy their props across.

### 5.1 Unchanged

`width`, `height`, `barWidth`, `gap`, `styles` (all 14 colour fields), `markers`,
`markerHitRadius`, `precomputedPeaks`, `peakComputationWidth`, `responsive`,
`responsiveDebounceMs`, `controlledCurrentTime`, `onCurrentTimeChange`,
`onPlay`, `onPause`, `onEnded`, `onLoaded`, `onTimeUpdate`, `onPeaksComputed`,
`onLoadingChange`, `onError`, `showControls`, `showTime`, `defaultVolume`,
`onVolumeChange`, `renderButtons`, `initialDuration`, and the
`WaveformNavigatorHandle` methods `play` / `pause` / `seek`.

That is the large majority of the surface — good news, and a direct result of
the web version having kept platform details out of its prop names.

### 5.2 Changed signatures

| Prop / type               | Web                                    | React Native                                                      |
| ------------------------- | -------------------------------------- | ----------------------------------------------------------------- |
| `audio`                   | `string \| File \| null`               | `string \| { uri: string } \| number` (require'd asset) `\| null` |
| `MarkerRenderProps.ctx`   | `CanvasRenderingContext2D`             | `SkCanvas` — **the hardest break**; see §5.5                      |
| `onMarkerClick` event arg | `React.MouseEvent \| React.TouchEvent` | `GestureResponderEvent`                                           |
| `audioElementRef`         | `MutableRefObject<HTMLAudioElement>`   | `backendRef` → the adapter instance                               |
| `className`               | CSS class string                       | `style` / `containerStyle` (RN `StyleProp<ViewStyle>`)            |
| `showVolume`              | default `true`                         | default **`false`** — mobile convention is system volume          |
| `workerUrl`               | worker script URL                      | dropped; replaced by `computeBackend?: 'chunked' \| 'worklet'`    |
| `forceMainThread`         | boolean                                | kept, same meaning                                                |

### 5.3 Dropped

- `preload` — no `<audio>` preload attribute. The backend decides; `expo-audio`
  and RNTP both load lazily.
- `keyboardSmallStep`, `keyboardLargeStep`, `disableKeyboardControls` — folded
  into accessibility actions (§5.4). Could return later for tvOS or iPad
  hardware keyboards.
- Hover tooltip / `hoverX` — no pointer to hover with. The **scrub** tooltip
  already implemented in the touch handlers is the mobile idiom, and it survives.

### 5.4 Accessibility

The web version invested real effort in the ARIA slider pattern; the RN analogue
is direct and should be treated as a port target, not an afterthought:

- `accessibilityRole="adjustable"`
- `accessibilityValue={{ min: 0, max: duration, now: currentTime, text: '<formatted> of <formatted>' }}`
- `onAccessibilityAction` handling `increment` / `decrement`, reusing the
  `keyboardSmallStep` logic that `useKeyboardControls` already contains
- `accessibilityLabel` from the existing `ariaLabel` prop (renamed)

VoiceOver and TalkBack both drive `adjustable` with swipe gestures, so this gets
screen-reader seeking for roughly the cost of deleting `useKeyboardControls`.

### 5.5 The one genuinely hard break: custom marker rendering

`Marker.markup` receives a `CanvasRenderingContext2D`. Any consumer using it has
written Canvas 2D drawing code that cannot run on Skia. There is no compatibility
shim worth building — the APIs are close in spirit but differ in every call.

Options, in order of preference:

1. **Accept the break, document it loudly.** Provide a porting table for the
   handful of calls the demo actually uses (`fillRect`, `fillText`, `measureText`,
   `save`/`restore`). Ship recipes rather than an abstraction.
2. **Add a declarative escape hatch** — `renderMarker?: (props) => ReactNode`
   returning Skia elements. More idiomatic for RN anyway, and portable enough
   that the web version could grow the same prop later.

Recommend doing **both**: `markup` takes `SkCanvas` for imperative parity, and
`renderMarker` is the documented happy path.

---

## 6. Repo and code-sharing strategy

Three options were considered:

| Option                                                            | Verdict                                                                                                                                                |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Monorepo — extract `core`, restructure this repo                  | **No.** Restructuring a published package with a git-tag-driven OIDC release pipeline, to share 158 lines of pure math, is a bad trade today.          |
| Separate repo depending on a published `@waveform-navigator/core` | **Later.** The right endgame, but it front-loads an npm scope, a second release pipeline, and a version-coupling problem before the RN package exists. |
| **Separate repo, vendored core, structured for later extraction** | **Yes.** Ship value now, keep the exit cheap.                                                                                                          |

Concretely:

- Copy `peaksComputation.ts`, `defaultMarkerLabel.ts`, `formatTime.ts` **and
  their tests** into `src/core/`, untouched. No RN imports ever enter that
  directory.
- Add `scripts/check-core-sync.mjs` that fetches those three files from this
  repo's `main` on GitHub and diffs them. Run it in CI as a **warning, not a
  failure**. This repo's own guidance already flags that the worker and
  `peaksComputation.ts` must be kept in sync by hand; a third copy in a different
  repo makes that risk sharper, and a nagging CI job is cheap insurance.
- If the sync cost ever becomes real, publish `@waveform-navigator/core` from
  this repo and swap the vendored directory for a dependency. Because `src/core/`
  is already isolated, that is an import-path change, not a refactor.

### Packaging

- **Name:** `react-native-waveform-navigator`. The `react-native-*` prefix is the
  ecosystem convention and carries real npm discoverability weight.
- **Scaffold with `create-react-native-library`.** It sets up
  `react-native-builder-bob`, the `example/` app, and CI correctly. Vite is the
  wrong tool here — bob handles the `react-native` field, Metro resolution, and
  the commonjs/module/typescript triple.
- **Peer dependencies:** `react`, `react-native`, `@shopify/react-native-skia`,
  `react-native-gesture-handler`, `react-native-reanimated`. Audio libraries are
  **optional** peers, reached through subpath exports.
- **The "zero runtime dependencies" promise does not survive**, and should not be
  claimed. It was true on web because the browser supplied canvas, audio, and
  workers. On RN those are all third-party. Peer-dep everything and be explicit
  in the README that this is a deliberate difference between the two packages.
- **RN floor:** 0.79+ / React 19, following Skia 2.6+. Requiring the New
  Architecture keeps the matrix sane; RN 0.76+ defaults to it anyway.
- **Example app** replaces the Vite demo: an Expo app mirroring the seven demo
  tabs (Basic, Styles, Markers, Interactive Markers, Responsive, Controlled,
  Custom Buttons), reusing `demo/public/media/Demo.mp3`.

---

## 7. Phased delivery

Estimates assume one developer already fluent in RN. Roughly **6–8 weeks
part-time**, or **3–4 weeks focused**.

### Phase 0 — Decisions and spike · 0.5–1 week · **do not skip**

Answer §9. Then build a throwaway Expo app that, on a **real mid-range Android**
(not a simulator):

- decodes `Demo.mp3` via `react-native-audio-api` at 44.1kHz and at 8kHz,
- computes 1400 peaks on the JS thread, chunked,
- draws 400 bars in Skia with an animated playhead.

Record: decode time, peak time, peak JS heap, sustained frame rate, and whether
Skia offscreen rendering works headlessly in Node (that decides the visual
testing story, §8). Every downstream estimate depends on these numbers, and the
answers could change the stack — that's exactly why it comes first.

### Phase 1 — Core and rendering · 1–1.5 weeks

Scaffold with `create-react-native-library`. Vendor `src/core/` plus tests. Build
`useWaveformData` (decode → chunked compute → canonical/display resample) and
`WaveformCanvas` (path build, progress clip, shared-value playhead). No audio —
drive it from a fake clock.

**Done when:** the waveform renders correctly at any width and DPR, fills in
progressively, and the playhead animates smoothly against a fake clock.

### Phase 2 — Audio backend · 1–1.5 weeks

Define `WaveformAudioBackend`. Implement the first adapter. Rewrite
`useAudioPlayer`: lifecycle, status subscription, UI-thread time interpolation,
seek, volume. Wire to the canvas.

**Done when:** load, play, pause, seek, and volume all work end to end, and the
playhead tracks real audio without stutter.

### Phase 3 — Interaction · 0.5–1 week

`Gesture.Tap` for seek and marker taps, `Gesture.Pan` for scrubbing. Port the
marker hit-test loop and the 10px touch-slop logic — it already encodes the right
behaviour, and gesture-handler's `activeOffsetX`/`maxDist` map onto it cleanly.
Scrub tooltip. Accessibility actions (§5.4).

### Phase 4 — Controls · 0.5–1 week

`WaveformControls` in RN: `Pressable` buttons, `react-native-svg` icons (small
enough here that it's fine), time display, Reanimated volume slider, loading
spinner. Honour `renderButtons`, `showTime`, `showVolume`.

### Phase 5 — Robustness · 1 week · **the phase estimates die in**

`AppState`, audio-session interruptions, Android audio focus, error surfacing,
file caching and invalidation, offline behaviour, source-change races. This repo
spent 1,000+ test lines on the web version of this problem for good reason; the
mobile version is not smaller.

### Phase 6 — Example app, docs, release · 0.5–1 week

Seven tabs, README with the §5 compat table, npm publish.

---

## 8. Testing

- **Unit:** Jest + `@testing-library/react-native` (`jest-expo` preset if Expo).
  The `src/core/` tests port with an import swap — Vitest and Jest agree on
  `describe`/`it`/`expect` for pure functions.
- **Design for testability:** pull _all_ geometry out of the Skia render tree
  into pure functions — bar layout, played width, marker x, hit regions. Test
  those directly and don't unit-test the render tree. This is better design
  regardless, and it sidesteps mocking Skia.
- **The state machines are where the value is.** `useAudioPlayer` and
  `useWaveformData` are where bugs will live. Port the _scenarios_ from
  `WaveformNavigator.visibility.test.tsx` and the `useWaveformData.*` files even
  though the assertions must be rewritten — that suite is a specification of
  failure modes, and mobile has the same ones under different names.
- **Visual regression:** the real loss. Playwright + committed PNGs has no cheap
  equivalent. Best candidate: render offscreen via
  `Skia.Surface.MakeOffscreen()` → `makeImageSnapshot()` → compare with
  `pixelmatch` (already the pattern in this repo). If Phase 0 shows that works
  headlessly in Node, visual coverage is nearly as good as web's at a fraction of
  simulator cost. If not, fall back to Maestro screenshots on a single pinned
  device and accept thinner coverage.
- **E2E:** Maestro over Detox — YAML flows, far less setup, works with Expo dev
  builds. Cover load → play → seek → marker tap.
- **Coverage:** keep the 70% threshold and the same exclusions in spirit
  (compute backends and `index.ts` excluded, covered by e2e).

---

## 9. Decisions needed before Phase 1

These change the plan materially. Phase 0 should close them.

1. **Expo or bare RN?** Drives `expo-audio` vs `react-native-track-player` and
   the file-system library. _Assumed for this plan: Expo with dev builds._
2. **Is background / lock-screen playback required?** If yes, `react-native-track-player`
   becomes the first adapter instead of `expo-audio`, and Phase 2 grows by
   several days. This is the single biggest branch point.
3. **Will peaks be shared between the web app and the mobile app?** If yes, pin
   `peakSampleRate` on both platforms (§4.3) — and that means a small feature
   release on _this_ repo.
4. **Remote URLs, bundled assets, or both?** Both is assumed; remote-only lets
   §4.5 shrink.
5. **Does anything use `Marker.markup` today?** If the app only uses default
   badges, §5.5 stops being a problem and `renderMarker` alone is enough.
6. **Which audio formats must work?** `react-native-audio-api` defaults to
   mp3/wav/mp4/m4a/aac. Anything outside that needs verification in Phase 0.

---

## 10. Risks

| Risk                                                                | Likelihood | Impact | Mitigation                                                                                                     |
| ------------------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| Decode memory/time unacceptable on low-end Android                  | Medium     | High   | Reduced sample rate (§4.3); measure in Phase 0; native module as the escape hatch                              |
| `expo-audio` `currentTime`-after-seek bug bites                     | Medium     | Medium | The backend adapter exists precisely for this — swap to RNTP without touching the component                    |
| Skia font loading makes marker labels flicker or mis-measure        | Medium     | Low    | System font manager + the existing width estimate as fallback; single measurement source for draw and hit-test |
| Worklet runtime copies the Float32Array, costing more than it saves | Medium     | Low    | Chunked JS is the default; worklets stay opt-in and benchmarked                                                |
| Visual regression coverage doesn't survive the move                 | Medium     | Medium | Validate offscreen Skia snapshots in Phase 0; fall back to Maestro with reduced scope                          |
| `src/core/` drifts from this repo                                   | High       | Low    | CI sync check; extraction to a shared package is pre-planned and cheap                                         |
| Background/interruption handling turns into a long tail             | High       | Medium | Phase 5 is scoped for it; port the web scenario list rather than rediscovering failures on device              |
| RN audio ecosystem churn during the build                           | Medium     | Medium | Pinned peer ranges; the adapter interface is the insulation layer                                              |

---

## 11. What this buys the web repo

Two changes are worth making here regardless of whether the RN port ships:

1. **`peakSampleRate` prop** (§4.3) — lets web and mobile produce identical
   peaks, and lets web users cut decode cost on long files. Minor release.
2. **Marker label measurement consistency** (§4.2) — the drawn badge uses
   `measureText`, the hit region uses an estimate. Making both use one value is a
   small, self-contained fix.

Neither is urgent. Both get cheaper to do now than after a second implementation
depends on the current behaviour.
