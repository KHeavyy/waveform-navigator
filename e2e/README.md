# E2E Tests

This directory contains end-to-end tests for the WaveformNavigator component using Playwright.

## Structure

- `waveform.spec.ts` - Integration tests for component functionality
- `visual.spec.ts` - Visual regression tests for canvas rendering
- `helpers.ts` - Test helpers and utilities
- `fixtures/` - Test fixtures including sample audio files

## Running Tests

```bash
# Run all e2e tests
npm run e2e

# Run with UI (interactive)
npm run e2e:ui

# Run in headed mode (see browser)
npm run e2e:headed

# Debug tests
npm run e2e:debug

# Run only visual tests
npm run e2e -- e2e/visual.spec.ts

# Update visual snapshots
npm run visual:update
```

## Test Coverage

### Integration Tests (`waveform.spec.ts`)
- Audio loading and waveform rendering
- Device pixel ratio handling (DPR 1 and 2)
- Play/pause controls
- Seek functionality (click-to-seek)
- Responsive resizing
- Accessibility checks with axe-core
- Time formatting display

### Visual Tests (`visual.spec.ts`)
- Waveform snapshot comparisons
- Multi-DPR rendering consistency
- Responsive width handling
- Aspect ratio verification

## Visual Snapshots

Visual snapshots are stored in `__snapshots__/` and are committed to version control. When making intentional visual changes:

1. Run `npm run visual:update` to generate new baselines
2. Review the updated snapshots
3. Commit the changes

CI will fail if visual changes are detected without updated baselines.

## Test Fixtures

The e2e tests use the demo application's audio file (`demo/media/Demo.mp3`) which is automatically served by the dev server configured in `playwright.config.ts`. This ensures tests use the same audio file as the demo, making them more realistic and easier to maintain.
