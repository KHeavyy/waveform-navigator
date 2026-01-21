# waveform-navigator

A small React component to render an audio waveform and provide navigation + playback controls.

## Installation

```
npm install waveform-navigator
```

## Basic Usage

```jsx
import React from 'react'
import ReactDOM from 'react-dom'
import WaveformNavigator from 'waveform-navigator'

function App(){
  // `audio` can be a URL string or a `File` object (from an `<input type="file"/>`).
  const url = '/path/to/audio.mp3';
  return <div style={{width: 900}}><WaveformNavigator audio={url} width={900} height={140} /></div>
}

ReactDOM.render(<App/>, document.getElementById('root'))
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
- **`barColor`** (string, default: '#2b6ef6'): Color of the waveform bars.
- **`progressColor`** (string, default: '#0747a6'): Color of the played portion of the waveform.
- **`backgroundColor`** (string, default: 'transparent'): Background color of the waveform canvas.
- **`playheadColor`** (string, default: '#ff4d4f'): Color of the playhead indicator.

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

#### Accessibility Props

- **`keyboardSmallStep`** (number, default: 5): Step size in seconds for small seek operations (ArrowLeft/ArrowRight keys).
- **`keyboardLargeStep`** (number | undefined): Step size in seconds for large seek operations (PageUp/PageDown keys). If not provided, defaults to 10% of the audio duration.
- **`disableKeyboardControls`** (boolean, default: false): Disable built-in keyboard navigation. Set to `true` if you want to implement custom keyboard handling.
- **`ariaLabel`** (string, default: 'Audio waveform seek bar'): Accessible label for the waveform control, announced to screen readers.

## Usage Examples

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
  const audioRef = useRef<HTMLAudioElement>(null);
  
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

The component is designed to work with modern bundlers that support `new URL(..., import.meta.url)` syntax for worker bundling.

#### Vite (Recommended - Works Out of the Box)

Vite automatically handles Web Worker bundling with no additional configuration needed:

```jsx
import WaveformNavigator from 'waveform-navigator';

function App() {
  return <WaveformNavigator audio="/path/to/audio.mp3" width={900} height={140} />;
}
```

#### Webpack 5

Webpack 5 supports the same syntax as Vite. No additional configuration is required for the bundled worker:

```jsx
import WaveformNavigator from 'waveform-navigator';

function App() {
  return <WaveformNavigator audio="/path/to/audio.mp3" width={900} height={140} />;
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
  }
};
```

#### Custom Worker Hosting

If you need to host the worker file separately (e.g., on a CDN or due to bundler constraints), you can provide a custom worker URL:

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

**Note:** The worker file is located at `dist/peaks.worker.js` in the published package.

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

| Key | Action |
|-----|--------|
| **Tab** | Focus the waveform control |
| **Arrow Left** | Seek backward by small step (default: 5 seconds) |
| **Arrow Right** | Seek forward by small step (default: 5 seconds) |
| **Page Up** | Seek backward by large step (default: 10% of duration) |
| **Page Down** | Seek forward by large step (default: 10% of duration) |
| **Home** | Jump to the start of the audio |
| **End** | Jump to the final moments of the audio (seeks close to the end) |
| **Space** or **Enter** | Toggle play/pause |

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
  keyboardSmallStep={10}  // Seek 10 seconds with arrow keys
  keyboardLargeStep={60}  // Seek 60 seconds with PageUp/PageDown
  disableKeyboardControls={false}  // Set true to disable built-in keyboard handling
/>
```

### Color Contrast

The default colors meet WCAG AA contrast requirements:
- Focus outline: `#0066cc` against white backgrounds (`#ffffff`, contrast ratio ≈4.54:1)
- Playhead: `#ff4d4f` (red) is visible against the waveform
- Hover tooltip: `rgba(17,24,39,0.95)` background with white text (contrast ratio 15:1)

For custom themes, ensure your colors maintain sufficient contrast for accessibility.

## Notes

- This package expects a modern browser with `AudioContext` support.
- For remote audio URLs, ensure CORS is enabled to allow waveform decoding.
- In controlled mode, the component will sync the audio element's currentTime when `controlledCurrentTime` changes (with a threshold of 0.01 seconds to avoid feedback loops).
- The `onCurrentTimeChange` callback is only fired in uncontrolled mode (when `controlledCurrentTime` is undefined).
- **Canvas is HiDPI-aware.** The component automatically renders sharp waveforms on Retina displays and high-DPI devices (devicePixelRatio > 1). No extra work required from the consumer.
- **Responsive by default.** The component uses `ResizeObserver` to automatically adjust to container width changes. When the container is resized, the waveform recomputes peaks from the cached audio buffer without re-fetching the audio file.
- **Fallback for older browsers.** If `ResizeObserver` is not available (older browsers), a console warning is logged and the component falls back to using the fixed `width` prop.
- **Performance.** Peak resampling on resize is debounced (default 150ms) to avoid excessive computation during continuous resizing. The audio buffer is cached in memory to enable fast resampling without re-decoding.
