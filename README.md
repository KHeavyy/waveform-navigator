# waveform-navigator

A small React component to render an audio waveform and provide navigation + playback controls.

## Installation

```
npm install waveform-navigator
```

## Basic Usage

```jsx
import React from 'react';
import ReactDOM from 'react-dom';
import WaveformNavigator from 'waveform-navigator';
import 'waveform-navigator/styles.css'; // Don't forget to import styles!

function App() {
	// `audio` can be a URL string or a `File` object (from an `<input type="file"/>`).
	const url = '/path/to/audio.mp3';
	return (
		<div style={{ width: 900 }}>
			<WaveformNavigator audio={url} width={900} height={140} />
		</div>
	);
}

ReactDOM.render(<App />, document.getElementById('root'));
```

### TypeScript Support

The package includes full TypeScript type definitions. Types are automatically available when you import the component:

```tsx
import WaveformNavigator from 'waveform-navigator';
import type { WaveformNavigatorProps } from 'waveform-navigator';
```

## API Reference

### Props

#### Basic Props

- **`audio`** (string | File | null | undefined): The audio source - can be a URL string or a File object from an `<input type="file"/>`.
- **`width`** (number, default: 800): Width of the waveform canvas in pixels. When `responsive` is enabled, this serves as the fallback width.
- **`height`** (number, default: 120): Height of the waveform canvas in pixels.
- **`className`** (string, default: ''): Additional CSS class name for the container.

#### Responsive Props

- **`responsive`** (boolean, default: true): Enable automatic resizing to match container width using ResizeObserver. When enabled, the waveform automatically adjusts the number of bars and resamples peaks when the container is resized.
- **`responsiveDebounceMs`** (number, default: 150): Debounce delay in milliseconds for resize events. Higher values reduce recomputation frequency during continuous resizing.

#### Worker Configuration Props

- **`workerUrl`** (string | undefined): Optional custom URL for the Web Worker that computes waveform peaks. When not provided, the component uses the bundled worker. Use this when hosting the worker file separately (e.g., on a CDN) or when your bundler requires a specific worker path.
- **`forceMainThread`** (boolean, default: false): Force peak computation to run on the main thread instead of using a Web Worker. Set to `true` to disable worker usage (useful for debugging or environments where workers are restricted).

#### Visual Customization Props

- **`barWidth`** (number, default: 3): Width of each waveform bar in pixels.
- **`gap`** (number, default: 2): Gap between waveform bars in pixels.
- **`styles`** (WaveformNavigatorStyles | undefined): A centralized style configuration object for customizing all visual aspects of the waveform and controls. Provides a clean way to configure colors without needing individual props for each element.

##### WaveformNavigatorStyles Interface

The `styles` prop accepts an object with the following optional properties:

**Waveform Colors:**

- `barColor` (string, default: '#2b6ef6'): Color of the waveform bars.
- `progressColor` (string, default: '#0747a6'): Color of the played portion of the waveform.
- `backgroundColor` (string, default: 'transparent'): Background color of the waveform canvas.
- `playheadColor` (string, default: '#ff4d4f'): Color of the playhead indicator.

**Control Button Colors:**

- `playButtonColor` (string, default: '#111827'): Background color of the play/pause button.
- `playIconColor` (string, default: '#fff'): Color of the play/pause icon.
- `rewindButtonColor` (string, default: '#fff'): Background color of the rewind button.
- `rewindIconColor` (string, default: '#111827'): Color of the rewind icon.
- `forwardButtonColor` (string, default: '#fff'): Background color of the forward button.
- `forwardIconColor` (string, default: '#111827'): Color of the forward icon.

**Volume Control Colors:**

- `volumeSliderFillColor` (string, default: '#111827'): Color of the volume slider fill and thumb.
- `volumeIconColor` (string, default: '#374151'): Color of the volume icon. The icon dynamically changes based on volume level (muted, low, high).

**Example:**

```tsx
<WaveformNavigator
	audio="/audio.mp3"
	styles={{
		barColor: '#8b5cf6',
		progressColor: '#6d28d9',
		playheadColor: '#ec4899',
		playButtonColor: '#7c3aed',
		playIconColor: '#fff',
		volumeSliderFillColor: '#7c3aed',
	}}
/>
```

