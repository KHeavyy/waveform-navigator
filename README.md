# waveform-navigator

A small React component to render an audio waveform and provide navigation + playback controls.

Quick usage:

1. Install (when published):

```
npm install waveform-navigator
```

2. Example usage in a React app:

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

Notes:
- This package expects a modern browser with `AudioContext` support.
- For remote audio URLs, ensure CORS is enabled to allow waveform decoding.

Want a TypeScript build, publishing scripts, or a dev example site? Ask and I’ll add them.
