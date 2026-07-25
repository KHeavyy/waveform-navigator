# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this is

`waveform-navigator` is a published npm package (v0.5.0, MIT): a single React
component that renders an audio waveform on a `<canvas>` and drives an
underlying `<audio>` element for playback, seeking, markers, and volume.

- **Library**, not an app — every change is a public API change for consumers.
- React 18+ is a **peer dependency**; never add it as a direct dependency.
- Zero runtime dependencies. Keep it that way.
- TypeScript strict mode, functional components + hooks only.
- Published artifacts: `dist/index.mjs`, `dist/index.cjs`, `dist/index.d.ts`,
  `dist/styles.css`, `dist/peaks.worker.js`. The `files` field ships `dist` and `src`.

## Commands

```bash
npm run dev            # concurrently: library watch build + demo dev server (:5173)
npm run build          # clean + vite build (lib) + vite build --mode worker
npm run type-check     # tsc --noEmit
npm run lint           # alias for type-check (NOT eslint)
npm run lint:ci        # eslint --max-warnings 0  — what you actually want for lint errors
npm run lint:fix       # eslint --fix
npm run format         # prettier --write .
npm test               # vitest run (unit, jsdom)
npm run test:watch     # vitest watch
npm run test:coverage  # vitest + v8 coverage (70% thresholds, enforced)
npm run e2e            # playwright; auto-starts the demo dev server
npm run e2e -- e2e/visual.spec.ts   # visual regression only
npm run e2e:ui         # playwright interactive UI mode
npm run e2e:headed     # run e2e with a visible browser
npm run e2e:debug      # playwright inspector
npm run visual:update  # regenerate committed visual snapshots
```

`npm run prepare` runs `npm run build`, so `npm install` builds the library.
The demo has its own `package.json`/lockfile — install it separately
(`npm install --prefix demo`) before running e2e.

**Before finishing any code change:** `npm run type-check`, `npm run lint:ci`,
`npm run format:check`, and `npm test`. Run `npm run e2e` when touching canvas
rendering, controls layout, or the worker.

Note: `format:check` currently reports ~12 pre-existing offenders (several test
files, `eslint.config.cjs`, `.github/PUBLISHING.md`). CI does not run it, so
that backlog is not blocking — just make sure the files _you_ touched are
clean rather than reformatting the repo as a side effect.

## Architecture

```
src/
├── index.ts                  # public entry — everything consumers can import
├── WaveformNavigator.tsx     # the component: props, refs, pointer/touch handling, marker hit-testing
├── components/
│   └── WaveformControls.tsx  # play/rewind/forward, time display, volume (incl. mobile popup)
├── hooks/
│   ├── useAudioPlayer.ts     # <audio> element lifecycle, play state, recovery, volume
│   ├── useWaveformData.ts    # fetch/decode audio → peaks (worker or main thread)
│   ├── useWaveformCanvas.ts  # all canvas drawing + RAF playhead loop
│   ├── useResponsiveWidth.ts # ResizeObserver + debounce → container width
│   └── useKeyboardControls.ts# ARIA slider keyboard pattern
├── utils/
│   ├── peaksComputation.ts   # computePeaksFromChannelData + resamplePeaks (shared with worker)
│   ├── workerCreation.ts     # worker construction with graceful fallback to null
│   ├── syncCanvasSize.ts     # HiDPI sizing, returns devicePixelRatio
│   ├── defaultMarkerLabel.ts # default M1/M2 badge geometry + hit region (shared draw/hit-test)
│   └── formatTime.ts
├── peaks.worker.ts           # off-main-thread peak computation, streams partial results
└── styles.css                # all component CSS (imported by WaveformNavigator.tsx)
```

`WaveformNavigator.tsx` is the only orchestrator: it owns hover state, marker
hover/click state, error state, and the shared blob-URL lifecycle, then wires
the five hooks together. Hooks do not talk to each other directly.

### Data flow

1. `useWaveformData` fetches the audio (or reads the `File`), decodes it via
   `AudioContext.decodeAudioData`, and hands channel data to the worker.
2. The worker streams `progress` messages so the waveform fills in
   progressively; the last message has `done: true`.
3. `useWaveformCanvas` caches the base waveform as `ImageData` and, during
   playback, only repaints the progress region + playhead each RAF frame.
4. `useAudioPlayer` owns the `<audio>` element and is the source of truth for
   `currentTime`, `duration`, `isPlaying`, `isLoading`, and `volume`.

### Invariants worth knowing before you edit