**Note:** The volume icon is clickable and will toggle mute/unmute. When unmuted, it automatically restores the previous volume level.

#### Controlled Props

The component supports both controlled and uncontrolled modes for playback position:

- **`controlledCurrentTime`** (number | undefined): When provided, the component operates in controlled mode where the parent manages the playback position. The audio element's currentTime will be synced with this value.
- **`onCurrentTimeChange`** ((time: number) => void): Callback fired when the internal time changes (in uncontrolled mode). Use this with `controlledCurrentTime` to implement controlled mode.
- **`audioElementRef`** (React.MutableRefObject<HTMLAudioElement | null>): A ref that will be populated with the internal audio element, allowing direct access to the HTMLAudioElement API.

#### Event Callbacks

- **`onPlay`** (() => void): Callback fired when audio playback starts.
- **`onPause`** (() => void): Callback fired when audio playback pauses.
- **`onEnded`** (() => void): Callback fired when audio playback ends.
- **`onLoaded`** ((duration: number) => void): Callback fired when audio metadata is loaded, providing the duration in seconds.
- **`onTimeUpdate`** ((currentTime: number) => void): Callback fired during playback as the current time updates, providing the current time in seconds.
- **`onPeaksComputed`** ((peaks: Float32Array) => void): Callback fired when waveform peaks are computed, providing the peak data array.
- **`onError`** ((error: Error, type: 'audio' | 'waveform') => void): Callback fired when an error occurs during audio loading or waveform computation. The `type` parameter indicates whether the error occurred during audio playback ('audio') or waveform generation ('waveform'). Common errors include CORS issues, unsupported audio formats, and decoding failures.

#### Accessibility Props

- **`keyboardSmallStep`** (number, default: 5): Step size in seconds for small seek operations (ArrowLeft/ArrowRight keys).
- **`keyboardLargeStep`** (number | undefined): Step size in seconds for large seek operations (PageUp/PageDown keys). If not provided, defaults to 10% of the audio duration.
- **`disableKeyboardControls`** (boolean, default: false): Disable built-in keyboard navigation. Set to `true` if you want to implement custom keyboard handling.
- **`ariaLabel`** (string, default: 'Audio waveform seek bar'): Accessible label for the waveform control, announced to screen readers.

#### UI Control Props

- **`showControls`** (boolean, default: true): Show or hide the built-in playback controls. Set to `false` to display only the waveform, useful when implementing custom controls or minimal UI. When hidden, you can control playback programmatically using the component ref.

### Programmatic Control (Ref Forwarding)

The component supports ref forwarding to expose imperative methods for programmatic control. This is useful for implementing custom UI controls or controlling playback from parent components.

#### Ref Handle Type

```tsx
import type { WaveformNavigatorHandle } from 'waveform-navigator';

interface WaveformNavigatorHandle {
	play: () => Promise<void>;
	pause: () => void;
	seek: (time: number) => void;
	resumeAudioContext: () => Promise<void>;
}
```

#### Methods

- **`play()`**: Start or resume audio playback. Returns a Promise that resolves when playback starts.
- **`pause()`**: Pause audio playback.
- **`seek(time)`**: Seek to a specific time in seconds.
- **`resumeAudioContext()`**: Resume any suspended AudioContext (required for Safari/iOS before playing audio). Returns a Promise that resolves when the context is resumed.

## Usage Examples

### Programmatic Control with Custom UI

Control playback from parent component without showing built-in controls:

```tsx
import { useRef } from 'react';
import WaveformNavigator from 'waveform-navigator';
import type { WaveformNavigatorHandle } from 'waveform-navigator';
import 'waveform-navigator/styles.css';

function App() {
	const waveformRef = useRef<WaveformNavigatorHandle>(null);

	const handlePlay = async () => {
		// Resume AudioContext first (required for Safari/iOS)
		await waveformRef.current?.resumeAudioContext();
		await waveformRef.current?.play();
	};

	const handlePause = () => {
		waveformRef.current?.pause();
	};

	const handleSeekTo30 = () => {
		waveformRef.current?.seek(30);
	};

	return (
		<div>
			<WaveformNavigator
				ref={waveformRef}
				audio="/path/to/audio.mp3"
				width={900}
				height={140}
				showControls={false} // Hide built-in controls
			/>

			{/* Custom controls */}
			<div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
				<button onClick={handlePlay}>Play</button>
				<button onClick={handlePause}>Pause</button>
				<button onClick={handleSeekTo30}>Jump to 30s</button>
			</div>
		</div>
	);
}
```

