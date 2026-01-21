# GitHub Copilot Instructions for waveform-navigator

## Project Overview

This repository is a React component library that provides an audio waveform visualization and navigation component called `WaveformNavigator`. It's built as an NPM package for reuse in other React applications.

**Tech Stack:**
- **Language:** TypeScript (strict mode enabled)
- **Framework:** React 18+ (functional components with hooks)
- **Build Tool:** TypeScript compiler (tsc)
- **Module System:** ESNext with bundler resolution
- **Package Manager:** npm

## Project Structure

```
src/
├── WaveformNavigator.tsx        # Main component
├── components/                  # Reusable UI components
│   └── WaveformControls.tsx    # Audio player controls
├── hooks/                       # Custom React hooks
│   ├── useAudioPlayer.ts       # Audio playback logic
│   ├── useWaveformData.ts      # Waveform data processing
│   └── useWaveformCanvas.ts    # Canvas rendering logic
├── utils/                       # Helper utilities
│   ├── formatTime.ts           # Time formatting
│   └── syncCanvasSize.ts       # Canvas sizing utilities
├── peaks.worker.ts             # Web Worker for audio processing
├── styles.css                  # Component styles
└── index.ts                    # Package entry point

demo/                            # Demo application (Vite-based)
```

## Coding Standards

### TypeScript Guidelines
- **Strict Mode:** Always maintain strict TypeScript configuration
- **Type Safety:** Avoid using `any` type; use explicit types or `unknown` when necessary
- **Interfaces:** Define interfaces for all component props and complex data structures
- **Type Exports:** Export type definitions when they may be useful to consumers

### React Best Practices
- **Functional Components:** Use only functional components with hooks (no class components)
- **Component Structure:** Follow the pattern: imports → types → component → export
- **Hooks:** Custom hooks should be prefixed with `use` and follow React hooks rules
- **Props Interfaces:** Name component props interfaces as `ComponentNameProps`
- **Refs:** Use `React.MutableRefObject` for refs that can be passed to consumers

### Component Patterns
- **Default Props:** Use default parameter values in destructuring for optional props
- **Event Handlers:** Prefix callback props with `on` (e.g., `onPlay`, `onPause`, `onTimeUpdate`)
- **Controlled vs Uncontrolled:** Support both patterns where applicable (see `controlledCurrentTime` example)
- **Custom Hooks:** Extract complex stateful logic into custom hooks for reusability

### Code Organization
- **Named Exports:** Use both default and named exports in index files for flexibility
- **Index Files:** Use index files to re-export public APIs from directories
- **File Naming:** Use PascalCase for component files (`.tsx`), camelCase for utilities (`.ts`)
- **Component Files:** Keep components focused; extract complex logic into hooks

## Styling
- **CSS:** Component styles are in `src/styles.css`
- **Class Names:** Use descriptive, lowercase class names with hyphens
- **Inline Styles:** Acceptable for dynamic styling based on props (colors, dimensions)
- **HiDPI Support:** Consider devicePixelRatio for canvas rendering on high-DPI displays

## Building, Testing, and Validation

### Build Commands
```bash
npm run build         # Build the library with TypeScript compiler
npm run prepare       # Runs automatically before npm publish
npm run dev           # Watch mode: concurrent tsc watch + demo dev server
```

### Testing
- **Test Command:** `npm test` (currently returns success with no tests configured)
- **Note:** There is no active test infrastructure yet. When adding tests, prefer Jest with React Testing Library

### Package Publishing
- **Built Files:** `dist/` directory (compiled JavaScript + type declarations)
- **Published Files:** Only `dist/` and `src/` directories are published (see `files` field in package.json)
- **Peer Dependencies:** React >=18 and react-dom >=18

## Audio & Canvas Specifics

### Web Audio API
- This component uses the Web Audio API (`AudioContext`) for waveform generation
- Audio files are decoded to generate peak data for visualization
- Handle CORS properly when loading remote audio URLs

### Web Workers
- `peaks.worker.ts` processes audio data off the main thread
- Worker communication uses `postMessage` for peak computation

### Canvas Rendering
- Canvas dimensions should account for `devicePixelRatio` for sharp rendering on Retina displays
- The `useWaveformCanvas` hook handles canvas drawing and playhead rendering
- Canvas should be cleared and redrawn when waveform data or visual props change

## Important Conventions

### Controlled Component Pattern
- When `controlledCurrentTime` prop is provided, the component operates in controlled mode
- In controlled mode, parent manages playback position via `controlledCurrentTime` and `onCurrentTimeChange`
- Use a threshold (0.01 seconds) to avoid feedback loops when syncing controlled time

### Callback Consistency
- All event callbacks are optional and should be safely invoked with optional chaining or null checks
- Callbacks should fire at appropriate lifecycle moments (e.g., `onLoaded` after metadata loads)

### Memory Management
- Clean up object URLs created from File objects to prevent memory leaks
- Remove event listeners in cleanup functions of useEffect hooks

## Documentation Requirements
- **README:** Keep README.md up to date with API changes
- **Props Documentation:** Document all component props with descriptions, types, and defaults
- **Code Comments:** Add comments for complex logic, especially in audio/canvas processing
- **Examples:** Include usage examples in README for common patterns

## Dependencies
- **Minimize Dependencies:** Keep the package lightweight; avoid adding unnecessary dependencies
- **Peer Dependencies:** Don't add React as a direct dependency (it's a peer dependency)
- **Dev Dependencies:** TypeScript, type definitions, and build tools only

## Security Considerations
- **Audio Sources:** Validate and sanitize audio source URLs from user input
- **CORS:** Ensure proper CORS headers for remote audio files
- **File Uploads:** Handle File objects safely; validate file types when accepting uploads

## Common Tasks

### Adding a New Prop
1. Add the prop to the `WaveformNavigatorProps` interface
2. Add a default value if optional (in component destructuring)
3. Update README.md with prop documentation
4. Use the prop in the component logic

### Creating a New Hook
1. Create file in `src/hooks/` with `use` prefix
2. Define clear input props interface and return type interface
3. Export from `src/hooks/index.ts`
4. Follow React hooks rules (call hooks unconditionally, only in function components)

### Modifying Canvas Rendering
1. Update `useWaveformCanvas` hook
2. Ensure HiDPI support is maintained (respect devicePixelRatio)
3. Clear canvas before redrawing to prevent visual artifacts

## References
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
