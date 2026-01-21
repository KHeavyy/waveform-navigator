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
- **`width`** (number, default: 800): Width of the waveform canvas in pixels.
- **`height`** (number, default: 120): Height of the waveform canvas in pixels.
- **`className`** (string, default: ''): Additional CSS class name for the container.

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

## Notes

- This package expects a modern browser with `AudioContext` support.
- For remote audio URLs, ensure CORS is enabled to allow waveform decoding.
- In controlled mode, the component will sync the audio element's currentTime when `controlledCurrentTime` changes (with a threshold of 0.01 seconds to avoid feedback loops).
- The `onCurrentTimeChange` callback is only fired in uncontrolled mode (when `controlledCurrentTime` is undefined).
- **Canvas is HiDPI-aware.** The component automatically renders sharp waveforms on Retina displays and high-DPI devices (devicePixelRatio > 1). No extra work required from the consumer.