### Minimal Waveform-Only UI

Display only the waveform for visualization purposes:

```tsx
function App() {
	return (
		<div style={{ width: '100%', maxWidth: 1200 }}>
			<WaveformNavigator
				audio="/path/to/audio.mp3"
				height={80}
				showControls={false}
				styles={{
					barColor: '#38bdf8',
					progressColor: '#0284c7',
					playheadColor: '#f43f5e',
				}}
			/>
		</div>
	);
}
```

### Custom Styled Controls

Customize the appearance of the waveform and playback controls:

```tsx
function App() {
	return (
		<div style={{ width: '100%', maxWidth: 1200 }}>
			<WaveformNavigator
				audio="/path/to/audio.mp3"
				styles={{
					// Waveform colors
					barColor: '#8b5cf6',
					progressColor: '#6d28d9',
					playheadColor: '#ec4899',
					// Control button colors
					playButtonColor: '#7c3aed',
					playIconColor: '#fff',
					rewindButtonColor: '#f3f4f6',
					rewindIconColor: '#6b7280',
					forwardButtonColor: '#f3f4f6',
					forwardIconColor: '#6b7280',
					// Volume control colors
					volumeSliderFillColor: '#7c3aed',
					volumeIconColor: '#6b7280',
				}}
			/>
		</div>
	);
}
```

**Note:** The volume icon automatically changes based on the volume level:

- **Muted** (0%): Speaker with slash
- **Low** (< 33%): Speaker with one sound wave
- **Medium** (< 66%): Speaker with two sound waves
- **High** (≥ 66%): Speaker with three sound waves

Click the volume icon to toggle mute/unmute. When unmuted, it restores the previous volume level.

### Combining Ref Control with Event Callbacks

```tsx
function App() {
	const waveformRef = useRef<WaveformNavigatorHandle>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);

	const togglePlayback = async () => {
		if (isPlaying) {
			waveformRef.current?.pause();
		} else {
			await waveformRef.current?.resumeAudioContext();
			await waveformRef.current?.play();
		}
	};

	return (
		<div>
			<WaveformNavigator
				ref={waveformRef}
				audio="/path/to/audio.mp3"
				width={900}
				height={140}
				showControls={false}
				onPlay={() => setIsPlaying(true)}
				onPause={() => setIsPlaying(false)}
				onTimeUpdate={setCurrentTime}
			/>

			<div style={{ marginTop: 16 }}>
				<button onClick={togglePlayback}>{isPlaying ? 'Pause' : 'Play'}</button>
				<span style={{ marginLeft: 16 }}>
					Current time: {currentTime.toFixed(2)}s
				</span>
			</div>
		</div>
	);
}
```

### Uncontrolled Mode (Default)

The component manages its own playback state:

```jsx
function App() {
	return (
		<WaveformNavigator
			audio="/path/to/audio.mp3"
			width={900}
			height={140}
			onPlay={() => console.log('Playing')}
			onPause={() => console.log('Paused')}
			onTimeUpdate={(time) => console.log('Current time:', time)}
		/>
	);
}
```

### Controlled Mode

Parent component manages the playback position:

```jsx
function App() {
	const [currentTime, setCurrentTime] = useState(0);

	return (
		<div>
			<WaveformNavigator
				audio="/path/to/audio.mp3"
				width={900}
				height={140}
				controlledCurrentTime={currentTime}
				onCurrentTimeChange={setCurrentTime}
				onTimeUpdate={(time) => console.log('Time update:', time)}
			/>
			<button onClick={() => setCurrentTime(30)}>Jump to 30s</button>
		</div>
	);
}
```

### Accessing the Audio Element