- **Canonical vs. display peaks.** Peaks are computed once at
  `peakComputationWidth` (default 1400), stored as the canonical array, and
  `resamplePeaks`-ed down to the current display bar count for rendering.
  `onPeaksComputed` always emits the canonical array so a consumer can persist
  one copy that looks right at any screen size. Resizing must never trigger
  recomputation from audio.
- **The worker and `peaksComputation.ts` must stay in sync.** They implement
  the same slot/max algorithm; a change to one needs the same change to the
  other or worker and main-thread output diverge. `e2e/worker.spec.ts` covers
  the main-thread path via the demo's "Force main-thread processing" toggle.
- **Worker failure is not an error.** `createPeaksWorker` returns `null` on
  unsupported/CSP/bundler failure and the hook falls back to main-thread
  computation. Preserve that path — `forceMainThread` and `workerUrl` are
  public props.
- **Shared blob URL.** `useWaveformData` hands the fetched `ArrayBuffer` back
  as a blob URL so the `<audio>` element doesn't refetch. The URL is owned and
  revoked in `WaveformNavigator.tsx`, and is tagged with the `audio` value it
  was created for so a late-arriving fetch can't attach to a newer source.
- **Background-tab / streamed-source recovery.** `useAudioPlayer` has
  substantial logic around `visibilitychange`, window focus, media errors, and
  reloading the source and waiting for `canplay` (8s timeout). This exists
  because browsers evict media data in background tabs. Don't simplify it
  without reading `WaveformNavigator.visibility.test.tsx` (1000+ lines of
  regression coverage for exactly these cases).
- **Controlled mode** uses a 0.01s threshold when syncing
  `controlledCurrentTime` to avoid feedback loops.
- **HiDPI.** Always size the canvas through `syncCanvasSize` and honour
  `devicePixelRatio`; invalidate the `ImageData` cache on any resize.
- **Silence stays visible.** Bars render at a `MIN_BAR_HEIGHT` floor (2px) so
  silent sections aren't invisible gaps.
- **Marker hit regions.** The default hit region is the M1/M2 label badge only
  (plus `markerHitRadius` padding) — not the stem — so clicks near a marker
  still seek. Markers can override with `hitTest`. Hit-testing is only enabled
  when `onMarkerClick` or `onMarkerHover` is supplied.
- `window.__waveformReady` is set by `useWaveformCanvas` after the first draw.
  E2E and unit tests rely on it; don't remove it.

## Documentation is part of the change (enforced)

`.claude/hooks/check-api-docs.sh` runs on Stop and **blocks completion** when
`src/WaveformNavigator.tsx`, `src/hooks/useAudioPlayer.ts`, or `dist/index.d.ts`
changed without a matching update to `README.md` **and** `demo/src/`.

So when you add or change a public prop, callback, style field, or ref method:

1. Update the type in `WaveformNavigator.tsx` with a TSDoc comment including
   the default value.
2. Add a default in the destructuring block if the prop is optional.
3. Document it in `README.md` under the matching section — "Basic Props",
   "Responsive Props", "Worker Configuration Props", "Controlled Props",
   "Event Callbacks", "Accessibility Props", "UI Control Props",
   "WaveformNavigatorStyles Interface", or "Programmatic Control".
4. Exercise it in a `demo/src/tabs/*.tsx` tab (add a tab in `App.tsx`'s `TABS`
   list and the corresponding `activeTab` branch if it warrants its own).
5. Export any new public type from `src/index.ts`.

### This file is the single source of truth

Contributor and AI-assistant guidance lives **here and nowhere else**. These
files used to carry their own copies and are now pointers — if you change a
workflow, a command, or a convention, edit this file and leave them alone:

- `.github/copilot-instructions.md` → points here.
- `e2e/README.md` → points here.
- `.github/PUBLISHING.md` → keeps only what this file does not cover: the
  one-time npm OIDC trusted-publishing setup, publish-failure troubleshooting,
  and the emergency manual-publish steps. Release _rules_ (what bumps what)
  live in "Git, CI, and releases" below.

`README.md` is the consumer-facing npm page, not contributor docs. It documents
the public API for people installing the package; its "Development" sections
are a courtesy summary. When guidance and README disagree, this file wins.

## Testing

- **Unit** — Vitest + Testing Library, `jsdom`, globals enabled, setup in
  `src/test/setup.ts` (mocks `AudioContext`, canvas 2D context, `ResizeObserver`,
  `fetch`, and `HTMLMediaElement.play/pause/load`). Tests live in
  `__tests__/` folders next to the code, named `<subject>.<scenario>.test.tsx`
  (e.g. `useWaveformData.workerFail.test.tsx`) — one file per scenario rather
  than one giant file per module.