```jsx
function App() {
	const audioRef = useRef < HTMLAudioElement > null;

	const handleCustomControl = () => {
		if (audioRef.current) {
			audioRef.current.playbackRate = 1.5; // Speed up playback
		}
	};

	return (
		<div>
			<WaveformNavigator
				audio="/path/to/audio.mp3"
				width={900}
				height={140}
				audioElementRef={audioRef}
			/>
			<button onClick={handleCustomControl}>Speed up 1.5x</button>
		</div>
	);
}
```

### Monitoring Waveform Computation

```jsx
function App() {
	const [peaksReady, setPeaksReady] = useState(false);

	return (
		<div>
			{!peaksReady && <div>Computing waveform...</div>}
			<WaveformNavigator
				audio="/path/to/audio.mp3"
				width={900}
				height={140}
				onPeaksComputed={(peaks) => {
					console.log('Peaks computed:', peaks.length, 'bars');
					setPeaksReady(true);
				}}
				onLoaded={(duration) => {
					console.log('Audio loaded, duration:', duration, 'seconds');
				}}
			/>
		</div>
	);
}
```

### Error Handling

The component provides comprehensive error handling for common failure scenarios:

```jsx
function App() {
	const [error, setError] = (useState < string) | (null > null);

	return (
		<div>
			{error && (
				<div style={{ color: 'red', padding: 12, marginBottom: 12 }}>
					Error: {error}
				</div>
			)}
			<WaveformNavigator
				audio="/path/to/audio.mp3"
				width={900}
				height={140}
				onError={(err, type) => {
					console.error(`${type} error:`, err.message);
					setError(err.message);
				}}
				onLoaded={() => {
					setError(null); // Clear error on successful load
				}}
			/>
		</div>
	);
}
```

The `onError` callback receives two parameters:

- **error**: An Error object with a descriptive message
- **type**: Either 'audio' (playback errors) or 'waveform' (visualization errors)

Common error types and their meanings:

- **"Audio format not supported or CORS error"**: The audio file format is not supported by the browser, or cross-origin restrictions are preventing access
- **"Audio decode error: File format may be unsupported or corrupted"**: The audio file could not be decoded (may be corrupted or in an unsupported format)
- **"CORS error: Audio file cannot be loaded due to cross-origin restrictions"**: Cross-Origin Resource Sharing (CORS) policy is blocking access to the audio file
- **"Network error: Unable to fetch audio file"**: Network connectivity issue or the file doesn't exist

When an error occurs, the component displays a user-friendly error overlay on the waveform canvas with an icon and message.

### Responsive Mode (Default)

The component automatically adapts to container width changes:

```jsx
function App() {
	return (
		<div style={{ width: '100%', maxWidth: 1200 }}>
			<WaveformNavigator
				audio="/path/to/audio.mp3"
				height={140}
				// responsive is true by default
			/>
		</div>
	);
}
```

To disable responsive behavior and use fixed width:

```jsx
function App() {
	return (
		<div style={{ width: 900 }}>
			<WaveformNavigator
				audio="/path/to/audio.mp3"
				width={900}
				height={140}
				responsive={false}
			/>
		</div>
	);
}
```

Customize debounce delay for responsive resizing:

```jsx
function App() {
	return (
		<div style={{ width: '100%' }}>
			<WaveformNavigator
				audio="/path/to/audio.mp3"
				height={140}
				responsive={true}
				responsiveDebounceMs={200} // Wait 200ms before recomputing
			/>
		</div>
	);
}
```

## Web Worker and Performance

### How Peak Computation Works

The component uses a Web Worker to compute waveform peaks off the main thread for better performance, especially with large audio files. The worker processes audio data in chunks and streams partial results back, enabling progressive waveform rendering.

**Key features:**

- **Automatic fallback:** If Web Workers are not supported or worker creation fails (e.g., due to CSP restrictions), the component automatically falls back to main-thread computation.
- **Immediate display:** Initial peaks are computed synchronously on the main thread for instant display, then refined by the worker.
- **No blocking:** The worker runs asynchronously, keeping the UI responsive during peak computation.

### Bundler Configuration

**Default Behavior:** The component uses an inline worker that is bundled directly into the library (as a base64-encoded data URL). This works out of the box with all modern bundlers and requires no additional configuration. The worker code is automatically extracted and executed in a separate thread when needed.

The component is designed to work with modern bundlers that support `new URL(..., import.meta.url)` syntax for worker bundling.

#### Vite (Recommended - Works Out of the Box)

Vite automatically handles Web Worker bundling with no additional configuration needed:

```jsx
import WaveformNavigator from 'waveform-navigator';

function App() {
	return (
		<WaveformNavigator audio="/path/to/audio.mp3" width={900} height={140} />
	);
}
```

The component will use the inline worker by default, with zero configuration required.

#### Webpack 5

Webpack 5 supports the same syntax as Vite. No additional configuration is required for the bundled worker:

```jsx
import WaveformNavigator from 'waveform-navigator';

function App() {
	return (
		<WaveformNavigator audio="/path/to/audio.mp3" width={900} height={140} />
	);
}
```

#### Rollup

For Rollup, ensure you're using `@rollup/plugin-node-resolve` and your output format supports dynamic imports:

```js
// rollup.config.js
import resolve from '@rollup/plugin-node-resolve';

export default {
	// ... other config
	plugins: [
		resolve(),
		// ... other plugins
	],
	output: {
		format: 'esm', // or 'system'
		// ...
	},
};
```

#### Custom Worker Hosting

In most cases, you don't need to use custom worker hosting. However, if you have specific requirements (e.g., strict Content Security Policy that blocks data URLs, or you want to host the worker on a CDN), you can provide a custom worker URL:

```jsx
import WaveformNavigator from 'waveform-navigator';

function App() {
	return (
		<WaveformNavigator
			audio="/path/to/audio.mp3"
			width={900}
			height={140}
			workerUrl="https://cdn.example.com/peaks.worker.js"
		/>
	);
}
```

**Note:** The compiled worker file is available at `dist/peaks.worker.js` in the published package for custom hosting scenarios.

### Forcing Main-Thread Computation

For debugging or environments where Web Workers are problematic, you can force main-thread computation:

```jsx
import WaveformNavigator from 'waveform-navigator';

function App() {
	return (
		<WaveformNavigator
			audio="/path/to/audio.mp3"
			width={900}
			height={140}
			forceMainThread={true}
		/>
	);
}
```

### Fallback Behavior

The component automatically detects and handles worker failures:

1. **Worker supported and created successfully:** Peak computation runs in worker (default behavior)
2. **Worker not supported:** Falls back to main-thread computation with a console warning
3. **Worker creation fails (CSP, CORS, etc.):** Falls back to main-thread computation with a console warning
4. **`forceMainThread={true}` provided:** Skips worker creation entirely and uses main-thread

In all cases, the waveform is rendered correctly—worker usage is a performance optimization, not a requirement.

## Accessibility

The waveform component is designed to be fully accessible to keyboard users and screen readers.

### Keyboard Navigation

The waveform can be focused and controlled entirely via keyboard:

| Key                    | Action                                                          |
| ---------------------- | --------------------------------------------------------------- |
| **Tab**                | Focus the waveform control                                      |
| **Arrow Left**         | Seek backward by small step (default: 5 seconds)                |
| **Arrow Right**        | Seek forward by small step (default: 5 seconds)                 |
| **Page Up**            | Seek backward by large step (default: 10% of duration)          |
| **Page Down**          | Seek forward by large step (default: 10% of duration)           |
| **Home**               | Jump to the start of the audio                                  |
| **End**                | Jump to the final moments of the audio (seeks close to the end) |
| **Space** or **Enter** | Toggle play/pause                                               |

### Screen Reader Support

- The waveform is exposed as a slider control (`role="slider"`) to assistive technologies
- Current time and duration are announced via `aria-valuetext` (e.g., "2:30 of 4:43")
- The control has an accessible name via `aria-label` (default: "Audio waveform seek bar")
- `aria-valuenow`, `aria-valuemin`, and `aria-valuemax` provide the numeric state

### Focus Indicators

- When focused via keyboard, the waveform displays a high-contrast blue outline
- The focus indicator meets WCAG AA contrast requirements
- Uses `:focus-visible` to show focus only for keyboard navigation (not mouse clicks)

### Customizing Accessibility

```jsx
<WaveformNavigator
	audio="/audio.mp3"
	ariaLabel="Podcast episode waveform"
	keyboardSmallStep={10} // Seek 10 seconds with arrow keys
	keyboardLargeStep={60} // Seek 60 seconds with PageUp/PageDown
	disableKeyboardControls={false} // Set true to disable built-in keyboard handling
/>
```