- Coverage thresholds are 70% across lines/functions/branches/statements and CI
  fails below them. `peaks.worker.ts`, `workerCreation.ts`, `index.ts`, and the
  demo are excluded (covered by e2e instead).
- **E2E** — Playwright against the demo app on `localhost:5173`, which
  Playwright starts itself. Projects: `chromium-dpr1`, `chromium-dpr2`, and
  `mobile-chrome` (Pixel 5, runs only `mobile.spec.ts`). Navigate with
  `?tab=<id>` via the `WaveformPage` helper in `e2e/helpers.ts`. The specs are
  `waveform.spec.ts` (loading, DPR, play/pause, click-to-seek, axe-core a11y),
  `visual.spec.ts`, `mobile.spec.ts`, `worker.spec.ts`, `customButtons.spec.ts`,
  and `generate-screenshots.spec.ts` (regenerates `screenshots/` for the README).
  There is no fixtures directory — tests play the demo's own
  `demo/public/media/Demo.mp3`, served by the demo dev server.
- **Visual regression** — snapshots in `e2e/__snapshots__/` are committed.
  Intentional visual changes require `npm run visual:update` plus committing
  the new baselines, or CI fails.
- **Playwright browsers** differ by environment:
  - _Claude Code on the web / agent sandboxes_ — binaries are preinstalled at
    `/opt/pw-browsers` (`PLAYWRIGHT_BROWSERS_PATH` points there) and downloads
    are blocked. Don't run `playwright install` here; it will fail or waste
    time. `.claude/hooks/session-start.sh` covers the OS-level deps on
    session start.
  - _CI_ — `ci.yml` installs them itself with
    `npx playwright install --with-deps chromium` before the integration and
    visual jobs. That step is meant to be there; leave it alone.
  - _A fresh local checkout_ — run `npx playwright install chromium` once.

## Code style

Prettier owns formatting and ESLint reports it as an error. Notable settings:

- **Tabs** for indentation (`tabWidth: 1`), single quotes, semicolons,
  `printWidth: 80`, `trailingComma: es5`. YAML uses 2 spaces.
- `curly: ['error', 'all']` — braces on every control statement, always.
- `padding-line-between-statements` — a blank line after every closing brace.
- No `any` where a real type or `unknown` will do (existing `(self as any)` /
  `(window as any)` casts in worker and browser-detection code are deliberate).
- Props interfaces are named `<Component>Props`; callback props are `on*`;
  hooks are `use*` in `src/hooks/` and re-exported from `src/hooks/index.ts`.
- Components are PascalCase `.tsx`, utilities camelCase `.ts`.
- README is excluded from Prettier (`.prettierignore`) because npm's renderer
  prefers spaces — don't reformat it.

## Git, CI, and releases

- Work on the branch you were assigned; open PRs against `main`. Squash on
  merge — commit subjects become the release changelog.
- **Commit subjects drive releases.** On every push to `main`, `publish.yml`
  reads commits since the last `v*` tag: `BREAKING CHANGE:` or `type!:` → major,
  `feat:`/`feature:` → minor, anything else → patch. It then bumps, tags,
  publishes to npm with provenance, and creates a GitHub release. Choose commit
  prefixes deliberately — `feat:` on a bugfix ships a minor version. The repo
  history uses `feat:`, `fix:`, `bug:`, and `ci:`. Note that `bug:` is not one
  of the recognised prefixes, so it falls through to a patch bump.

  ```text
  fix: resolve audio playback issue on Safari      → 1.0.0 → 1.0.1
  feat: add support for custom waveform colors     → 1.0.0 → 1.1.0
  feat: redesign component API                     → 1.0.0 → 2.0.0
    (body) BREAKING CHANGE: onTimeUpdate now receives an object
  ```

- `package.json`'s `version` is not the source of truth; git tags are. Don't
  hand-bump it. Publishing uses npm OIDC trusted publishing — no tokens. See
  `.github/PUBLISHING.md` for the one-time setup, failure troubleshooting, and
  the emergency manual-publish procedure.
- `ci.yml` runs on PRs to `main`: lint + type-check, unit tests with coverage,
  Playwright integration tests, visual regression, and a build that asserts all
  five dist artifacts exist.
- `deploy-demo.yml` publishes `demo/` to GitHub Pages on push to `main`
  (built with `--base /waveform-navigator/`).
- `dist/` is gitignored — never commit build output. `e2e/__snapshots__/` and
  `screenshots/` are committed on purpose.