### Color Contrast

The default colors meet WCAG AA contrast requirements:

- Focus outline: `#0066cc` against white backgrounds (`#ffffff`, contrast ratio ≈4.54:1)
- Playhead: `#ff4d4f` (red) is visible against the waveform
- Hover tooltip: `rgba(17,24,39,0.95)` background with white text (contrast ratio 15:1)

For custom themes, ensure your colors maintain sufficient contrast for accessibility.

## Build and Development

### Building the Package

The package is built using Vite in library mode, which produces optimized ESM and CJS outputs along with TypeScript declarations.

```bash
# Build the library
npm run build

# Build in watch mode (useful during development)
npm run build:watch

# Run demo app alongside watch mode
npm run dev
```

#### Build Outputs

The build process generates the following files in `dist/`:

- **`index.mjs`** - ES module build (for modern bundlers and Node.js with ESM)
- **`index.cjs`** - CommonJS build (for older bundlers and Node.js with CJS)
- **`index.d.ts`** - TypeScript type declarations
- **`styles.css`** - Component styles (must be imported separately)
- **`peaks.worker.js`** - Compiled Web Worker script (for custom hosting scenarios)
- **Source maps** - For debugging (`.map` files)

### Package Exports

The package uses the modern `exports` field for proper ESM/CJS support and TypeScript types:

```json
{
	"main": "./dist/index.cjs",
	"module": "./dist/index.mjs",
	"types": "./dist/index.d.ts",
	"exports": {
		".": {
			"import": {
				"types": "./dist/index.d.ts",
				"default": "./dist/index.mjs"
			},
			"require": {
				"types": "./dist/index.d.ts",
				"default": "./dist/index.cjs"
			}
		},
		"./styles.css": "./dist/styles.css"
	}
}
```

This configuration ensures that:

- **ESM consumers** (modern bundlers, Node.js with `"type": "module"`) get the `.mjs` file
- **CJS consumers** (older Node.js, some bundlers) get the `.cjs` file
- **TypeScript users** get proper type definitions automatically
- **Bundlers** can perform optimal tree-shaking (package is marked with `"sideEffects": ["*.css"]`)

### Available Import Patterns

```jsx
// Default import (recommended)
import WaveformNavigator from 'waveform-navigator'

// Named import also available
import { WaveformNavigator } from 'waveform-navigator'

// Import styles
import 'waveform-navigator/styles.css'

// TypeScript types
import type { WaveformNavigatorProps } from 'waveform-navigator'
```

### Publishing

Before publishing to npm:

1. Ensure all changes are committed
2. Update version in `package.json` (e.g., `npm version patch/minor/major`)
3. Run `npm run build` to create fresh build outputs
4. Run `npm publish`

The package includes automated safeguards:

- The `prepare` script automatically runs the build before publishing, ensuring the latest code is always published
- The `prepublishOnly` script runs type-checking and tests before allowing a publish, preventing broken releases

### Available Scripts

```bash
# Build the library (cleans dist, builds main library + worker)
npm run build

# Clean build artifacts
npm run clean

# Type-check without emitting files
npm run type-check

# Run tests
npm test

# Build in watch mode (useful during development)
npm run build:watch

# Run demo app alongside watch mode
npm run dev
```

### Development Setup

To work on this package:

**Prerequisites:**

- Node.js 20+ (required for development dependencies)
- The package itself supports Node.js 14+ for consumers

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Run demo app for testing changes
cd demo
npm install
npm run dev
```

The demo app imports the library from the parent directory, allowing you to test changes in a real application context.

## Notes

- This package expects a modern browser with `AudioContext` support.
- For remote audio URLs, ensure CORS is enabled to allow waveform decoding.
- In controlled mode, the component will sync the audio element's currentTime when `controlledCurrentTime` changes (with a threshold of 0.01 seconds to avoid feedback loops).
- The `onCurrentTimeChange` callback is only fired in uncontrolled mode (when `controlledCurrentTime` is undefined).
- **Canvas is HiDPI-aware.** The component automatically renders sharp waveforms on Retina displays and high-DPI devices (devicePixelRatio > 1). No extra work required from the consumer.
- **Responsive by default.** The component uses `ResizeObserver` to automatically adjust to container width changes. When the container is resized, the waveform recomputes peaks from the cached audio buffer without re-fetching the audio file.
- **Fallback for older browsers.** If `ResizeObserver` is not available (older browsers), a console warning is logged and the component falls back to using the fixed `width` prop.
- **Performance.** Peak resampling on resize is debounced (default 150ms) to avoid excessive computation during continuous resizing. The audio buffer is cached in memory to enable fast resampling without re-decoding.

## Troubleshooting

### CORS Errors

**Problem:** You see errors like "CORS error: Audio file cannot be loaded due to cross-origin restrictions" or "Audio format not supported or CORS error".

**Solution:** The component requires CORS to be properly configured when loading audio from remote URLs. This is necessary because the Web Audio API needs to decode the audio data to generate the waveform visualization.

**How to fix:**

1. **Server-side (Recommended):** Configure your server to include proper CORS headers:

   ```
   Access-Control-Allow-Origin: *
   # Or specify your domain:
   Access-Control-Allow-Origin: https://yourdomain.com
   ```

2. **Proxy through your backend:** If you don't control the audio server, proxy the audio through your own backend that adds CORS headers.

3. **For development:** Use a local development server that serves audio files with CORS headers, or use a CORS proxy service (not recommended for production).

4. **File objects:** If possible, use File objects from `<input type="file">` instead of remote URLs to avoid CORS issues entirely.

**Note:** The component sets `crossOrigin="anonymous"` on the audio element automatically. If your server requires credentials for CORS, you'll need to modify the component or proxy the requests.

### Audio Decoding Errors

**Problem:** You see "Audio decode error" or "Audio format not supported" messages.

**Causes:**

- The audio file is corrupted or incomplete
- The file format is not supported by the browser
- The file extension doesn't match the actual audio format

**Solutions:**

1. **Verify the file:** Ensure the audio file plays correctly in your browser by opening it directly
2. **Check browser support:** Use widely supported formats like MP3, WAV, or OGG. Check [MDN's audio format compatibility table](https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Audio_codecs)
3. **Re-encode the file:** Use tools like FFmpeg to convert to a compatible format:
   ```bash
   ffmpeg -i input.audio -acodec libmp3lame -ab 192k output.mp3
   ```
4. **Check Content-Type:** Ensure your server sends the correct `Content-Type` header (e.g., `audio/mpeg` for MP3, `audio/wav` for WAV)

### Safari and iOS Limitations

**Problem:** Audio playback doesn't start, or you see AudioContext-related errors on Safari/iOS.

**Important Safari/iOS Behavior:**

Safari and iOS have special restrictions for audio playback to prevent unwanted sounds and conserve battery:

1. **User Gesture Requirement:** On Safari (especially iOS), audio playback and AudioContext must be initiated by a user gesture (click, tap, etc.). The browser will block playback that starts without user interaction.

2. **AudioContext Suspended State:** When you create an AudioContext on iOS Safari outside of a user gesture context, it will typically start in a "suspended" state. You should always check its state before attempting to resume it:

   ```jsx
   function App() {
     const audioRef = useRef<HTMLAudioElement | null>(null);

     const handleUserGesture = async () => {
       // Resume AudioContext on user gesture (required for Safari/iOS)
       const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
       if (AudioContextClass) {
         const tempCtx = new AudioContextClass();
         if (tempCtx.state === 'suspended') {
           await tempCtx.resume();
         }
         tempCtx.close();
       }

       // Now the audio element can play
       if (audioRef.current) {
         audioRef.current.play();
       }
     };

     return (
       <div>
         <button onClick={handleUserGesture}>Start Audio</button>
         <WaveformNavigator
           audio="/path/to/audio.mp3"
           audioElementRef={audioRef}
         />
       </div>
     );
   }
   ```

3. **Best Practices for Safari/iOS:**
   - Always initiate playback through a user action (button click, tap, etc.)
   - Display a "Tap to play" or "Enable audio" button before attempting playback
   - Handle the `play()` promise rejection gracefully when autoplay is blocked
   - Test your implementation on actual iOS devices, not just Safari on macOS

4. **Low Power Mode:** iOS Low Power Mode may further restrict audio playback

**More information:**

- [Apple's Web Audio Best Practices](https://developer.apple.com/documentation/webkit/delivering_video_content_for_safari)
- [MDN: Autoplay guide for media and Web Audio APIs](https://developer.mozilla.org/en-US/docs/Web/Media/Autoplay_guide)

### Network Errors

**Problem:** "Network error: Unable to fetch audio file" or fetch failures.

**Solutions:**

1. Verify the URL is correct and accessible
2. Check network connectivity
3. Ensure the server is running and responding
4. Check for firewall or security software blocking the request
5. Verify the file exists at the specified path

### Performance Issues with Large Files

**Problem:** The waveform takes a long time to load or the UI becomes unresponsive.

**Solutions:**

1. **Use Web Worker (default):** The component uses a Web Worker by default for peak computation. Ensure you haven't disabled it with `forceMainThread={true}`.
2. **Optimize audio files:** Use compressed formats (MP3, OGG) instead of uncompressed (WAV, AIFF).
3. **Reduce file size:** Lower the bitrate or sample rate of your audio files if waveform quality is more important than audio quality.
4. **Adjust responsive debounce:** Increase `responsiveDebounceMs` to reduce recomputation frequency during resizing.

## Development

### Running Tests

This project includes comprehensive test coverage with unit tests, integration tests, and visual regression tests.

#### Unit Tests

Run unit tests with Vitest:

```bash
# Run tests once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Open Vitest UI
npm run test:ui
```

Unit tests cover:

- Utility functions (formatTime, peaksComputation, syncCanvasSize)
- Custom React hooks
- Component rendering logic

#### Integration and E2E Tests

Run integration tests with Playwright:

```bash
# Run all e2e tests
npm run e2e

# Run with UI mode (interactive)
npm run e2e:ui

# Run in headed mode (see browser)
npm run e2e:headed

# Debug tests
npm run e2e:debug
```

Integration tests cover:

- Audio loading and playback
- Seek/click-to-seek functionality
- Responsive resizing behavior
- Event callbacks
- Accessibility (a11y) with axe-core

#### Visual Regression Tests

Visual tests capture canvas snapshots and compare them to baselines:

```bash
# Run visual tests
npm run e2e -- e2e/visual.spec.ts

# Update visual snapshots (when making intentional visual changes)
npm run visual:update
```

Visual tests verify:

- Waveform rendering at DPR 1 and DPR 2
- Consistent rendering at different viewport widths
- Correct aspect ratios and canvas dimensions

**Updating Visual Snapshots:**

When you make intentional changes to the visual appearance of the waveform:

1. Run `npm run visual:update` to generate new baseline snapshots
2. Review the new snapshots in `e2e/__snapshots__/`
3. Commit the updated snapshots to version control
4. CI will use these baselines for future visual regression checks

### Type Checking and Linting

```bash
# Type check with TypeScript
npm run type-check

# Lint (currently runs type-check)
npm run lint
```

### Code Formatting

This project uses Prettier for code formatting with the following configuration:

- Tabs for indentation
- Always use semicolons
- Single quotes for strings

```bash
# Format all files
npm run format

# Check if files are formatted correctly
npm run format:check
```

The repository includes VS Code settings that automatically format files on save. For other editors, install the Prettier extension and configure it to format on save.

### Building

```bash
# Build the library
npm run build

# Build in watch mode
npm run build:watch
```

### CI/CD

This project uses GitHub Actions for continuous integration. The CI pipeline runs on every push and pull request:

- **Lint and Type Check:** Validates code quality and type safety
- **Unit Tests:** Runs unit tests with coverage reporting (Node 20)
- **Integration Tests:** Runs e2e tests with Playwright
- **Visual Tests:** Compares visual snapshots against baselines
- **Build:** Ensures the library builds successfully

Coverage reports are uploaded to Codecov, and test artifacts (screenshots, reports) are available for failed runs.

### Test Coverage

The project maintains these coverage thresholds:

- **Lines:** 70%
- **Functions:** 70%
- **Branches:** 70%
- **Statements:** 70%

Run `npm run test:coverage` to generate a detailed coverage report in the `coverage/` directory.
